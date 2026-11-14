# Sind.19-Mar API

Backend inicial de Sind.19-Mar construido con NestJS 10 y TypeScript.

## Requisitos
- Node.js 20 o superior
- npm
- PostgreSQL configurado mediante `DATABASE_URL`

## Instalación
```bash
npm install
```

## Desarrollo
```bash
npm run start:dev
```

La API usa el prefijo global `/api`.

### Comprobaciones de salud
- `GET /api/health`: liveness; confirma que el proceso HTTP responde.
- `GET /api/health/ready`: readiness; ejecuta `SELECT 1` y confirma que PostgreSQL está disponible. Responde HTTP 503 cuando la base de datos no puede atender consultas.

## Compilar
```bash
npm run build
npm test
npm run start:prod
```

Estado: base inicial de desarrollo; todavía no es un servicio de producción. La comprobación readiness no reemplaza migraciones, monitoreo ni pruebas de integración en un entorno desplegado.
