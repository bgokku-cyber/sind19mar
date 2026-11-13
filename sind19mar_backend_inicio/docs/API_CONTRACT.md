# Contrato inicial de API

Prefijo global: `/api`

## Autenticación
- `POST /api/auth/register/passenger` — registra pasajero con `fullName`, `phone`, `password`; devuelve token de acceso.
- `POST /api/auth/register/driver` — registra conductor con los mismos campos más `licenseNumber`; el conductor puede iniciar sesión y registrar vehículo, pero no conectarse ni aceptar viajes hasta aprobación.
- `POST /api/auth/login` — recibe `phone` y `password`; devuelve token Bearer válido por 12 horas.

Contraseñas: mínimo 10 caracteres. El hash se guarda con bcrypt. La verificación de teléfono por SMS/OTP aún no está integrada; no considerar el registro listo para producción hasta elegir e integrar un proveedor y sus controles antifraude.

## Conductores y vehículos (requiere Bearer)
- `GET /api/drivers/me` — perfil y vehículos propios.
- `POST /api/drivers/me/vehicles` — registra un vehículo propio; inicia inactivo, pendiente de aprobación.
- `PATCH /api/drivers/me/availability` — cuerpo `{ "availability": "AVAILABLE" | "OFFLINE" }`; solo permite conectarse con cuenta, conductor y vehículo aprobados.

## Administración (requiere cuenta ADMIN)
- `GET /api/admin/drivers/pending` — conductores pendientes de verificación.
- `PATCH /api/admin/vehicles/:id/approve` — aprueba un vehículo de un conductor todavía no verificado.
- `PATCH /api/admin/drivers/:id/approve` — aprueba al conductor cuando tiene al menos un vehículo activo.
- `PATCH /api/admin/users/:id/suspend` — suspende una cuenta y desconecta al conductor si corresponde.

El primer administrador se crea de forma explícita con `npx prisma db seed`, definiendo `ADMIN_PHONE`, `ADMIN_PASSWORD` (mínimo 14 caracteres) y opcionalmente `ADMIN_NAME` en el entorno. Nunca se publica una ruta abierta para crear administradores.

## Viajes (requiere Bearer)
- `POST /api/rides` — crea una solicitud; el pasajero se obtiene de la sesión, no del cuerpo.
- `GET /api/rides` — devuelve solo los viajes propios del pasajero o conductor autenticado.
- `POST /api/rides/:id/accept` — conductor autenticado acepta un viaje disponible.
- `POST /api/rides/:id/status` — cuerpo `{ "status": "DRIVER_ARRIVING" | "IN_PROGRESS" | "COMPLETED" }`; solo el conductor asignado puede avanzar el viaje.

Transiciones permitidas:
1. `REQUESTED → ACCEPTED` mediante aceptación del conductor verificado, activo, disponible y con vehículo aprobado.
2. `ACCEPTED → DRIVER_ARRIVING`.
3. `DRIVER_ARRIVING → IN_PROGRESS`.
4. `IN_PROGRESS → COMPLETED`; al completar, el conductor vuelve a estar disponible.

Las transiciones y reclamaciones críticas se validan en el servidor y usan transacciones. Las cancelaciones, tarifas finales, liquidaciones y pasarela de pagos quedan pendientes de definición e implementación.

## Salud y convenciones
- `GET /api/health` — comprueba que la API responde.
- JSON UTF-8; fechas ISO 8601 UTC; identificadores opacos generados por el servidor.
- Configurar `JWT_SECRET` seguro y único en el entorno; la API no inicia en producción sin él.
- CORS queda desactivado si no se configura `CORS_ORIGINS`; establecer orígenes explícitos para el panel web.

## Pendiente antes de producción
Falta OTP/SMS, recuperación y rotación de sesiones, límites de intentos y throttling, pruebas automatizadas, cancelaciones y reglas de reembolso, pasarela de pagos, carga segura de documentos, auditoría administrativa, monitoreo, respaldo y despliegue. No usar datos reales ni abrir la API públicamente como servicio productivo todavía.
