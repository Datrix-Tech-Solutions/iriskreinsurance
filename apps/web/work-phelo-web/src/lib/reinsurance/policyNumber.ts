export const POLICY_NUMBER_FALLBACK = 'TBA';

/** Displays a placement's policy number, or a fallback when it hasn't been set yet. */
export function displayPolicyNumber(policyNumber: string | null | undefined): string {
  return policyNumber ?? POLICY_NUMBER_FALLBACK;
}
