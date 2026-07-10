import type { AgentRow, TimelineEntry } from '../lib/types';

function shortPath(path: string | null | undefined): string {
  if (!path) return '';
  const parts = path.split('/').filter(Boolean);
  return parts.slice(-2).join('/') || path;
}

function shortCommand(summary: string | null | undefined): string {
  if (!summary) return '';
  const trimmed = summary.replace(/\s+/g, ' ').trim();
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}

/**
 * Human-readable one-liner for what an agent is observably doing right now. Never exposes
 * raw hook names, session/agent ids, or classifier internals -- those live in the
 * inspector's Developer Details section only.
 */
export function summarizeAgentAction(agent: AgentRow): string {
  const file = shortPath(agent.currentFile);
  switch (agent.activity) {
    case 'researching':
      return file ? `Reading ${file}` : 'Reading files';
    case 'coding':
      return file ? `Editing ${file}` : 'Editing code';
    case 'formatting':
      return file ? `Formatting ${file}` : 'Formatting code';
    case 'testing':
      return 'Running tests';
    case 'building':
      return 'Building project';
    case 'reviewing':
      return 'Reviewing code';
    case 'running_command':
      return shortCommand(agent.currentCommandSummary) || 'Running a command';
    case 'managing_database':
      return 'Working on the database';
    case 'managing_infrastructure':
      return 'Working on infrastructure';
    case 'planning':
      return 'Planning the task';
    case 'meeting':
      return 'In a planning huddle';
    case 'waiting_approval':
      return 'Waiting for approval';
    case 'blocked':
      return 'Blocked';
    case 'failed':
      return 'Hit a failure';
    case 'completed':
      return 'Task completed';
    case 'walking':
    case 'idle':
    default:
      return 'Idle at desk';
  }
}

const NORMALIZED_TYPE_SUMMARY: Record<string, string> = {
  session_start: 'Session started',
  user_prompt_submit: 'New task received',
  subagent_start: 'Subagent started',
  file_read: 'Reading a file',
  file_edit: 'Editing a file',
  command_run: 'Running a command',
  tool_use: 'Using a tool',
  tool_completed: 'Finished a step',
  tool_failed: 'A step failed',
  notification: 'Waiting for input',
  pre_compact: 'Compacting context',
  subagent_stop: 'Subagent finished',
  stop: 'Task completed',
  session_end: 'Session ended',
};

/** Human-readable label for a timeline row, from its normalized type (never raw payload). */
export function summarizeTimelineEntry(entry: TimelineEntry): string {
  if (!entry.normalizedType) return 'Activity';
  const base = NORMALIZED_TYPE_SUMMARY[entry.normalizedType] ?? entry.normalizedType.replace(/_/g, ' ');
  if (entry.toolName && ['file_read', 'file_edit', 'command_run', 'tool_use'].includes(entry.normalizedType)) {
    return `${base} · ${entry.toolName}`;
  }
  return base;
}
