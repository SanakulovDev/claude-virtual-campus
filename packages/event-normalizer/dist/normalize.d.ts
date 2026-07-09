import type { AgentActivity, CommandCategory, FileCategory, OfficeZoneKey, RawHookPayload } from '@campus/contracts';
import { toProjectRelativePath } from './fileClassifier';
export interface NormalizedEventCore {
    normalizedType: string;
    activity: AgentActivity;
    targetZoneKey: OfficeZoneKey;
    workSummary: string;
    toolName: string | null;
    filePath: string | null;
    fileCategory: FileCategory | null;
    commandSummary: string | null;
    commandCategory: CommandCategory | null;
    safeMetadata: Record<string, unknown>;
    /** True when this represents a subagent lifecycle signal (closest supported proxy). */
    isSubagentStart: boolean;
    isTaskCompletionSignal: boolean;
    isFailure: boolean;
}
/**
 * Converts one raw Claude Code hook payload into an observable, language-agnostic
 * normalized event core. Never exposes hidden reasoning -- only tool names, file
 * paths, and commands the tool call itself already made observable (spec section 16).
 */
export declare function normalizeHookEvent(raw: RawHookPayload, rootPath: string): NormalizedEventCore;
export { toProjectRelativePath };
