# API inicial del ciclo de viajes

**Estado:** endpoints de backend incorporados; requieren compilación, migración y pruebas de integración antes de considerarse listos.

Prefijo global: `/api`.

## Crear solicitud

`POST /api/rides`

```json
{
  "passengerId": "ID_DE_PASAJERO",
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

`paymentMethod` acepta `CASH` o `DIGITAL`. La opción DIGITAL solo registra la preferencia; no procesa cobros.

## Consultas

- `GET /api/rides/passenger/:passengerId`: historial del pasajero.
- `GET /api/rides/driver/:driverId`: viajes disponibles y asignados.
- `GET /api/rides/driver/:driverId?active=true`: viajes activos del conductor.

## Aceptar viaje

`PATCH /api/rides/:rideId/accept`

```json
{ "driverId": "ID_DE_CONDUCTOR" }
```

El servicio exige conductor activo, verificado y disponible. La asignación usa actualización condicional dentro de una transacción para impedir que dos conductores reclamen el mismo viaje.

## Cambiar estado

`PATCH /api/rides/:rideId/status`

```json
{ "driverId": "ID_DE_CONDUCTOR", "status": "DRIVER_ARRIVING" }
```

Transiciones: ACCEPTED → DRIVER_ARRIVING → IN_PROGRESS → COMPLETED. Se permite cancelar desde ACCEPTED o DRIVER_ARRIVING. Al completar o cancelar, el conductor vuelve a AVAILABLE.

## Antes de exponer estos endpoints

Autenticación/autorización todavía no está integrada en este módulo: no publicar en internet ni confiar en IDs enviados por el cliente. Añadir guards JWT y verificar que el usuario autenticado corresponda al pasajero/conductor indicado. También falta definir quién registra el cobro final, notificaciones y seguimiento GPS en tiempo real.
