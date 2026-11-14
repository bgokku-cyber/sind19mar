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

### Configuración central del mapa
- `GET /api/maps/config`: entrega la ciudad inicial, centro geográfico, zoom, radio de cobertura, proveedor y plantilla de teselas para las aplicaciones pasajero y conductor.
- La configuración inicial corresponde a La Paz, Bolivia. No requiere una clave de Google Maps.
- El proveedor y la ubicación se pueden cambiar por variables de entorno al desplegar el backend:

```env
MAP_CITY="La Paz"
MAP_COUNTRY="Bolivia"
MAP_CENTER_LATITUDE="-16.5"
MAP_CENTER_LONGITUDE="-68.15"
MAP_DEFAULT_ZOOM="12"
MAP_COVERAGE_RADIUS_KM="25"
MAP_PROVIDER="openstreetmap"
MAP_TILE_URL_TEMPLATE="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
```

La respuesta indica `locationMode: gps_or_manual` y `attributionRequired: true`. La detección GPS y el selector manual deben implementarse en las apps; este endpoint sólo centraliza la configuración y no activa por sí mismo la navegación ni el cálculo de rutas. Respeta las condiciones de uso y atribución del proveedor de teselas elegido.
