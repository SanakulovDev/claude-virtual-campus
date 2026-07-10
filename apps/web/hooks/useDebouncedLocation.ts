'use client';

import { useEffect, useRef, useState } from 'react';
import type { StudioLocationKey } from '../selectors/visual-state.selector';
import { MOVEMENT_DEBOUNCE_MS } from '../selectors/movement';

/**
 * Commits a new studio location only after it has stayed stable for a short window, so a
 * burst of backend events can't make an agent thrash between locations. 'attention' commits
 * immediately (urgent). Because every "working" activity already maps to 'desk', ordinary
 * tool bursts never even start the timer.
 */
export function useDebouncedLocation(desired: StudioLocationKey): StudioLocationKey {
  const [committed, setCommitted] = useState<StudioLocationKey>(desired);
  const committedRef = useRef(committed);
  committedRef.current = committed;

  useEffect(() => {
    if (desired === committedRef.current) return undefined;
    if (desired === 'attention') {
      setCommitted(desired);
      return undefined;
    }
    const timer = setTimeout(() => setCommitted(desired), MOVEMENT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [desired]);

  return committed;
}
