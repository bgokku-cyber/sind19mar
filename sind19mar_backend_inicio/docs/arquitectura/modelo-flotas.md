# Modelo inicial de empresas y flotas

**Estado:** propuesta de esquema incorporada a `prisma/schema.prisma`; pendiente de validación con Prisma y de migración PostgreSQL.

## Objetivo

Permitir que Sind.19-Mar registre tanto conductores independientes como conductores que trabajan con una empresa o flota, sin duplicar las cuentas de conductor.

## Entidades añadidas

- **Fleet:** empresa o flota. Guarda nombre, nombre legal opcional, teléfono de contacto, estado y usuario administrador.
- **FleetMembership:** vincula un conductor con una flota. La combinación `fleetId + driverId` es única. Los estados son `PENDING`, `ACTIVE`, `SUSPENDED` y `LEFT`.
- **FleetStatus:** controla si la flota está pendiente de aprobación, activa o suspendida.

## Relaciones incorporadas

- Un usuario con rol `FLEET_MANAGER` puede administrar una o varias flotas.
- Una flota puede tener varios conductores mediante `FleetMembership`.
- Un conductor puede conservar su perfil aunque cambie de flota.
- Un vehículo puede pertenecer a un conductor independiente (`fleetId = null`) o estar registrado a nombre de una flota (`fleetId` informado).
- En un vehículo de flota, `driverId` puede identificar al conductor asignado; puede quedar vacío mientras el vehículo no tenga asignación.
- Un viaje puede registrar la flota que prestó el servicio mediante `Ride.fleetId`. El campo es opcional para viajes de conductores independientes.

## Reglas que debe aplicar la API

1. Solo una cuenta activa con rol `FLEET_MANAGER` puede administrar una flota.
2. Solo una flota activa puede aceptar nuevas membresías y viajes.
3. Un conductor solo puede operar un vehículo de flota si tiene membresía activa en esa misma flota.
4. Si `Vehicle.fleetId` es nulo, `Vehicle.driverId` debe ser obligatorio. Si ambos están informados, el conductor debe pertenecer a esa flota.
5. Al asignar un viaje a una flota, la API debe comprobar que el conductor y el vehículo correspondan a esa flota.
6. Los cambios de estado y las fechas de membresía deben conservarse para auditoría; no se debe borrar el historial al retirar a un conductor.

Las reglas 1–5 requieren validaciones de servicio y, donde corresponda, restricciones SQL adicionales. Prisma Schema por sí solo no expresa todas estas condiciones.

## Decisiones todavía pendientes

- Si un conductor podrá pertenecer a más de una flota activa al mismo tiempo. El esquema permite varias membresías, pero no impone exclusividad.
- Si la flota necesitará datos legales adicionales para el proceso de registro.
- La política monetaria del piloto: los campos de tarifa actuales siguen siendo decimales y todavía no guardan explícitamente la moneda. Antes de procesar cobros debe definirse moneda de liquidación, precisión y registro de tipo de cambio cuando exista conversión.
- El proveedor y flujo de pagos digitales. Este cambio conserva `CASH` y `DIGITAL`; no integra una pasarela ni almacena datos de tarjetas.

## Próxima verificación técnica

Desde `sind19mar_backend_inicio`, ejecutar:

```bash
npx prisma format
npx prisma validate
```

Después de corregir cualquier error, generar una migración PostgreSQL en un entorno de desarrollo con `npx prisma migrate dev --name add_fleets`. No ejecutar migraciones en producción con esta especificación inicial.
