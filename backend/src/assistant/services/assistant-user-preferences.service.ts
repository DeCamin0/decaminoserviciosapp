import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateAssistantPreferencesDto } from '../dto/assistant-preferences.dto';
import {
  DEFAULT_ASSISTANT_PREFERENCES,
  type AssistantLocale,
  type AssistantResponseStyle,
  type AssistantTone,
  type ResolvedAssistantPreferences,
} from '../types/assistant-preferences.types';

const ALLOWED_LOCALES = new Set<string>(['es', 'en', 'ro']);
const ALLOWED_STYLES = new Set<string>(['short', 'normal', 'detailed']);
const ALLOWED_TONES = new Set<string>(['professional', 'friendly']);

export type AssistantPreferencesPublic = {
  opted_in: boolean;
  locale: string | null;
  response_style: string | null;
  tone: string | null;
  updated_at: Date | null;
};

@Injectable()
export class AssistantUserPreferencesService {
  private readonly logger = new Logger(AssistantUserPreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valores efectivos para prompts. Sin fila o opted_in false → inactivo (comportamiento legacy).
   */
  async resolveForAssistant(
    userId: string,
  ): Promise<ResolvedAssistantPreferences> {
    try {
      const row = await this.prisma.assistantUserPreferences.findUnique({
        where: { usuario_id: userId },
      });
      if (!row || !row.opted_in) {
        return { ...DEFAULT_ASSISTANT_PREFERENCES };
      }
      return {
        active: true,
        locale: this.coerceLocale(row.locale),
        responseStyle: this.coerceStyle(row.response_style),
        tone: this.coerceTone(row.tone),
      };
    } catch (e: any) {
      this.logger.warn(
        `Preferencias no disponibles (${e?.message ?? e}); fallback sin personalización`,
      );
      return { ...DEFAULT_ASSISTANT_PREFERENCES };
    }
  }

  /** Respuesta segura para GET (sin PII extra). */
  async getPublic(userId: string): Promise<AssistantPreferencesPublic> {
    const row = await this.prisma.assistantUserPreferences.findUnique({
      where: { usuario_id: userId },
    });
    if (!row) {
      return {
        opted_in: false,
        locale: null,
        response_style: null,
        tone: null,
        updated_at: null,
      };
    }
    return {
      opted_in: row.opted_in,
      locale: row.locale,
      response_style: row.response_style,
      tone: row.tone,
      updated_at: row.updated_at,
    };
  }

  async upsert(
    userId: string,
    body: UpdateAssistantPreferencesDto,
  ): Promise<AssistantPreferencesPublic> {
    this.validatePatch(body);

    const existing = await this.prisma.assistantUserPreferences.findUnique({
      where: { usuario_id: userId },
    });

    const opted_in =
      body.opted_in !== undefined
        ? body.opted_in
        : (existing?.opted_in ?? false);

    const norm = (v: string | null | undefined) =>
      v === '' || v === undefined ? null : v;

    const locale =
      body.locale !== undefined
        ? norm(body.locale as string | null | undefined)
        : (existing?.locale ?? null);
    const response_style =
      body.response_style !== undefined
        ? norm(body.response_style as string | null | undefined)
        : (existing?.response_style ?? null);
    const tone =
      body.tone !== undefined
        ? norm(body.tone as string | null | undefined)
        : (existing?.tone ?? null);

    await this.prisma.assistantUserPreferences.upsert({
      where: { usuario_id: userId },
      create: {
        usuario_id: userId,
        opted_in,
        locale,
        response_style,
        tone,
      },
      update: {
        opted_in,
        locale,
        response_style,
        tone,
      },
    });

    return this.getPublic(userId);
  }

  private validatePatch(body: UpdateAssistantPreferencesDto): void {
    if (body.locale != null && body.locale !== '') {
      if (!ALLOWED_LOCALES.has(body.locale)) {
        throw new BadRequestException('locale debe ser es, en o ro');
      }
    }
    if (body.response_style != null && body.response_style !== '') {
      if (!ALLOWED_STYLES.has(body.response_style)) {
        throw new BadRequestException(
          'response_style debe ser short, normal o detailed',
        );
      }
    }
    if (body.tone != null && body.tone !== '') {
      if (!ALLOWED_TONES.has(body.tone)) {
        throw new BadRequestException('tone debe ser professional o friendly');
      }
    }
  }

  private coerceLocale(v: string | null | undefined): AssistantLocale {
    if (v && ALLOWED_LOCALES.has(v)) {
      return v as AssistantLocale;
    }
    return 'es';
  }

  private coerceStyle(v: string | null | undefined): AssistantResponseStyle {
    if (v && ALLOWED_STYLES.has(v)) {
      return v as AssistantResponseStyle;
    }
    return 'normal';
  }

  private coerceTone(v: string | null | undefined): AssistantTone {
    if (v && ALLOWED_TONES.has(v)) {
      return v as AssistantTone;
    }
    return 'professional';
  }
}
