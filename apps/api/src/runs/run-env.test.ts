import { describe, expect, it } from 'vitest';
import { buildRunEnv } from './run-env';

describe('buildRunEnv', () => {
  it('keeps CLI + system vars, drops everything else', () => {
    const env = buildRunEnv({
      PATH: '/usr/bin', HOME: '/home/x', SHELL: '/bin/zsh', LANG: 'en_US.UTF-8',
      ANTHROPIC_API_KEY: 'sk-ant', CLAUDE_CONFIG_DIR: '/c', CAMPUS_HOOK_URL: 'http://127.0.0.1:4000',
      DATABASE_URL: 'postgres://secret', AWS_SECRET_ACCESS_KEY: 'nope', STRIPE_KEY: 'nope',
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/home/x');
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant');
    expect(env.CLAUDE_CONFIG_DIR).toBe('/c');
    expect(env.CAMPUS_HOOK_URL).toBe('http://127.0.0.1:4000');
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.STRIPE_KEY).toBeUndefined();
  });

  it('honors the RUN_ENV_ALLOWLIST extension', () => {
    const env = buildRunEnv({ MY_EXTRA: 'v', RUN_ENV_ALLOWLIST: 'MY_EXTRA' });
    expect(env.MY_EXTRA).toBe('v');
  });

  it('drops empty strings so ${VAR:-} compose passthrough never blanks CLI auth', () => {
    const env = buildRunEnv({ CLAUDE_CODE_OAUTH_TOKEN: '', ANTHROPIC_API_KEY: '', PATH: '/usr/bin' });
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.PATH).toBe('/usr/bin');
  });
});
