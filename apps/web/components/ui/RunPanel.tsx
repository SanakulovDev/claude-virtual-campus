'use client';

import { useEffect, useState, useMemo } from 'react';
import { useCampusStore } from '../../stores/campusStore';
import { fetchProjectRuns, startRun, stopRun } from '../../lib/socket';
import type { RunRow } from '../../lib/types';

const STATUS_STYLE: Record<RunRow['status'], { bg: string; fg: string; label: string }> = {
  RUNNING: { bg: '#4f9d6922', fg: '#4f9d69', label: 'Running' },
  COMPLETED: { bg: '#4bb07a22', fg: '#4bb07a', label: 'Completed' },
  FAILED: { bg: '#d6604f22', fg: '#d6604f', label: 'Failed' },
  STOPPED: { bg: '#9aa3ad22', fg: '#9aa3ad', label: 'Stopped' },
};

function RunEntry({ run }: { run: RunRow }) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLE[run.status];
  return (
    <li className="rounded-md border border-slate-200 bg-white p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700" title={run.prompt}>
          {run.prompt}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: style.bg, color: style.fg }}>
          {style.label}
        </span>
        {run.status === 'RUNNING' && (
          <button
            onClick={() => void stopRun(run.id)}
            className="rounded-md border border-rose-200 px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
          >
            Stop
          </button>
        )}
      </div>
      {run.resultText && (
        <button onClick={() => setOpen(!open)} className="mt-1 text-[10px] text-slate-400 hover:text-slate-600">
          {open ? 'Hide result' : 'Show result'}
        </button>
      )}
      {open && run.resultText && (
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[10px] text-slate-600">
          {run.resultText}
        </pre>
      )}
    </li>
  );
}

/**
 * Send a task to this project: spawns a headless Claude run in the project directory via
 * the API. The run's own hooks animate the room; destructive tools still go through the
 * approval drawer. One active run per project.
 */
export function RunPanel({ projectId }: { projectId: string }) {
  const runsData = useCampusStore((s) => s.runs);
  const runs = useMemo(() => runsData[projectId] ?? [], [runsData, projectId]);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const busy = runs.some((r) => r.status === 'RUNNING');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchProjectRuns(projectId);
        if (!cancelled) useCampusStore.getState().setProjectRuns(projectId, list);
      } catch {
        // silently ignore fetch errors (no API in test)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const send = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || busy || sending) return;
    setSending(true);
    setError(null);
    try {
      await startRun(projectId, trimmed);
      setPrompt('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="Give this team a task…"
        className="w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800 placeholder:text-slate-400"
      />
      <button
        onClick={() => void send()}
        disabled={busy || sending || prompt.trim().length === 0}
        className="w-full rounded-md bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? 'A run is active for this project' : sending ? 'Starting…' : 'Send task'}
      </button>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
      {runs.length > 0 && (
        <ul className="space-y-1.5">
          {runs.map((run) => (
            <RunEntry key={run.id} run={run} />
          ))}
        </ul>
      )}
    </div>
  );
}
