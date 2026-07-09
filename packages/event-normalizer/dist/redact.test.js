"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const redact_1 = require("./redact");
(0, vitest_1.describe)('redactSensitiveData', () => {
    (0, vitest_1.it)('redacts values under secret-shaped keys', () => {
        const result = (0, redact_1.redactSensitiveData)({ password: 'hunter2', api_key: 'abc', normal: 'ok' });
        (0, vitest_1.expect)(result.password).toBe('[REDACTED]');
        (0, vitest_1.expect)(result.api_key).toBe('[REDACTED]');
        (0, vitest_1.expect)(result.normal).toBe('ok');
    });
    (0, vitest_1.it)('redacts bearer tokens embedded in strings', () => {
        const result = (0, redact_1.redactSensitiveData)({ header: 'Authorization: Bearer abc.def.ghi' });
        (0, vitest_1.expect)(result.header).not.toContain('abc.def.ghi');
    });
    (0, vitest_1.it)('drops prototype-polluting keys', () => {
        const malicious = JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}');
        const result = (0, redact_1.redactSensitiveData)(malicious);
        (0, vitest_1.expect)(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
        (0, vitest_1.expect)({}.polluted).toBeUndefined();
    });
    (0, vitest_1.it)('truncates very long strings', () => {
        const result = (0, redact_1.redactSensitiveData)({ big: 'x'.repeat(10000) });
        (0, vitest_1.expect)(result.big.length).toBeLessThan(5000);
    });
});
