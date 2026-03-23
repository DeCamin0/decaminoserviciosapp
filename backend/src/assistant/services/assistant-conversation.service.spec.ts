import { AssistantConversationService } from './assistant-conversation.service';

describe('AssistantConversationService', () => {
  const validConvId = '550e8400-e29b-41d4-a716-446655440000';

  it('appendExchange persistă response_source pe mesajul assistant', async () => {
    const messageCreates: Array<Record<string, unknown>> = [];
    const prisma = {
      $transaction: async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          assistantConversation: {
            findFirst: jest.fn().mockResolvedValue({ id: validConvId }),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
          },
          assistantMessage: {
            create: jest.fn().mockImplementation(({ data }: { data: any }) => {
              messageCreates.push(data);
              return Promise.resolve({});
            }),
          },
        };
        return fn(tx);
      },
    };
    const svc = new AssistantConversationService(prisma as any);
    await svc.appendExchange(
      'user-1',
      validConvId,
      'hola',
      'respuesta',
      'validated_faq',
    );
    const assistantRow = messageCreates.find((d) => d.role === 'assistant');
    expect(assistantRow?.response_source).toBe('validated_faq');
  });

  it('appendExchange omite response_source dacă lipsește', async () => {
    const messageCreates: Array<Record<string, unknown>> = [];
    const prisma = {
      $transaction: async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          assistantConversation: {
            findFirst: jest.fn().mockResolvedValue({ id: validConvId }),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
          },
          assistantMessage: {
            create: jest.fn().mockImplementation(({ data }: { data: any }) => {
              messageCreates.push(data);
              return Promise.resolve({});
            }),
          },
        };
        return fn(tx);
      },
    };
    const svc = new AssistantConversationService(prisma as any);
    await svc.appendExchange('user-1', validConvId, 'hola', 'respuesta');
    const assistantRow = messageCreates.find((d) => d.role === 'assistant');
    expect(assistantRow?.response_source).toBeUndefined();
  });
});
