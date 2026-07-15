import { describe, expect, it } from 'vitest';
import { mergeSettings, stripOurSettings } from './merge-settings';

describe('mergeSettings', () => {
  it('adds our hooks to an empty settings object', () => {
    const result = mergeSettings({}, { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: '.claude/hooks/send-event.sh' }] }] } });
    expect(result.hooks?.SessionStart).toHaveLength(1);
  });

  it('preserves existing unrelated settings and hooks', () => {
    const existing = { permissions: { allow: ['Bash(ls:*)'] }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'my-other-hook.sh' }] }] } };
    const template = { hooks: { Stop: [{ hooks: [{ type: 'command', command: '.claude/hooks/send-event.sh' }] }] } };
    const result = mergeSettings(existing, template);
    expect(result.permissions).toEqual({ allow: ['Bash(ls:*)'] });
    expect(result.hooks?.Stop).toHaveLength(2);
  });

  it('is idempotent -- merging twice does not duplicate entries', () => {
    const template = { hooks: { Stop: [{ hooks: [{ type: 'command', command: '.claude/hooks/send-event.sh' }] }] } };
    const once = mergeSettings({}, template);
    const twice = mergeSettings(once, template);
    expect(twice.hooks?.Stop).toHaveLength(1);
  });
});

describe('stripOurSettings', () => {
  it('removes only our hook commands, keeping user-added ones', () => {
    const existing = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: '.claude/hooks/send-event.sh' }, { type: 'command', command: 'my-other-hook.sh' }] }],
      },
    };
    const result = stripOurSettings(existing);
    expect(result.hooks?.Stop?.[0]?.hooks).toEqual([{ type: 'command', command: 'my-other-hook.sh' }]);
  });

  it('drops the hooks key entirely once empty', () => {
    const existing = { hooks: { Stop: [{ hooks: [{ type: 'command', command: '.claude/hooks/send-event.sh' }] }] } };
    const result = stripOurSettings(existing);
    expect(result.hooks).toBeUndefined();
  });

  it('removes absolute Codex hook commands', () => {
    const existing = { hooks: { Stop: [{ hooks: [{ type: 'command', command: "'/tmp/my project/.codex/hooks/send-event.sh'" }] }] } };
    expect(stripOurSettings(existing).hooks).toBeUndefined();
  });
});
