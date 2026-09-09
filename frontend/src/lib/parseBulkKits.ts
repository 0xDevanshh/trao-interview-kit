export interface BulkKitEntry {
  jd: string;
  company_url: string;
  days: number;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function parseCsv(text: string): BulkKitEntry[] {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV must have a header row (jd,company_url,days) plus at least one data row.");
  }

  const header = parseCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const jdIndex = header.indexOf("jd");
  const urlIndex = header.indexOf("company_url");
  const daysIndex = header.indexOf("days");

  if (jdIndex === -1 || urlIndex === -1 || daysIndex === -1) {
    throw new Error('CSV header must include "jd", "company_url", and "days" columns.');
  }

  return lines.slice(1).map((line, rowIndex) => {
    const fields = parseCsvLine(line);
    const jd = fields[jdIndex]?.trim() ?? "";
    const company_url = fields[urlIndex]?.trim() ?? "";
    const days = Number(fields[daysIndex]?.trim());

    if (!jd || !company_url || !Number.isInteger(days) || days <= 0) {
      throw new Error(`Row ${rowIndex + 2} is missing a jd/company_url or has an invalid days value.`);
    }

    return { jd, company_url, days };
  });
}

function parseJson(text: string): BulkKitEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("JSON file must be an array of { jd, company_url, days } objects.");
  }

  return parsed.map((entry, index) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as Record<string, unknown>).jd !== "string" ||
      typeof (entry as Record<string, unknown>).company_url !== "string" ||
      typeof (entry as Record<string, unknown>).days !== "number"
    ) {
      throw new Error(`Entry ${index + 1} must have string "jd"/"company_url" and a numeric "days".`);
    }

    const { jd, company_url, days } = entry as { jd: string; company_url: string; days: number };

    if (!jd || !company_url || !Number.isInteger(days) || days <= 0) {
      throw new Error(`Entry ${index + 1} is missing a jd/company_url or has an invalid days value.`);
    }

    return { jd, company_url, days };
  });
}

/**
 * Supports two bulk formats, chosen by file extension:
 * - .json: an array of { jd, company_url, days } objects.
 * - .csv: a header row (jd,company_url,days) followed by one row per kit.
 *   Fields containing commas must be quoted, e.g. "We need someone with
 *   Node.js, TypeScript, and Postgres experience".
 */
export function parseBulkInput(text: string, filename: string): BulkKitEntry[] {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".json")) {
    return parseJson(text);
  }
  if (lower.endsWith(".csv")) {
    return parseCsv(text);
  }

  throw new Error("Unsupported file type — please upload a .json or .csv file.");
}
