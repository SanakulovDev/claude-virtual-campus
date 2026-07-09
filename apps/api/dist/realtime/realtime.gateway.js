"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RealtimeGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const contracts_1 = require("@campus/contracts");
const prisma_service_1 = require("../prisma/prisma.service");
const bootstrap_1 = require("./bootstrap");
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
let RealtimeGateway = RealtimeGateway_1 = class RealtimeGateway {
    prisma;
    logger = new common_1.Logger(RealtimeGateway_1.name);
    server;
    constructor(prisma) {
        this.prisma = prisma;
    }
    afterInit() {
        this.logger.log('Socket.IO gateway initialized');
    }
    handleConnection(client) {
        client.join('campus');
    }
    handleJoinProject(client, projectId) {
        client.join((0, contracts_1.projectRoom)(projectId));
    }
    handleJoinSession(client, sessionId) {
        client.join((0, contracts_1.sessionRoom)(sessionId));
    }
    async handleBootstrapRequest(client) {
        const snapshot = await (0, bootstrap_1.buildBootstrapSnapshot)(this.prisma);
        client.emit(contracts_1.SOCKET_EVENTS.bootstrap, snapshot);
    }
    emitToCampus(event, payload) {
        this.server?.to('campus').emit(event, payload);
    }
    emitToProject(projectId, event, payload) {
        this.server?.to((0, contracts_1.projectRoom)(projectId)).emit(event, payload);
    }
    emitToSession(sessionId, event, payload) {
        this.server?.to((0, contracts_1.sessionRoom)(sessionId)).emit(event, payload);
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join:project'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, String]),
    __metadata("design:returntype", void 0)
], RealtimeGateway.prototype, "handleJoinProject", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join:session'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, String]),
    __metadata("design:returntype", void 0)
], RealtimeGateway.prototype, "handleJoinSession", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(contracts_1.SOCKET_EVENTS.bootstrap),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleBootstrapRequest", null);
exports.RealtimeGateway = RealtimeGateway = RealtimeGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: CORS_ORIGIN }, namespace: '/' }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RealtimeGateway);
