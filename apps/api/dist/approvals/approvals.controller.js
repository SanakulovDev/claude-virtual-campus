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
exports.ApprovalsController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@campus/contracts");
const approvals_service_1 = require("./approvals.service");
let ApprovalsController = class ApprovalsController {
    approvals;
    constructor(approvals) {
        this.approvals = approvals;
    }
    async requestApproval(body) {
        const parsed = contracts_1.approvalRequestBodySchema.safeParse(body);
        if (!parsed.success)
            throw new common_1.BadRequestException(parsed.error.flatten());
        return this.approvals.requestApproval(parsed.data);
    }
    allow(approvalId) {
        return this.approvals.resolve(approvalId, 'ALLOWED');
    }
    deny(approvalId) {
        return this.approvals.resolve(approvalId, 'DENIED');
    }
};
exports.ApprovalsController = ApprovalsController;
__decorate([
    (0, common_1.Post)('api/claude/approval'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApprovalsController.prototype, "requestApproval", null);
__decorate([
    (0, common_1.Post)('api/approvals/:approvalId/allow'),
    __param(0, (0, common_1.Param)('approvalId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApprovalsController.prototype, "allow", null);
__decorate([
    (0, common_1.Post)('api/approvals/:approvalId/deny'),
    __param(0, (0, common_1.Param)('approvalId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApprovalsController.prototype, "deny", null);
exports.ApprovalsController = ApprovalsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [approvals_service_1.ApprovalsService])
], ApprovalsController);
