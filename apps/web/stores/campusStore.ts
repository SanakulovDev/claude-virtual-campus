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

interface CampusStoreState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  projects: Record<string, ProjectRow>;
  approvals: Record<string, ApprovalRow>;
  timeline: TimelineEntry[];
  camera: CameraState;
  selection: SelectionState;

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
}

export const useCampusStore = create<CampusStoreState>((set) => ({
  connectionStatus: 'connecting',
  projects: {},
  approvals: {},
  timeline: [],
  camera: { mode: 'campus', focusedProjectId: null, followedAgentId: null },
  selection: { selectedProjectId: null, selectedAgentId: null },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  bootstrapCampus: (projects, recentEvents) =>
    set(() => ({
      projects: Object.fromEntries(projects.map((p) => [p.id, p])),
      timeline: recentEvents.slice(0, MAX_TIMELINE_ENTRIES),
    })),

  upsertProject: (project) =>
    set((state) => ({ projects: { ...state.projects, [project.id]: project } })),

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

  selectProject: (projectId) => set((state) => ({ selection: { ...state.selection, selectedProjectId: projectId } })),
  selectAgent: (agentId) => set((state) => ({ selection: { ...state.selection, selectedAgentId: agentId } })),

  focusProjectRoom: (projectId) =>
    set({ camera: { mode: 'room', focusedProjectId: projectId, followedAgentId: null } }),

  followAgent: (agentId) =>
    set((state) => ({ camera: { ...state.camera, mode: 'follow', followedAgentId: agentId } })),

  stopFollowingAgent: () =>
    set((state) => ({ camera: { ...state.camera, mode: 'room', followedAgentId: null } })),

  returnToCampus: () => set({ camera: { mode: 'campus', focusedProjectId: null, followedAgentId: null } }),
}));
