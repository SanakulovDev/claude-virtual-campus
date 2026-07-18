'use client';

import { useEffect } from 'react';
import { useCampusStore } from '../stores/campusStore';
import { selectAgentVisualState } from '../selectors/visual-state.selector';
import { useKioskMode } from './useKioskMode';

const FOCUS_HOLD_MS = 20_000;   // return to overview this long after the last event
const TICK_MS = 3_000;

/**
 * Kiosk camera automation: attention anywhere wins immediately; otherwise focus the room
 * with the most recent event; after 20s of quiet, pull back to the whole-lab overview.
 * Reads the same store the manual camera uses, so nothing else changes.
 */
export function useKioskDirector(): void {
  const kiosk = useKioskMode();

  useEffect(() => {
    if (!kiosk) return undefined;

    const direct = () => {
      const s = useCampusStore.getState();
      const projects = Object.values(s.projects);

      const attention = projects.find((p) => p.agents.some((a) => selectAgentVisualState(a) === 'attention'));
      if (attention) {
        if (s.camera.focusedProjectId !== attention.id) s.focusProjectRoom(attention.id);
        return;
      }

      const latest = s.timeline[0];
      const fresh = latest && Date.now() - new Date(latest.receivedAt).getTime() < FOCUS_HOLD_MS;
      if (fresh && s.projects[latest.projectId]) {
        if (s.camera.focusedProjectId !== latest.projectId) s.focusProjectRoom(latest.projectId);
        return;
      }

      if (s.camera.mode !== 'campus') s.returnToCampus();
    };

    direct();
    const id = setInterval(direct, TICK_MS);
    return () => clearInterval(id);
  }, [kiosk]);
}
