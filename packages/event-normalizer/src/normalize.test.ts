import { describe, expect, it } from 'vitest';
import { normalizeHookEvent } from './normalize';

const base = { session_id: 'session-1', cwd: '/repo' };

describe('normalizeHookEvent runtime-neutral hooks', () => {
  it('normalizes Codex apply_patch as a file edit', () => {
    const event = normalizeHookEvent({
      ...base,
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_use_id: 'tool-1',
      tool_input: { command: '*** Begin Patch\n*** Update File: src/app.ts\n@@\n-old\n+new\n*** End Patch' },
    }, '/repo');

    expect(event).toMatchObject({
      normalizedType: 'file_edit',
      activity: 'coding',
      filePath: 'src/app.ts',
      fileCategory: 'source',
    });
  });

  it('uses native Codex subagent lifecycle events', () => {
    const start = normalizeHookEvent({
      ...base,
      hook_event_name: 'SubagentStart',
      agent_id: 'agent-1',
      agent_type: 'code-reviewer',
    }, '/repo');
    expect(start).toMatchObject({ normalizedType: 'subagent_start', isSubagentStart: true, activity: 'walking' });
  });

  it('represents PermissionRequest and PostCompact explicitly', () => {
    expect(normalizeHookEvent({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash' }, '/repo'))
      .toMatchObject({ normalizedType: 'permission_request', activity: 'waiting_approval' });
    expect(normalizeHookEvent({ ...base, hook_event_name: 'PostCompact' }, '/repo'))
      .toMatchObject({ normalizedType: 'post_compact' });
  });
});
