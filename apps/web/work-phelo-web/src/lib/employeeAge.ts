export const MIN_EMPLOYEE_AGE = 18;

export function isAtLeastMinimumEmployeeAge(
  dateOfBirth: string,
  minimumAge = MIN_EMPLOYEE_AGE,
): boolean {
  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) {
    return false;
  }

  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - dob.getUTCMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }

  return age >= minimumAge;
}
