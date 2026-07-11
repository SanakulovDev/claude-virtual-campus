import { create } from 'zustand';
import type { AgentRow, ApprovalRow, ProjectRow, TimelineEntry } from '../lib/types';

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
  timeline: TimelineEntry[];
  camera: CameraState;
  selection: SelectionState;
  ui: UiState;

  setConnectionStatus: (status: CampusStoreState['connectionStatus']) => void;
  bootstrapCampus: (projects: ProjectRow[], recentEvents: TimelineEntry[]) => void;
  upsertProject: (project: ProjectRow) => void;
  upsertAgent: (agentId: string, projectId: string, patch: Partial<AgentRow>) => void;
  addTimelineEvent: (entry: TimelineEntry) => void;
  requestApproval: (approval: ApprovalRow) => void;
  resolveApproval: (approvalId: string, status: ApprovalRow['status']) => void;
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
  timeline: [],
  camera: { mode: 'campus', focusedProjectId: null, followedAgentId: null },
  selection: { selectedProjectId: null, selectedAgentId: null },
  ui: { dockCollapsed: false, inspectorOpen: false, timelineExpanded: false, developerDetails: false, ambientLifeEnabled: true, searchQuery: '' },

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

  upsertAgent: (agentId, projectId, patch) =>
    set((state) => {
      const project = state.projects[projectId];
      if (!project) return state;
      const agents = project.agents.some((a) => a.id === agentId)
        ? project.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a))
        : [...project.agents, patch as AgentRow];
      return { projects: { ...state.projects, [projectId]: { ...project, agents } } };
    }),

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
