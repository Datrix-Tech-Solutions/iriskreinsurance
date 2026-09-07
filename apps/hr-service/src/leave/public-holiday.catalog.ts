type HolidaySeedDefinition = {
  name: string;
  date: Date;
  countryScope: string;
  regionScope: string;
  source: string;
};

const GHANA_ALIASES = new Set(['gh', 'gha', 'ghana', 'republic of ghana']);
const GHANA_SCOPE = 'ghana';

function dateAtMidnight(year: number, monthIndex: number, day: number) {
  const value = new Date(year, monthIndex, day);
  value.setHours(0, 0, 0, 0);
  return value;
}

function calculateWesternEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return dateAtMidnight(year, month - 1, day);
}

function getFirstFridayOfDecember(year: number) {
  const value = dateAtMidnight(year, 11, 1);
  while (value.getDay() !== 5) {
    value.setDate(value.getDate() + 1);
  }
  return value;
}

function buildObservedDate(
  date: Date,
  occupied: Set<string>,
  toDateKey: (value: Date) => string,
) {
  const observed = new Date(date);
  observed.setHours(0, 0, 0, 0);

  if (observed.getDay() !== 0 && observed.getDay() !== 6) {
    occupied.add(toDateKey(observed));
    return { observedDate: observed, isObservedShifted: false };
  }

  while (
    observed.getDay() === 0 ||
    observed.getDay() === 6 ||
    occupied.has(toDateKey(observed))
  ) {
    observed.setDate(observed.getDate() + 1);
  }

  occupied.add(toDateKey(observed));
  return { observedDate: observed, isObservedShifted: true };
}

function normalizeCountry(country: string | null | undefined) {
  const normalized = country?.trim().toLowerCase() ?? '';
  return GHANA_ALIASES.has(normalized) ? GHANA_SCOPE : normalized;
}

export type SeededPublicHoliday = HolidaySeedDefinition & {
  observedDate: Date;
  isObservedShifted: boolean;
};

export function getSeededPublicHolidaysForLocation(
  country: string | null | undefined,
  _region: string | null | undefined,
  year: number,
  toDateKey: (value: Date) => string,
): SeededPublicHoliday[] {
  const normalizedCountry = normalizeCountry(country);

  if (normalizedCountry !== GHANA_SCOPE) {
    return [];
  }

  const easterSunday = calculateWesternEasterSunday(year);
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(easterSunday.getDate() - 2);
  goodFriday.setHours(0, 0, 0, 0);

  const easterMonday = new Date(easterSunday);
  easterMonday.setDate(easterSunday.getDate() + 1);
  easterMonday.setHours(0, 0, 0, 0);

  const definitions: HolidaySeedDefinition[] = [
    {
      name: "New Year's Day",
      date: dateAtMidnight(year, 0, 1),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: 'Constitution Day',
      date: dateAtMidnight(year, 0, 7),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: 'Independence Day',
      date: dateAtMidnight(year, 2, 6),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: 'Good Friday',
      date: goodFriday,
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: 'Easter Monday',
      date: easterMonday,
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: 'Labour Day',
      date: dateAtMidnight(year, 4, 1),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: "Founders' Day",
      date: dateAtMidnight(year, 7, 4),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: 'Kwame Nkrumah Memorial Day',
      date: dateAtMidnight(year, 8, 21),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: "Farmers' Day",
      date: getFirstFridayOfDecember(year),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: 'Christmas Day',
      date: dateAtMidnight(year, 11, 25),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
    {
      name: 'Boxing Day',
      date: dateAtMidnight(year, 11, 26),
      countryScope: GHANA_SCOPE,
      regionScope: '',
      source: 'SYSTEM_GHANA',
    },
  ];

  const occupiedObservedDates = new Set<string>();

  return definitions.map((definition) => {
    const { observedDate, isObservedShifted } = buildObservedDate(
      definition.date,
      occupiedObservedDates,
      toDateKey,
    );

    return {
      ...definition,
      observedDate,
      isObservedShifted,
    };
  });
}
