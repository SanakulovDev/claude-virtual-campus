import type { SimplifiedAgentVisualState } from '../selectors/visual-state.selector';

/** Shared visual system for the 3D scene and the HTML chrome. Light architectural-model
 * scene framed by dark glass UI. No textures -- flat reusable materials only. */
export const PALETTE = {
  sceneBackground: '#e9ebee',
  ground: '#d5d8dd',
  grass: '#9cb36e',
  grassEdge: '#8aa25e',
  earth: '#a07d55',
  earthDark: '#7c5c3c',
  path: '#cdbfa2',
  hubPlatform: '#cdc7bb',
  hubAccent: '#b7b0a2',
  studioPlatform: '#ece8e0',
  studioWall: '#f4f1ec',
  studioTrim: '#dcd6ca',
  deskWood: '#c9a67d',
  deskWoodDark: '#b28a5c',
  monitor: '#23272f',
  planningTable: '#d7cfc1',
  tableLeg: '#9c917f',
  reviewFrame: '#2b303a',
  glass: '#bcd4e0',
  foliage: '#6f8f5f',
  pot: '#8a6f57',
  avatarBody: '#eae6de',
  avatarSkin: '#e7c6a5',
  /** Robot chassis system: painted plating (per role) over dark joints, with a lit optic. */
  robotJoint: '#4a5160',
  robotServo: '#6d7480',
  robotTrim: '#c2c7cf',
  robotVisor: '#1d2733',
  /** Agent Lab office system: warm wood + white walls + glass partitions. */
  officeFloor: '#c9a87c',
  hallwayFloor: '#b8946a',
  wall: '#f2efe9',
  partition: '#e4dfd6',
  partitionGlass: '#cfe0e8',
  doorTrim: '#8a7a64',
  rug: '#7f9c8f',
  sofa: '#7a8fa6',
  coffeeMachine: '#3a3f47',
  screenFrame: '#2b303a',
  pants: '#4a5160',
  skinTones: ['#e7c6a5', '#d9a97f', '#c68d5e', '#a96f45', '#8a5a36'],
  hairColors: ['#2f2a26', '#5b4632', '#8a6f4d', '#b5b0a8', '#c2703f', '#1d1d1f'],
} as const;

/** Subtle status accents. Colour is never the only signal -- paired with text + icon in UI. */
export const STATE_COLOR: Record<SimplifiedAgentVisualState, string> = {
  idle: '#9aa3ad',
  planning: '#8b7fd6',
  working: '#4f9d69',
  checking: '#d69a3c',
  attention: '#d6604f',
  completed: '#4bb07a',
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

/** Deterministic accent hue for a project, from its stable key. */
export function projectAccent(projectKey: string): string {
  let hash = 0;
  for (let i = 0; i < projectKey.length; i += 1) {
    hash = (hash * 31 + projectKey.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 55%, 60%)`;
}

/** Simple role tint for subagent avatars; main Claude stays neutral. */
export function agentBodyColor(agentType: string, externalAgentId: string | null): string {
  if (externalAgentId === 'main-claude' || agentType === 'main-claude') return PALETTE.avatarBody;
  const roleColors: Record<string, string> = {
    'backend-developer': '#cbb28f',
    'frontend-developer': '#a9c1d6',
    'api-developer': '#b9cdb2',
    'database-engineer': '#d6b3c4',
    'qa-engineer': '#d8ca8f',
    'code-reviewer': '#c3b7d9',
    'security-reviewer': '#d6b0a6',
    'devops-engineer': '#b0c9c4',
    'infrastructure-engineer': '#c9c3a8',
    'documentation-agent': '#c7c2b8',
  };
  return roleColors[agentType] ?? '#d3cec4';
}
