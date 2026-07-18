'use client';

/** True when the page runs as a wall/desk display (?kiosk=1): HUD hidden, camera
 * auto-directed, no pointer input expected. Read once -- kiosk devices don't navigate. */
export function useKioskMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('kiosk') === '1';
}
