import { resolveAssistantResponseSource } from './assistant-response-source.util';

describe('resolveAssistantResponseSource', () => {
  it('validated_faq', () => {
    expect(resolveAssistantResponseSource({ kind: 'validated_faq' })).toBe(
      'validated_faq',
    );
  });

  it('llm_only → llm', () => {
    expect(resolveAssistantResponseSource({ kind: 'llm_only' })).toBe('llm');
  });

  it('pipeline_with_data → read_tools', () => {
    expect(resolveAssistantResponseSource({ kind: 'pipeline_with_data' })).toBe(
      'read_tools',
    );
  });

  it('pipeline_empty_kb (procKbSinArticulos) → llm', () => {
    expect(resolveAssistantResponseSource({ kind: 'pipeline_empty_kb' })).toBe(
      'llm',
    );
  });

  it('pipeline_empty_no_data → no_data', () => {
    expect(
      resolveAssistantResponseSource({ kind: 'pipeline_empty_no_data' }),
    ).toBe('no_data');
  });
});
