import {
  Controller,
  All,
  Req,
  Res,
  Body,
  Query,
  Headers,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { N8nProxyService } from '../services/n8n-proxy.service';
import multer from 'multer';
import FormData from 'form-data';

/**
 * Proxy controller for routing requests to n8n
 * This allows gradual migration: frontend can switch endpoints one by one
 */
@Controller('api/n8n')
export class ProxyController {
  constructor(private readonly n8nProxyService: N8nProxyService) {}

  /**
   * Catch-all route for proxying requests to n8n
   * Matches: /api/n8n/webhook/...
   */
  @All('*')
  async proxyToN8n(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any,
    @Query() query: any,
    @Headers() headers: Record<string, string>,
  ) {
    try {
      // Extract the endpoint path (remove /api/n8n prefix)
      let endpoint = req.path.replace('/api/n8n', '') || '/';

      // Add query parameters to endpoint if they exist
      if (Object.keys(query).length > 0) {
        const queryString = new URLSearchParams(query).toString();
        endpoint = `${endpoint}?${queryString}`;
      }

      // Handle FormData with multer (body was NOT parsed by Express)
      const isFormData = req.headers['content-type']?.includes(
        'multipart/form-data',
      );
      let requestBody = body;

      if (isFormData) {
        // Parse FormData using multer (body stream is still available)
        return new Promise((resolve, reject) => {
          console.log('[Proxy] Parsing FormData with multer...');
          const upload = multer().any();
          upload(req, res, async (err: any) => {
            if (err) {
              console.error('[Proxy] Multer error:', err);
              return reject(err);
            }

            console.log('[Proxy] Multer parsed - req.body:', req.body);
            console.log(
              '[Proxy] req.body keys:',
              req.body ? Object.keys(req.body) : 'empty',
            );

            // Reconstruct FormData for axios
            const formData = new FormData();

            // Add fields from req.body (multer puts them here)
            if (req.body && Object.keys(req.body).length > 0) {
              Object.keys(req.body).forEach((key) => {
                const value = req.body[key];
                if (value !== undefined && value !== null) {
                  formData.append(key, String(value));
                  console.log(`[Proxy] Added field: ${key} = ${value}`);
                }
              });
            } else {
              console.error('[Proxy] ERROR: req.body is empty after multer!');
            }

            // Add files parsed by multer (buffer-based)
            const files = (req as any).files || [];
            if (Array.isArray(files) && files.length > 0) {
              files.forEach((file: any) => {
                if (!file || !file.buffer) return;
                const fname =
                  file.originalname || file.fieldname || 'upload.bin';
                const ftype = file.mimetype || 'application/octet-stream';
                formData.append(file.fieldname || 'file', file.buffer, {
                  filename: fname,
                  contentType: ftype,
                });
                console.log(
                  `[Proxy] Added file: field=${file.fieldname} name=${fname} type=${ftype} size=${file.size}`,
                );
              });
            } else {
              console.warn('[Proxy] No files found in multer parsing.');
            }

            requestBody = formData;

            try {
              const forwardHeaders: Record<string, string> = {};
              const excludeHeaders = ['host', 'connection', 'content-length'];
              Object.keys(headers).forEach((key) => {
                if (!excludeHeaders.includes(key.toLowerCase())) {
                  forwardHeaders[key] = headers[key];
                }
              });

              console.log(
                '[Proxy] Calling n8nProxyService.proxyRequest with FormData',
              );
              const result = await this.n8nProxyService.proxyRequest(
                req.method,
                endpoint,
                requestBody,
                forwardHeaders,
              );

              console.log('[Proxy] Got response from n8n for avatar:', {
                type: typeof result,
                isArray: Array.isArray(result),
                keys:
                  result && typeof result === 'object'
                    ? Object.keys(result)
                    : 'not object',
                preview: JSON.stringify(result).substring(0, 200),
              });

              return resolve(res.status(200).json(result) as any);
            } catch (error: any) {
              const statusCode = error.status || 500;
              const message =
                error.response?.message || error.message || 'Proxy error';
              return resolve(
                res
                  .status(statusCode)
                  .json({ error: message, statusCode }) as any,
              );
            }
          });
        });
      }

      // Log for debugging (non-FormData requests)
      console.log(`[Proxy] ${req.method} ${endpoint}`, {
        hasBody: !!body,
        queryParams: Object.keys(query).length,
        contentType: headers['content-type'],
        bodyKeys:
          body && typeof body === 'object' ? Object.keys(body) : 'not object',
      });

      // Forward relevant headers (exclude host, connection, etc.)
      const forwardHeaders: Record<string, string> = {};
      const excludeHeaders = ['host', 'connection', 'content-length'];

      Object.keys(headers).forEach((key) => {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          forwardHeaders[key] = headers[key];
        }
      });

      // Proxy the request to n8n
      const result = await this.n8nProxyService.proxyRequest(
        req.method,
        endpoint,
        requestBody,
        forwardHeaders,
      );

      // Log response for debugging (truncate if too large)
      const resultStr = JSON.stringify(result);
      console.log(`[Proxy] Response for ${endpoint}:`, {
        type: typeof result,
        isArray: Array.isArray(result),
        length: Array.isArray(result)
          ? result.length
          : Object.keys(result || {}).length,
        preview: resultStr.substring(0, 200),
      });

      // Check if response is binary (image) or JSON
      // For now, assume JSON - if n8n returns binary, we'll need to handle it differently
      return res.status(200).json(result);
    } catch (error: any) {
      // Log error for debugging
      console.error(`[Proxy Error] ${req.method} ${req.path}:`, {
        status: error.status,
        message: error.message,
      });

      // Handle errors from n8n
      const statusCode = error.status || 500;
      const message = error.response?.message || error.message || 'Proxy error';

      return res.status(statusCode).json({
        error: message,
        statusCode,
      });
    }
  }
}
