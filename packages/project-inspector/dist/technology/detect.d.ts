import type { ProjectTechnologyProfile } from '@campus/contracts';
/**
 * Detects technology from filenames/extensions present at `dir` (non-recursive) plus
 * size-limited reads of a handful of well-known manifest files. Never executes
 * anything, never installs dependencies, never runs builds -- see spec section 4.
 */
export declare function detectTechnologyProfile(dir: string): Promise<ProjectTechnologyProfile>;
