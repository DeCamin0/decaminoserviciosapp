import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Handler pentru favicon.ico - evită log-ul de eroare 404
   */
  @Get('favicon.ico')
  getFavicon(@Res() res: Response) {
    res.status(204).end(); // No Content
  }
}
