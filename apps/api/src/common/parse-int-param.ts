import { BadRequestException } from '@nestjs/common';

/** Parse an optional numeric query param. Absent -> fallback. Present but non-finite -> 400. */
export function parseIntParam(raw: string | undefined, fallback: number | undefined): number | undefined {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new BadRequestException(`invalid numeric query parameter: ${raw}`);
  return n;
}
