import * as dns from 'node:dns';
import * as https from 'node:https';
import { NodeHttpHandler } from '@smithy/node-http-handler';

/** Cloudflare edge IPs that route R2 S3 API when local DNS returns unreachable 172.64.66.x */
export const R2_DEFAULT_EDGE_FALLBACK_IPS = [
  '172.64.148.235',
  '172.64.155.209',
  '104.16.132.229',
  '104.19.192.174',
] as const;

export function parseEdgeFallbackIps(raw: string | undefined): string[] {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return [];
  if (['false', 'off', '0', 'no'].includes(trimmed.toLowerCase())) return [];
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveEdgeFallbackIps(explicit: string): string[] {
  const parsed = parseEdgeFallbackIps(explicit);
  if (parsed.length) return parsed;
  if (process.env.NODE_ENV === 'production') return [];
  return [...R2_DEFAULT_EDGE_FALLBACK_IPS];
}

function isR2EndpointHost(hostname: string, endpointHost: string): boolean {
  if (!hostname) return false;
  if (hostname === endpointHost) return true;
  return hostname.endsWith('.r2.cloudflarestorage.com');
}

export function createR2HttpsAgent(
  endpointHost: string,
  fallbackIps: string[],
): https.Agent | undefined {
  if (!fallbackIps.length || !endpointHost) return undefined;

  return new https.Agent({
    keepAlive: true,
    lookup: (hostname, options, callback) => {
      if (!isR2EndpointHost(hostname, endpointHost)) {
        dns.lookup(hostname, options, callback);
        return;
      }

      const addresses = fallbackIps.map((address) => ({
        address,
        family: 4 as const,
      }));

      if (options.all) {
        callback(null, addresses);
        return;
      }

      callback(null, addresses[0].address, 4);
    },
  });
}

export function createR2RequestHandler(
  endpoint: string,
  fallbackIps: string[],
): NodeHttpHandler | undefined {
  if (!fallbackIps.length) return undefined;

  let endpointHost = '';
  try {
    endpointHost = new URL(endpoint).hostname;
  } catch {
    return undefined;
  }

  const httpsAgent = createR2HttpsAgent(endpointHost, fallbackIps);
  if (!httpsAgent) return undefined;

  return new NodeHttpHandler({
    httpsAgent,
    connectionTimeout: 30_000,
    requestTimeout: 120_000,
  });
}
