import { TEST_DATABASE_URL } from './database-url';

// Assigned, not defaulted: an exported DATABASE_URL pointing at the real campus must never
// win here, or a test run silently writes rooms into the campus you use.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.CORS_ORIGIN ??= 'http://localhost:3100';
process.env.APPROVAL_TIMEOUT_MS = '1200';
