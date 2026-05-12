import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Logger,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClientesService } from '../services/clientes.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/clientes')
export class ClientesController {
  private readonly logger = new Logger(ClientesController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientesService: ClientesService,
  ) {}

  @Get()
  async getClientes() {
    try {
      const clientes = await this.prisma.clientes.findMany({
        orderBy: {
          NOMBRE_O_RAZON_SOCIAL: 'asc',
        },
      });

      // Mapează câmpurile pentru compatibilitate cu frontend-ul/n8n
      const mapped = clientes.map((c: any) => {
        const rest = { ...c };
        delete rest.portal_invite_token;
        return {
          ...rest,
          // n8n trimitea `tipo` cu lowercase - păstrăm același nume de câmp
          tipo: c.TIPO ?? c.tipo ?? null,
          // Frontend-ul așteaptă câmpul cu spații, nu cu underscore
          'NOMBRE O RAZON SOCIAL':
            c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? null,
          // Păstrăm și varianta cu underscore pentru compatibilitate
          NOMBRE_O_RAZON_SOCIAL: c.NOMBRE_O_RAZON_SOCIAL ?? null,
          // Frontend-ul așteaptă 'CODIGO POSTAL' (cu spațiu) în loc de CODIGO_POSTAL (cu underscore)
          'CODIGO POSTAL': c.CODIGO_POSTAL ?? c['CODIGO POSTAL'] ?? null,
          // Păstrăm și varianta cu underscore pentru compatibilitate
          CODIGO_POSTAL: c.CODIGO_POSTAL ?? null,
          // Servicio entrega
          'SERVICIO ENTREGA':
            c.SERVICIO_ENTREGA ?? c['SERVICIO ENTREGA'] ?? null,
          SERVICIO_ENTREGA: c.SERVICIO_ENTREGA ?? null,
          // Telefon entrega
          'TELEFON ENTREGA': c.TELEFONO_ENTREGA ?? c['TELEFON ENTREGA'] ?? null,
          TELEFONO_ENTREGA: c.TELEFONO_ENTREGA ?? null,
        };
      });

      return mapped;
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to load clients',
      };
    }
  }

  /**
   * POST endpoint pentru CRUD operations (add/edit/delete)
   * Compatibil cu n8n workflow-ul original care folosea `action` în body
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async crudCliente(@Body() body: any) {
    try {
      this.logger.log(
        `📝 CRUD request - action: ${body.action || 'missing'}, id: ${body.id || 'missing'}`,
      );

      const action = body.action?.toLowerCase();

      if (action === 'add') {
        return await this.clientesService.addCliente(body);
      } else if (action === 'edit') {
        if (!body.id) {
          throw new BadRequestException('ID is required for edit operation');
        }
        return await this.clientesService.updateCliente(Number(body.id), body);
      } else if (action === 'delete') {
        if (!body.id) {
          throw new BadRequestException('ID is required for delete operation');
        }
        return await this.clientesService.deleteCliente(Number(body.id));
      } else {
        throw new BadRequestException(
          `Invalid action: ${action}. Must be 'add', 'edit', or 'delete'.`,
        );
      }
    } catch (error: any) {
      this.logger.error('❌ Error in CRUD operation:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error en operación CRUD: ${error.message}`,
      );
    }
  }

  /**
   * GET endpoint pentru lista de furnizori (proveedores)
   */
  @Get('proveedores')
  @UseGuards(JwtAuthGuard)
  async getProveedores() {
    try {
      return await this.clientesService.getProveedores();
    } catch (error: any) {
      this.logger.error('❌ Error fetching proveedores:', error);
      throw error;
    }
  }

  /**
   * POST endpoint pentru CRUD operations pentru furnizori (add/edit/delete)
   * Compatibil cu n8n workflow-ul original care folosea `action` în body
   */
  @Post('proveedores')
  @UseGuards(JwtAuthGuard)
  async crudProveedor(@Body() body: any) {
    try {
      this.logger.log(
        `📝 CRUD proveedor request - action: ${body.action || 'missing'}, id: ${body.id || 'missing'}`,
      );

      const action = body.action?.toLowerCase();

      if (action === 'add') {
        return await this.clientesService.addProveedor(body);
      } else if (action === 'edit') {
        if (!body.id) {
          throw new BadRequestException('ID is required for edit operation');
        }
        return await this.clientesService.updateProveedor(
          Number(body.id),
          body,
        );
      } else if (action === 'delete') {
        if (!body.id) {
          throw new BadRequestException('ID is required for delete operation');
        }
        return await this.clientesService.deleteProveedor(Number(body.id));
      } else {
        throw new BadRequestException(
          `Invalid action: ${action}. Must be 'add', 'edit', or 'delete'.`,
        );
      }
    } catch (error: any) {
      this.logger.error('❌ Error in CRUD proveedor operation:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error en operación CRUD proveedor: ${error.message}`,
      );
    }
  }

  /** Genera o devuelve el token de invitación al portal (enlace + QR por comunidad). */
  @Post(':clienteId/portal-invite-token')
  @UseGuards(JwtAuthGuard)
  async ensurePortalInviteToken(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Body() body?: { rotate?: boolean },
  ) {
    const data = await this.clientesService.ensurePortalInviteToken(
      clienteId,
      Boolean(body?.rotate),
    );
    return { success: true, data };
  }

  /** Contactos por comunidad (portal / notificaciones). `clienteId` = id numérico en tabla Clientes. */
  @Get(':clienteId/contactos')
  @UseGuards(JwtAuthGuard)
  async listClienteContactos(
    @Param('clienteId', ParseIntPipe) clienteId: number,
  ) {
    const data = await this.clientesService.listClienteContactos(clienteId);
    return { success: true, data };
  }

  @Post(':clienteId/contactos')
  @UseGuards(JwtAuthGuard)
  async createClienteContacto(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.clientesService.createClienteContacto(clienteId, body);
  }

  @Put(':clienteId/contactos/:contactoId')
  @UseGuards(JwtAuthGuard)
  async updateClienteContacto(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Param('contactoId', ParseIntPipe) contactoId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.clientesService.updateClienteContacto(
      clienteId,
      contactoId,
      body,
    );
  }

  @Delete(':clienteId/contactos/:contactoId')
  @UseGuards(JwtAuthGuard)
  async deleteClienteContacto(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Param('contactoId', ParseIntPipe) contactoId: number,
  ) {
    return this.clientesService.deleteClienteContacto(clienteId, contactoId);
  }

  /** Facturas subidas al portal (PDF) por cliente — listado CRM. */
  @Get(':clienteId/portal-facturas-manuales')
  @UseGuards(JwtAuthGuard)
  async listPortalFacturasManuales(
    @Param('clienteId', ParseIntPipe) clienteId: number,
  ) {
    return this.clientesService.listPortalFacturasManuales(clienteId);
  }

  @Get(':clienteId/portal-facturas-manuales/:facturaId/archivo')
  @UseGuards(JwtAuthGuard)
  async getPortalFacturaManualArchivo(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Param('facturaId', ParseIntPipe) facturaId: number,
    @Res() res: Response,
  ) {
    const { buffer, filename, mime } =
      await this.clientesService.getPortalFacturaManualPdfBuffer(
        clienteId,
        facturaId,
      );
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }

  /**
   * GET endpoint pentru obținerea contractelor unui client după NIF
   * Migrat de la n8n webhook: /webhook/8e669710-0850-4b9b-b48e-fc19d09e4841
   */
  @Get(':nif/contracts')
  @UseGuards(JwtAuthGuard)
  async getContratosCliente(@Param('nif') nif: string) {
    try {
      this.logger.log(`📥 Fetching contracts for cliente NIF: ${nif}`);
      const contratos = await this.clientesService.getContratosCliente(nif);
      return {
        success: true,
        data: contratos,
        message: `Se encontraron ${contratos.length} contrato(s) para el cliente.`,
      };
    } catch (error: any) {
      this.logger.error('❌ Error fetching contratos cliente:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al cargar contratos: ${error.message}`,
      );
    }
  }

  /**
   * POST endpoint pentru upload/delete contracte
   * Migrat de la n8n webhook: /webhook/f1535e89-f74b-4df3-8516-5dfdda8c6b35
   * Acceptă action: 'upload' | 'delete'
   */
  @Post('contracts')
  @UseGuards(JwtAuthGuard)
  async crudContract(@Body() body: any) {
    try {
      this.logger.log(
        `📝 Contract CRUD request - action: ${body.action || 'missing'}, id: ${body.id || 'missing'}`,
      );

      const action = body.action?.toLowerCase();

      if (action === 'upload') {
        return await this.clientesService.uploadContract(body);
      } else if (action === 'delete') {
        if (!body.id) {
          throw new BadRequestException('ID is required for delete operation');
        }
        return await this.clientesService.deleteContract(Number(body.id));
      } else {
        throw new BadRequestException(
          `Invalid action: ${action}. Must be 'upload' or 'delete'.`,
        );
      }
    } catch (error: any) {
      this.logger.error('❌ Error in contract CRUD operation:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error en operación de contrato: ${error.message}`,
      );
    }
  }
}
