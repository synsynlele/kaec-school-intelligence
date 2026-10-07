"use strict";

// Next's compiled ESLint plugin loads this adapter synchronously with require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { globSync } = require("tinyglobby");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isAbsolute, parse } = require("node:path");

// Next 16.3.6 consumes only globSync(pattern, { onlyDirectories: true }).
// Disable globby-style directory expansion to retain fast-glob's exact-root
// behaviour. Keep this adapter scoped to the Next ESLint plugin.
exports.globSync = (patterns, options = {}) => {
  const inputs = Array.isArray(patterns) ? patterns : [patterns];
  const compatiblePatterns = inputs.map((pattern) => pattern.replace(/\/\*\*\/?$/, "/**/*"));
  return globSync(compatiblePatterns, {
    absolute: inputs.some((pattern) => isAbsolute(pattern)),
    ...options,
    expandDirectories: false,
  }).map((path) => path.length > parse(path).root.length ? path.replace(/\/$/, "") : path);
};
