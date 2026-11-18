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


### Confirmación de cobros en efectivo
- `POST /api/rides/:id/payment/cash/confirm` requiere JWT de conductor.
- Sólo el conductor asignado puede confirmar después de completar el viaje, cuando el método sea `CASH`, el estado siga `PENDING` y exista una tarifa registrada.
- La operación marca el pago como `PAID` y registra la tarifa final con el importe oficial calculado por el backend. La actualización condicional evita confirmar dos veces.
- El conductor debe confirmar únicamente después de recibir el efectivo. La API registra su declaración; no verifica físicamente el intercambio.
- Los pagos `DIGITAL` no se pueden marcar como pagados desde esta ruta. Además, la creación de viajes rechaza temporalmente `paymentMethod: DIGITAL` con HTTP 503 hasta integrar un proveedor autorizado y su confirmación verificable. Esto evita aceptar viajes que quedarían indefinidamente pendientes de cobro.
- La app de pasajero mantiene habilitado únicamente efectivo. No hay cobro QR, tarjeta ni transferencia automática habilitado; no se deben presentar como disponibles.

### Motor tarifario y cotización vial en bolivianos
- El backend calcula la tarifa en BOB a partir de la distancia vial obtenida del proveedor de rutas; no acepta el importe estimado enviado por la aplicación.
- La fórmula es: máximo entre tarifa mínima y (tarifa base + kilómetros de ruta × precio por kilómetro). El resultado se redondea a dos decimales.
- Variables: `FARE_BASE_BOB`, `FARE_PER_KM_BOB` y `FARE_MINIMUM_BOB`. No hay valores predeterminados: si falta alguna variable o no es válida, la tarifa no está disponible.
- `GET /api/routes/quote?originLatitude=...&originLongitude=...&destinationLatitude=...&destinationLongitude=...` requiere JWT de pasajero y devuelve distancia vial, duración, geometría y, si la tarifa está configurada, un token firmado con `JWT_SECRET`, válido cinco minutos y vinculado a las coordenadas.
- Al crear un viaje, el backend verifica el token y guarda el importe firmado como `estimatedFare`. La tarifa enviada por el cliente se ignora.
- El proveedor se configura con `ROUTING_PROVIDER` y `ROUTING_BASE_URL`. El servidor público `router.project-osrm.org` es sólo para desarrollo y bajo volumen; producción requiere un proveedor contratado o instancia propia, límites de uso y monitoreo.
- La fórmula está implementada, pero el piloto no debe habilitar tarifas hasta que el sindicato apruebe los valores de BOB y se verifiquen las condiciones del proveedor de rutas.
