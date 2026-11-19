# Sind.19-Mar API

Backend inicial de Sind.19-Mar construido con NestJS 10 y TypeScript.

## Requisitos

- Node.js 20 o superior
- npm
- Docker Desktop (o Docker Engine) con Docker Compose

## Preparar PostgreSQL local

La configuración de desarrollo usa PostgreSQL 16 en un contenedor Docker. No necesitas contratar un servidor de base de datos.

1. Entra en esta carpeta: `sind19mar_backend_inicio/`.
2. Crea tu archivo local de variables copiando `.env.example` como `.env`:
   - Windows PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux: `cp .env.example .env`
3. Inicia la base de datos: `docker compose up -d`.
4. Instala dependencias: `npm install`.
5. Crea las tablas según el esquema Prisma: `npx prisma db push`.
6. Genera Prisma Client: `npm run db:generate`.
7. Inicia la API: `npm run start:dev`.

La API usa el prefijo global `/api`. Comprueba su estado en `http://localhost:3000/api/health`.

## Detener y conservar la base de datos

Ejecuta `docker compose down` para detener PostgreSQL. Los datos permanecen en el volumen Docker. Para volver a iniciarlo, usa `docker compose up -d`.

**Solo desarrollo:** las credenciales incluidas son valores locales de prueba. No las uses en producción ni publiques un archivo `.env`. Para producción se requiere una base administrada, credenciales seguras, migraciones revisadas y configuración de red.

## Compilar

```bash
npm run build
npm run start:prod
```

Estado: base inicial de desarrollo; todavía no es un servicio de producción.
