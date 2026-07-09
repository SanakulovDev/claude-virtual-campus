'use client';

import { useCampusStore } from '../../stores/campusStore';

export function TimelinePanel() {
  const timeline = useCampusStore((s) => s.timeline);

  return (
    <div className="flex h-full items-center gap-2 overflow-x-auto border-t border-slate-800 bg-slate-950 px-3 py-1.5 text-xs">
      {timeline.length === 0 && <span className="text-slate-500">No events yet.</span>}
      {timeline.slice(0, 40).map((entry) => (
        <span key={entry.id} className="whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-slate-300">
          {entry.normalizedType}
          {entry.toolName ? ` · ${entry.toolName}` : ''}
        </span>
      ))}
    </div>
  );
}
