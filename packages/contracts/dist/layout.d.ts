import type { OfficeZoneKey } from './enums';
/** Deterministic grid position for a project room, shared by API (persistence) and web (3D scene). */
export declare function calculateRoomPosition(index: number): {
    x: number;
    z: number;
};
/** Zone-local offsets within a medium room, per spec section 20. Small/large scale from this. */
export declare const MEDIUM_ROOM_ZONES: Record<OfficeZoneKey, [number, number, number]>;
