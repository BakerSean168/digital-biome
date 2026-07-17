import {
  AccessAuthenticationError,
  type AccessContextData,
  verifyAccessRequest,
} from '../../../edge/access';

const JSON_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export const onRequest: PagesFunction<Env, string, AccessContextData> = async (context) => {
  try {
    context.data.accessIdentity = await verifyAccessRequest(context.request, context.env);
    return await context.next();
  } catch (error) {
    const authError = error instanceof AccessAuthenticationError
      ? error
      : new AccessAuthenticationError(
          'access_verification_failed',
          500,
          'Cloudflare Access verification failed.',
        );

    console.warn(JSON.stringify({
      event: 'access_verification_failed',
      code: authError.code,
      path: new URL(context.request.url).pathname,
      status: authError.status,
    }));

    return Response.json(
      { error: { code: authError.code, message: authError.message } },
      { status: authError.status, headers: JSON_HEADERS },
    );
  }
};
