/** Presentation identity only; the legacy index must never assign financials. */
export function reportSnapshotRowKey(
  placementId: string,
  snapshot: { reinsurerId: string; closingId?: string },
  snapshotIndex: number,
): string {
  const identity =
    snapshot.closingId != null ? `closing:${snapshot.closingId}` : `legacy-index:${snapshotIndex}`;
  return `${placementId}:${snapshot.reinsurerId}:${identity}`;
}
