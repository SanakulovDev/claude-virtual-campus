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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@campus/contracts");
const events_service_1 = require("./events.service");
let EventsController = class EventsController {
    events;
    constructor(events) {
        this.events = events;
    }
    async receive(body) {
        const parsed = contracts_1.rawHookPayloadSchema.safeParse(body);
        if (!parsed.success) {
            // Fail-open contract lives in the hook script itself (always exits 0); a 400 here
            // just means the payload was malformed, it must never crash the caller's shell.
            throw new common_1.BadRequestException(parsed.error.flatten());
        }
        return this.events.ingest(parsed.data);
    }
};
exports.EventsController = EventsController;
__decorate([
    (0, common_1.Post)('events'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "receive", null);
exports.EventsController = EventsController = __decorate([
    (0, common_1.Controller)('api/claude'),
    __metadata("design:paramtypes", [events_service_1.EventsService])
], EventsController);
