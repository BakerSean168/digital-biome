const WEBHOOK_TARGET = 'https://gcp-dev-01.taile92a8e.ts.net:8443/github/webhook';
const MAX_BODY_BYTES = 1024 * 1024;
const FORWARDED_HEADERS = [
  'content-type',
  'x-github-event',
  'x-github-delivery',
  'x-github-hook-id',
  'x-hub-signature-256',
] as const;

function jsonError(status: number, code: string): Response {
  return Response.json(
    { error: { code } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function validJsonContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

function forwardHeaders(request: Request): Headers | null {
  const signature = request.headers.get('x-hub-signature-256');
  const event = request.headers.get('x-github-event');
  const delivery = request.headers.get('x-github-delivery');
  const hookId = request.headers.get('x-github-hook-id');
  if (!signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return null;
  if (event !== 'ping' && event !== 'pull_request') return null;
  if (!delivery || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(delivery)) return null;
  if (!hookId || !/^[1-9][0-9]*$/.test(hookId)) return null;

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}


async function readLimitedBody(request: Request): Promise<ArrayBuffer | null> {
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel('body-too-large').catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const raw = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return raw.buffer;
}

function validDeclaredLength(value: string | null): number | null | 'INVALID' {
  if (value === null) return null;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return 'INVALID';
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return 'INVALID';
  return parsed;
}

export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED');
  if (!validJsonContentType(request.headers.get('content-type'))) {
    return jsonError(415, 'CONTENT_TYPE_INVALID');
  }

  const declaredLength = validDeclaredLength(request.headers.get('content-length'));
  if (declaredLength === 'INVALID') return jsonError(400, 'CONTENT_LENGTH_INVALID');
  if (declaredLength !== null && declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, 'BODY_TOO_LARGE');
  }

  const headers = forwardHeaders(request);
  if (!headers) return jsonError(400, 'GITHUB_HEADERS_INVALID');

  const rawBody = await readLimitedBody(request);
  if (rawBody === null) return jsonError(413, 'BODY_TOO_LARGE');

  let upstream: Response;
  try {
    upstream = await fetch(WEBHOOK_TARGET, {
      method: 'POST',
      headers,
      body: rawBody,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return jsonError(502, 'WEBHOOK_VERIFIER_UNAVAILABLE');
  }

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
