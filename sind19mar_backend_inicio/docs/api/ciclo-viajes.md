# API del ciclo de viajes — Sind.19-Mar

**Estado:** las rutas de viajes ahora exigen un JWT firmado y el rol correspondiente. La emisión del token, OTP, sesiones revocables, migración, integración PostgreSQL y pruebas HTTP siguen pendientes.

Prefijo global: `/api`.

Todas las rutas de este documento requieren:

```
Authorization: Bearer <access_token>
```

El token debe incluir `sub` (User.id), `role`, `iat` y `exp`, estar firmado con HS256 usando `AUTH_JWT_SECRET` y tener una duración máxima de 15 minutos. Actualmente el repositorio aún no implementa el endpoint que emite esos tokens.

## Crear solicitud

`POST /api/rides`

Rol: `PASSENGER`.

Ejemplo de cuerpo:

```json
{
  "originAddress": "Plaza San Francisco, La Paz",
  "originLatitude": -16.495,
  "originLongitude": -68.133,
  "destinationAddress": "Zona Sur, La Paz",
  "destinationLatitude": -16.53,
  "destinationLongitude": -68.08,
  "paymentMethod": "CASH",
  "estimatedFare": "25.00"
}
```

No enviar `passengerId`: el servidor lo obtiene del usuario autenticado. `paymentMethod` acepta `CASH` o `DIGITAL`. La opción DIGITAL solo registra la preferencia; no procesa cobros.

## Consultas

- `GET /api/rides/passenger/me`: historial del pasajero autenticado. Rol `PASSENGER`.
- `GET /api/rides/driver/me`: solicitudes abiertas y viajes asignados al conductor autenticado. Rol `DRIVER`.
- `GET /api/rides/driver/me?active=true`: solo viajes activos del conductor autenticado. Rol `DRIVER`.

Los identificadores de pasajero y conductor ya no se reciben desde la URL para decidir la identidad del actor.

## Aceptar viaje

`PATCH /api/rides/:rideId/accept`

Rol: `DRIVER`. No requiere cuerpo ni acepta `driverId`; el conductor se deriva del token. El servicio exige conductor activo, verificado y disponible. La asignación usa actualización condicional dentro de una transacción para impedir que dos conductores reclamen el mismo viaje.

## Cambiar estado

`PATCH /api/rides/:rideId/status`

Rol: `DRIVER`.

```json
{ "status": "DRIVER_ARRIVING" }
```

No enviar `driverId`: el servidor usa el perfil de conductor asociado al usuario autenticado y rechaza viajes que no estén asignados a ese conductor.

Transiciones: ACCEPTED → DRIVER_ARRIVING → IN_PROGRESS → COMPLETED. Se permite cancelar desde ACCEPTED o DRIVER_ARRIVING. Al completar o cancelar, el conductor vuelve a AVAILABLE.

## Códigos de respuesta de seguridad

- `401 Unauthorized`: falta el token, la firma es inválida, el token venció o la autenticación no está configurada.
- `403 Forbidden`: el rol no está autorizado o el recurso no pertenece al usuario autenticado.
- `400 Bad Request`: el cliente intenta enviar `passengerId` o `driverId` como identidad del actor.

## Pendiente antes de exponer la API

Implementar OTP y emisión de tokens, persistencia/rotación/revocación de refresh tokens, cancelación segura por pasajero, auditoría, validación de DTOs, migraciones y pruebas de integración HTTP con PostgreSQL. DIGITAL no confirma un pago; falta integrar un proveedor y webhooks autenticados e idempotentes. No publicar ni abrir acceso a usuarios reales hasta cerrar estas tareas.
