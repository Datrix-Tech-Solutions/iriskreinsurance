import { format, differenceInDays, isWeekend, addDays } from 'date-fns';

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current)) count++;
    current = addDays(current, 1);
  }
  return count;
}

export function daysBetween(start: Date, end: Date): number {
  return differenceInDays(end, start);
}
