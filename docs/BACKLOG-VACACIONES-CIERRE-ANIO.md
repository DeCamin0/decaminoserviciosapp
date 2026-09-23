# Backlog — Cierre año vacaciones (restante automate)

**Status:** ⏸️ Viitor — așteaptă detalii + aprobare explicită.  
**Notat:** 2026-09-23 (conv. Alecu)

## Obiectiv
La sfârșitul anului, calcula automat zilele de vacanță rămase pentru angajații **ACTIVO** și le pasează în `VACACIONES_RESTANTES_ANO_ANTERIOR` pentru anul următor — pe **fiecare client** (Decamino + HERA).

## Situație actuală
| Pieză | Stare |
|--------|--------|
| Calcul saldo live | ✅ `VacacionesService.calcularSaldo` |
| Câmp DB carry | ✅ `VACACIONES_RESTANTES_ANO_ANTERIOR` |
| Editare manuală admin | ✅ endpoint + UI Solicitudes |
| Rollover automat 31.12 → 1.01 | ❌ lipsește |

## Direcție propusă
1. **v1:** Preview (dry-run) + buton confirmare admin  
2. **v2:** Cron 1 ianuarie 00:15 Europe/Madrid  
3. Formulă tipică: `max(0, generados_31_dic + carry_vechi − consumidos_an)`  
4. Asuntos propios: de regulă **fără** report  
5. Multi-client: același job pe ambele baze / instanțe  

## Open questions (necesare înainte de Aprobat)
- [ ] Plafon maxim de zile reportate?
- [ ] Bază: consumidos aprobados vs solo disfrutados hasta 31.12?
- [ ] Idempotență / tabel audit `vacaciones_cierre_anio`?
- [ ] Cine confirmă (Developer / Admin / RRHH)?

## Fișiere relevante
- `backend/src/services/vacaciones.service.ts`
- `backend/src/controllers/vacaciones.controller.ts`
- `frontend/src/pages/SolicitudesPage.jsx` (edit restantes año anterior)
