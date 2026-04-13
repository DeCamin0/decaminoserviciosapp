/** Usuario inyectado por PortalJwtStrategy tras validar el Bearer del portal. */
export interface PortalAuthUserPayload {
  contacto_id: number;
  cliente_id: number;
  email: string | null;
  nombre: string;
  clienteNombre: string | null;
  nif: string | null;
}
