import { INestApplication } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ComunicadosStorageService } from '../services/comunicados-storage.service';
import { PushService } from '../services/push.service';
import { ComunicadosController } from './comunicados.controller';
import { ComunicadosDebugController } from './comunicados-debug.controller';
import { ComunicadosModule } from './comunicados.module';
import { ComunicadosService } from './comunicados.service';

function registeredRoutes(app: INestApplication): string[] {
  const instance = app.getHttpAdapter().getInstance();
  const stack = instance.router?.stack ?? instance._router?.stack ?? [];
  const routes: string[] = [];
  const visit = (layers: any[]) => {
    for (const layer of layers || []) {
      if (layer.route?.path) {
        const methods = Object.keys(layer.route.methods)
          .map((method: string) => method.toUpperCase())
          .join(',');
        routes.push(`${methods} ${layer.route.path}`);
      } else if (Array.isArray(layer.handle?.stack)) {
        visit(layer.handle.stack);
      }
    }
  };
  visit(stack);
  return routes;
}

describe('ComunicadosModule debug routes', () => {
  it('keeps the real controller and does not register the debug controller', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      ComunicadosModule,
    );
    const exportsMeta = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      ComunicadosModule,
    );

    expect(controllers).toContain(ComunicadosController);
    expect(controllers).not.toContain(ComunicadosDebugController);
    expect(exportsMeta).toContain(ComunicadosService);
  });

  describe('HTTP surface without a database', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ComunicadosModule],
      })
        .overrideProvider(PrismaService)
        .useValue({
          onModuleInit: async () => undefined,
          onModuleDestroy: async () => undefined,
          $connect: async () => undefined,
          $disconnect: async () => undefined,
        })
        .overrideProvider(PushService)
        .useValue({})
        .overrideProvider(ComunicadosStorageService)
        .useValue({})
        .compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app?.close();
    });

    it('keeps the comunicados API and drops the debug routes', () => {
      const routes = registeredRoutes(app);
      expect(routes).toEqual(
        expect.arrayContaining([
          'GET /api/comunicados',
          'GET /api/comunicados/unread-count',
          'POST /api/comunicados',
        ]),
      );
      const joined = routes.join('\n');
      expect(joined).not.toContain('debug/table-structure');
      expect(joined).not.toContain('debug/add-columns');
    });
  });
});
