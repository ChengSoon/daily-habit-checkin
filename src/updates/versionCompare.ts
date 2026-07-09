export type ComparableVersion = {
  version: string;
  buildNumber?: number | null;
};

function normalizeVersion(version: string): number[] {
  const clean = version.trim().replace(/^v/i, "").split("-")[0] ?? "";

  return clean.split(".").map((segment) => {
    const parsed = Number.parseInt(segment, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export function isRemoteNewer(remote: ComparableVersion, current: ComparableVersion): boolean {
  const versionResult = compareVersions(remote.version, current.version);
  return versionResult > 0;
}
