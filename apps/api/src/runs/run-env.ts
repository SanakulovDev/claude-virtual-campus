/** The child gets an explicit allowlist, never the full environment. A denylist of one
 * variable would leak every unrelated secret in the parent process; this drops them by
 * default. Prefix matches cover the CLI's own config family. */
const EXACT = new Set(['PATH', 'HOME', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR', 'CAMPUS_HOOK_URL']);
const PREFIXES = ['CLAUDE_', 'ANTHROPIC_'];

export function buildRunEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const extra = (source.RUN_ENV_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowExact = new Set([...EXACT, ...extra]);
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (allowExact.has(key) || PREFIXES.some((p) => key.startsWith(p))) out[key] = value;
  }
  return out;
}
