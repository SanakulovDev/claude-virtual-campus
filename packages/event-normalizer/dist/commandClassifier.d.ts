import type { CommandCategory } from '@campus/contracts';
export interface CommandClassification {
    category: CommandCategory;
    isDestructive: boolean;
    executable: string;
}
/**
 * Classifies a sanitized shell command string into a purpose category without ever
 * executing it -- pure token inspection only (spec section 5).
 */
export declare function classifyCommand(rawCommand: string): CommandClassification;
