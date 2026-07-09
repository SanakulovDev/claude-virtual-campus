import { describe, expect, it } from 'vitest';
import { classifyFile } from './fileClassifier';

const root = '/repo';

describe('classifyFile', () => {
  it.each([
    ['/repo/app/Services/Payment.php', 'source'],
    ['/repo/app/services/payment.py', 'source'],
    ['/repo/internal/payment/service.go', 'source'],
    ['/repo/src/index.js', 'source'],
    ['/repo/src/lib.rs', 'source'],
  ])('classifies source file %s', (file, expected) => {
    expect(classifyFile(file, root).category).toBe(expected);
  });

  it.each([
    ['/repo/tests/PaymentTest.php', 'test'],
    ['/repo/internal/payment/service_test.go', 'test'],
    ['/repo/app/test_payment.py', 'test'],
    ['/repo/src/payment.spec.ts', 'test'],
  ])('classifies test file %s', (file, expected) => {
    expect(classifyFile(file, root).category).toBe(expected);
  });

  it.each([
    ['/repo/database/migrations/2024_01_01_create_users.php', 'migration'],
    ['/repo/alembic/versions/0001_init.py', 'migration'],
    ['/repo/schema.sql', 'migration'],
  ])('classifies migration/database file %s', (file, expected) => {
    expect(classifyFile(file, root).category).toBe(expected);
  });

  it('classifies configuration files', () => {
    expect(classifyFile('/repo/package.json', root).category).toBe('configuration');
    expect(classifyFile('/repo/config/app.yaml', root).category).toBe('configuration');
  });

  it('classifies infrastructure files', () => {
    expect(classifyFile('/repo/Dockerfile', root).category).toBe('infrastructure');
    expect(classifyFile('/repo/infra/main.tf', root).category).toBe('infrastructure');
  });

  it('classifies documentation', () => {
    expect(classifyFile('/repo/README.md', root).category).toBe('documentation');
  });

  it('flags sensitive files without exposing raw path outside project', () => {
    const result = classifyFile('/repo/.env', root);
    expect(result.category).toBe('secret');
    expect(result.isSensitive).toBe(true);
  });

  it('classifies unknown extensions safely', () => {
    expect(classifyFile('/repo/weird.xyzabc', root).category).toBe('unknown');
  });

  it('redacts paths outside the project root instead of leaking them', () => {
    const result = classifyFile('/etc/passwd', root);
    expect(result.projectRelativePath).toBe('(outside-project)/passwd');
  });
});
