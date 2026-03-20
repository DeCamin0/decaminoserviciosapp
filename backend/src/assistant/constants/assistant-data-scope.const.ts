/**
 * Scope de date pentru asistent: aceeași regulă pentru toate intent-urile cu acces SQL.
 * ALL = roluri cu acces complet (vezi RbacService.resolveDataScope).
 * OWN = doar rândurile asociate codului utilizatorului (empleado).
 */
export enum AssistantDataScope {
  ALL = 'ALL',
  OWN = 'OWN',
}
