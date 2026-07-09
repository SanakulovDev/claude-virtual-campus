import type { FileCategory } from '@campus/contracts';
export interface FileClassification {
    category: FileCategory;
    isSensitive: boolean;
    /** Path relative to the project root, forward-slash separated, with no leading '../'. */
    projectRelativePath: string;
}
/** Converts an absolute or arbitrary path to a safe, project-relative display path. */
export declare function toProjectRelativePath(filePath: string, rootPath: string): string;
/**
 * Classifies file activity using only the path/extension -- never file contents.
 * Never assumes a `src/` layout (spec section 6).
 */
export declare function classifyFile(filePath: string, rootPath: string): FileClassification;
