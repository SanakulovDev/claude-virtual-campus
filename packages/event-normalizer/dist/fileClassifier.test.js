"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fileClassifier_1 = require("./fileClassifier");
const root = '/repo';
(0, vitest_1.describe)('classifyFile', () => {
    vitest_1.it.each([
        ['/repo/app/Services/Payment.php', 'source'],
        ['/repo/app/services/payment.py', 'source'],
        ['/repo/internal/payment/service.go', 'source'],
        ['/repo/src/index.js', 'source'],
        ['/repo/src/lib.rs', 'source'],
    ])('classifies source file %s', (file, expected) => {
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)(file, root).category).toBe(expected);
    });
    vitest_1.it.each([
        ['/repo/tests/PaymentTest.php', 'test'],
        ['/repo/internal/payment/service_test.go', 'test'],
        ['/repo/app/test_payment.py', 'test'],
        ['/repo/src/payment.spec.ts', 'test'],
    ])('classifies test file %s', (file, expected) => {
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)(file, root).category).toBe(expected);
    });
    vitest_1.it.each([
        ['/repo/database/migrations/2024_01_01_create_users.php', 'migration'],
        ['/repo/alembic/versions/0001_init.py', 'migration'],
        ['/repo/schema.sql', 'migration'],
    ])('classifies migration/database file %s', (file, expected) => {
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)(file, root).category).toBe(expected);
    });
    (0, vitest_1.it)('classifies configuration files', () => {
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)('/repo/package.json', root).category).toBe('configuration');
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)('/repo/config/app.yaml', root).category).toBe('configuration');
    });
    (0, vitest_1.it)('classifies infrastructure files', () => {
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)('/repo/Dockerfile', root).category).toBe('infrastructure');
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)('/repo/infra/main.tf', root).category).toBe('infrastructure');
    });
    (0, vitest_1.it)('classifies documentation', () => {
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)('/repo/README.md', root).category).toBe('documentation');
    });
    (0, vitest_1.it)('flags sensitive files without exposing raw path outside project', () => {
        const result = (0, fileClassifier_1.classifyFile)('/repo/.env', root);
        (0, vitest_1.expect)(result.category).toBe('secret');
        (0, vitest_1.expect)(result.isSensitive).toBe(true);
    });
    (0, vitest_1.it)('classifies unknown extensions safely', () => {
        (0, vitest_1.expect)((0, fileClassifier_1.classifyFile)('/repo/weird.xyzabc', root).category).toBe('unknown');
    });
    (0, vitest_1.it)('redacts paths outside the project root instead of leaking them', () => {
        const result = (0, fileClassifier_1.classifyFile)('/etc/passwd', root);
        (0, vitest_1.expect)(result.projectRelativePath).toBe('(outside-project)/passwd');
    });
});
