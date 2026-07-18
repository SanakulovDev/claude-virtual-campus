'use client';

import { useState } from 'react';
import { useCampusStore } from '../../stores/campusStore';
import { selectProjectVisualState } from '../../selectors/project-status.selector';
import { installProject } from '../../lib/socket';

const CONNECT_COMMAND = 'campus install';

/** "Add project": connects a real project by installing campus hooks on a local path (the
 * server touches only .claude/). The room still appears on the first real Claude event, so
 * this invents nothing. The terminal command stays as a fallback. */
function AddProjectPopover() {
  const [open, setOpen] = useState(false);
  const [pathValue, setPathValue] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; message?: string }>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(CONNECT_COMMAND).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const connect = () => {
    const target = pathValue.trim();
    if (!target) return;
    setStatus({ kind: 'busy' });
    installProject(target)
      .then(() => setStatus({ kind: 'ok', message: 'Connected. Run `claude` there and the room appears.' }))
      .catch((e: Error) => setStatus({ kind: 'error', message: e.message }));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100"
      >
        + Add project
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-lg">
          <p className="text-[12px] font-medium text-slate-800">Connect a project</p>
          <p className="mt-1 text-[11px] text-slate-500">Paste the project&apos;s full path and connect it from here:</p>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              value={pathValue}
              onChange={(e) => setPathValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connect()}
              placeholder="/Users/me/Developer/my-project"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-sky-500"
              aria-label="Project path"
            />
            <button
              onClick={connect}
              disabled={status.kind === 'busy' || pathValue.trim() === ''}
              className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {status.kind === 'busy' ? '…' : 'Connect'}
            </button>
          </div>
          {status.message && (
            <p className={`mt-1.5 text-[10px] ${status.kind === 'error' ? 'text-rose-500' : 'text-emerald-600'}`}>{status.message}</p>
          )}
          <div className="mt-2.5 border-t border-slate-100 pt-2">
            <p className="text-[10px] text-slate-400">Or run it in a terminal, in any language:</p>
            <div className="mt-1 flex items-center gap-1.5">
              <code className="flex-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-800">{CONNECT_COMMAND}</code>
              <button onClick={copy} className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100">
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CONNECTION = {
  connected: { color: '#12a150', label: 'Connected (Stable)' },
  connecting: { color: '#c98a1e', label: 'Connecting…' },
  disconnected: { color: '#d6483a', label: 'Disconnected' },
} as const;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-[13px] text-slate-500">
      {label}: <span className="font-semibold text-slate-800 tabular-nums">{value}</span>
    </span>
  );
}

/** Premium light top bar: brand, live connection, spelled-out counts, search, alerts. */
export function CampusTopBar() {
  const connectionStatus = useCampusStore((s) => s.connectionStatus);
  const projects = useCampusStore((s) => s.projects);
  const approvals = useCampusStore((s) => s.approvals);
  const returnToCampus = useCampusStore((s) => s.returnToCampus);
  const toggleDock = useCampusStore((s) => s.toggleDock);
  const ambientLifeEnabled = useCampusStore((s) => s.ui.ambientLifeEnabled);
  const toggleAmbientLife = useCampusStore((s) => s.toggleAmbientLife);
  const restingCount = useCampusStore((s) => Object.keys(s.restingAgentIds).length);
  const restAllIdle = useCampusStore((s) => s.restAllIdle);
  const wakeAllBots = useCampusStore((s) => s.wakeAllBots);
  const query = useCampusStore((s) => s.ui.searchQuery);
  const setQuery = useCampusStore((s) => s.setSearchQuery);

  const list = Object.values(projects);
  const activeProjects = list.filter((p) => selectProjectVisualState(p.agents) !== 'idle').length;
  const totalAgents = list.reduce((sum, p) => sum + p.agents.length, 0);
  const pending = Object.values(approvals).filter((a) => a.status === 'PENDING').length;
  const conn = CONNECTION[connectionStatus];

  return (
    <header className="panel relative z-40 flex h-14 flex-none items-center justify-between border-b border-slate-200/80 px-3">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDock}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-800"
          aria-label="Toggle project dock"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 3.5h12M2 8h12M2 12.5h12" strokeLinecap="round" />
          </svg>
        </button>
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#d97a4a] to-[#c9612e] text-white shadow-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.4 6.4L21 11l-6.6 2.6L12 20l-2.4-6.4L3 11l6.6-2.6z" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">Claude Virtual Campus</span>
        </span>
        <span className="ml-1 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: conn.color }} />
            <span className="inline-flex h-2 w-2 rounded-full" style={{ background: conn.color }} />
          </span>
          {conn.label}
        </span>
      </div>

      <div className="hidden items-center gap-6 md:flex">
        <Stat label="Active Projects" value={activeProjects} />
        <Stat label="Total Agents" value={totalAgents} />
      </div>

      <div className="flex items-center gap-2.5">
        <label className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1.5 text-slate-400 focus-within:border-slate-300 lg:flex">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-28 bg-transparent text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
            aria-label="Search projects and agents"
          />
        </label>

        <AddProjectPopover />

        <button
          onClick={() => (restingCount > 0 ? wakeAllBots() : restAllIdle())}
          title="Cosmetic only: rests idle bots. Any real Claude activity wakes them instantly."
          className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
            restingCount > 0
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-slate-100'
          }`}
        >
          {restingCount > 0 ? `Wake all (${restingCount})` : 'Rest idle bots'}
        </button>

        <button
          onClick={toggleAmbientLife}
          aria-pressed={ambientLifeEnabled}
          title="Ambient idle life is cosmetic only and never counts as real Claude work"
          className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
            ambientLifeEnabled
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-slate-100'
          }`}
        >
          Ambient life: {ambientLifeEnabled ? 'on' : 'off'}
        </button>

        <button
          className="relative rounded-lg border border-slate-200 bg-white/70 p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label={pending > 0 ? `${pending} pending approvals` : 'Notifications'}
          onClick={returnToCampus}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1.8a3.4 3.4 0 00-3.4 3.4c0 3.2-1.2 4.2-1.2 4.2h9.2s-1.2-1-1.2-4.2A3.4 3.4 0 008 1.8zM6.6 12a1.4 1.4 0 002.8 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {pending > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {pending}
            </span>
          )}
        </button>

        <button
          onClick={returnToCampus}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-slate-800"
        >
          Campus Overview
        </button>
      </div>
    </header>
  );
}
