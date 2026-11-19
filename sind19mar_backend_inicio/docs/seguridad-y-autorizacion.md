# Seguridad, autenticación y autorización — Sind.19-Mar

**Fecha:** 19 de noviembre de 2026  
**Estado:** especificación aprobada para orientar la implementación; todavía no es código desplegado.

## 1. Objetivo

Impedir que una persona pueda actuar como otro pasajero, conductor o administrador cambiando identificadores enviados en el cuerpo o la URL. La identidad del actor debe proceder exclusivamente de una sesión autenticada y validada por el servidor.

## 2. Mecanismo propuesto

- Autenticación mediante teléfono verificado y código de un solo uso (OTP).
- Contraseñas, si se habilitan como segundo factor, almacenadas únicamente con Argon2id; nunca en texto plano.
- Access token JWT firmado por el servidor, con expiración corta (15 minutos como valor inicial).
- Refresh token aleatorio, rotatorio y almacenado en la base solo como hash; revocar la familia de sesiones al detectar reutilización.
- Claims mínimos: `sub` (User.id), `role`, `sid` (sesión) e `iat/exp`. No incluir teléfono, contraseña ni documentos.
- Claves y secretos mediante variables de entorno o gestor de secretos; nunca en Git, imágenes ni logs.
- Límites de intentos y frecuencia para solicitar/verificar OTP; respuestas que no revelen si un teléfono está registrado.

Los valores de expiración y límites deberán confirmarse en pruebas de seguridad antes del piloto. La verificación telefónica requiere elegir y configurar un proveedor compatible con Bolivia; no se presupone ninguno.

## 3. Reglas de autorización por rol

| Rol | Acceso permitido |
|---|---|
| PASSENGER | Crear viajes para sí mismo; consultar y cancelar únicamente sus viajes según estado. |
| DRIVER | Consultar solicitudes abiertas sin teléfono del pasajero; aceptar una solicitud si está activo, verificado y disponible; actualizar únicamente viajes asignados a sí mismo. |
| FLEET_MANAGER | Consultar y administrar únicamente su flota, sus vehículos y las membresías vinculadas a esa flota. |
| ADMIN | Operaciones administrativas explícitas, con auditoría de actor, acción, recurso y fecha. |

Ser miembro de una flota no concede acceso a otras flotas. Los conductores independientes conservan el mismo flujo de viaje, sin requerir una flota.

## 4. Cambios obligatorios en la API de viajes

Las rutas actuales reciben `passengerId` o `driverId` del cliente. Esos identificadores no deben ser fuente de autoridad.

| Ruta actual | Contrato seguro objetivo |
|---|---|
| `POST /api/rides` | Tomar el pasajero desde `req.user.sub`; rechazar `passengerId` enviado por el cliente. |
| `GET /api/rides/passenger/:passengerId` | Sustituir por `GET /api/rides/passenger/me`; filtrar por el pasajero asociado al usuario autenticado. |
| `GET /api/rides/driver/:driverId` | Sustituir por `GET /api/rides/driver/me`; derivar el conductor desde el usuario autenticado. |
| `PATCH /api/rides/:rideId/accept` | No aceptar `driverId` del cuerpo; usar el conductor asociado a `req.user.sub`. |
| `PATCH /api/rides/:rideId/status` | No aceptar `driverId` del cuerpo; exigir que el viaje esté asignado al conductor autenticado. |

La API debe devolver 401 si falta o no es válido el token, 403 si el rol no tiene permiso y 404 cuando corresponda ocultar la existencia de un recurso ajeno. Validar DTOs y rechazar propiedades inesperadas.

## 5. Reglas específicas para viajes y pagos

1. Un pasajero solo puede leer o cancelar sus propios viajes. La cancelación debe respetar la máquina de estados y registrar motivo/actor.
2. Un conductor solo puede aceptar si su cuenta está ACTIVE, tiene `verifiedAt`, disponibilidad AVAILABLE y cumple las reglas de vehículo/flota vigentes.
3. La aceptación debe ser atómica: dos conductores concurrentes nunca pueden reclamar el mismo viaje.
4. Antes de la asignación, ocultar el teléfono del pasajero. Tras la asignación, revelarlo solo al conductor asignado y al personal autorizado.
5. `DIGITAL` no significa pago confirmado. Solo un webhook autenticado del proveedor puede confirmar un pago digital; procesarlo con clave idempotente y validar importe/moneda.
6. El registro de pago en efectivo debe vincularse al viaje asignado y guardar actor, importe BOB, fecha y estado; no permitir que el cliente marque un pago como confirmado.
7. Toda acción administrativa, cambio de estado y confirmación de pago debe dejar un evento de auditoría.

## 6. Cambios de datos necesarios antes de implementar sesiones

Agregar un modelo de sesión/refresh token con: identificador, userId, hash del token, familia, expiración, revocación, fecha de creación y metadatos mínimos del dispositivo. Indexar userId, familia y expiración. No guardar OTP ni refresh tokens en claro. Definir política de retención y borrado de sesiones.

## 7. Pruebas de aceptación de seguridad

- Sin token: todas las rutas privadas responden 401.
- Pasajero A no puede consultar, cancelar ni alterar el viaje de pasajero B.
- Conductor A no puede aceptar o cambiar el estado de un viaje asignado a conductor B.
- Alterar `passengerId`/`driverId` en cuerpo o URL no cambia la identidad del actor.
- Conductor suspendido o no verificado no puede consultar ni aceptar solicitudes.
- Dos conductores aceptando simultáneamente producen exactamente una asignación.
- Un miembro de una flota no puede leer otra flota.
- Un cliente no puede confirmar por sí mismo un pago DIGITAL.
- Repetir un webhook no duplica el cobro ni el evento contable.
- Refresh token rotado no puede reutilizarse; cerrar sesión revoca la sesión.

## 8. Secuencia de implementación

1. Incorporar módulos de autenticación, OTP y sesiones; añadir dependencias mantenidas y configurar secretos.
2. Añadir migración de sesiones y pruebas de persistencia con PostgreSQL.
3. Implementar guards JWT y guardas de rol; exponer identidad tipada en el contexto de petición.
4. Refactorizar el controlador de viajes para eliminar IDs de actor suministrados por el cliente.
5. Añadir pruebas unitarias, integración y pruebas negativas de autorización.
6. Revisar límites de frecuencia, CORS, TLS, logs sin datos sensibles y auditoría antes de staging.

## 9. Estado actual verificado

- El repositorio contiene NestJS 10, Prisma 6 y roles PASSENGER, DRIVER, FLEET_MANAGER y ADMIN.
- El controlador de viajes existente todavía recibe identificadores de pasajero/conductor en parámetros o cuerpos.
- El paquete actual no incluye todavía `@nestjs/jwt`, Passport ni un proveedor OTP.
- Por lo tanto, esta especificación no afirma que la autenticación o la autorización por usuario ya estén implementadas.

**Criterio de salida:** no exponer la API a pasajeros o conductores reales hasta completar los pasos 1–5 y superar las pruebas de seguridad anteriores.
