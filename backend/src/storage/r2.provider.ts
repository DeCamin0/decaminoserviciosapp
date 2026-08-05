import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageProvider } from './storage-provider';
import type {
  GetObjectResult,
  PresignGetOptions,
  PresignPutOptions,
  PresignedUrlResult,
  PutObjectInput,
  PutObjectResult,
  StorageConfig,
} from './storage.types';

@Injectable()
export class R2Provider implements StorageProvider {
  private readonly logger = new Logger(R2Provider.name);
  private client: S3Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getConfig(): StorageConfig {
    return this.configService.get<StorageConfig>('storage') as StorageConfig;
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const cfg = this.getConfig();
    if (!cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) {
      throw new Error(
        'R2 client cannot be created: missing R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY',
      );
    }
    this.client = new S3Client({
      region: cfg.region || 'auto',
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: true,
    });
    return this.client;
  }

  private get bucket(): string {
    return this.getConfig().bucket;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const body =
      typeof input.body === 'string'
        ? Buffer.from(input.body, 'utf8')
        : Buffer.from(input.body);

    const result = await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );

    return {
      key: input.key,
      etag: result.ETag,
      bucket: this.bucket,
    };
  }

  async get(key: string): Promise<GetObjectResult> {
    const result = await this.getClient().send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`R2 get returned empty body for key=${key}`);
    }

    return {
      key,
      body: Buffer.from(bytes),
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      etag: result.ETag,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.getClient().send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (err: unknown) {
      const httpStatus = (err as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      const name = (err as { name?: string })?.name;
      if (httpStatus === 404 || name === 'NotFound' || name === 'NoSuchKey') {
        return false;
      }
      this.logger.warn(`R2 exists() unexpected error for key=${key}`);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getPresignedGetUrl(
    options: PresignGetOptions,
  ): Promise<PresignedUrlResult> {
    const expiresInSeconds = options.expiresInSeconds ?? 60;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
    });
    const url = await getSignedUrl(this.getClient(), command, {
      expiresIn: expiresInSeconds,
    });
    return { url, key: options.key, expiresInSeconds };
  }

  async getPresignedPutUrl(
    options: PresignPutOptions,
  ): Promise<PresignedUrlResult> {
    const expiresInSeconds = options.expiresInSeconds ?? 300;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
      ContentType: options.contentType,
    });
    const url = await getSignedUrl(this.getClient(), command, {
      expiresIn: expiresInSeconds,
    });
    return { url, key: options.key, expiresInSeconds };
  }
}
