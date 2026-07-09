/**
 * Deep-redacts secret-shaped keys/values from untrusted hook payload data before it is
 * persisted or broadcast. Guards against prototype pollution and unbounded payloads
 * (spec section 27).
 */
export declare function redactSensitiveData(value: unknown, depth?: number): unknown;
