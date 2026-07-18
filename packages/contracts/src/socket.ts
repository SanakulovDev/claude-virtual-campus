export const SOCKET_EVENTS = {
  bootstrap: 'campus:bootstrap',
  projectCreated: 'project:created',
  projectUpdated: 'project:updated',
  projectRemoved: 'project:removed',
  projectTechnologyDetected: 'project:technology_detected',
  projectModuleDetected: 'project:module_detected',
  sessionStarted: 'session:started',
  sessionUpdated: 'session:updated',
  sessionEnded: 'session:ended',
  agentCreated: 'agent:created',
  agentStateChanged: 'agent:state_changed',
  taskCreated: 'task:created',
  taskUpdated: 'task:updated',
  toolStarted: 'tool:started',
  toolCompleted: 'tool:completed',
  toolFailed: 'tool:failed',
  approvalRequested: 'approval:requested',
  approvalResolved: 'approval:resolved',
  eventReceived: 'event:received',
} as const;

export function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}

export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}
