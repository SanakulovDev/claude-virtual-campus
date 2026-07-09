"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRoomPosition = calculateRoomPosition;
exports.calculateRoomTemplate = calculateRoomTemplate;
const COLUMNS = 3;
const SPACING_X = 22;
const SPACING_Z = 18;
/** Deterministic grid position for a project room, per spec section 20. */
function calculateRoomPosition(index) {
    return {
        x: (index % COLUMNS) * SPACING_X,
        z: Math.floor(index / COLUMNS) * SPACING_Z,
    };
}
function calculateRoomTemplate(agentCount) {
    if (agentCount >= 9)
        return 'LARGE';
    if (agentCount >= 4)
        return 'MEDIUM';
    return 'SMALL';
}
