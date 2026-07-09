"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const commandClassifier_1 = require("./commandClassifier");
const cases = [
    ['composer install', 'install'],
    ['php artisan test', 'test'],
    ['vendor/bin/phpunit', 'test'],
    ['vendor/bin/pest', 'test'],
    ['php artisan migrate', 'migration'],
    ['python -m pytest', 'test'],
    ['pytest', 'test'],
    ['poetry install', 'install'],
    ['ruff check .', 'lint'],
    ['mypy .', 'typecheck'],
    ['go test ./...', 'test'],
    ['go build ./...', 'build'],
    ['go vet ./...', 'lint'],
    ['golangci-lint run', 'lint'],
    ['pnpm test', 'test'],
    ['npm run build', 'build'],
    ['npx tsc --noEmit', 'typecheck'],
    ['cargo test', 'test'],
    ['cargo build', 'build'],
    ['mvn test', 'test'],
    ['gradle build', 'build'],
    ['dotnet test', 'test'],
    ['make test', 'test'],
    ['docker compose up', 'container'],
    ['unknown-tool something', 'unknown'],
    ['rm -rf /', 'destructive'],
];
(0, vitest_1.describe)('classifyCommand', () => {
    vitest_1.it.each(cases)('classifies "%s" as %s', (command, expected) => {
        (0, vitest_1.expect)((0, commandClassifier_1.classifyCommand)(command).category).toBe(expected);
    });
    (0, vitest_1.it)('flags destructive commands even when not matching a known tool', () => {
        (0, vitest_1.expect)((0, commandClassifier_1.classifyCommand)('sudo rm important-file').isDestructive).toBe(true);
        (0, vitest_1.expect)((0, commandClassifier_1.classifyCommand)('git push --force origin main').category).toBe('destructive');
    });
    (0, vitest_1.it)('does not misclassify a safe git push as destructive', () => {
        const result = (0, commandClassifier_1.classifyCommand)('git push origin main');
        (0, vitest_1.expect)(result.category).toBe('git');
        (0, vitest_1.expect)(result.isDestructive).toBe(false);
    });
});
