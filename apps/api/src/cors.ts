const DEFAULT_CORS_ORIGIN = 'http://localhost:3100';

/** Parse an explicit comma-separated origin allowlist for HTTP and Socket.IO. */
export function corsOrigins(value = process.env.CORS_ORIGIN): string | string[] {
  const origins = (value ?? DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0]! : origins;
}
