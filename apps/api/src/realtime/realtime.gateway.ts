import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, projectRoom, sessionRoom } from '@campus/contracts';
import { corsOrigins } from '../cors';
import { PrismaService } from '../prisma/prisma.service';
import { buildBootstrapSnapshot } from './bootstrap';

@WebSocketGateway({ cors: { origin: corsOrigins() }, namespace: '/' })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  afterInit() {
    this.logger.log('Socket.IO gateway initialized');
  }

  handleConnection(client: Socket) {
    client.join('campus');
  }

  @SubscribeMessage('join:project')
  handleJoinProject(client: Socket, projectId: string) {
    client.join(projectRoom(projectId));
  }

  @SubscribeMessage('join:session')
  handleJoinSession(client: Socket, sessionId: string) {
    client.join(sessionRoom(sessionId));
  }

  @SubscribeMessage(SOCKET_EVENTS.bootstrap)
  async handleBootstrapRequest(client: Socket) {
    const snapshot = await buildBootstrapSnapshot(this.prisma);
    client.emit(SOCKET_EVENTS.bootstrap, snapshot);
  }

  emitToCampus(event: string, payload: unknown) {
    this.server?.to('campus').emit(event, payload);
  }

  emitToProject(projectId: string, event: string, payload: unknown) {
    this.server?.to(projectRoom(projectId)).emit(event, payload);
  }

  emitToSession(sessionId: string, event: string, payload: unknown) {
    this.server?.to(sessionRoom(sessionId)).emit(event, payload);
  }
}
