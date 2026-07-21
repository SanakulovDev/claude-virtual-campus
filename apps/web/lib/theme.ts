import type { SimplifiedAgentVisualState } from '../selectors/visual-state.selector';

/** Night-ops lab: dark graphite scene, robots with lit status visors, copper brand accent.
 * Shared by the 3D scene and the HTML chrome. No textures -- flat materials + emissives. */
export const PALETTE = {
  sceneBackground: '#0e1116',
  /** Lab shell */
  floor: '#252c39',
  hallwayFloor: '#2c3444',
  laneGlow: '#44546c',
  wall: '#353e4d',
  partition: '#3b4453',
  partitionGlass: '#8fa5bd',
  glassEdge: '#4d5f78',
  /** Workstations */
  deskTop: '#333c4b',
  deskLeg: '#242b37',
  monitor: '#12161d',
  planningTable: '#313a49',
  tableLeg: '#1d232e',
  screenFrame: '#232a37',
  /** Server racks in the core */
  rack: '#272e3b',
  rackFace: '#2e3644',
  /** Robot chassis: light plating over dark joints, status carried by the visor. */
  robotPlating: '#ccd1d9',
  robotJoint: '#3d434e',
  robotDark: '#2a2f38',
  visorBase: '#0b0e13',
  /** Brand accent (Claude copper). */
  accent: '#e0784a',
} as const;

/** Status accents, tuned for the dark scene. Colour is never the only signal -- paired
 * with text + icon in UI, and with pose/beacon in-scene. */
export const STATE_COLOR: Record<SimplifiedAgentVisualState, string> = {
  idle: '#5d6774',
  planning: '#8f83f0',
  working: '#3ecf8e',
  checking: '#f2b23c',
  attention: '#ff5c47',
  completed: '#43d69a',
};

export const STATE_LABEL: Record<SimplifiedAgentVisualState, string> = {
  idle: 'Idle',
  planning: 'Planning',
  working: 'Working',
  checking: 'Checking',
  attention: 'Attention',
  completed: 'Completed',
};

export const STATE_ICON: Record<SimplifiedAgentVisualState, string> = {
  idle: '○',
  planning: '◆',
  working: '●',
  checking: '◐',
  attention: '!',
  completed: '✓',
};

/** drei <Html> defaults to a near-max z-index, which floats 3D labels over the HTML UI
 * chrome. Cap all in-scene labels below the drawers (z-20/30) and dock so panels win. */
export const HTML_Z_RANGE: [number, number] = [15, 0];

/** Role tint for a robot's shoulder markings; main Claude wears the brand copper. */
export function agentBodyColor(agentType: string, externalAgentId: string | null): string {
  if (externalAgentId === 'main-claude' || agentType === 'main-claude') return PALETTE.accent;
  const roleColors: Record<string, string> = {
    'backend-developer': '#c9a15f',
    'frontend-developer': '#5fa8e8',
    'api-developer': '#7fbf7a',
    'database-engineer': '#d97fb0',
    'qa-engineer': '#e0c95f',
    'code-reviewer': '#a58fe0',
    'security-reviewer': '#e08f7a',
    'devops-engineer': '#6fc4bb',
    'infrastructure-engineer': '#b8b06a',
    'documentation-agent': '#9aa3ad',
  };
  return roleColors[agentType] ?? '#8b95a3';
}
