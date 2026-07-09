'use client';

import { useCampusStore } from '../../stores/campusStore';
import { apiUrl } from '../../lib/socket';

export function ApprovalPanel() {
  const approvals = useCampusStore((s) => s.approvals);
  const pending = Object.values(approvals).filter((a) => a.status === 'PENDING');

  if (pending.length === 0) return null;

  async function resolve(id: string, decision: 'allow' | 'deny') {
    await fetch(apiUrl(`/api/approvals/${id}/${decision}`), { method: 'POST' });
  }

  return (
    <div className="absolute bottom-16 right-3 w-80 space-y-2">
      {pending.map((approval) => (
        <div key={approval.id} className="rounded border border-rose-700 bg-rose-950/90 p-3 text-sm shadow-lg">
          <div className="font-medium text-rose-200">Approval requested</div>
          <div className="text-xs text-rose-300">{approval.safeSummary}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => resolve(approval.id, 'allow')} className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600">
              Allow once
            </button>
            <button onClick={() => resolve(approval.id, 'deny')} className="rounded bg-rose-700 px-2 py-1 text-xs hover:bg-rose-600">
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
