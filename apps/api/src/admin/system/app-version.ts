import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The release version from the monorepo root package.json. The API runs from
 * src/ in development and from a bundled dist/ in production, so walk up until
 * the root package is found, starting from the working directory.
 */
function loadAppVersion(): string | null {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth++) {
    try {
      const pkg = JSON.parse(
        readFileSync(resolve(dir, "package.json"), "utf8"),
      );
      if (pkg?.name === "kaneo" && typeof pkg.version === "string") {
        return pkg.version;
      }
    } catch {
      // Keep walking up.
    }
    dir = resolve(dir, "..");
  }
  return null;
}

let cached: { version: string | null } | undefined;

export function readAppVersion(): string | null {
  cached ??= { version: loadAppVersion() };
  return cached.version;
}
