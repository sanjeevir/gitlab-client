export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.js", // Include all JavaScript files in `src/`
    "!src/**/*.test.js", // Exclude test files
  ],
  coverageReporters: ["json", "text", "lcov"],
};
