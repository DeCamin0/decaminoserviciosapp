import {
  Injectable,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { createPool } from 'mysql2/promise';
import { randomUUID } from 'crypto';

export type TenantStatus = 'provisioning' | 'active' | 'failed' | 'inactive';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  notes: string | null;
  plan: string | null;
  /** Public API base URL (e.g. https://api.client.com) for super-admin health probes */
  api_public_url: string | null;
  /** e.g. production, staging */
  environment: string | null;
  database_name: string;
  database_user: string;
  status: TenantStatus;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

function parseMysqlUrl(urlStr: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error('Invalid TENANT_REGISTRY_DATABASE_URL');
  }
  if (!u.protocol.startsWith('mysql')) {
    throw new Error('TENANT_REGISTRY_DATABASE_URL must start with mysql://');
  }
  const database = u.pathname.replace(/^\//, '').split('?')[0];
  if (!database) {
    throw new Error(
      'TENANT_REGISTRY_DATABASE_URL must include database name in path',
    );
  }
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password || ''),
    database,
  };
}

@Injectable()
export class TenantRegistryService {
  private pool: Pool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.TENANT_REGISTRY_DATABASE_URL?.trim());
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Tenant registry not configured (set TENANT_REGISTRY_DATABASE_URL and run migrations/tenant_registry_tables.sql)',
      );
    }
  }

  private getPool(): Pool {
    this.assertConfigured();
    if (!this.pool) {
      const cfg = parseMysqlUrl(
        process.env.TENANT_REGISTRY_DATABASE_URL!.trim(),
      );
      this.pool = createPool({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        waitForConnections: true,
        connectionLimit: 5,
      });
    }
    return this.pool;
  }

  async slugExists(slug: string): Promise<boolean> {
    const [rows] = await this.getPool().query<RowDataPacket[]>(
      'SELECT 1 AS x FROM tenants WHERE slug = ? LIMIT 1',
      [slug],
    );
    return rows.length > 0;
  }

  async insertTenant(params: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    notes: string | null;
    plan: string | null;
    api_public_url: string | null;
    environment: string | null;
    database_name: string;
    database_user: string;
    database_password_enc: string;
  }): Promise<void> {
    try {
      await this.getPool().execute(
        `INSERT INTO tenants (id, name, slug, timezone, notes, plan, api_public_url, environment, database_name, database_user, database_password_enc, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'provisioning')`,
        [
          params.id,
          params.name,
          params.slug,
          params.timezone,
          params.notes,
          params.plan,
          params.api_public_url,
          params.environment,
          params.database_name,
          params.database_user,
          params.database_password_enc,
        ],
      );
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Slug or database name already exists');
      }
      throw e;
    }
  }

  async listTenants(): Promise<TenantRow[]> {
    const [rows] = await this.getPool().query<RowDataPacket[]>(
      `SELECT id, name, slug, timezone, notes, plan, api_public_url, environment, database_name, database_user, status, last_error, created_at, updated_at
       FROM tenants ORDER BY created_at DESC`,
    );
    return (rows as TenantRow[]).map((r) =>
      this.normalizeTenantRow(r as RowDataPacket),
    );
  }

  async getTenant(id: string): Promise<TenantRow | null> {
    const [rows] = await this.getPool().query<RowDataPacket[]>(
      `SELECT id, name, slug, timezone, notes, plan, api_public_url, environment, database_name, database_user, status, last_error, created_at, updated_at
       FROM tenants WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0] as RowDataPacket | undefined;
    return row ? this.normalizeTenantRow(row) : null;
  }

  async getTenantWithSecret(
    id: string,
  ): Promise<(TenantRow & { database_password_enc: string }) | null> {
    const [rows] = await this.getPool().query<RowDataPacket[]>(
      `SELECT id, name, slug, timezone, notes, plan, api_public_url, environment, database_name, database_user, database_password_enc, status, last_error, created_at, updated_at
       FROM tenants WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0] as RowDataPacket | undefined;
    if (!row) {
      return null;
    }
    const base = this.normalizeTenantRow(row);
    return {
      ...base,
      database_password_enc: String(row.database_password_enc ?? ''),
    };
  }

  private normalizeTenantRow(row: RowDataPacket): TenantRow {
    const api_public_url =
      row.api_public_url != null && String(row.api_public_url).trim() !== ''
        ? String(row.api_public_url).trim()
        : null;
    const environment =
      row.environment != null && String(row.environment).trim() !== ''
        ? String(row.environment).trim()
        : null;
    return { ...(row as unknown as TenantRow), api_public_url, environment };
  }

  async updateTenantMeta(
    id: string,
    meta: { api_public_url?: string | null; environment?: string | null },
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (meta.api_public_url !== undefined) {
      sets.push('api_public_url = ?');
      vals.push(meta.api_public_url);
    }
    if (meta.environment !== undefined) {
      sets.push('environment = ?');
      vals.push(meta.environment);
    }
    if (sets.length === 0) {
      return;
    }
    vals.push(id);
    await this.getPool().execute(
      `UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`,
      vals,
    );
  }

  async appendLog(
    tenantId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
  ): Promise<void> {
    const safe = [...message]
      .map((ch) => {
        const cp = ch.codePointAt(0)!;
        return cp >= 32 && cp !== 0x7f ? ch : ' ';
      })
      .join('')
      .slice(0, 8000);
    await this.getPool().execute(
      `INSERT INTO tenant_provision_logs (tenant_id, level, message) VALUES (?, ?, ?)`,
      [tenantId, level, safe],
    );
  }

  async listLogs(
    tenantId: string,
    limit = 100,
  ): Promise<
    Array<{ id: number; level: string; message: string; created_at: Date }>
  > {
    const [rows] = await this.getPool().query<RowDataPacket[]>(
      `SELECT id, level, message, created_at FROM tenant_provision_logs WHERE tenant_id = ? ORDER BY id DESC LIMIT ?`,
      [tenantId, limit],
    );
    return rows as Array<{
      id: number;
      level: string;
      message: string;
      created_at: Date;
    }>;
  }

  async updateStatus(
    id: string,
    status: TenantStatus,
    lastError: string | null,
  ): Promise<void> {
    await this.getPool().execute(
      `UPDATE tenants SET status = ?, last_error = ? WHERE id = ?`,
      [status, lastError, id],
    );
  }

  newId(): string {
    return randomUUID();
  }
}
