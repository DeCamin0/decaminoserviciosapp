import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MeService } from '../services/me.service';

@Controller('api/me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return this.meService.getMe(user);
  }
}
