import type { AccessContextData } from '../../../edge/access';
import {
  parsePrivateInfrastructure,
  PrivateInfrastructureConfigError,
} from '../../../edge/private-infrastructure';

const JSON_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export const onRequestGet: PagesFunction<Env, string, AccessContextData> = (context) => {
  try {
    const payload = parsePrivateInfrastructure(context.env.PRIVATE_INFRASTRUCTURE_JSON);
    return Response.json(payload, { headers: JSON_HEADERS });
  } catch (error) {
    const code = error instanceof PrivateInfrastructureConfigError
      ? error.code
      : 'private_infrastructure_unavailable';

    console.error(JSON.stringify({
      event: 'private_infrastructure_unavailable',
      code,
      path: new URL(context.request.url).pathname,
      status: 500,
    }));

    return Response.json(
      { error: { code, message: 'Private infrastructure data is unavailable.' } },
      { status: 500, headers: JSON_HEADERS },
    );
  }
};
