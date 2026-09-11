/** @type {import('jest').Config} */
export default {
  // NOT the "ts-jest" preset: ts-jest (and ts-node) crash outright under
  // this project's typescript@7.0.2 — its native/Go compiler doesn't
  // expose the classic ts.sys/compiler-program API ts-jest depends on.
  // babel-jest transpiles (no type-checking; that's tsc's job via
  // `npm run build`) and actually works. Confirmed by running both.
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': 'babel-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
};
