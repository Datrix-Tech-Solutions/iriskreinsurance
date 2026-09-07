/** Unwraps an endorsement snapshot's nested placement, falling back to the record itself. */
export function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

/** Reads the participants array off an endorsement snapshot, if present. */
export function getSnapshotParticipants(
  snapshot: Record<string, unknown>,
): Record<string, unknown>[] {
  const ps = snapshot.participants;
  return Array.isArray(ps) ? (ps as Record<string, unknown>[]) : [];
}
