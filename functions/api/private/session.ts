import type { AccessContextData } from '../../../edge/access';

export const onRequestGet: PagesFunction<Env, string, AccessContextData> = (context) => {
  // Reading the identity proves middleware validation ran. Do not return identity
  // claims when the client only needs an authenticated/unauthenticated signal.
  void context.data.accessIdentity;

  return Response.json(
    {
      authenticated: true,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
};
