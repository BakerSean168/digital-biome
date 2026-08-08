interface VisitorIPResponse {
  ip: string;
  rawIp: string;
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
    '39.172.88.99';

  const cf = (request.cf as Record<string, any>) || {};

  const country = (cf.country as string) || 'CN';
  const city = (cf.city as string) || 'Shanghai';
  const asnNum = cf.asn ? `AS${cf.asn}` : 'AS56041';
  const isp = (cf.asOrganization as string) || 'China Mobile';

  const maskedIp = maskIp(rawIp);

  const isBot = !!request.headers.get('cf-worker') || false;
  const riskScore = isBot ? 15 : 0;
  const trustScore = 100 - riskScore;

  const payload: VisitorIPResponse = {
    ip: maskedIp,
    rawIp,
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
