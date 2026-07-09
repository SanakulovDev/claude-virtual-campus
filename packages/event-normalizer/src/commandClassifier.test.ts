import { describe, expect, it } from 'vitest';
import { classifyCommand } from './commandClassifier';

const cases: Array<[string, string]> = [
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

describe('classifyCommand', () => {
  it.each(cases)('classifies "%s" as %s', (command, expected) => {
    expect(classifyCommand(command).category).toBe(expected);
  });

  it('flags destructive commands even when not matching a known tool', () => {
    expect(classifyCommand('sudo rm important-file').isDestructive).toBe(true);
    expect(classifyCommand('git push --force origin main').category).toBe('destructive');
  });

  it('does not misclassify a safe git push as destructive', () => {
    const result = classifyCommand('git push origin main');
    expect(result.category).toBe('git');
    expect(result.isDestructive).toBe(false);
  });
});
