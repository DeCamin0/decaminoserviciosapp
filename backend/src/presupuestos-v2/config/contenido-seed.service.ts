import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LEGACY_BLOQUES_DECAMINO,
  PRESENTACION_DECAMINO_SEED,
  ACEPTACION_DECAMINO_SEED,
  SERVICIO_BLOQUES_REFS,
} from './legacy-content-seed';
import { normalizeContenidoComercial } from './config-catalog';

@Injectable()
export class ContenidoSeedService {
  private readonly logger = new Logger(ContenidoSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent: upsert Legacy Decamino blocks + enrich brand/servicios. */
  async ensureLegacyContentSeeded() {
    let orden = 0;
    for (const b of LEGACY_BLOQUES_DECAMINO) {
      await this.prisma.v2ContenidoBloque.upsert({
        where: { codigo: b.codigo },
        create: {
          codigo: b.codigo,
          nombre: b.nombre,
          categoria: b.categoria,
          body_json: b.body as Prisma.InputJsonValue,
          activo: true,
          orden: orden++,
          brand_id: null,
        },
        update: {
          nombre: b.nombre,
          categoria: b.categoria,
          body_json: b.body as Prisma.InputJsonValue,
          activo: true,
        },
      });
    }

    const brands = await this.prisma.v2Brand.findMany({
      where: { activo: true },
    });
    for (const brand of brands) {
      const prev = (brand.config_json || {}) as Record<string, any>;
      const needsPresentacion =
        !Array.isArray(prev.presentacion) || prev.presentacion.length < 3;
      const needsGarantia =
        !Array.isArray(prev.garantia_bloques) || !prev.garantia_bloques.length;
      const needsCond =
        !Array.isArray(prev.condiciones_secciones) ||
        !prev.condiciones_secciones.length;
      if (!needsPresentacion && !needsGarantia && !needsCond) continue;

      const garantiaBloque = LEGACY_BLOQUES_DECAMINO.find(
        (x) => x.codigo === 'garantia_corporativa',
      );
      const condBloque = LEGACY_BLOQUES_DECAMINO.find(
        (x) => x.codigo === 'condiciones_generales',
      );
      const next = {
        ...prev,
        ...(needsPresentacion && {
          presentacion: PRESENTACION_DECAMINO_SEED,
        }),
        ...(needsGarantia && {
          garantia_bloques: (garantiaBloque?.body as any)?.cajas || [],
          garantia_intro: (garantiaBloque?.body as any)?.intro || '',
        }),
        ...(needsCond && {
          condiciones_secciones: (condBloque?.body as any)?.secciones || [],
          condiciones_intro: (condBloque?.body as any)?.intro || '',
        }),
        aceptacion_texto: prev.aceptacion_texto || ACEPTACION_DECAMINO_SEED,
        validez_dias: prev.validez_dias ?? 60,
      };
      await this.prisma.v2Brand.update({
        where: { id: brand.id },
        data: { config_json: next as Prisma.InputJsonValue },
      });
    }

    for (const [codigo, refs] of Object.entries(SERVICIO_BLOQUES_REFS)) {
      const svc = await this.prisma.v2ServicioComercial.findUnique({
        where: { codigo_interno: codigo },
      });
      if (!svc) continue;
      const prev = normalizeContenidoComercial(
        svc.contenido_comercial_json,
        svc.nombre,
      );
      const already =
        Array.isArray((prev as any).bloques_refs) &&
        (prev as any).bloques_refs.length > 0;
      // Enrich short seeds: if few tareas and no refs, attach Legacy blocks
      const short =
        (prev.tareas_auxiliares?.length || 0) +
          (prev.tareas_limpieza?.length || 0) +
          (prev.tareas?.length || 0) <
        6;
      if (already && !short) continue;

      const auxOp = LEGACY_BLOQUES_DECAMINO.find(
        (b) => b.codigo === 'auxiliares_operativa',
      );
      const auxMant = LEGACY_BLOQUES_DECAMINO.find(
        (b) => b.codigo === 'auxiliares_mantenimiento',
      );
      const limpFreq = LEGACY_BLOQUES_DECAMINO.find(
        (b) => b.codigo === 'limpieza_frecuencias',
      );

      let tareas_auxiliares = prev.tareas_auxiliares || [];
      let tareas_limpieza = prev.tareas_limpieza || [];
      let tareas = prev.tareas || [];
      let operativa = prev.operativa || [];

      if (codigo === 'auxiliares' || codigo === 'auxiliar_limpieza') {
        if (tareas_auxiliares.length < 6) {
          tareas_auxiliares = [
            ...((auxOp?.body as any)?.items || []),
            ...((auxMant?.body as any)?.items || []),
          ];
        }
      }
      if (codigo === 'limpieza' || codigo === 'auxiliar_limpieza') {
        if (tareas_limpieza.length < 6) {
          const grupos = ((limpFreq?.body as any)?.grupos || []) as Array<{
            titulo: string;
            items: string[];
          }>;
          tareas_limpieza = grupos.flatMap((g) =>
            (g.items || []).map((it) => `${g.titulo}: ${it}`),
          );
        }
      }
      if (
        codigo === 'auxiliares' &&
        tareas.length < 6 &&
        !tareas_auxiliares.length
      ) {
        tareas = (auxOp?.body as any)?.items || [];
      }

      const periodicos =
        codigo === 'auxiliar_limpieza' &&
        !(prev.servicios_periodicos || []).length
          ? [
              {
                nombre: 'Cristales',
                periodicidad: 'trimestral',
                descripcion: 'Incluido en el precio',
                orden: 0,
              },
              {
                nombre: 'Abrillantado',
                periodicidad: 'anual',
                descripcion: 'Incluido en el precio',
                orden: 1,
              },
              {
                nombre: 'Limpieza de garaje',
                periodicidad: 'anual',
                descripcion: 'Incluido en el precio',
                orden: 2,
              },
            ]
          : prev.servicios_periodicos;

      const contenido = normalizeContenidoComercial(
        {
          ...prev,
          bloques_refs: refs,
          tareas_auxiliares,
          tareas_limpieza,
          tareas,
          operativa,
          servicios_periodicos: periodicos,
          template_key: prev.template_key || codigo,
        },
        svc.nombre,
      );

      await this.prisma.v2ServicioComercial.update({
        where: { id: svc.id },
        data: {
          contenido_comercial_json:
            contenido as unknown as Prisma.InputJsonValue,
        },
      });
    }

    this.logger.log('V2 Legacy commercial content seed ensured');
  }
}
