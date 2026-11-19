# Especificación e implementación parcial de pagos — Sind.19-Mar

**Ámbito:** piloto de transporte en La Paz, Bolivia.  
**Moneda:** bolivianos (BOB); las aplicaciones deben mostrar importes como **Bs**.  
**Estado:** registro de pagos y confirmación de efectivo añadidos a esta rama; integración digital todavía pendiente. Los cambios no están integrados en `main`.

## 1. Situación comprobada

El backend ya dispone de `Ride.paymentMethod` (`CASH` o `DIGITAL`), `Ride.paymentStatus` y `Ride.finalFare`.

En esta rama se añadió:

- Modelo persistente `RidePayment`, uno por viaje, con importe decimal, moneda, método y estado.
- Relación opcional al usuario que confirmó el efectivo, con fecha de confirmación.
- Endpoint autenticado `POST /api/rides/:id/payment/cash/confirm`.
- Control para que solo el conductor asignado confirme el efectivo de un viaje completado.
- Control para exigir una tarifa final positiva calculada por el servidor.
- Actualización transaccional del pago y de `Ride.paymentStatus`.
- Protección idempotente: repetir la confirmación no crea otro pago ni cambia el importe.
- Pruebas unitarias añadidas para autorización, tarifa faltante, método digital e idempotencia.

**Verificación automatizada:** CI aprobó la generación de Prisma, compilación y 122 pruebas del backend (17 suites). No se ha ejecutado contra una base PostgreSQL real ni se ha probado en dispositivos físicos.

**Limitación funcional actual:** al completar el viaje, el backend fija `finalFare` con la tarifa calculada y guardada en `estimatedFare`. La confirmación de efectivo sólo se permite si ese importe del servidor es positivo y está presente; no se acepta un monto enviado por el teléfono.

## 2. Regla principal

**Un viaje completado no equivale a un pago confirmado.**

El importe cobrable debe salir de `Ride.finalFare`, que el backend fija al completar el viaje a partir de la tarifa cotizada y guardada por el servidor. Nunca se acepta como importe oficial un monto enviado por la aplicación del pasajero o del conductor.

Si `finalFare` es nulo, cero o negativo, el backend impide crear o confirmar el pago. La moneda almacenada por el flujo de efectivo es BOB.

## 3. Flujo de efectivo implementado parcialmente

1. El viaje llega a `COMPLETED`.
2. El servidor fija una tarifa final positiva en `finalFare` al completar el viaje.
3. El conductor asignado llama a `POST /api/rides/:id/payment/cash/confirm` con su sesión autenticada.
4. El backend verifica conductor, viaje completado, método `CASH` y tarifa final.
5. En una transacción, crea o recupera el único registro `RidePayment`, marca el pago como `PAID` y actualiza `Ride.paymentStatus`.
6. Registra fecha y usuario que declaró haber recibido el efectivo.

La confirmación del conductor es un registro operativo, no una prueba bancaria. Debe quedar auditable y permitir que el pasajero o la administración reporten una discrepancia. La interfaz debe mostrar el recibo en Bs.

La operación es idempotente: una segunda llamada devuelve el pago ya confirmado sin duplicarlo ni modificar su importe. Los estados inconsistentes requieren revisión administrativa.

## 4. Flujo digital — pendiente

1. El pasajero solicita iniciar el pago digital para un viaje completado.
2. El backend crea una operación con importe y moneda tomados de la base de datos y solicita una sesión/intención al proveedor.
3. La aplicación abre el checkout del proveedor. No recoge ni almacena números de tarjeta, CVV, PIN ni claves bancarias.
4. El proveedor notifica el resultado a un webhook del backend.
5. El backend verifica la firma/autenticidad del webhook, identifica la operación y comprueba importe, moneda y referencia externa.
6. Solo una notificación válida de éxito puede cambiar el pago a `PAID`. El retorno de la aplicación nunca basta para confirmar el cobro.

Faltan el proveedor, el modelo de intentos, el endpoint de webhook, la verificación criptográfica, la conciliación y las pruebas de eventos duplicados o falsificados. No se deben simular pagos exitosos.

## 5. Modelo de datos

### Implementado en esta rama

Se añadió `RidePayment`, relacionado uno a uno con `Ride`, con:

- `rideId` único para impedir más de un registro consolidado por viaje.
- `amount Decimal(10,2)` y `currency` con valor predeterminado `BOB`.
- `method` y `status` reutilizando los enums existentes.
- `paidAt`, `cashConfirmedAt` y `cashConfirmedByUserId`.
- Relación de auditoría con `User`.

El estado de pago también se refleja en `Ride.paymentStatus` para mantener compatibilidad con las pantallas y respuestas existentes.

### Pendiente para pagos digitales

Cuando se seleccione un proveedor se añadirá un historial `PaymentAttempt` para reintentos y un registro `PaymentWebhookEvent` con unicidad por proveedor e identificador de evento. Se conservarán únicamente referencias y hashes no sensibles; no se guardarán datos de tarjetas ni payloads completos innecesarios.

## 6. Estados y reglas

| Estado | Significado |
|---|---|
| `PENDING` | Pago aún no confirmado |
| `PAID` | Efectivo declarado por el conductor asignado o pago digital confirmado por webhook verificado |
| `FAILED` | Intento digital fallido verificado |
| `REFUNDED` | Reembolso confirmado mediante un proceso autorizado |

- Cada viaje tendrá como máximo un registro consolidado `RidePayment`; los reintentos digitales se guardarán por separado.
- Un pago con estado inconsistente o importe distinto de `finalFare` requiere revisión.
- Un reembolso no se considera completado hasta recibir confirmación verificable o registrar el movimiento autorizado correspondiente.
- No se define comisión, porcentaje de plataforma ni liquidación a flotas: esas reglas requieren una decisión comercial explícita.

## 7. API

| Ruta | Estado |
|---|---|
| `POST /api/rides/:id/payment/cash/confirm` | Implementada; CI aprobada. Requiere tarifa final positiva guardada por el servidor |
| `POST /api/rides/:id/payment/checkout` | Pendiente |
| `POST /api/payments/webhooks/:provider` | Pendiente |
| `GET /api/rides/:id/payment` | Pendiente |
| Operación administrativa de reembolso y auditoría | Pendiente |

Todas las rutas de usuario deben aplicar autenticación y autorización por rol, además de verificar la pertenencia al viaje. El webhook no usa sesión de usuario: autentica al proveedor mediante firma y controles propios.

## 8. Criterios de aceptación antes del piloto

- [ ] Efectivo: solo el conductor asignado puede confirmar el cobro de un viaje completado.
- [ ] Efectivo: una segunda confirmación no duplica ni modifica el pago.
- [ ] El servidor calcula y guarda `finalFare` antes de habilitar el cobro.
- [ ] Digital: un retorno falso desde la app no marca el pago como `PAID`.
- [ ] Digital: webhook con firma inválida, importe incorrecto o moneda distinta no confirma el pago.
- [ ] Digital: webhook duplicado se procesa una sola vez.
- [ ] Un pasajero no puede consultar pagos de viajes ajenos.
- [ ] Todos los importes se calculan en el servidor y se almacenan con precisión decimal en BOB.
- [ ] Pasajero, conductor y administración muestran estados coherentes y la identidad visual verde oscuro, verde brillante y blanco.
- [ ] Se prueban reembolsos, conciliación y auditoría antes de habilitar dinero real.

## 9. Dependencia para integrar pagos reales

La integración digital depende de seleccionar una pasarela disponible para comercios en Bolivia y revisar sus requisitos de alta, moneda, comisiones, webhooks y reembolsos. Hasta entonces, el modo digital debe permanecer como no disponible o de prueba; nunca debe simularse un pago exitoso.
