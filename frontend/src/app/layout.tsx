import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TRAO",
  description: "TRAO interview kit",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold text-foreground">
              TRAO
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/login"
                className="text-muted hover:text-foreground"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="text-muted hover:text-foreground"
              >
                Register
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
