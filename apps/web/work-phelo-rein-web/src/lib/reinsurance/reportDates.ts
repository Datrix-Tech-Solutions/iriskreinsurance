/** Today as an ISO date string (YYYY-MM-DD), built from local calendar parts so it
 *  matches exactly what the DatePicker/Calendar emits when "today" is picked by hand.
 *  Used to seed the reinsurance reports' end date to the current day. */
export function todayISODate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
}
