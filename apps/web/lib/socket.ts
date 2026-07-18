import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    socket = io(url, { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return `${base}${path}`;
}

/** Rename an agent (presentation only). `name: null` resets to the generated name. */
export async function renameAgent(agentId: string, name: string | null): Promise<void> {
  await fetch(apiUrl(`/api/agents/${agentId}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

/** Delete a room. The server cascades its data and broadcasts project:removed to every tab. */
export async function removeProject(projectId: string): Promise<void> {
  await fetch(apiUrl(`/api/projects/${projectId}`), { method: 'DELETE' });
}

/** Connect a project from the UI: the server installs campus hooks into the given local path
 * (touching only .claude/). The room still appears on the first real Claude event. */
export async function installProject(path: string): Promise<void> {
  const res = await fetch(apiUrl('/api/projects/install'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Install failed (${res.status})`);
  }
}
