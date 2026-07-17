// Integration tests get their own Postgres schema so a test run can never create rooms in --
// or reset -- the campus you actually use. Override for CI or a non-default Postgres.
export const TEST_DATABASE_URL =
  process.env.CAMPUS_TEST_DATABASE_URL ??
  'postgresql://campus:campus@localhost:5433/campus?schema=campus_test';
