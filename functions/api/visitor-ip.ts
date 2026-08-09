interface VisitorIPResponse {
  ip: string;
  country: string;
  city: string;
  asn: string;
  isp: string;
  trustScore: number;
  riskScore: number;
  tags: {
    vpn: boolean;
    proxy: boolean;
    tor: boolean;
    datacenter: boolean;
    abuse: boolean;
  };
  edge: {
    colo: string;
    timezone: string;
    httpProtocol: string;
    tlsVersion: string;
  };
  timestamp: string;
}

function maskIp(ip: string): string {
  if (!ip) return '127.0.0.*';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:*:*:*:*`;
  }
  return ip;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const request = context.request;
  const rawIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';

  const cf = (request.cf as Record<string, any>) || {};

  const country = (cf.country as string) || 'Unknown';
  const city = (cf.city as string) || 'Local';
  const asnNum = cf.asn ? `AS${cf.asn}` : 'AS--';
  const isp = (cf.asOrganization as string) || 'Unresolved network';

  const maskedIp = maskIp(rawIp);

  const isBot = !!request.headers.get('cf-worker') || false;
  const riskScore = isBot ? 15 : 0;
  const trustScore = 100 - riskScore;

  const payload: VisitorIPResponse = {
    ip: maskedIp,
    country,
    city,
    asn: asnNum,
    isp,
    trustScore,
    riskScore,
    tags: {
      vpn: false,
      proxy: false,
      tor: false,
      datacenter: false,
      abuse: false,
    },
    edge: {
      colo: typeof cf.colo === 'string' ? cf.colo : 'LOCAL',
      timezone: typeof cf.timezone === 'string' ? cf.timezone : 'Unknown',
      httpProtocol: typeof cf.httpProtocol === 'string' ? cf.httpProtocol : 'Unknown',
      tlsVersion: typeof cf.tlsVersion === 'string' ? cf.tlsVersion : 'Unknown',
    },
    timestamp: new Date().toISOString(),
  };

  return Response.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
