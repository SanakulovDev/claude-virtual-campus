"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyCommand = classifyCommand;
const DESTRUCTIVE_PATTERNS = [
    /\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*)\b/, // rm -rf, rm -fr
    /\bsudo\b/,
    /\bgit\s+push\b.*(--force\b|-f\b)/,
    /\bdrop\s+database\b/i,
    /\bdrop\s+table\b/i,
    /\bdatabase\s+reset\b/i,
    /\btruncate\s+table\b/i,
    /\bmigrate:?\s*reset\b/i,
    /\bcredential(s)?\s+export\b/i,
    /\bproduction\s+deploy\b/i,
];
function basename(token) {
    const parts = token.split('/');
    return parts[parts.length - 1] ?? token;
}
const RULES = [
    // test
    { category: 'test', match: (exe) => ['phpunit', 'pest', 'pytest', 'vitest', 'jest', 'mocha', 'rspec'].includes(exe) },
    { category: 'test', match: (exe, rest) => exe === 'php' && rest[0] === 'artisan' && rest[1] === 'test' },
    { category: 'test', match: (exe, rest) => (exe === 'python' || exe === 'python3') && rest.includes('pytest') },
    { category: 'test', match: (exe, rest) => ['go', 'cargo', 'mvn', 'gradle', 'gradlew', 'dotnet', 'make'].includes(exe) && rest[0] === 'test' },
    { category: 'test', match: (exe, rest) => ['npm', 'pnpm', 'yarn', 'bun'].includes(exe) && (rest[0] === 'test' || (rest[0] === 'run' && rest[1] === 'test')) },
    // build
    { category: 'build', match: (exe, rest) => ['go', 'cargo', 'gradle', 'gradlew', 'dotnet', 'make'].includes(exe) && rest[0] === 'build' },
    { category: 'build', match: (exe, rest) => ['npm', 'pnpm', 'yarn', 'bun'].includes(exe) && rest[0] === 'run' && rest[1] === 'build' },
    { category: 'build', match: (exe, rest) => exe === 'mvn' && (rest[0] === 'package' || rest[0] === 'compile') },
    { category: 'build', match: (exe) => exe === 'tsc' },
    // lint
    { category: 'lint', match: (exe) => ['ruff', 'eslint', 'golangci-lint', 'phpstan', 'psalm', 'rubocop'].includes(exe) },
    { category: 'lint', match: (exe, rest) => exe === 'go' && rest[0] === 'vet' },
    { category: 'lint', match: (exe, rest) => exe === 'ruff' && rest[0] === 'check' },
    { category: 'lint', match: (exe, rest) => (exe === 'npm' || exe === 'pnpm') && rest.includes('lint') },
    // typecheck
    { category: 'typecheck', match: (exe) => exe === 'mypy' },
    { category: 'typecheck', match: (exe, rest) => (exe === 'tsc' || exe === 'npx') && rest.includes('--noEmit') },
    // format
    { category: 'format', match: (exe) => ['black', 'prettier', 'gofmt', 'rustfmt'].includes(exe) },
    // install
    { category: 'install', match: (exe, rest) => exe === 'composer' && rest[0] === 'install' },
    { category: 'install', match: (exe, rest) => exe === 'poetry' && rest[0] === 'install' },
    { category: 'install', match: (exe, rest) => (exe === 'pip' || exe === 'pip3') && rest[0] === 'install' },
    { category: 'install', match: (exe, rest) => ['npm', 'pnpm', 'yarn', 'bun'].includes(exe) && (rest.length === 0 || rest[0] === 'install' || rest[0] === 'i' || rest[0] === 'ci') },
    { category: 'install', match: (exe, rest) => exe === 'bundle' && (rest.length === 0 || rest[0] === 'install') },
    { category: 'install', match: (exe, rest) => exe === 'go' && rest[0] === 'mod' && rest[1] === 'download' },
    { category: 'install', match: (exe, rest) => exe === 'cargo' && rest[0] === 'fetch' },
    { category: 'install', match: (exe, rest) => exe === 'mix' && rest[0] === 'deps.get' },
    // migration / database
    { category: 'migration', match: (exe, rest) => exe === 'php' && rest[0] === 'artisan' && rest[1] === 'migrate' },
    { category: 'migration', match: (exe) => exe === 'alembic' },
    { category: 'migration', match: (exe, rest) => exe === 'prisma' && rest[0] === 'migrate' },
    { category: 'migration', match: (exe, rest) => exe === 'manage.py' && rest[0] === 'migrate' },
    { category: 'migration', match: (exe, rest) => exe === 'rails' && rest.includes('db:migrate') },
    { category: 'database', match: (exe) => ['psql', 'mysql', 'sqlite3', 'redis-cli'].includes(exe) },
    // container / infrastructure
    { category: 'container', match: (exe, rest) => (exe === 'docker' && (rest[0] === 'compose' || rest[0] === 'build' || rest[0] === 'run')) || exe === 'docker-compose' },
    { category: 'container', match: (exe) => exe === 'kubectl' },
    // git
    { category: 'git', match: (exe) => exe === 'git' },
    // deploy
    { category: 'deploy', match: (exe, rest, raw) => /\bdeploy\b/i.test(raw) || (exe === 'terraform' && rest[0] === 'apply') },
    // inspection (read-only)
    { category: 'inspection', match: (exe) => ['ls', 'find', 'grep', 'cat', 'head', 'tail', 'which', 'stat'].includes(exe) },
    // filesystem (mutating, non-destructive)
    { category: 'filesystem', match: (exe) => ['cp', 'mv', 'mkdir', 'touch', 'rm', 'chmod', 'chown'].includes(exe) },
    // network
    { category: 'network', match: (exe) => ['curl', 'wget', 'ssh', 'scp', 'rsync'].includes(exe) },
    // serve / run (checked after test/build so `go run` etc. don't shadow more specific rules)
    { category: 'serve', match: (exe, rest) => ['npm', 'pnpm', 'yarn', 'bun'].includes(exe) && rest[0] === 'run' && ['dev', 'start', 'serve'].includes(rest[1] ?? '') },
    { category: 'run', match: (exe, rest) => exe === 'go' && rest[0] === 'run' },
    { category: 'run', match: (exe) => ['python', 'python3', 'node', 'ruby'].includes(exe) },
];
/**
 * Classifies a sanitized shell command string into a purpose category without ever
 * executing it -- pure token inspection only (spec section 5).
 */
function classifyCommand(rawCommand) {
    const trimmed = rawCommand.trim();
    const isDestructive = DESTRUCTIVE_PATTERNS.some((re) => re.test(trimmed));
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const executable = tokens.length > 0 ? basename(tokens[0]) : '';
    const rest = tokens.slice(1);
    if (isDestructive) {
        return { category: 'destructive', isDestructive: true, executable };
    }
    for (const rule of RULES) {
        if (rule.match(executable, rest, trimmed)) {
            return { category: rule.category, isDestructive: false, executable };
        }
    }
    return { category: 'unknown', isDestructive: false, executable };
}
