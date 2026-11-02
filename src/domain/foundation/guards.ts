/**
 * Shared runtime guards for parsing untrusted JSON (data products, private exports,
 * browser payloads). Error messages are part of existing test and lock contracts;
 * keep them byte-identical.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
}

export function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a string array`);
  }
}

/** Like `assertStringArray`, but every item must also be non-blank. */
export function assertNonEmptyStringArray(
  value: unknown,
  label: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${label} must be a string array`);
  }
}
