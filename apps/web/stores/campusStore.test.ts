import { describe, expect, it, beforeEach } from 'vitest';
import { useCampusStore } from './campusStore';
import type { ProjectRow, TimelineEntry } from '../lib/types';

function makeProject(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 'p1',
    projectKey: 'path:abc',
    name: 'demo',
    rootPath: '/tmp/demo',
    remoteUrl: null,
    isGitRepository: true,
    roomTemplate: 'SMALL',
    roomPositionX: 0,
    roomPositionZ: 0,
    technologies: [],
    modules: [],
    agents: [],
    ...overrides,
  };
}

beforeEach(() => {
  useCampusStore.setState({
    connectionStatus: 'connecting',
    projects: {},
    approvals: {},
    timeline: [],
    camera: { mode: 'campus', focusedProjectId: null, followedAgentId: null },
    selection: { selectedProjectId: null, selectedAgentId: null },
    ui: { dockCollapsed: false, inspectorOpen: false, timelineExpanded: false, developerDetails: false, ambientLifeEnabled: true },
  });
});

describe('campusStore', () => {
  it('bootstraps projects and timeline from a snapshot', () => {
    const project = makeProject();
    const event: TimelineEntry = { id: 'e1', projectId: 'p1', hookEventName: 'Stop', normalizedType: 'stop', toolName: null, receivedAt: new Date().toISOString() };
    useCampusStore.getState().bootstrapCampus([project], [event]);
    expect(useCampusStore.getState().projects.p1).toEqual(project);
    expect(useCampusStore.getState().timeline).toHaveLength(1);
  });

  it('renders an empty state when no projects exist', () => {
    expect(Object.keys(useCampusStore.getState().projects)).toHaveLength(0);
  });

  it('upserts a project by id', () => {
    const project = makeProject();
    useCampusStore.getState().upsertProject(project);
    expect(useCampusStore.getState().projects.p1?.name).toBe('demo');
    useCampusStore.getState().upsertProject({ ...project, name: 'renamed' });
    expect(useCampusStore.getState().projects.p1?.name).toBe('renamed');
  });

  it('handles an unknown-technology project safely', () => {
    const project = makeProject({ technologies: [] });
    useCampusStore.getState().upsertProject(project);
    expect(useCampusStore.getState().projects.p1?.technologies).toEqual([]);
  });

  it('upserts an agent into its project, adding it if new', () => {
    useCampusStore.getState().upsertProject(makeProject());
    useCampusStore.getState().upsertAgent('a1', 'p1', {
      id: 'a1',
      projectId: 'p1',
      externalAgentId: 'main-claude',
      agentType: 'main-claude',
      displayName: 'Main Claude',
      status: 'active',
      activity: 'coding',
      currentZoneKey: 'development-desk',
      currentTaskId: null,
      currentSessionId: 's1',
      lastSeenAt: new Date().toISOString(),
    });
    expect(useCampusStore.getState().projects.p1?.agents).toHaveLength(1);
    expect(useCampusStore.getState().projects.p1?.agents[0]?.activity).toBe('coding');
  });

  it('deduplicates timeline events by id', () => {
    const event: TimelineEntry = { id: 'e1', projectId: 'p1', hookEventName: 'Stop', normalizedType: 'stop', toolName: null, receivedAt: new Date().toISOString() };
    useCampusStore.getState().addTimelineEvent(event);
    useCampusStore.getState().addTimelineEvent(event);
    expect(useCampusStore.getState().timeline).toHaveLength(1);
  });

  it('tracks approval request and resolution', () => {
    useCampusStore.getState().requestApproval({ id: 'ap1', projectId: 'p1', toolName: 'Bash', safeSummary: 'rm -rf /tmp', commandCategory: 'destructive', status: 'PENDING', requestedAt: new Date().toISOString() });
    expect(useCampusStore.getState().approvals.ap1?.status).toBe('PENDING');
    useCampusStore.getState().resolveApproval('ap1', 'DENIED');
    expect(useCampusStore.getState().approvals.ap1?.status).toBe('DENIED');
  });

  it('drives selection and camera actions', () => {
    useCampusStore.getState().selectProject('p1');
    useCampusStore.getState().focusProjectRoom('p1');
    expect(useCampusStore.getState().camera.mode).toBe('room');
    useCampusStore.getState().followAgent('a1');
    expect(useCampusStore.getState().camera.mode).toBe('follow');
    useCampusStore.getState().stopFollowingAgent();
    expect(useCampusStore.getState().camera.mode).toBe('room');
    useCampusStore.getState().returnToCampus();
    expect(useCampusStore.getState().camera.mode).toBe('campus');
  });
});

describe('inspector / dock UI behaviour', () => {
  function seedAgent() {
    useCampusStore.getState().upsertProject(makeProject());
    useCampusStore.getState().upsertAgent('a1', 'p1', {
      id: 'a1',
      projectId: 'p1',
      externalAgentId: 'main-claude',
      agentType: 'main-claude',
      displayName: 'Main Claude',
      status: 'active',
      activity: 'coding',
      currentZoneKey: 'development-desk',
      currentTaskId: null,
      currentSessionId: 's1',
      lastSeenAt: new Date().toISOString(),
    });
  }

  it('keeps the inspector closed until something is selected', () => {
    expect(useCampusStore.getState().ui.inspectorOpen).toBe(false);
  });

  it('opens the inspector when a project is selected', () => {
    useCampusStore.getState().selectProject('p1');
    expect(useCampusStore.getState().ui.inspectorOpen).toBe(true);
    expect(useCampusStore.getState().selection.selectedProjectId).toBe('p1');
  });

  it('selecting an agent opens the inspector and resolves its project', () => {
    seedAgent();
    useCampusStore.getState().selectAgent('a1');
    expect(useCampusStore.getState().ui.inspectorOpen).toBe(true);
    expect(useCampusStore.getState().selection.selectedAgentId).toBe('a1');
    expect(useCampusStore.getState().selection.selectedProjectId).toBe('p1');
  });

  it('closeInspector clears selection and closes the drawer', () => {
    useCampusStore.getState().selectProject('p1');
    useCampusStore.getState().closeInspector();
    expect(useCampusStore.getState().ui.inspectorOpen).toBe(false);
    expect(useCampusStore.getState().selection.selectedProjectId).toBeNull();
  });

  it('returning to campus deselects and closes the inspector', () => {
    useCampusStore.getState().selectProject('p1');
    useCampusStore.getState().returnToCampus();
    expect(useCampusStore.getState().ui.inspectorOpen).toBe(false);
    expect(useCampusStore.getState().selection.selectedProjectId).toBeNull();
    expect(useCampusStore.getState().camera.mode).toBe('campus');
  });

  it('toggles the dock', () => {
    expect(useCampusStore.getState().ui.dockCollapsed).toBe(false);
    useCampusStore.getState().toggleDock();
    expect(useCampusStore.getState().ui.dockCollapsed).toBe(true);
  });
});
