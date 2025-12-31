import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './services/assistant.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { DataQueryService } from './services/data-query.service';
import { ResponseGeneratorService } from './services/response-generator.service';
import { EscalationService } from './services/escalation.service';
import { AuditService } from './services/audit.service';
import { RbacService } from './services/rbac.service';
import { AiResponseService } from './services/ai-response.service';
import { ConversationContextService } from './services/conversation-context.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramService } from '../services/telegram.service';
import { VacacionesModule } from '../vacaciones/vacaciones.module';

@Module({
  imports: [PrismaModule, VacacionesModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    IntentClassifierService,
    DataQueryService,
    ResponseGeneratorService,
    EscalationService,
    AuditService,
    RbacService,
    AiResponseService,
    ConversationContextService,
    TelegramService,
  ],
  exports: [AssistantService],
})
export class AssistantModule {}
