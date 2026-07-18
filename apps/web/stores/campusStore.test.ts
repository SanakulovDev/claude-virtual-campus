import { describe, expect, it, beforeEach } from 'vitest';
import { useCampusStore } from './campusStore';
import type { AgentRow, ProjectRow, TimelineEntry, RunRow } from '../lib/types';

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
    runs: {},
    timeline: [],
    camera: { mode: 'campus', focusedProjectId: null, followedAgentId: null },
    selection: { selectedProjectId: null, selectedAgentId: null },
    ui: { dockCollapsed: false, inspectorOpen: false, timelineExpanded: false, developerDetails: false, ambientLifeEnabled: true, searchQuery: '' },
    restingAgentIds: {},
  });
});

function makeAgent(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'a1',
    projectId: 'p1',
    externalAgentId: 'main-claude',
    agentType: 'main-claude',
    displayName: 'Claude',
    status: 'active',
    activity: 'idle',
    currentZoneKey: 'assigned-desk',
    currentTaskId: null,
    currentSessionId: 's1',
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  };
}

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

  it('removes a project and clears selection + camera when it was active', () => {
    const project = makeProject({ agents: [makeAgent()] });
    const store = useCampusStore.getState();
    store.upsertProject(project);
    store.selectProject('p1');
    store.focusProjectRoom('p1');

    store.removeProject('p1');

    const s = useCampusStore.getState();
    expect(s.projects.p1).toBeUndefined();
    expect(s.selection.selectedProjectId).toBeNull();
    expect(s.ui.inspectorOpen).toBe(false);
    expect(s.camera.mode).toBe('campus');
  });

  it('removeProject leaves an unrelated selection and camera untouched', () => {
    const store = useCampusStore.getState();
    store.upsertProject(makeProject({ id: 'p1' }));
    store.upsertProject(makeProject({ id: 'p2', projectKey: 'path:def' }));
    store.selectProject('p2');
    store.focusProjectRoom('p2');

    store.removeProject('p1');

    const s = useCampusStore.getState();
    expect(s.projects.p2).toBeDefined();
    expect(s.selection.selectedProjectId).toBe('p2');
    expect(s.camera.focusedProjectId).toBe('p2');
  });

  it('rests one bot and wakes it via toggle', () => {
    const store = useCampusStore.getState();
    store.upsertProject(makeProject({ agents: [makeAgent()] }));
    store.toggleAgentRest('a1');
    expect(useCampusStore.getState().restingAgentIds.a1).toBe(true);
    store.toggleAgentRest('a1');
    expect(useCampusStore.getState().restingAgentIds.a1).toBeUndefined();
  });

  it('restAllIdle rests only idle bots', () => {
    const store = useCampusStore.getState();
    store.upsertProject(
      makeProject({
        agents: [makeAgent({ id: 'idle1', activity: 'idle' }), makeAgent({ id: 'busy1', activity: 'coding' })],
      }),
    );
    store.restAllIdle();
    const s = useCampusStore.getState();
    expect(s.restingAgentIds.idle1).toBe(true);
    expect(s.restingAgentIds.busy1).toBeUndefined();
  });

  it('auto-wakes a resting bot the moment real work arrives', () => {
    const store = useCampusStore.getState();
    store.upsertProject(makeProject({ agents: [makeAgent({ id: 'a1', activity: 'idle' })] }));
    store.toggleAgentRest('a1');
    expect(useCampusStore.getState().restingAgentIds.a1).toBe(true);

    // A real event makes the agent non-idle -> it must wake.
    store.upsertAgent('a1', 'p1', { activity: 'coding' });
    expect(useCampusStore.getState().restingAgentIds.a1).toBeUndefined();
  });
});

describe('runs slice', () => {
  it('setProjectRuns replaces a project run list', () => {
    const run = { id: 'r1', projectId: 'p1', prompt: 'x', status: 'RUNNING', resultText: null, exitCode: null, startedAt: 't', finishedAt: null } as const;
    useCampusStore.getState().setProjectRuns('p1', [run]);
    expect(useCampusStore.getState().runs.p1).toHaveLength(1);
  });

  it('upsertRun prepends new runs and replaces existing ones in place', () => {
    const a = { id: 'a', projectId: 'p1', prompt: '1', status: 'RUNNING', resultText: null, exitCode: null, startedAt: 't1', finishedAt: null };
    useCampusStore.getState().setProjectRuns('p1', [a as never]);
    useCampusStore.getState().upsertRun({ ...a, status: 'COMPLETED', resultText: 'done' } as never);
    expect(useCampusStore.getState().runs.p1![0]!.status).toBe('COMPLETED');
    useCampusStore.getState().upsertRun({ ...a, id: 'b', prompt: '2' } as never);
    expect(useCampusStore.getState().runs.p1![0]!.id).toBe('b');
    expect(useCampusStore.getState().runs.p1).toHaveLength(2);
  });
});
