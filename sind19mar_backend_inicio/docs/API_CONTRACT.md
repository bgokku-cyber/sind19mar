# Contrato inicial de API

Prefijo global: `/api`

## Salud
- `GET /api/health` — comprueba que la API responde.

## Viajes
- `POST /api/rides` — crea una solicitud de viaje. Recibe `passengerId`, direcciones, coordenadas, tarifa estimada opcional y `paymentMethod` (`CASH` o `DIGITAL`).
- `GET /api/rides?passengerId=...` — lista hasta 100 viajes de un pasajero.
- `GET /api/rides?driverId=...` — lista hasta 100 viajes de un conductor.
- `POST /api/rides/:id/accept` — acepta un viaje; cuerpo: `{ "driverId": "..." }`.
- `POST /api/rides/:id/status` — avanza el viaje; cuerpo: `{ "driverId": "...", "status": "DRIVER_ARRIVING" | "IN_PROGRESS" | "COMPLETED" }`.

Transiciones permitidas:
1. `REQUESTED → ACCEPTED` mediante aceptación del conductor verificado y disponible.
2. `ACCEPTED → DRIVER_ARRIVING`.
3. `DRIVER_ARRIVING → IN_PROGRESS`.
4. `IN_PROGRESS → COMPLETED`; al completar, el conductor vuelve a estar disponible.

Las transiciones se verifican en el servidor y las actualizaciones críticas se ejecutan dentro de transacciones. Las cancelaciones y sus reglas de negocio quedan pendientes de definir.

## Convenciones
- JSON UTF-8.
- Fechas en ISO 8601 UTC.
- Identificadores opacos generados por el servidor.
- Validación en servidor de los datos recibidos.
- Errores con códigos HTTP estándar; no exponer trazas ni secretos.

## Seguridad y alcance actual
**Esta API todavía es una versión de desarrollo.** Los identificadores `passengerId` y `driverId` llegan en el cuerpo o query y todavía no se validan contra una sesión autenticada. No desplegar ni exponer estos endpoints a usuarios reales hasta implementar autenticación, autorización por rol y propiedad del recurso, límites de solicitudes y configuración CORS restringida.

## Recursos previstos
- `/auth`: registro, inicio de sesión y renovación de sesión.
- `/passengers`: perfil e historial del pasajero.
- `/drivers`: perfil, documentos y disponibilidad.
- `/vehicles`: vehículos asociados a conductores o flotas.
- `/fleets`: empresas y administración de flotas.
- `/admin`: operaciones administrativas protegidas.
