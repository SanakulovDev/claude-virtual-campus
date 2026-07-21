'use client';

import { useCampusStore } from '../../stores/campusStore';
import { summarizeTimelineEntry } from '../../selectors/activity-summary.selector';
import type { TimelineEntry } from '../../lib/types';

const MAJOR_TYPES = new Set(['user_prompt_submit', 'stop', 'tool_failed', 'session_start', 'session_end', 'subagent_start']);

/** Contextual bottom strip: agent-scoped, else project-scoped, else campus-level major
 * events only. Hidden entirely when there's nothing worth showing. Expandable. */
export function ContextTimeline() {
  const timeline = useCampusStore((s) => s.timeline);
  const selection = useCampusStore((s) => s.selection);
  const expanded = useCampusStore((s) => s.ui.timelineExpanded);
  const toggle = useCampusStore((s) => s.toggleTimelineExpanded);

  let scope: 'agent' | 'project' | 'campus';
  let entries: TimelineEntry[];
  if (selection.selectedAgentId) {
    scope = 'agent';
    entries = timeline.filter((e) => e.agentId === selection.selectedAgentId);
  } else if (selection.selectedProjectId) {
    scope = 'project';
    entries = timeline.filter((e) => e.projectId === selection.selectedProjectId);
  } else {
    scope = 'campus';
    entries = timeline.filter((e) => MAJOR_TYPES.has(e.normalizedType));
  }

  if (entries.length === 0) return null;

  const scopeLabel = scope === 'agent' ? 'Agent log' : scope === 'project' ? 'Project log' : 'Lab log';

  return (
    <div className="panel pointer-events-auto border-t border-white/10">
      <div className="flex items-center gap-3 px-3 py-1.5">
        <span className="flex-none font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{scopeLabel}</span>
        {!expanded && (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {entries.slice(0, 24).map((e) => (
              <span key={e.id} className="flex-none rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                {summarizeTimelineEntry(e)}
              </span>
            ))}
          </div>
        )}
        <button onClick={toggle} className="ml-auto flex-none rounded px-2 py-0.5 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-100">
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {expanded && (
        <ul className="max-h-48 overflow-y-auto px-3 pb-2">
          {entries.slice(0, 100).map((e) => (
            <li key={e.id} className="flex justify-between border-b border-white/5 py-1 font-mono text-[11px] text-slate-400">
              <span>{summarizeTimelineEntry(e)}</span>
              <span className="text-slate-600">{new Date(e.receivedAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
