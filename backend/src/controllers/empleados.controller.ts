import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadosService } from '../services/empleados.service';

@Controller('api/empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    const codigo = user?.userId;
    const empleado = await this.empleadosService.getEmpleadoByCodigo(codigo);
    return { success: true, empleado };
  }
}
