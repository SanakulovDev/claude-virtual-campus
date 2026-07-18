'use client';

import { useEffect, useState } from 'react';

/**
 * True when the page runs as a wall/desk display (?kiosk=1): HUD hidden, camera
 * auto-directed, no pointer input expected. Resolved in an effect, not during render:
 * the server always renders non-kiosk, so reading location.search while hydrating makes
 * the first client render disagree with the server HTML (React #418/#423). The one-frame
 * HUD flash on a kiosk device is the accepted cost.
 */
export function useKioskMode(): boolean {
  const [kiosk, setKiosk] = useState(false);
  useEffect(() => {
    setKiosk(new URLSearchParams(window.location.search).get('kiosk') === '1');
  }, []);
  return kiosk;
}
