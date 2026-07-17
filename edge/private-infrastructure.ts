const PRIVATE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'ssh:']);

export interface PrivateInfrastructurePayload {
  version: 1;
  values: Record<string, string>;
  links: Record<string, string>;
}

export class PrivateInfrastructureConfigError extends Error {
  readonly code = 'private_infrastructure_configuration_invalid';

  constructor() {
    super('Private infrastructure configuration is invalid.');
    this.name = 'PrivateInfrastructureConfigError';
  }
}

function parseStringRecord(value: unknown, validateLink: boolean): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PrivateInfrastructureConfigError();
  }

  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (!PRIVATE_KEY_PATTERN.test(key) || typeof rawValue !== 'string') {
      throw new PrivateInfrastructureConfigError();
    }

    const normalizedValue = rawValue.trim();
    if (!normalizedValue || normalizedValue.length > 2048 || /[\u0000-\u001f\u007f]/.test(normalizedValue)) {
      throw new PrivateInfrastructureConfigError();
    }

    if (validateLink) {
      let url: URL;
      try {
        url = new URL(normalizedValue);
      } catch {
        throw new PrivateInfrastructureConfigError();
      }

      if (!ALLOWED_LINK_PROTOCOLS.has(url.protocol) || !url.hostname) {
        throw new PrivateInfrastructureConfigError();
      }
    }

    result[key] = normalizedValue;
  }

  return result;
}

export function parsePrivateInfrastructure(rawConfig: string): PrivateInfrastructurePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawConfig);
  } catch {
    throw new PrivateInfrastructureConfigError();
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new PrivateInfrastructureConfigError();
  }

  const config = parsed as Record<string, unknown>;
  if (config.version !== 1) {
    throw new PrivateInfrastructureConfigError();
  }

  return {
    version: 1,
    values: parseStringRecord(config.values, false),
    links: parseStringRecord(config.links, true),
  };
}
