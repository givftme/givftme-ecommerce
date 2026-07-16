export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function toDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function isPastDateOnly(value: string) {
  const date = parseDateOnly(value);

  if (!date) {
    return false;
  }

  return date < startOfToday();
}

export function isFutureDateOnly(value: string) {
  const date = parseDateOnly(value);

  if (!date) {
    return false;
  }

  return date > startOfToday();
}

export function isMoreThanFiveYearsAway(value: string) {
  const date = parseDateOnly(value);

  if (!date) {
    return false;
  }

  const limit = startOfToday();
  limit.setFullYear(limit.getFullYear() + 5);

  return date > limit;
}

export function daysFromToday(value: string) {
  const date = parseDateOnly(value);

  if (!date) {
    return 0;
  }

  const diff = date.getTime() - startOfToday().getTime();
  return Math.round(diff / 86_400_000);
}

export function formatOccasionDate(value: string) {
  const date = parseDateOnly(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
    .format(date)
    .replace("Sep ", "Sept ");
}
