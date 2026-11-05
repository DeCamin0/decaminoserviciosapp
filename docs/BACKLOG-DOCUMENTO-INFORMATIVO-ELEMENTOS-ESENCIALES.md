# Backlog — Documento informativo (elementos esenciales del contrato)

**Status:** ⏸️ Viitor — așteaptă detalii + **Aprobat**.  
**Notat:** 2026-11-05 (conv. Alecu)  
**PDF model:** `DOCUMENTO INFORMATIVO ELEMENTOS ESENCIALE S.pdf` (root repo)

## Obiectiv
Clarifica și, eventual, pregătește datele pe care **firma** trebuie să le furnizeze **gestoriei** pentru documentul informativ asupra elementelor esențiale ale contractului (relații > 4 săptămâni) — fără a reinventa ce gestoría completează deja din contract / convenio / lege.

## Principiu (important)
- **Nu** e prioritar să umplem tot PDF-ul din app.
- Gestoria are de regulă: contract, convenio, salariu descompus, CIF/domiciliu social, perioadă probă, texte legale.
- Interesul nostru: ce **lipsește la gestoría** și trebuie de la **operațional / firmă**.

## Ce avem deja în `DatosEmpleados` / config (util ca listă de control)
- Identitate: nombre, DNI/NIE
- Firmă: `VITE_COMPANY_*` (nume, CIF, adresă)
- Centro trabajo, tip contract, fecha alta / antigüedad
- GRUPO, horas contrato, sueldo bruto mensual
- Nº cuenta, Seg. Social (angajat)

## Ce e tipic „de la noi” (nu din lege/convenio)
1. **Centro de trabajo habitual actual** + adresă (comunidad / `Clientes`) — se schimbă des  
2. **Itinerante / multi-centru / teletrabajo** — realitate operațională  
3. **Descriere scurtă post** (1–2 fraze pe teren), dacă contractul e doar generic  
4. **Turnuri / orar concret** pe centru, dacă nu e fix în contract  
5. **Confirmări firmă:** plan igualdad / acoso / LGTBI (există sau nu + documente)  
6. **Formare obligatorie** specifică postului (ex. PRL)  
7. **Sisteme algoritmice HR** — răspuns firmă (de obicei „No”)

## Ce NU trebuie să „inventăm” în DB ca prim pas
Texte de convenio, proceduri extinción/preaviso, descompunere salarială oficială, ETT, străinătate/UE — le ține gestoría din dosar.

## Direcții posibile (când se reia)
- [ ] Checklist scurt de trimis gestoriei (câmpuri obligatorii de la firmă)
- [ ] Export per angajat (centru + adresă + grup + date existente)
- [ ] Opțional: câmpuri minime noi doar pentru ce lipsește operațional (descriere post, flag itinerante, etc.) — **doar cu Aprobat pentru modificări DB** pe Decamino + HERA
- [ ] Generare PDF / PRL „informativo” — doar după checklist + date clare

## Multi-client
Orice implementare ulterioară: **Decamino + HERA** separat (centrele și denumirile de grup diferă).

## Referințe
- PDF: `DOCUMENTO INFORMATIVO ELEMENTOS ESENCIALE S.pdf`
- Schema: `backend/prisma/schema.prisma` → `User` / `DatosEmpleados`
- Related Art. 18 certificat: `CERTIFICADO_INFORMACION_RECIBIDA_ART_18_DECAMINO*.docx` (alt document; nu confunda)
