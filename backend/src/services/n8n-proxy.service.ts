import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import FormData from 'form-data';

@Injectable()
export class N8nProxyService {
  private readonly axiosInstance: AxiosInstance;
  private readonly n8nBaseUrl: string;
  // Simple token-bucket regulator (in-memory, per-instance)
  private tokens: number;
  private readonly maxBurst: number;
  private readonly replenishPerSecond: number;
  private readonly maxQueue: number;
  private readonly baseBackoffMs: number;
  private readonly maxRetries: number;
  private readonly jitterMs: number;
  private readonly queue: Array<() => void> = [];
  private refillTimer: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    this.n8nBaseUrl =
      this.configService.get<string>('n8n.baseUrl') ||
      'https://n8n.decaminoservicios.com';

    this.axiosInstance = axios.create({
      baseURL: this.n8nBaseUrl,
      timeout: this.configService.get<number>('n8n.timeout') || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DeCamino-Backend/1.0',
      },
    });

    // Regulator config (can be tuned via env/config later)
    this.maxBurst =
      this.configService.get<number>('n8n.rateLimit.maxBurst') || 10;
    this.replenishPerSecond =
      this.configService.get<number>('n8n.rateLimit.rps') || 5;
    this.maxQueue =
      this.configService.get<number>('n8n.rateLimit.maxQueue') || 500;
    this.baseBackoffMs =
      this.configService.get<number>('n8n.backoff.baseMs') || 200;
    this.maxRetries =
      this.configService.get<number>('n8n.backoff.maxRetries') || 4;
    this.jitterMs =
      this.configService.get<number>('n8n.backoff.jitterMs') || 150;
    this.tokens = this.maxBurst;
    this.startRefill();
  }

  private startRefill() {
    if (this.refillTimer) return;
    this.refillTimer = setInterval(() => {
      this.tokens = Math.min(
        this.maxBurst,
        this.tokens + this.replenishPerSecond,
      );
      this.drainQueue();
    }, 1000);
  }

  private drainQueue() {
    while (this.tokens > 0 && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.tokens -= 1;
        next();
      }
    }
  }

  private schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.withBackoff(task).then(resolve).catch(reject);
      };

      if (this.tokens > 0) {
        this.tokens -= 1;
        run();
        return;
      }

      if (this.queue.length >= this.maxQueue) {
        return reject(
          new HttpException(
            {
              message: 'Rate limit queue full',
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          ),
        );
      }

      this.queue.push(run);
    });
  }

  private async withBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        const res: any = await fn();
        // Axios response-like objects have status; treat 429/5xx as retryable
        const status = res?.status ?? res?.statusCode;
        if (![429, 500, 502, 503, 504].includes(status)) {
          return res;
        }
        if (attempt >= this.maxRetries) {
          return res;
        }
      } catch (error) {
        if (attempt >= this.maxRetries) {
          throw error;
        }
      }
      const jitter = Math.random() * this.jitterMs;
      const delay = this.baseBackoffMs * Math.pow(2, attempt) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }

  /**
   * Proxy a request to n8n
   * @param method HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param endpoint n8n endpoint (e.g., '/webhook/login-yyBov0qVQZEhX2TL')
   * @param data Request body (for POST, PUT, etc.)
   * @param headers Additional headers
   * @returns Response from n8n
   */
  async proxyRequest(
    method: string,
    endpoint: string,
    data?: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    try {
      // Build headers properly for axios
      const requestHeaders: Record<string, string> = {
        'User-Agent': 'DeCamino-Backend/1.0',
      };

      // Handle FormData
      let requestData = data;
      const isFormData = headers?.['content-type']?.includes(
        'multipart/form-data',
      );

      // Check if data is already a FormData instance (from form-data package)
      const isFormDataInstance =
        data &&
        typeof data === 'object' &&
        (data.constructor?.name === 'FormData' ||
          data.getHeaders ||
          data.append);

      console.log('[N8nProxy] Data type check:', {
        isFormData: isFormData,
        isFormDataInstance: isFormDataInstance,
        dataType: typeof data,
        dataConstructor: data?.constructor?.name,
        hasGetHeaders: !!(data as any)?.getHeaders,
        hasAppend: !!(data as any)?.append,
      });

      if (isFormData && Buffer.isBuffer(data)) {
        // Raw FormData buffer - pass directly to axios with original content-type
        requestData = data;
        // Keep original content-type with boundary - DON'T modify it
        console.log(
          '[N8nProxy] Forwarding raw FormData buffer to n8n, size:',
          data.length,
        );
        // Don't touch content-type header - axios will use it as-is
      } else if (isFormDataInstance) {
        // Data is already a FormData instance - use it directly
        console.log('[N8nProxy] Using existing FormData instance');
        requestData = data;
        // Remove content-type so FormData can set it with boundary
        delete requestHeaders['content-type'];
        delete requestHeaders['Content-Type'];
      } else if (isFormData && data && typeof data === 'object') {
        // Reconstruct FormData from object
        console.log('[N8nProxy] Reconstructing FormData from object');
        const formData = new FormData();
        Object.keys(data).forEach((key) => {
          const value = data[key];
          if (value !== undefined && value !== null) {
            formData.append(key, value);
          }
        });
        requestData = formData;
        // Remove content-type so FormData can set it with boundary
        delete requestHeaders['content-type'];
        delete requestHeaders['Content-Type'];
      } else if (
        !isFormData &&
        !headers?.['Content-Type'] &&
        !headers?.['content-type']
      ) {
        requestHeaders['Content-Type'] = 'application/json';
      }

      // Merge with forwarded headers
      Object.assign(requestHeaders, headers);

      const config: AxiosRequestConfig = {
        method: method.toLowerCase() as any,
        url: endpoint,
        headers: requestHeaders,
      };

      if (
        requestData &&
        ['post', 'put', 'patch'].includes(method.toLowerCase())
      ) {
        config.data = requestData;
        console.log('[N8nProxy] Request config:', {
          method: config.method,
          url: endpoint,
          hasData: !!config.data,
          dataType: typeof config.data,
          dataConstructor: (config.data as any)?.constructor?.name,
          headersKeys: Object.keys(config.headers || {}),
        });
      }

      const response: AxiosResponse = await this.schedule(() =>
        this.axiosInstance.request(config),
      );

      // 304 Not Modified is a valid success response (caching)
      if (response.status === 304) {
        return response.data || { status: 'not-modified' };
      }

      return response.data;
    } catch (error: any) {
      if (error.response) {
        // 304 Not Modified should not be treated as error
        if (error.response.status === 304) {
          return error.response.data || { status: 'not-modified' };
        }

        // n8n returned an error response
        throw new HttpException(
          {
            message: error.response.data?.message || 'n8n request failed',
            statusCode: error.response.status,
            data: error.response.data,
          },
          error.response.status,
        );
      } else if (error.request) {
        // Request was made but no response received
        throw new HttpException(
          {
            message: 'No response from n8n',
            statusCode: HttpStatus.GATEWAY_TIMEOUT,
          },
          HttpStatus.GATEWAY_TIMEOUT,
        );
      } else {
        // Error setting up request
        throw new HttpException(
          {
            message: error.message || 'Internal server error',
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  /**
   * Get n8n base URL (for reference)
   */
  getBaseUrl(): string {
    return this.n8nBaseUrl;
  }
}
