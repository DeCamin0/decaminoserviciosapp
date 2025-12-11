import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
  Req,
  Body,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AvatarService } from '../services/avatar.service';

@Controller('api/avatar')
@UseGuards(JwtAuthGuard)
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  /**
   * GET /api/avatar/me - Obține avatarul userului curent
   */
  @Get('me')
  async getMyAvatar(@Req() req: any) {
    const codigo = req.user?.userId || req.user?.CODIGO;
    if (!codigo) {
      throw new BadRequestException('User CODIGO not found in token');
    }

    const avatar = await this.avatarService.getAvatar(codigo);
    if (!avatar) {
      return { success: false, message: 'Avatar not found' };
    }

    return {
      success: true,
      AVATAR_B64: avatar.AVATAR_B64,
      CODIGO: avatar.CODIGO,
      NOMBRE: avatar.NOMBRE,
      FECHA_SUBIDA: avatar.FECHA_SUBIDA,
    };
  }

  /**
   * POST /api/avatar - Upload/update avatar (compatibil cu n8n)
   * Acceptă FormData cu: motivo, CODIGO, nombre, file/archivo
   */
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async uploadAvatar(
    @Req() req: any,
    @Body() body: any,
    @UploadedFiles() files: any[],
  ) {
    const motivo = body.motivo || 'Guardar';
    const codigo = body.CODIGO || req.user?.userId || req.user?.CODIGO;
    const nombre = body.nombre || null;

    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    // Verifică dacă userul poate accesa acest CODIGO (doar propriul sau admin)
    const userCodigo = req.user?.userId || req.user?.CODIGO;
    const isAdmin =
      req.user?.grupo === 'Admin' || req.user?.grupo === 'Developer';

    if (codigo !== userCodigo && !isAdmin) {
      throw new BadRequestException('You can only update your own avatar');
    }

    if (motivo === 'Guardar' || motivo === 'Editar') {
      // Upload/Update avatar
      // Acceptă 'file' sau 'archivo' (fallback)
      let uploadedFile = null;
      if (files && files.length > 0) {
        // Caută primul fișier (poate fi 'file' sau 'archivo')
        uploadedFile =
          files.find((f) => f.fieldname === 'file') ||
          files.find((f) => f.fieldname === 'archivo') ||
          files[0];
      }

      if (!uploadedFile || !uploadedFile.buffer) {
        throw new BadRequestException(
          'File is required for upload. Use multipart/form-data with field "file" or "archivo"',
        );
      }

      const fileBuffer = uploadedFile.buffer;

      const result = await this.avatarService.saveAvatar(
        codigo,
        nombre,
        fileBuffer,
      );

      return {
        success: true,
        avatar: result.avatar,
        url: result.avatar,
        version: result.version,
      };
    } else if (motivo === 'get') {
      // Get avatar
      const avatar = await this.avatarService.getAvatar(codigo);
      if (!avatar) {
        return { success: false, message: 'Avatar not found' };
      }

      return {
        success: true,
        AVATAR_B64: avatar.AVATAR_B64,
        CODIGO: avatar.CODIGO,
        NOMBRE: avatar.NOMBRE,
        FECHA_SUBIDA: avatar.FECHA_SUBIDA,
      };
    } else if (motivo === 'Eliminar') {
      // Delete avatar
      await this.avatarService.deleteAvatar(codigo);
      return {
        success: true,
        message: 'Avatar deleted successfully',
      };
    } else {
      throw new BadRequestException(
        `Invalid motivo: ${motivo}. Use 'Guardar', 'Editar', 'get', or 'Eliminar'`,
      );
    }
  }

  /**
   * DELETE /api/avatar - Șterge avatarul userului curent
   */
  @Delete()
  async deleteMyAvatar(@Req() req: any) {
    const codigo = req.user?.userId || req.user?.CODIGO;
    if (!codigo) {
      throw new BadRequestException('User CODIGO not found in token');
    }

    await this.avatarService.deleteAvatar(codigo);
    return {
      success: true,
      message: 'Avatar deleted successfully',
    };
  }

  /**
   * POST /api/avatar/bulk - Obține toate avatarele (compatibil cu n8n)
   * Acceptă JSON body cu { motivo: 'get' } sau FormData cu motivo='get'
   * Compatibil cu n8n: când nu trimite CODIGO, returnează toți angajații cu avatar
   */
  @Post('bulk')
  async getAllAvatars() {
    // Returnează toate avatarele (similar cu n8n când nu trimite CODIGO)
    const avatars = await this.avatarService.getAllAvatars();
    return avatars;
  }
}
