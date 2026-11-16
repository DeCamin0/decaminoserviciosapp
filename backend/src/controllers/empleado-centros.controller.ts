import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmpleadoCentrosService } from '../services/empleado-centros.service';

@Controller('api/centros-empleado')
@UseGuards(JwtAuthGuard)
export class EmpleadoCentrosController {
  constructor(private readonly centros: EmpleadoCentrosService) {}

  @Get()
  async getCentros(@Query('codigo') codigo: string, @Req() req: any) {
    const clean = String(codigo || '').trim();
    if (!clean) throw new BadRequestException('codigo es obligatorio');
    this.assertCanRead(req, clean);
    return this.centros.getCentros(clean);
  }

  @Put()
  async setCentros(
    @Body() body: { codigo?: string; centros?: string[] },
    @Req() req: any,
  ) {
    this.assertAdmin(req);
    const codigo = String(body?.codigo || '').trim();
    if (!codigo) throw new BadRequestException('codigo es obligatorio');
    const extras = await this.centros.setExtras(codigo, body?.centros || []);
    return { extras };
  }

  @Get('hoy')
  async diaHoy(@Req() req: any) {
    const codigo = this.selfCodigo(req);
    if (!codigo) throw new BadRequestException('Empleado sin código');
    return this.centros.diaHoy(codigo);
  }

  @Post('hoy')
  async elegirHoy(@Body() body: { centro?: string }, @Req() req: any) {
    const codigo = this.selfCodigo(req);
    if (!codigo) throw new BadRequestException('Empleado sin código');
    return this.centros.elegirHoy(codigo, String(body?.centro || ''));
  }

  private selfCodigo(req: any): string {
    return String(
      req?.user?.CODIGO || req?.user?.codigo || req?.user?.userId || '',
    ).trim();
  }

  private assertCanRead(req: any, codigo: string) {
    if (this.selfCodigo(req) === codigo) return;
    this.assertAdmin(req);
  }

  private assertAdmin(req: any) {
    const grupo = req?.user?.GRUPO || req?.user?.grupo;
    const ok =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';
    if (!ok) {
      throw new ForbiddenException(
        'No puedes cambiar los centros de otro empleado',
      );
    }
  }
}
