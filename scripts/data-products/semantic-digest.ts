import { createHash } from 'node:crypto';

export function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function jsonString(value: string): string {
  if (/[\uD800-\uDFFF]/u.test(value))
    throw new Error('Canonical JSON requires well-formed Unicode');
  return JSON.stringify(value);
}

/** Compact UTF-8 JSON; emit sorted keys directly (JS object enumeration reorders integer keys). */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return jsonString(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    // Reviewer P2: Python and JS differ for floats (1.0, -0.0, exponent formatting)
    // and integers beyond JS precision. Current products use safe integer counts.
    // Fail closed outside that domain; this is NOT a general floating-point standard.
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new Error('Canonical JSON numeric domain is safe integers (excluding negative zero)');
    }
    return String(value);
  }
  if (Array.isArray(value)) return `[${Array.from(value, canonicalJson).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    // UTF-8 order matches Python Unicode code-point order, unlike UTF-16 sort().
    return `{${Object.keys(record)
      .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
      .map((key) => `${jsonString(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('Canonical JSON requires JSON values');
}

export function canonicalSemanticBytes(artifact: unknown): Buffer {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    throw new Error('Semantic artifact must be an object');
  }
  const value = artifact as Record<string, unknown>;
  return Buffer.from(
    canonicalJson({
      schemaVersion: value.schemaVersion,
      product: value.product,
      producer: value.producer,
      payload: value.payload,
    }),
    'utf8',
  );
}

export function semanticSha256(artifact: unknown): string {
  return sha256(canonicalSemanticBytes(artifact));
}
