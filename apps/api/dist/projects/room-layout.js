"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRoomPosition = void 0;
exports.calculateRoomTemplate = calculateRoomTemplate;
var contracts_1 = require("@campus/contracts");
Object.defineProperty(exports, "calculateRoomPosition", { enumerable: true, get: function () { return contracts_1.calculateRoomPosition; } });
function calculateRoomTemplate(agentCount) {
    if (agentCount >= 9)
        return 'LARGE';
    if (agentCount >= 4)
        return 'MEDIUM';
    return 'SMALL';
}
