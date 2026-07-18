/** Single source of truth for the API bind host -- main.ts listens on it and the runs
 * endpoint refuses to spawn on anything non-loopback. Sharing the resolution prevents
 * the guard drifting from the real bind. */
export function resolveApiHost(): string {
  return process.env.API_HOST ?? '127.0.0.1';
}

export function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}
