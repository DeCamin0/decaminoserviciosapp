import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { FotosTrabajoController } from './fotos-trabajo.controller';
import { FotosTrabajoService } from './fotos-trabajo.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [FotosTrabajoController],
  providers: [FotosTrabajoService],
  exports: [FotosTrabajoService],
})
export class FotosTrabajoModule {}
