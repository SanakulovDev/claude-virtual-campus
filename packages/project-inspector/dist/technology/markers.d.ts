import type { TechnologyCategory } from '@campus/contracts';
export interface MarkerRule {
    id: string;
    displayName: string;
    category: TechnologyCategory;
    /** Exact filenames present at the scanned directory. */
    filenames?: string[];
    /** Extensions (with dot) present at the scanned directory. */
    extensions?: string[];
    /** Confidence when matched by filename/extension alone. */
    confidence: number;
    /**
     * Optional: a small, size-limited read of one of the matched files to raise
     * confidence or add evidence (e.g. detecting Laravel inside composer.json).
     * Must never execute anything -- text search only.
     */
    contentSniff?: {
        filename: string;
        needle: string;
        displayNameOverride?: string;
        id?: string;
    };
}
export declare const MARKER_RULES: MarkerRule[];
