import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],

  // ── Coverage (c8 / V8 native) ──────────────────────────────────────────────
  // Uses V8's built-in instrumentation — the same engine as the c8 CLI tool.
  // Run with: npm run test:coverage
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/app/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/lib/**/*.{ts,tsx}",
    // Exclude files that are pure config / generated / test infrastructure
    "!src/**/*.d.ts",
    "!src/app/layout.tsx",         // Next.js root layout — no logic to test
    "!src/app/globals.css",
    "!src/instrumentation*.ts",    // Sentry/OTel instrumentation stubs
    "!src/middleware.ts",
  ],
  coverageReporters: [
    "text",        // printed to the terminal after the run
    "html",        // written to coverage/index.html for browsing
    "lcov",        // coverage/lcov.info — consumed by CI / editor plugins
  ],
  coverageDirectory: "coverage",
};

export default createJestConfig(config);
