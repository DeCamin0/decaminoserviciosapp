import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { createConnection, type Connection } from 'mysql2/promise';
import { spawn } from 'child_process';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { TenantRegistryService } from './tenant-registry.service';
import { TenantCryptoService } from './tenant-crypto.service';

function escIdent(part: string): string {
  return '`' + String(part).replace(/`/g, '``') + '`';
}

function buildMysqlUrl(params: {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}): string {
  return `mysql://${encodeURIComponent(params.user)}:${encodeURIComponent(params.password)}@${params.host}:${params.port}/${encodeURIComponent(params.database)}?charset=utf8mb4`;
}

@Injectable()
export class TenantProvisioningService {
  constructor(
    private readonly registry: TenantRegistryService,
    private readonly crypto: TenantCryptoService,
  ) {}

  assertProvisionEnv(): void {
    const host = process.env.DB_PROVISION_HOST?.trim();
    const user = process.env.DB_PROVISION_USER?.trim();
    if (!host || !user) {
      throw new ServiceUnavailableException(
        'DB provisioning not configured: set DB_PROVISION_HOST and DB_PROVISION_USER (and DB_PROVISION_PASSWORD) on the server',
      );
    }
  }

  generateDbPassword(): string {
    return randomBytes(24).toString('base64url');
  }

  /** Fire-and-forget background job */
  scheduleProvision(tenantId: string): void {
    setImmediate(() => {
      void this.runProvisionJob(tenantId).catch((err) => {
        console.error('[TenantProvisioning] job error', tenantId, err);
      });
    });
  }

  async runProvisionJob(tenantId: string): Promise<void> {
    const row = await this.registry.getTenantWithSecret(tenantId);
    if (!row) {
      return;
    }
    if (row.status === 'active') {
      return;
    }

    this.assertProvisionEnv();
    const host = process.env.DB_PROVISION_HOST!.trim();
    const port = parseInt(process.env.DB_PROVISION_PORT || '3306', 10);
    const adminUser = process.env.DB_PROVISION_USER!.trim();
    const adminPassword = process.env.DB_PROVISION_PASSWORD ?? '';
    const userHost = (process.env.DB_PROVISION_APP_USER_HOST || '%').trim();

    let plainPassword: string;
    try {
      plainPassword = this.crypto.decrypt(row.database_password_enc);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.registry.appendLog(
        tenantId,
        'error',
        `Decrypt failed: ${msg}`,
      );
      await this.registry.updateStatus(tenantId, 'failed', msg.slice(0, 2000));
      return;
    }

    let conn: Connection | undefined;
    try {
      conn = await createConnection({
        host,
        port,
        user: adminUser,
        password: adminPassword,
        multipleStatements: false,
      });
      await this.registry.appendLog(
        tenantId,
        'info',
        'Provision: admin DB connection OK',
      );

      const dbName = row.database_name;
      const [dbRows] = await conn.query(
        `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
        [dbName],
      );
      const existingDb = dbRows as Array<{ SCHEMA_NAME: string }>;
      if (!existingDb.length) {
        await conn.query(
          `CREATE DATABASE ${escIdent(dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
        await this.registry.appendLog(
          tenantId,
          'info',
          `Created database ${dbName}`,
        );
      } else {
        await this.registry.appendLog(
          tenantId,
          'warn',
          `Database ${dbName} already exists; skipped CREATE DATABASE`,
        );
      }

      const dbUser = row.database_user;
      const userQuoted = `${escIdent(dbUser)}@${escIdent(userHost)}`;
      try {
        await conn.query(`CREATE USER ${userQuoted} IDENTIFIED BY ?`, [
          plainPassword,
        ]);
        await this.registry.appendLog(
          tenantId,
          'info',
          `Created DB user ${dbUser}@${userHost}`,
        );
      } catch (e: unknown) {
        const err = e as { code?: string; errno?: number; message?: string };
        const exists =
          err.code === 'ER_CANNOT_USER' ||
          err.errno === 1396 ||
          /exists/i.test(String(err.message || ''));
        if (exists) {
          await conn.query(`ALTER USER ${userQuoted} IDENTIFIED BY ?`, [
            plainPassword,
          ]);
          await this.registry.appendLog(
            tenantId,
            'warn',
            `User ${dbUser}@${userHost} already existed; password reset`,
          );
        } else {
          throw e;
        }
      }

      await conn.query(
        `GRANT ALL PRIVILEGES ON ${escIdent(dbName)}.* TO ${userQuoted}`,
      );
      await conn.query(`FLUSH PRIVILEGES`);
      await this.registry.appendLog(tenantId, 'info', 'GRANT applied');

      await conn.end();
      conn = undefined;

      const appUrl = buildMysqlUrl({
        user: dbUser,
        password: plainPassword,
        host,
        port,
        database: dbName,
      });
      await this.runPrismaDbPush(appUrl);
      await this.registry.appendLog(
        tenantId,
        'info',
        'Schema sync completed (prisma db push, no seed)',
      );
      await this.registry.updateStatus(tenantId, 'active', null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.registry.appendLog(tenantId, 'error', msg);
      await this.registry.updateStatus(tenantId, 'failed', msg.slice(0, 2000));
      if (conn) {
        try {
          await conn.end();
        } catch {
          /* ignore */
        }
      }
    }
  }

  private runPrismaDbPush(databaseUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const prismaCli = join(
        process.cwd(),
        'node_modules',
        'prisma',
        'build',
        'index.js',
      );
      const child = spawn(
        process.execPath,
        [prismaCli, 'db', 'push', '--skip-generate'],
        {
          env: { ...process.env, DATABASE_URL: databaseUrl },
          cwd: process.cwd(),
        },
      );
      let stderr = '';
      let stdout = '';
      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new BadRequestException(
              `prisma db push exited ${code}: ${(stderr || stdout).slice(0, 4000)}`,
            ),
          );
        }
      });
    });
  }
}
