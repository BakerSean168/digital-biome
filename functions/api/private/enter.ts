import { getSafeNextPath, type AccessContextData } from '../../../edge/access';

export const onRequestGet: PagesFunction<Env, string, AccessContextData> = (context) => {
  const requestUrl = new URL(context.request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get('next'));

  return new Response(null, {
    status: 303,
    headers: {
      'Cache-Control': 'private, no-store',
      Location: new URL(nextPath, requestUrl.origin).toString(),
    },
  });
};
