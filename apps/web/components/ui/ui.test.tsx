import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useCampusStore } from '../../stores/campusStore';
import { ProjectDock } from './ProjectDock';
import { InspectorDrawer } from './InspectorDrawer';
import { CampusTopBar } from './CampusTopBar';
import type { ProjectRow } from '../../lib/types';

function project(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 'p1',
    projectKey: 'path:abc',
    name: 'Commerce API',
    rootPath: '/tmp/demo',
    remoteUrl: null,
    isGitRepository: true,
    roomTemplate: 'SMALL',
    roomPositionX: 0,
    roomPositionZ: 0,
    technologies: [{ id: 't1', techId: 'php', displayName: 'PHP', category: 'language', confidence: 0.9, evidence: [] }],
    modules: [],
    agents: [],
    ...overrides,
  };
}

function reset() {
  useCampusStore.setState({
    connectionStatus: 'connected',
    projects: {},
    approvals: {},
    timeline: [],
    camera: { mode: 'campus', focusedProjectId: null, followedAgentId: null },
    selection: { selectedProjectId: null, selectedAgentId: null },
    ui: { dockCollapsed: false, inspectorOpen: false, timelineExpanded: false, developerDetails: false },
  });
}

beforeEach(reset);
afterEach(cleanup);

describe('ProjectDock', () => {
  it('renders projects', () => {
    useCampusStore.getState().upsertProject(project());
    render(<ProjectDock />);
    expect(screen.getByText('Commerce API')).toBeTruthy();
  });

  it('does not leak repository paths into the dock', () => {
    useCampusStore.getState().upsertProject(project());
    render(<ProjectDock />);
    expect(screen.queryByText('/tmp/demo')).toBeNull();
  });

  it('focuses a studio and selects the project on click', () => {
    useCampusStore.getState().upsertProject(project());
    render(<ProjectDock />);
    fireEvent.click(screen.getByText('Commerce API'));
    expect(useCampusStore.getState().camera.mode).toBe('room');
    expect(useCampusStore.getState().selection.selectedProjectId).toBe('p1');
  });
});

describe('InspectorDrawer', () => {
  it('renders nothing until something is selected', () => {
    useCampusStore.getState().upsertProject(project());
    const { container } = render(<InspectorDrawer />);
    expect(container.firstChild).toBeNull();
  });

  it('opens after a project is selected and can be closed', () => {
    useCampusStore.getState().upsertProject(project());
    useCampusStore.getState().selectProject('p1');
    render(<InspectorDrawer />);
    expect(screen.getByText('Inspector')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Close inspector'));
    expect(useCampusStore.getState().ui.inspectorOpen).toBe(false);
  });
});

describe('CampusTopBar', () => {
  it('shows the campus overview control and resets the camera', () => {
    useCampusStore.setState({ camera: { mode: 'room', focusedProjectId: 'p1', followedAgentId: null } });
    render(<CampusTopBar />);
    fireEvent.click(screen.getByText('Campus overview'));
    expect(useCampusStore.getState().camera.mode).toBe('campus');
  });
});
