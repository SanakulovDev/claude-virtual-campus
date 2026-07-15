export interface HookCommand {
  type: string;
  command: string;
  timeout?: number;
}

export interface HookMatcherGroup {
  matcher?: string;
  hooks: HookCommand[];
}

export interface ClaudeSettings {
  hooks?: Record<string, HookMatcherGroup[]>;
  [key: string]: unknown;
}

const OUR_HOOK_COMMANDS = new Set(['.claude/hooks/send-event.sh', '.claude/hooks/request-approval.sh']);

function isOurHookCommand(command: string): boolean {
  return OUR_HOOK_COMMANDS.has(command) ||
    command.includes('/.codex/hooks/send-event.sh') ||
    command.includes('/.codex/hooks/request-approval.sh');
}

function sameGroup(a: HookMatcherGroup, b: HookMatcherGroup): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merges our template's hook entries into a project's existing settings.json without
 * disturbing anything the user already configured. Idempotent: running twice produces
 * the same result as running once (spec section 11).
 */
export function mergeSettings(existing: ClaudeSettings, template: ClaudeSettings): ClaudeSettings {
  const merged: ClaudeSettings = { ...existing, hooks: { ...(existing.hooks ?? {}) } };

  for (const [eventName, templateGroups] of Object.entries(template.hooks ?? {})) {
    const existingGroups = merged.hooks![eventName] ?? [];
    const next = [...existingGroups];
    for (const group of templateGroups) {
      if (!next.some((g) => sameGroup(g, group))) {
        next.push(group);
      }
    }
    merged.hooks![eventName] = next;
  }

  return merged;
}

/** Inverse of mergeSettings: strips only the hook entries this plugin installed. */
export function stripOurSettings(existing: ClaudeSettings): ClaudeSettings {
  if (!existing.hooks) return existing;

  const hooks: Record<string, HookMatcherGroup[]> = {};
  for (const [eventName, groups] of Object.entries(existing.hooks)) {
    const cleanedGroups = groups
      .map((group) => ({ ...group, hooks: group.hooks.filter((h) => !isOurHookCommand(h.command)) }))
      .filter((group) => group.hooks.length > 0);
    if (cleanedGroups.length > 0) {
      hooks[eventName] = cleanedGroups;
    }
  }

  const result: ClaudeSettings = { ...existing, hooks };
  if (Object.keys(hooks).length === 0) {
    delete result.hooks;
  }
  return result;
}
