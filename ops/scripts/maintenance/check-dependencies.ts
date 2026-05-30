import { spawnSync } from "node:child_process";

type OutdatedPackage = {
  current?: string;
  wanted?: string;
  latest?: string;
};

type AllowedOutdatedPackage = {
  latestMajor: number;
  name: string;
  reason: string;
  stableMajor: number;
};

type VersionParts = [number, number, number];

const allowedOutdatedPackages: AllowedOutdatedPackage[] = [
  {
    latestMajor: 10,
    name: "eslint",
    reason: "ESLint 10 currently breaks the React plugin chain bundled by eslint-config-next.",
    stableMajor: 9,
  },
];

function parseOutdatedPackages(output: string) {
  if (!output.trim()) return new Map<string, OutdatedPackage>();

  const parsed = JSON.parse(output) as Record<string, OutdatedPackage>;
  return new Map(Object.entries(parsed));
}

function parseMajor(version: string | undefined) {
  const match = version?.match(/^(\d+)/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function parseVersionParts(version: string | undefined): VersionParts | null {
  const match = version?.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match?.[1] || !match[2] || !match[3]) return null;

  return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10)];
}

function compareVersions(left: VersionParts, right: VersionParts) {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }

  return 0;
}

function isCurrentAtLeastLatest(details: OutdatedPackage) {
  const current = parseVersionParts(details.current);
  const latest = parseVersionParts(details.latest);
  if (!current || !latest) return false;

  return compareVersions(current, latest) >= 0;
}

function isAllowedOutdatedPackage(name: string, details: OutdatedPackage) {
  const allowed = allowedOutdatedPackages.find((candidate) => candidate.name === name);
  if (!allowed) return false;

  return parseMajor(details.current) === allowed.stableMajor && parseMajor(details.wanted) === allowed.stableMajor && parseMajor(details.latest) === allowed.latestMajor;
}

function runNpmOutdated() {
  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd", "outdated", "--json"], {
      encoding: "utf8",
    });
  }

  return spawnSync("npm", ["outdated", "--json"], {
    encoding: "utf8",
  });
}

const result = runNpmOutdated();

if (result.error) {
  console.error(`Failed to inspect dependency freshness: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0 && result.status !== 1) {
  console.error(result.stderr || `npm outdated exited with status ${result.status ?? 1}`);
  process.exit(result.status ?? 1);
}

const outdatedPackages = parseOutdatedPackages(result.stdout);
const unexpectedOutdated = [...outdatedPackages.entries()]
  .filter(([, details]) => !isCurrentAtLeastLatest(details))
  .filter(([name, details]) => !isAllowedOutdatedPackage(name, details))
  .sort(([left], [right]) => left.localeCompare(right));

if (unexpectedOutdated.length > 0) {
  console.error("Unexpected outdated dependencies found:");
  for (const [name, details] of unexpectedOutdated) {
    console.error(`- ${name}: current ${details.current ?? "unknown"}, wanted ${details.wanted ?? "unknown"}, latest ${details.latest ?? "unknown"}`);
  }
  process.exit(1);
}

if (outdatedPackages.size > 0) {
  console.log("Dependency freshness check passed with documented compatibility holds:");
  for (const allowed of allowedOutdatedPackages) {
    if (outdatedPackages.has(allowed.name)) {
      console.log(`- ${allowed.name}: ${allowed.reason}`);
    }
  }
} else {
  console.log("Dependencies are current.");
}
