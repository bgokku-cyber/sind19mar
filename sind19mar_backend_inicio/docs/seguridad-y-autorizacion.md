# Seguridad, autenticación y autorización — Sind.19-Mar

**Actualización:** 20 de noviembre de 2026  
**Estado:** guard JWT y protección inicial de rutas de viajes incorporados en la rama de desarrollo. La autenticación completa y el piloto siguen pendientes.

## 1. Objetivo

Impedir que una persona pueda actuar como otro pasajero, conductor o administrador cambiando identificadores enviados en el cuerpo o la URL. La identidad del actor debe proceder exclusivamente de una sesión autenticada y validada por el servidor.

## 2. Mecanismo objetivo

- Autenticación mediante teléfono verificado y código de un solo uso (OTP).
- Access token JWT firmado por el servidor, con expiración corta (15 minutos como valor inicial).
- Refresh token aleatorio, rotatorio y almacenado en la base solo como hash; revocar la familia de sesiones al detectar reutilización.
- Claims mínimos: `sub` (User.id), `role`, `sid` (sesión) e `iat/exp`. No incluir teléfono, contraseña ni documentos.
- Claves y secretos mediante variables de entorno o gestor de secretos; nunca en Git, imágenes ni logs.
- Límites de intentos y frecuencia para solicitar/verificar OTP; respuestas que no revelen si un teléfono está registrado.

La verificación telefónica requiere elegir y configurar un proveedor compatible con Bolivia; no se presupone ninguno.

## 3. Reglas de autorización por rol

| Rol | Acceso permitido |
|---|---|
| PASSENGER | Crear viajes para sí mismo; consultar y cancelar únicamente sus viajes según estado. |
| DRIVER | Consultar solicitudes abiertas sin teléfono del pasajero; aceptar una solicitud si está activo, verificado y disponible; actualizar únicamente viajes asignados a sí mismo. |
| FLEET_MANAGER | Consultar y administrar únicamente su flota, sus vehículos y las membresías vinculadas a esa flota. |
| ADMIN | Operaciones administrativas explícitas, con auditoría de actor, acción, recurso y fecha. |

Ser miembro de una flota no concede acceso a otras flotas. Los conductores independientes conservan el mismo flujo de viaje, sin requerir una flota.

## 4. Contrato de la API de viajes

| Ruta protegida | Rol | Identidad del actor |
|---|---|---|
| `POST /api/rides` | PASSENGER | `req.user.sub`; rechaza `passengerId` en el cuerpo. |
| `GET /api/rides/passenger/me` | PASSENGER | Perfil de pasajero asociado al usuario autenticado. |
| `GET /api/rides/driver/me` | DRIVER | Perfil de conductor asociado al usuario autenticado. |
| `PATCH /api/rides/:rideId/accept` | DRIVER | Conductor derivado de `req.user.sub`; no recibe `driverId`. |
| `PATCH /api/rides/:rideId/status` | DRIVER | Conductor derivado de `req.user.sub`; rechaza `driverId` en el cuerpo. |

Los identificadores de actor enviados por el cliente no son fuente de autoridad. El guard responde 401 ante token ausente o inválido y 403 ante un rol no autorizado.

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
- Conductor suspendido o no verificado no puede consultar o aceptar solicitudes.
- Dos conductores aceptando simultáneamente producen exactamente una asignación.
- Un miembro de una flota no puede leer otra flota.
- Un cliente no puede confirmar por sí mismo un pago DIGITAL.
- Repetir un webhook no duplica el cobro ni el evento contable.
- Refresh token rotado no puede reutilizarse; cerrar sesión revoca la sesión.

## 8. Estado real de implementación — 20 de noviembre de 2026

**Incorporado en la rama de desarrollo:**
- Guard JWT HS256 con verificación de firma mediante comparación de tiempo constante.
- Rechazo de token ausente, firma inválida, algoritmo distinto de HS256, rol desconocido, token vencido o duración mayor a 15 minutos.
- Restricción de roles por ruta: PASSENGER para crear/consultar sus viajes y DRIVER para consultar/aceptar/actualizar viajes.
- Las rutas de viajes derivan el usuario desde el token; ya no reciben IDs de pasajero/conductor para determinar al actor.
- El servicio resuelve el perfil de pasajero/conductor mediante `User.id` y conserva la comprobación de conductor activo/verificado.
- Pruebas unitarias nuevas para el guard JWT.

**Pendiente y no debe darse por implementado:**
- Emisión de tokens: no existe todavía endpoint de login ni proveedor OTP.
- Persistencia y revocación de sesiones/refresh tokens; el guard actual valida firma y expiración, pero no consulta una sesión revocable.
- Pruebas de integración HTTP con PostgreSQL y validación de la compilación tras estos cambios.
- Cancelación del pasajero, gestión de flotas, auditoría y pagos digitales con proveedor/webhook.
- Rotación de claves, rate limiting, CORS restringido, TLS y revisión de seguridad antes de producción.

## 9. Configuración local

Añadir `AUTH_JWT_SECRET` al archivo `.env` local. Generar un secreto aleatorio de al menos 32 bytes con:

```bash
openssl rand -base64 48
```

No copiar el secreto real a GitHub ni compartirlo en chats. El archivo `.env.example` contiene solo un marcador de posición.

**Criterio de salida:** no exponer la API a pasajeros o conductores reales hasta implementar emisión OTP/tokens y sesiones revocables, completar pruebas de integración y superar las pruebas de seguridad anteriores.
