# Environment Variables Example

Copy this to `.env` in the backend folder:

```env
# Server
PORT=3000
CORS_ORIGIN=http://localhost:5173

# n8n (for proxy endpoints that still use it)
N8N_BASE_URL=https://n8n.decaminoservicios.com
N8N_TIMEOUT=30000

# MariaDB Database
DB_TYPE=mysql
DB_HOST=217.154.102.115
DB_PORT=3306
DB_USERNAME=facturacion_user
DB_PASSWORD=ParolaTare123!
DB_NAME=decamino_db
DB_SYNC=false
DB_LOGGING=true

# JWT
JWT_SECRET=decamino-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

## Important Notes:

- **DB_SYNC**: Set to `false` in production! TypeORM will NOT auto-sync schema.
- **DB_LOGGING**: Set to `true` for development, `false` in production.
- **DB_NAME**: The name of your MariaDB database (e.g., `decaminoservicios`)
- **Table name**: Update `@Entity('empleados')` in `user.entity.ts` if your table has a different name
