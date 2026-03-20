import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './services/assistant.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { DataQueryService } from './services/data-query.service';
import { AssistantReadToolsService } from './services/assistant-read-tools.service';
import { AssistantUserThrottlerGuard } from './guards/assistant-user-throttler.guard';
import { ResponseGeneratorService } from './services/response-generator.service';
import { EscalationService } from './services/escalation.service';
import { AuditService } from './services/audit.service';
import { RbacService } from './services/rbac.service';
import { AiResponseService } from './services/ai-response.service';
import { ConversationContextService } from './services/conversation-context.service';
import { AssistantUserPreferencesService } from './services/assistant-user-preferences.service';
import { AssistantConversationService } from './services/assistant-conversation.service';
import { AssistantOperationalAlertService } from './services/assistant-operational-alert.service';
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
    AssistantReadToolsService,
    AssistantUserThrottlerGuard,
    ResponseGeneratorService,
    EscalationService,
    AuditService,
    RbacService,
    AiResponseService,
    ConversationContextService,
    AssistantUserPreferencesService,
    AssistantConversationService,
    AssistantOperationalAlertService,
    TelegramService,
  ],
  exports: [AssistantService, RbacService, AssistantUserPreferencesService],
})
export class AssistantModule {}
