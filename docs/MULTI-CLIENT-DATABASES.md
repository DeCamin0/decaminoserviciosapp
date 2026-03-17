# Multi-Client: migrații pe ambele baze de date

**Regulă proiect:** orice migrare sau modificare de structură DB se aplică **pe ambele baze** (Decamino și HERA), nu doar pe una.

## Baze de date

| Client   | Env file              | Bază de date      |
|----------|------------------------|--------------------|
| Decamino | `.env.decamino.local`  | `decamino_db`      |
| HERA     | `.env.hera.local`      | `hera_facility_db` |

## Cum rulezi migrările pe ambele

Pentru scripturi care acceptă env (ex. `run-horario-telefono-entrega-migration.js`):

```bash
cd backend
node scripts/run-<NUME>-migration.js .env.decamino.local
node scripts/run-<NUME>-migration.js .env.hera.local
```

La migrări noi: fie scriptul acceptă un argument env și îl documentezi, fie documentezi explicit că trebuie rulate două comenzi (una per client).

## Referințe

- **MASTER_LEAD_INSTRUCTION.md** → secțiunea **3.1) Multi-Client**
- **.cursorrules** → regula **2. Multi-Client**
- **.cursor/rules/multi-client-databases.mdc** → regula Cursor (alwaysApply)
