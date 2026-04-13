import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PortalAuthUserPayload } from './portal.types';

export const PortalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PortalAuthUserPayload =>
    ctx.switchToHttp().getRequest().user,
);
