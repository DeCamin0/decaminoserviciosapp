import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/informes/items')
@UseGuards(JwtAuthGuard)
export class InformesItemsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAll(@Query('activo') activo?: string) {
    const where =
      activo !== undefined && activo !== ''
        ? { activo: activo === 'true' || activo === '1' }
        : {};
    const items = await this.prisma.informes_items.findMany({
      where,
      orderBy: [{ item_id: 'asc' }],
    });
    return { success: true, data: items };
  }

  @Post()
  async create(
    @Body()
    body: {
      item_id: string;
      nombre: string;
      descripcion?: string;
      precio: number;
      observaciones?: string;
      activo?: boolean;
    },
  ) {
    const item = await this.prisma.informes_items.create({
      data: {
        item_id: body.item_id.trim(),
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() ?? null,
        precio: Number(body.precio),
        observaciones: body.observaciones?.trim() ?? null,
        activo: body.activo ?? true,
      },
    });
    return { success: true, data: item };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      nombre?: string;
      descripcion?: string;
      precio?: number;
      observaciones?: string;
      activo?: boolean;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (body.nombre !== undefined) data.nombre = body.nombre.trim();
    if (body.descripcion !== undefined)
      data.descripcion = body.descripcion?.trim() ?? null;
    if (body.precio !== undefined) data.precio = Number(body.precio);
    if (body.observaciones !== undefined)
      data.observaciones = body.observaciones?.trim() ?? null;
    if (body.activo !== undefined) data.activo = body.activo;
    const item = await this.prisma.informes_items.update({
      where: { id },
      data,
    });
    return { success: true, data: item };
  }
}
