"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_EVENTS = void 0;
exports.projectRoom = projectRoom;
exports.sessionRoom = sessionRoom;
exports.SOCKET_EVENTS = {
    bootstrap: 'campus:bootstrap',
    projectCreated: 'project:created',
    projectUpdated: 'project:updated',
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
};
function projectRoom(projectId) {
    return `project:${projectId}`;
}
function sessionRoom(sessionId) {
    return `session:${sessionId}`;
}
