'use client';

import { useEffect, useState } from 'react';
import type { AmbientActivity } from '@campus/contracts';
import { useCampusStore } from '../stores/campusStore';
import { ambientActivityForAgent } from '../selectors/ambient';
import { selectAgentVisualState } from '../selectors/visual-state.selector';
import type { AgentRow } from '../lib/types';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

const ROTATE_MS = 9000;

/**
 * Ambient activity for one agent, or null. Recomputed from live agent state every render,
 * so a real coding-agent event stops ambient life immediately. Rotates activities over time.
 * Bucket 0 shows nothing, giving a short settle delay before an idle agent wanders off.
 */
export function useAmbientActivity(agent: AgentRow, projectId: string): AmbientActivity | null {
  const enabled = useCampusStore((s) => s.ui.ambientLifeEnabled);
  const approvals = useCampusStore((s) => s.approvals);
  const project = useCampusStore((s) => s.projects[projectId]);
  const reducedMotion = usePrefersReducedMotion();
  const [bucket, setBucket] = useState(0);

  const idle = selectAgentVisualState(agent) === 'idle';
  const roomBlocked =
    Object.values(approvals).some((a) => a.projectId === projectId && a.status === 'PENDING') ||
    (project?.agents ?? []).some((a) => selectAgentVisualState(a) === 'attention');

  useEffect(() => {
    if (!enabled || reducedMotion || !idle || roomBlocked) {
      setBucket(0);
      return;
    }
    const id = setInterval(() => setBucket((b) => b + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [enabled, reducedMotion, idle, roomBlocked]);

  if (bucket === 0) return null;
  return ambientActivityForAgent(agent, { enabled, reducedMotion, roomBlocked }, bucket);
}
