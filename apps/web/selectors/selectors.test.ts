import { describe, expect, it } from 'vitest';
import type { AgentActivity } from '@campus/contracts';
import {
  selectAgentVisualState,
  selectAgentLocation,
  selectStudioLocation,
} from './visual-state.selector';
import { selectProjectVisualState } from './project-status.selector';
import { summarizeAgentAction, summarizeTimelineEntry } from './activity-summary.selector';
import { assignDesks } from './desk-assignment';
import { deskLocal } from './office-layout';
import { shouldCommitMove, MOVEMENT_DEBOUNCE_MS } from './movement';
import type { AgentRow, TimelineEntry } from '../lib/types';

function agent(activity: AgentActivity, extra: Partial<AgentRow> = {}): AgentRow {
  return {
    id: extra.id ?? 'a1',
    projectId: 'p1',
    externalAgentId: extra.externalAgentId ?? 'main-claude',
    agentType: 'main-claude',
    displayName: 'Main Claude',
    status: 'active',
    activity,
    currentZoneKey: 'assigned-desk',
    currentTaskId: null,
    currentSessionId: 's1',
    lastSeenAt: new Date().toISOString(),
    ...extra,
  };
}

describe('visual state mapping', () => {
  it.each<[AgentActivity, string]>([
    ['researching', 'working'], // Read
    ['coding', 'working'], // Edit / Write
    ['running_command', 'working'], // generic command
    ['managing_database', 'working'],
    ['testing', 'checking'],
    ['building', 'checking'],
    ['reviewing', 'checking'], // lint routes to reviewing on the backend
    ['waiting_approval', 'attention'], // permission
    ['blocked', 'attention'],
    ['failed', 'attention'], // tool failure
    ['completed', 'completed'],
    ['idle', 'idle'],
    ['planning', 'planning'],
  ])('%s activity -> %s visual state', (activity, expected) => {
    expect(selectAgentVisualState(agent(activity))).toBe(expected);
  });
});

describe('movement / location behaviour', () => {
  it('keeps related working events at the same desk (no destination change)', () => {
    const reads = selectAgentLocation(agent('researching'));
    const edits = selectAgentLocation(agent('coding'));
    const cmd = selectAgentLocation(agent('running_command'));
    expect(reads).toBe('desk');
    expect(edits).toBe('desk');
    expect(cmd).toBe('desk');
  });

  it('moves the agent to the shared review screen when checking begins', () => {
    expect(selectAgentLocation(agent('testing'))).toBe('review-screen');
    expect(selectStudioLocation('checking')).toBe('review-screen');
  });

  it('returns the agent to its desk on completion', () => {
    expect(selectAgentLocation(agent('completed'))).toBe('desk');
  });

  it('does not send attention to a separate room (pauses in place)', () => {
    expect(selectAgentLocation(agent('waiting_approval'))).toBe('attention');
  });

  it('debounces rapid destination changes but commits attention immediately', () => {
    expect(shouldCommitMove('desk', 'review-screen', 100, MOVEMENT_DEBOUNCE_MS)).toBe(false);
    expect(shouldCommitMove('desk', 'review-screen', MOVEMENT_DEBOUNCE_MS + 1, MOVEMENT_DEBOUNCE_MS)).toBe(true);
    expect(shouldCommitMove('desk', 'attention', 0, MOVEMENT_DEBOUNCE_MS)).toBe(true);
    expect(shouldCommitMove('desk', 'desk', 9999, MOVEMENT_DEBOUNCE_MS)).toBe(false);
  });

  it('gives multiple agents distinct desk positions', () => {
    const positions = [0, 1, 2, 3].map((i) => deskLocal(i).join(','));
    expect(new Set(positions).size).toBe(4);
  });

  it('assigns main-claude the first desk deterministically', () => {
    const assigned = assignDesks([
      agent('idle', { id: 'zzz', externalAgentId: 'sub' }),
      agent('idle', { id: 'aaa', externalAgentId: 'main-claude' }),
    ]);
    expect(assigned[0]?.agent.externalAgentId).toBe('main-claude');
    expect(assigned[0]?.deskIndex).toBe(0);
  });
});

describe('project status aggregation', () => {
  it('is idle when there are no agents', () => {
    expect(selectProjectVisualState([])).toBe('idle');
  });

  it('surfaces the most urgent agent state', () => {
    expect(selectProjectVisualState([agent('coding'), agent('waiting_approval')])).toBe('attention');
    expect(selectProjectVisualState([agent('coding'), agent('testing')])).toBe('checking');
    expect(selectProjectVisualState([agent('idle'), agent('completed')])).toBe('completed');
  });
});

describe('activity summaries (human readable, no raw payloads)', () => {
  it('summarizes agent actions', () => {
    expect(summarizeAgentAction(agent('researching', { currentFile: 'app/services/payment.py' }))).toBe(
      'Reading services/payment.py',
    );
    expect(summarizeAgentAction(agent('testing'))).toBe('Running tests');
    expect(summarizeAgentAction(agent('waiting_approval'))).toBe('Waiting for approval');
  });

  it('summarizes timeline entries without exposing hook names', () => {
    const entry: TimelineEntry = {
      id: 'e1',
      projectId: 'p1',
      hookEventName: 'PreToolUse',
      normalizedType: 'command_run',
      toolName: 'Bash',
      receivedAt: new Date().toISOString(),
    };
    expect(summarizeTimelineEntry(entry)).toContain('Running a command');
  });
});
