---
name: decamino-security-change
description: >-
  Planifică și verifică modificări în decaminoserviciosapp, codul comun
  DeCamino și HERA. Folosește la orice schimbare de backend, frontend, Prisma,
  autorizare, documente, fichaje, vacanțe, cereri, nóminas sau performanță,
  la code review, la prevenirea regresiilor și înainte de comenzi care ar
  putea scrie în bază. Nu înlocuiește regulile multi-client-databases și
  visual-refresh-v2.
---

# Schimbare sigură DeCamino / HERA

Codul este unul singur. DeCamino și HERA sunt două procese, două fișiere de mediu, două baze. Orice regulă de autorizare sau de date se aplică ambelor.

Nu edita cele patru reguli existente. Nu instala ECC. Nu trata hook-ul de shell ca pe singura protecție.

## Când

La implementare, review sau audit în `decaminoserviciosapp`. Dacă task-ul este în alt folder al workspace-ului, nu aplica skill-ul.

## Pași

1. Delimitează un singur comportament. La remedieri din audit, o constatare pe rând, după aprobare.
2. Listează fișierele și spune dacă schimbarea atinge UI închis în `visual-refresh-v2`. Dacă da, oprește-te și cere aprobare.
3. Identifică apelantul: neautentificat, angajat, manager, admin, portal, link public. Verifică guard-ul și că identitatea vine din token, nu din body.
4. Pentru date, spune efectul pe `decamino_db` și pe `hera_facility_db`. Migrările urmează `multi-client-databases` și nu se execută fără aprobare.
5. Propune verificarea: test existent, sau un caz citit din cod dacă nu există test. Nu rula teste care scriu date reale.
6. După editare, raportează ce s-a schimbat, ce ai verificat și ce regresii rămân posibile pe ambele instanțe.

## De refuzat fără aprobare explicită

- `prisma migrate`, `prisma db push`, `prisma db execute`, scripturi `run-*-migration.js`
- clienți `mysql` / `mariadb` / `mysqladmin`
- `DELETE`, `DROP`, `TRUNCATE`, `ALTER` pe baze reale
- `git push`, `git reset --hard`
- rescrierea matricei de permisiuni sau a scope-ului „vede toți angajații” fără o decizie de produs

Operațiunile normale rămân permise: citire de cod, `git status` / `diff` / `commit`, `npm test`, `npm run`, `prisma generate`, `prisma validate`, `prisma migrate status`.

## Formă scurtă înainte de cod

```
Comportament:
Fișiere:
Cine are voie:
Efect DeCamino / HERA:
UI închis atins: nu / da (mă opresc)
Scriere în bază: nu / cere aprobare
Verificare:
```
