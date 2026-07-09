// ponytail: local-dev default connection string, matches docker-compose.yml; override via env for CI.
process.env.DATABASE_URL ??= 'postgresql://campus:campus@localhost:5433/campus?schema=public';
process.env.CORS_ORIGIN ??= 'http://localhost:3100';
process.env.APPROVAL_TIMEOUT_MS = '1200';
