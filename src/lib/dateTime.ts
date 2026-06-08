function toTimestampMs(value: string): number {
  const timestampMs = Date.parse(value);

  return Number.isFinite(timestampMs) ? timestampMs : Number.NEGATIVE_INFINITY;
}

export function compareDateTimeDesc(left: string, right: string): number {
  const leftTimestampMs = toTimestampMs(left);
  const rightTimestampMs = toTimestampMs(right);

  if (leftTimestampMs === rightTimestampMs) {
    return 0;
  }

  return rightTimestampMs > leftTimestampMs ? 1 : -1;
}
