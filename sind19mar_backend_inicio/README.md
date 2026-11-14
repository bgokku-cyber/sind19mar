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
MAP_TILE_URL_TEMPLATE="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
```

La respuesta indica `locationMode: gps_or_manual` y `attributionRequired: true`. La detección GPS y el selector manual deben implementarse en las apps; este endpoint sólo centraliza la configuración y no activa por sí mismo la navegación ni el cálculo de rutas. Respeta las condiciones de uso y atribución del proveedor de teselas elegido.


### Ubicación GPS del conductor
- `POST /api/drivers/me/location`: recibe latitud y longitud usando la identidad del conductor autenticado; no acepta IDs enviados por el cliente.
- Sólo se almacena ubicación si la cuenta está activa, el conductor fue verificado y está en estado `AVAILABLE` o `ON_TRIP`.
- `GET /api/rides` para un pasajero incluye la última ubicación del conductor asignado en sus propios viajes; la app sólo la representa si la posición tiene menos de 90 segundos.
- Al pasar a `OFFLINE`, se elimina la última posición almacenada.
- La app transmite ubicación en primer plano después de que el conductor pulsa «Mi ubicación» y concede permiso. El seguimiento en segundo plano no está habilitado.

**Actualización de base de datos:** se añadió el modelo `DriverLocation` a Prisma. Este repositorio aún no tenía historial de migraciones; antes de ejecutar en una base de datos de desarrollo existente, sincroniza el esquema con `npx prisma db push` desde `sind19mar_backend_inicio` y genera el cliente con `npx prisma generate`. Para producción se debe preparar y revisar una migración versionada y respaldar la base de datos antes de aplicarla.


### Base del motor tarifario en bolivianos
- Se añadió una función pura y probada para calcular una tarifa en BOB a partir de una distancia de ruta suministrada por un proveedor de rutas.
- La fórmula es: máximo entre tarifa mínima y (tarifa base + kilómetros de ruta × precio por kilómetro). El resultado se redondea a dos decimales.
- Variables previstas: `FARE_BASE_BOB`, `FARE_PER_KM_BOB` y `FARE_MINIMUM_BOB`. No se inventan valores predeterminados: si falta alguna variable o no es válida, la configuración tarifaria se considera no disponible.
- **Todavía no se usa para crear viajes ni se expone como cotización pública.** Primero falta integrar y validar una distancia vial real (no distancia en línea recta), definir la política tarifaria del sindicato y conectar el cotizador al flujo de solicitud. El cliente nunca debe determinar la tarifa oficial.


### Rutas viales y cotización preliminar
- `GET /api/routes/quote?originLatitude=...&originLongitude=...&destinationLatitude=...&destinationLongitude=...` requiere JWT de pasajero.
- El backend consulta un proveedor compatible con OSRM, devuelve distancia vial en km, duración estimada en minutos y geometría simplificada para dibujar la ruta.
- El proveedor se configura con `ROUTING_PROVIDER` y `ROUTING_BASE_URL`. El servidor público `router.project-osrm.org` es únicamente para desarrollo/pruebas de bajo volumen; producción requiere un servicio contratado o instancia propia, límites de uso y monitoreo.
- Si las variables de tarifa BOB no están configuradas, la respuesta devuelve `fare: null` y explica que la tarifa oficial no está disponible. No se inventa un precio.
- Esta cotización todavía no se persiste en el viaje ni habilita la solicitud del pasajero. Antes se debe aprobar la tabla tarifaria del sindicato y verificar proveedor, cobertura, tiempos y condiciones de operación.
