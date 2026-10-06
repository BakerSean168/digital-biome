import { execFileSync } from 'node:child_process';

export interface GitHubReleaseTransport {
  json(endpoint: string): Promise<unknown>;
  download(endpoint: string, maxBytes: number): Promise<Uint8Array>;
}

export function githubReadToken(): string {
  const token =
    process.env.GH_TOKEN?.trim() ||
    execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 16_384,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  if (!token) throw new Error('Set GH_TOKEN or authenticate gh to read producer Releases');
  return token;
}

/** GET only. Constructed API paths, never asset URLs supplied by an event/manifest. */
export function createGitHubReleaseTransport(
  token: string,
  fetcher: typeof fetch = fetch,
): GitHubReleaseTransport {
  async function get(endpoint: string, maxBytes: number, accept: string): Promise<Uint8Array> {
    if (!endpoint.startsWith('/repos/') || endpoint.includes('..'))
      throw new Error('Invalid GitHub API endpoint');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      // Native fetch strips Authorization on the cross-origin GitHub asset redirect.
      const response = await fetcher(`https://api.github.com${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: accept,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`GitHub GET ${endpoint}: HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > maxBytes)
        throw new Error('GitHub response exceeds byte limit');
      if (!response.body) throw new Error('GitHub response has no body');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error('GitHub response exceeds byte limit');
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, size);
    } finally {
      controller.abort();
      clearTimeout(timer);
    }
  }
  return {
    async json(endpoint) {
      return JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          await get(endpoint, 4 * 1024 * 1024, 'application/vnd.github+json'),
        ),
      );
    },
    download: (endpoint, maxBytes) => get(endpoint, maxBytes, 'application/octet-stream'),
  };
}
