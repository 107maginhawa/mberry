/**
 * Transport abstraction for API communication
 *
 * Provides a unified interface for making API requests via HTTP fetch.
 */

/**
 * Response from transport layer
 */
export interface TransportResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

/**
 * Request options for transport
 */
export interface TransportRequest {
  method: string;
  url: string;
  body?: string;
  headers?: Record<string, string>;
}

/**
 * Transport interface
 */
export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
}

/**
 * HTTP Transport - uses fetch for standard HTTP requests
 */
export class HttpTransport implements Transport {
  constructor(private baseUrl: string) {}

  async request(req: TransportRequest): Promise<TransportResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.baseUrl}${req.url}`, {
        method: req.method,
        body: req.body,
        headers: {
          'Content-Type': 'application/json',
          ...req.headers,
        },
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        body: await response.text(),
        headers,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 408,
          body: JSON.stringify({ message: 'Request timeout' }),
          headers: { 'content-type': 'application/json' },
        };
      }

      throw error;
    }
  }
}

// Transport state
let currentTransport: Transport | null = null;
let httpBaseUrl = 'http://localhost:7213';

/**
 * Set base URL for HTTP transport
 */
export function setHttpBaseUrl(url: string) {
  httpBaseUrl = url;
  currentTransport = new HttpTransport(url);
}

/**
 * Get the current transport instance
 */
export function getTransport(): Transport {
  if (!currentTransport) {
    currentTransport = new HttpTransport(httpBaseUrl);
  }
  return currentTransport;
}

/**
 * Get transport info for debugging
 */
export function getTransportInfo(): {
  active: 'http';
  baseUrl: string;
} {
  return {
    active: 'http',
    baseUrl: httpBaseUrl,
  };
}
