# PostgreSQL: operación y puesta en marcha

## Desarrollo local (PostgreSQL 16)

Desde `sind19mar_backend_inicio/`:

1. Copia `.env.example` a `.env` y cambia `JWT_SECRET` por un secreto aleatorio largo.
2. Ejecuta `docker compose up -d`.
3. Espera a que esté saludable: `docker compose ps`.
4. Ejecuta `npm install` y `npx prisma generate`.
5. Para desarrollo inicial ejecuta `npx prisma db push`.
6. Para crear el primer administrador, define `ADMIN_PHONE`, `ADMIN_PASSWORD` (mínimo 14 caracteres) y `ADMIN_NAME` en `.env`, luego ejecuta `npx prisma db seed`.
7. Inicia la API con `npm run start:dev` y comprueba `/api/health` y `/api/health/ready`.

Los datos se conservan en el volumen Docker `sind19mar_postgres_data`. `docker compose down` detiene los contenedores sin borrar el volumen. **No ejecutes `docker compose down -v` salvo que quieras borrar todos los datos locales.**

## Antes de producción

- Crear PostgreSQL administrado en un proveedor elegido por el propietario y usar TLS.
- Crear un usuario de aplicación con privilegios mínimos; no usar el usuario superusuario de PostgreSQL.
- Guardar `DATABASE_URL`, `JWT_SECRET`, credenciales de administrador inicial y claves externas como secretos del proveedor; nunca subirlos a Git.
- Generar y revisar una migración versionada con Prisma Migrate. La base actual se ha comprobado en CI mediante `prisma db push`, pero eso **no sustituye** una carpeta de migraciones versionadas para producción.
- Probar restauración de backup, retención, monitorización y rotación de credenciales.
- Desplegar la API sólo después de ejecutar `npx prisma migrate deploy` contra la base destino.
- Comprobar `/api/health/ready` desde el entorno desplegado.

## Estado

CI utiliza una instancia efímera PostgreSQL 16 para validar el esquema. No es una base de datos persistente ni una base de producción. La creación del servidor persistente requiere elegir proveedor, región, presupuesto y aportar secretos desde la cuenta propietaria; no se inventan ni se almacenan credenciales en el repositorio.
