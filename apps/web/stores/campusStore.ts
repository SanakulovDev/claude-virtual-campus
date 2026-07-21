import { create } from 'zustand';
import type { AgentRow, ApprovalRow, ProjectRow, TimelineEntry, RunRow } from '../lib/types';
import { selectAgentVisualState } from '../selectors/visual-state.selector';

const MAX_TIMELINE_ENTRIES = 200;

interface CameraState {
  mode: 'campus' | 'room' | 'follow';
  focusedProjectId: string | null;
  followedAgentId: string | null;
}

interface SelectionState {
  selectedProjectId: string | null;
  selectedAgentId: string | null;
}

interface UiState {
  dockCollapsed: boolean;
  inspectorOpen: boolean;
  timelineExpanded: boolean;
  developerDetails: boolean;
  ambientLifeEnabled: boolean;
  searchQuery: string;
}

interface CampusStoreState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  projects: Record<string, ProjectRow>;
  approvals: Record<string, ApprovalRow>;
  runs: Record<string, RunRow[]>;
  timeline: TimelineEntry[];
  camera: CameraState;
  selection: SelectionState;
  ui: UiState;
  /** Agents the user has manually put to rest. Cosmetic only; cleared the moment real work
   * arrives (see upsertAgent). Not persisted -- resets on reload, like ambientLifeEnabled. */
  restingAgentIds: Record<string, true>;

  setConnectionStatus: (status: CampusStoreState['connectionStatus']) => void;
  bootstrapCampus: (projects: ProjectRow[], recentEvents: TimelineEntry[]) => void;
  upsertProject: (project: ProjectRow) => void;
  removeProject: (projectId: string) => void;
  upsertAgent: (agentId: string, projectId: string, patch: Partial<AgentRow>) => void;
  toggleAgentRest: (agentId: string) => void;
  restAllIdle: () => void;
  wakeAllBots: () => void;
  addTimelineEvent: (entry: TimelineEntry) => void;
  requestApproval: (approval: ApprovalRow) => void;
  resolveApproval: (approvalId: string, status: ApprovalRow['status']) => void;
  setProjectRuns: (projectId: string, runs: RunRow[]) => void;
  upsertRun: (run: RunRow) => void;
  selectProject: (projectId: string | null) => void;
  selectAgent: (agentId: string | null) => void;
  focusProjectRoom: (projectId: string) => void;
  followAgent: (agentId: string) => void;
  stopFollowingAgent: () => void;
  returnToCampus: () => void;
  closeInspector: () => void;
  toggleDock: () => void;
  toggleTimelineExpanded: () => void;
  toggleDeveloperDetails: () => void;
  toggleAmbientLife: () => void;
  setSearchQuery: (query: string) => void;
}

function projectIdForAgent(projects: Record<string, ProjectRow>, agentId: string): string | null {
  for (const project of Object.values(projects)) {
    if (project.agents.some((a) => a.id === agentId)) return project.id;
  }
  return null;
}

export const useCampusStore = create<CampusStoreState>((set) => ({
  connectionStatus: 'connecting',
  projects: {},
  approvals: {},
  runs: {},
  timeline: [],
  camera: { mode: 'campus', focusedProjectId: null, followedAgentId: null },
  selection: { selectedProjectId: null, selectedAgentId: null },
  // Ambient idle life defaults OFF: robots on standby hold their station instead of
  // wandering. The top-bar toggle still turns it on for anyone who wants the cosmetics.
  ui: { dockCollapsed: false, inspectorOpen: false, timelineExpanded: false, developerDetails: false, ambientLifeEnabled: false, searchQuery: '' },
  restingAgentIds: {},

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  bootstrapCampus: (projects, recentEvents) =>
    set(() => ({
      projects: Object.fromEntries(projects.map((p) => [p.id, p])),
      timeline: recentEvents.slice(0, MAX_TIMELINE_ENTRIES),
    })),

  upsertProject: (project) =>
    set((state) => {
      // Live project:created/updated events carry a bare row with no relation arrays.
      // Merge so an update never wipes the agents/technologies/modules we already have.
      const existing = state.projects[project.id];
      const merged: ProjectRow = {
        ...existing,
        ...project,
        agents: project.agents ?? existing?.agents ?? [],
        technologies: project.technologies ?? existing?.technologies ?? [],
        modules: project.modules ?? existing?.modules ?? [],
      };
      return { projects: { ...state.projects, [project.id]: merged } };
    }),

  removeProject: (projectId) =>
    set((state) => {
      const removed = state.projects[projectId];
      if (!removed) return state;
      const { [projectId]: _dropped, ...projects } = state.projects;
      const { [projectId]: _droppedRuns, ...runs } = state.runs;

      // Drop any resting flags for agents that no longer exist.
      const removedAgentIds = new Set(removed.agents.map((a) => a.id));
      const restingAgentIds = { ...state.restingAgentIds };
      removedAgentIds.forEach((id) => delete restingAgentIds[id]);

      // If the camera was in this room (or following one of its agents), return to overview.
      const cameraInRoom =
        state.camera.focusedProjectId === projectId ||
        (state.camera.followedAgentId != null && removedAgentIds.has(state.camera.followedAgentId));
      const camera = cameraInRoom
        ? { mode: 'campus' as const, focusedProjectId: null, followedAgentId: null }
        : state.camera;

      const selectionCleared = state.selection.selectedProjectId === projectId;
      return {
        projects,
        runs,
        restingAgentIds,
        camera,
        selection: selectionCleared ? { selectedProjectId: null, selectedAgentId: null } : state.selection,
        ui: selectionCleared ? { ...state.ui, inspectorOpen: false } : state.ui,
      };
    }),

  upsertAgent: (agentId, projectId, patch) =>
    set((state) => {
      const project = state.projects[projectId];
      if (!project) return state;
      const agents = project.agents.some((a) => a.id === agentId)
        ? project.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a))
        : [...project.agents, patch as AgentRow];

      // Real work always wins: a resting bot wakes the moment it is no longer idle.
      let restingAgentIds = state.restingAgentIds;
      const merged = agents.find((a) => a.id === agentId);
      if (merged && restingAgentIds[agentId] && selectAgentVisualState(merged) !== 'idle') {
        const next = { ...restingAgentIds };
        delete next[agentId];
        restingAgentIds = next;
      }

      return { projects: { ...state.projects, [projectId]: { ...project, agents } }, restingAgentIds };
    }),

  toggleAgentRest: (agentId) =>
    set((state) => {
      const restingAgentIds = { ...state.restingAgentIds };
      if (restingAgentIds[agentId]) delete restingAgentIds[agentId];
      else restingAgentIds[agentId] = true;
      return { restingAgentIds };
    }),

  restAllIdle: () =>
    set((state) => {
      const restingAgentIds = { ...state.restingAgentIds };
      for (const project of Object.values(state.projects)) {
        for (const agent of project.agents) {
          if (selectAgentVisualState(agent) === 'idle') restingAgentIds[agent.id] = true;
        }
      }
      return { restingAgentIds };
    }),

  wakeAllBots: () => set({ restingAgentIds: {} }),

  addTimelineEvent: (entry) =>
    set((state) => {
      if (state.timeline.some((e) => e.id === entry.id)) return state;
      return { timeline: [entry, ...state.timeline].slice(0, MAX_TIMELINE_ENTRIES) };
    }),

  requestApproval: (approval) =>
    set((state) => ({ approvals: { ...state.approvals, [approval.id]: approval } })),

  resolveApproval: (approvalId, status) =>
    set((state) => {
      const existing = state.approvals[approvalId];
      if (!existing) return state;
      return { approvals: { ...state.approvals, [approvalId]: { ...existing, status } } };
    }),

  setProjectRuns: (projectId, runs) =>
    set((state) => ({ runs: { ...state.runs, [projectId]: runs } })),

  upsertRun: (run) =>
    set((state) => {
      const list = state.runs[run.projectId] ?? [];
      const exists = list.some((r) => r.id === run.id);
      const next = exists ? list.map((r) => (r.id === run.id ? run : r)) : [run, ...list];
      return { runs: { ...state.runs, [run.projectId]: next.slice(0, 20) } };
    }),

  selectProject: (projectId) =>
    set((state) => ({
      selection: { selectedProjectId: projectId, selectedAgentId: null },
      ui: { ...state.ui, inspectorOpen: projectId != null },
    })),

  selectAgent: (agentId) =>
    set((state) => {
      if (agentId == null) {
        return { selection: { ...state.selection, selectedAgentId: null } };
      }
      const projectId = projectIdForAgent(state.projects, agentId) ?? state.selection.selectedProjectId;
      return {
        selection: { selectedProjectId: projectId, selectedAgentId: agentId },
        ui: { ...state.ui, inspectorOpen: true },
      };
    }),

  focusProjectRoom: (projectId) =>
    set({ camera: { mode: 'room', focusedProjectId: projectId, followedAgentId: null } }),

  followAgent: (agentId) =>
    set((state) => ({ camera: { ...state.camera, mode: 'follow', followedAgentId: agentId } })),

  stopFollowingAgent: () =>
    set((state) => ({ camera: { ...state.camera, mode: 'room', followedAgentId: null } })),

  returnToCampus: () =>
    set((state) => ({
      camera: { mode: 'campus', focusedProjectId: null, followedAgentId: null },
      selection: { selectedProjectId: null, selectedAgentId: null },
      ui: { ...state.ui, inspectorOpen: false },
    })),

  closeInspector: () =>
    set((state) => ({
      selection: { selectedProjectId: null, selectedAgentId: null },
      ui: { ...state.ui, inspectorOpen: false },
    })),

  toggleDock: () => set((state) => ({ ui: { ...state.ui, dockCollapsed: !state.ui.dockCollapsed } })),
  toggleTimelineExpanded: () => set((state) => ({ ui: { ...state.ui, timelineExpanded: !state.ui.timelineExpanded } })),
  toggleDeveloperDetails: () => set((state) => ({ ui: { ...state.ui, developerDetails: !state.ui.developerDetails } })),
  toggleAmbientLife: () => set((state) => ({ ui: { ...state.ui, ambientLifeEnabled: !state.ui.ambientLifeEnabled } })),
  setSearchQuery: (query) => set((state) => ({ ui: { ...state.ui, searchQuery: query } })),
}));
