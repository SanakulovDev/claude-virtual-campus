'use client';

import { useCampusStore } from '../../stores/campusStore';
import { apiUrl } from '../../lib/socket';

/** Floating drawer for pending permission requests. Allow-once / Deny only; destructive
 * actions are never auto-approved (backend enforces, this is just the human decision UI). */
export function ApprovalDrawer() {
  const approvals = useCampusStore((s) => s.approvals);
  const projects = useCampusStore((s) => s.projects);
  const pending = Object.values(approvals).filter((a) => a.status === 'PENDING');

  if (pending.length === 0) return null;

  async function resolve(id: string, decision: 'allow' | 'deny') {
    await fetch(apiUrl(`/api/approvals/${id}/${decision}`), { method: 'POST' }).catch(() => undefined);
  }

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-30 w-80 max-w-[88vw] space-y-2">
      {pending.map((a) => (
        <div key={a.id} className="panel-solid rounded-lg border border-rose-500/40 p-3 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/15 text-xs font-bold text-rose-400">!</span>
            <span className="text-sm font-semibold text-rose-300">Approval needed</span>
            <span className="ml-auto font-mono text-[11px] text-slate-500">{projects[a.projectId]?.name}</span>
          </div>
          <p className="mt-1.5 break-words font-mono text-xs text-slate-300">{a.safeSummary}</p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => resolve(a.id, 'allow')} className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
              Allow once
            </button>
            <button onClick={() => resolve(a.id, 'deny')} className="flex-1 rounded-md bg-rose-600 py-1.5 text-xs font-medium text-white hover:bg-rose-500">
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
