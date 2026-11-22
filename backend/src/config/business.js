// S2-DEV-08: "today" for prices. A price is in effect from its effective date onward, so the
// server has to agree with the staff on what today's date is. The database runs in UTC, which is
// a day behind Manila for the first 8 hours of every day, so we ask Postgres for the date IN the
// company's time zone instead of using its own clock date.
// Change it with BUSINESS_TIMEZONE in the backend .env (any name from the tz list, e.g. Asia/Manila).
export function businessTimeZone() {
  return process.env.BUSINESS_TIMEZONE || 'Asia/Manila';
}

// SQL piece that means "today's date in the company time zone"; give it the placeholder
// that carries businessTimeZone(), e.g. todaySql('$3').
export const todaySql = (placeholder) => `(now() AT TIME ZONE ${placeholder})::date`;
