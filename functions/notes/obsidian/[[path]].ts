/**
 * Runtime tombstone for protected knowledge-note routes.
 *
 * This Function is invoked only for paths emitted into dist/_routes.json by
 * the postbuild private-route boundary. Public notes stay on the static fast
 * path; protected routes fail closed even if an older static asset is still
 * resident in an edge cache after a deployment.
 */
export const onRequest: PagesFunction = async () => new Response('Not Found', {
  status: 404,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Robots-Tag': 'noindex',
  },
});
