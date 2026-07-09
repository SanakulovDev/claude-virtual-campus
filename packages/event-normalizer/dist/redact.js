"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactSensitiveData = redactSensitiveData;
const SECRET_KEY_PATTERN = /(password|secret|token|api[_-]?key|authorization|cookie|private[_-]?key|credential|connection[_-]?string|access[_-]?key)/i;
const SECRET_VALUE_PATTERNS = [
    /Bearer\s+[A-Za-z0-9._-]+/g,
    /AKIA[0-9A-Z]{16}/g, // AWS access key id
    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
    /ghp_[A-Za-z0-9]{20,}/g, // GitHub token
    /sk-[A-Za-z0-9]{20,}/g, // generic secret-key-shaped token
];
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 6;
const MAX_KEYS_PER_OBJECT = 200;
const MAX_STRING_LENGTH = 4000;
function redactString(value) {
    let result = value;
    for (const pattern of SECRET_VALUE_PATTERNS) {
        result = result.replace(pattern, '[REDACTED]');
    }
    return result.length > MAX_STRING_LENGTH ? `${result.slice(0, MAX_STRING_LENGTH)}...[truncated]` : result;
}
/**
 * Deep-redacts secret-shaped keys/values from untrusted hook payload data before it is
 * persisted or broadcast. Guards against prototype pollution and unbounded payloads
 * (spec section 27).
 */
function redactSensitiveData(value, depth = 0) {
    if (depth > MAX_DEPTH)
        return '[REDACTED-DEPTH-LIMIT]';
    if (typeof value === 'string')
        return redactString(value);
    if (typeof value !== 'object' || value === null)
        return value;
    if (Array.isArray(value)) {
        return value.slice(0, MAX_KEYS_PER_OBJECT).map((item) => redactSensitiveData(item, depth + 1));
    }
    const result = {};
    let count = 0;
    for (const [key, val] of Object.entries(value)) {
        if (UNSAFE_KEYS.has(key))
            continue;
        if (count >= MAX_KEYS_PER_OBJECT)
            break;
        count += 1;
        if (SECRET_KEY_PATTERN.test(key)) {
            result[key] = '[REDACTED]';
        }
        else {
            result[key] = redactSensitiveData(val, depth + 1);
        }
    }
    return result;
}
