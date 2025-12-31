export class MessageDto {
  mensaje: string;
  usuario: {
    id: string;
    nombre: string;
    rol: string;
  };
}

export class AssistantResponseDto {
  respuesta: string;
  acciones?: Array<{
    tipo: string;
    label: string;
    payload?: any;
  }>;
  confianza?: number;
  escalado?: boolean;
  ticket_id?: string;
}
