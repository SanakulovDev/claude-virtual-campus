'use client';

import { useEffect } from 'react';
import { SOCKET_EVENTS } from '@campus/contracts';
import { getSocket, apiUrl } from '../lib/socket';
import { useCampusStore } from '../stores/campusStore';
import type { AgentRow, ApprovalRow, ProjectRow, TimelineEntry } from '../lib/types';

/** Wires the Socket.IO connection into the zustand store; call once near the app root. */
export function useCampusSocket() {
  const setConnectionStatus = useCampusStore((s) => s.setConnectionStatus);
  const bootstrapCampus = useCampusStore((s) => s.bootstrapCampus);
  const upsertProject = useCampusStore((s) => s.upsertProject);
  const upsertAgent = useCampusStore((s) => s.upsertAgent);
  const addTimelineEvent = useCampusStore((s) => s.addTimelineEvent);
  const requestApproval = useCampusStore((s) => s.requestApproval);
  const resolveApproval = useCampusStore((s) => s.resolveApproval);

  useEffect(() => {
    const socket = getSocket();

    async function loadBootstrap() {
      const res = await fetch(apiUrl('/api/campus/bootstrap'));
      const data = (await res.json()) as { projects: ProjectRow[]; recentEvents: TimelineEntry[] };
      bootstrapCampus(data.projects, data.recentEvents);
    }

    function onConnect() {
      setConnectionStatus('connected');
      loadBootstrap().catch(() => undefined);
    }
    function onDisconnect() {
      setConnectionStatus('disconnected');
    }
    function onProjectUpsert(project: ProjectRow) {
      upsertProject(project);
    }
    function onAgentChanged(agent: AgentRow) {
      upsertAgent(agent.id, agent.projectId, agent);
    }
    function onEventReceived(entry: TimelineEntry) {
      addTimelineEvent(entry);
    }
    function onApprovalRequested(approval: ApprovalRow) {
      requestApproval(approval);
    }
    function onApprovalResolved(approval: ApprovalRow) {
      resolveApproval(approval.id, approval.status);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.projectCreated, onProjectUpsert);
    socket.on(SOCKET_EVENTS.projectUpdated, onProjectUpsert);
    socket.on(SOCKET_EVENTS.agentCreated, onAgentChanged);
    socket.on(SOCKET_EVENTS.agentStateChanged, onAgentChanged);
    socket.on(SOCKET_EVENTS.eventReceived, onEventReceived);
    socket.on(SOCKET_EVENTS.approvalRequested, onApprovalRequested);
    socket.on(SOCKET_EVENTS.approvalResolved, onApprovalResolved);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.projectCreated, onProjectUpsert);
      socket.off(SOCKET_EVENTS.projectUpdated, onProjectUpsert);
      socket.off(SOCKET_EVENTS.agentCreated, onAgentChanged);
      socket.off(SOCKET_EVENTS.agentStateChanged, onAgentChanged);
      socket.off(SOCKET_EVENTS.eventReceived, onEventReceived);
      socket.off(SOCKET_EVENTS.approvalRequested, onApprovalRequested);
      socket.off(SOCKET_EVENTS.approvalResolved, onApprovalResolved);
    };
  }, []);
}
