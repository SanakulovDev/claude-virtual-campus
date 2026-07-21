/** Single source of truth for the API bind host -- main.ts listens on it and the runs
 * endpoint refuses to spawn on anything non-loopback. Sharing the resolution prevents
 * the guard drifting from the real bind. */
export function resolveApiHost(): string {
  return process.env.API_HOST ?? '127.0.0.1';
}

export function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

/**
 * CORS_ORIGIN is a comma-separated list. `localhost:3200` and `127.0.0.1:3200` are
 * different origins to a browser, so both forms of the web port belong in the list --
 * a single exact string turns "typed the IP instead" into an opaque CORS failure.
 */
export function resolveCorsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Explicit operator opt-in for runs on a non-loopback bind. A container must bind 0.0.0.0
 * to be reachable at all, so the loopback guard cannot tell "exposed to the LAN" from
 * "published on 127.0.0.1 by the port mapping". Only set this where the same config that
 * sets it also constrains exposure (docker-compose.yml publishes every port on 127.0.0.1).
 */
export function allowNonLoopbackRuns(): boolean {
  return process.env.RUNS_ALLOW_NONLOOPBACK === '1';
}
