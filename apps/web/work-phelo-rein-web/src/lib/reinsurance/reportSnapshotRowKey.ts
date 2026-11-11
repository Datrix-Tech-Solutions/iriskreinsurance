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

/** Expanded settlement rows share their parent placement's page number. */
export function reportPlacementGroupNumber(
  placementId: string,
  groups: ReadonlyArray<{ id: string }>,
  page: number,
  limit: number,
): number {
  const index = groups.findIndex((group) => group.id === placementId);
  if (index < 0) throw new Error('Report row has no placement group');
  return (page - 1) * limit + index + 1;
}
