import { IntentType } from '../services/intent-classifier.service';
import {
  messageExplicitlyRequestsPedidosListOrData,
  messageIsPedidosHowToWithoutDataRequest,
  resolvePedidosProceduralStaticReply,
} from './assistant-pedidos-procedural.util';

describe('assistant-pedidos-procedural.util', () => {
  describe('resolvePedidosProceduralStaticReply', () => {
    it('cómo subo el albarán → albarán procedural (no listado)', () => {
      const r = resolvePedidosProceduralStaticReply(
        'cómo subo el albarán',
        IntentType.PEDIDOS,
        'es',
      );
      expect(r?.kind).toBe('albaran');
      expect(r?.reply).toContain('Pedidos');
      expect(r?.reply).toContain('albarán');
    });

    it('dónde subo el albarán → albarán procedural', () => {
      const r = resolvePedidosProceduralStaticReply(
        'dónde subo el albarán',
        IntentType.PEDIDOS,
        'es',
      );
      expect(r?.kind).toBe('albaran');
    });

    it('adjuntar albarán → albarán procedural', () => {
      const r = resolvePedidosProceduralStaticReply(
        'adjuntar albarán',
        IntentType.PEDIDOS,
        'es',
      );
      expect(r?.kind).toBe('albaran');
    });

    it('quiero subir el albarán → albarán procedural', () => {
      const r = resolvePedidosProceduralStaticReply(
        'quiero subir el albarán',
        IntentType.PEDIDOS,
        'es',
      );
      expect(r?.kind).toBe('albaran');
    });

    it('ver pedidos → null (debe usar read_tools)', () => {
      expect(
        resolvePedidosProceduralStaticReply(
          'ver pedidos',
          IntentType.PEDIDOS,
          'es',
        ),
      ).toBeNull();
    });

    it('ver mis pedidos → null', () => {
      expect(
        resolvePedidosProceduralStaticReply(
          'ver mis pedidos',
          IntentType.PEDIDOS,
          'es',
        ),
      ).toBeNull();
    });

    it('cómo hago un pedido → guía pedidos (sin datos explícitos)', () => {
      const r = resolvePedidosProceduralStaticReply(
        'cómo hago un pedido de material',
        IntentType.PEDIDOS,
        'es',
      );
      expect(r?.kind).toBe('pedidos_howto');
      expect(r?.reply).toContain('Pedidos');
    });

    it('otro intent → null', () => {
      expect(
        resolvePedidosProceduralStaticReply(
          'cómo subo el albarán',
          IntentType.FICHAJES,
          'es',
        ),
      ).toBeNull();
    });
  });

  describe('messageExplicitlyRequestsPedidosListOrData', () => {
    it('detecta ver pedidos sin cómo', () => {
      expect(messageExplicitlyRequestsPedidosListOrData('ver pedidos')).toBe(
        true,
      );
    });

    it('cómo ver mis pedidos no es sólo listado (pregunta procedimiento)', () => {
      expect(
        messageExplicitlyRequestsPedidosListOrData('cómo ver mis pedidos'),
      ).toBe(false);
    });
  });

  describe('messageIsPedidosHowToWithoutDataRequest', () => {
    it('cómo + pedido sin pedir lista', () => {
      expect(
        messageIsPedidosHowToWithoutDataRequest(
          '¿cómo hago un pedido de material?',
        ),
      ).toBe(true);
    });
  });
});
