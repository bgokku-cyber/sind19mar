# Sind.19-Mar API

Backend inicial de Sind.19-Mar, construido con NestJS 10, TypeScript, Prisma 6 y PostgreSQL. Este proyecto sigue en desarrollo y todavía no es un servicio de producción.

## Requisitos

- Node.js 20 o superior
- npm
- Docker Compose v2 para levantar PostgreSQL localmente

## Instalación

Desde esta carpeta:

```bash
npm install
cp .env.example .env
```

## Preparar la base de datos local

El repositorio incluye un servicio PostgreSQL para desarrollo. Los valores de `.env.example` y `docker-compose.yml` son exclusivamente locales y no deben reutilizarse en producción.

```bash
docker compose up -d db
docker compose ps
npx prisma validate
npx prisma generate
npm run db:migrate -- --name init
```

El comando de migración crea una carpeta en `prisma/migrations` en tu entorno. Antes de compartir esa migración, revisa los archivos generados y súbelos al repositorio mediante un commit. No ejecutes migraciones contra una base de datos de producción desde este flujo de desarrollo.

Si el puerto 5432 ya está ocupado, detén el servicio que lo utiliza o cambia el puerto publicado en `docker-compose.yml` y el host/puerto de `DATABASE_URL` en `.env`.

## Ejecutar y verificar la API

```bash
npm run start:dev
```

La API usa el prefijo global `/api`. Comprueba su estado en:

`GET /api/health`

## Compilar y probar

```bash
npm run build
npm test -- --runInBand
```

## Detener PostgreSQL

```bash
docker compose down
```

Este comando conserva los datos del volumen local. No uses `docker compose down -v` salvo que quieras borrar deliberadamente la base de datos local.

## Estado

- Base inicial de API y esquema Prisma: presentes en el repositorio.
- Configuración reproducible de PostgreSQL local: incluida para facilitar el desarrollo.
- Autenticación completa, integración de pagos digitales, despliegue y piloto operativo: pendientes.
