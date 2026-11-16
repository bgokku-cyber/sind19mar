# Especificación de pagos — Sind.19-Mar

**Estado:** propuesta técnica para revisión; todavía no implementada.  
**Ámbito inicial:** piloto en La Paz, Bolivia.  
**Moneda de operación:** bolivianos (BOB, mostrar como **Bs** en las aplicaciones).

## 1. Situación comprobada del backend

El esquema Prisma actual ya contiene:

- `Ride.paymentMethod`: `CASH` o `DIGITAL`.
- `Ride.paymentStatus`: `PENDING`, `PAID`, `FAILED` o `REFUNDED`.
- `Ride.finalFare`: tarifa final opcional.

Todavía no existe un registro independiente de pagos, historial de intentos, confirmación de cobro en efectivo ni integración con una pasarela. La finalización de un viaje tampoco confirma por sí sola que se haya cobrado.

## 2. Regla principal

**Un viaje completado no equivale a un pago confirmado.**

El importe cobrable debe salir de `Ride.finalFare`, calculado y guardado por el servidor. Nunca se debe aceptar como importe oficial un monto enviado por la aplicación del pasajero o del conductor. La moneda del piloto es BOB; la interfaz debe mostrar `Bs`, no dólares.

Si `finalFare` todavía es nulo, el backend debe impedir iniciar o confirmar el cobro y dejar el caso para revisión; no debe inventar una tarifa.

## 3. Flujo de efectivo

1. El viaje llega a `COMPLETED` y el servidor fija `finalFare`.
2. Se crea un pago `PENDING` por el importe final y moneda BOB.
3. El conductor asignado registra que recibió el efectivo.
4. El backend comprueba que el viaje está completado, que el conductor autenticado es el asignado y que el pago corresponde a ese viaje.
5. En una transacción, cambia el pago a `PAID`, registra fecha y usuario que confirmó, y actualiza `Ride.paymentStatus`.
6. La aplicación muestra recibo con importe en Bs, método efectivo, fecha y estado.

La operación debe ser idempotente: repetir la confirmación no debe crear un segundo cobro ni alterar el importe. La confirmación del conductor es un registro operativo, no una prueba bancaria; debe quedar auditable y permitir que pasajero o administrador reporten una discrepancia.

## 4. Flujo digital

1. El pasajero solicita iniciar el pago digital para un viaje completado.
2. El backend crea una operación con importe y moneda tomados de la base de datos y solicita una sesión/intención al proveedor.
3. La aplicación abre el checkout del proveedor. No recoge ni almacena números de tarjeta, CVV, PIN ni claves bancarias.
4. El proveedor notifica el resultado a un webhook del backend.
5. El backend verifica la firma/autenticidad del webhook, identifica la operación, comprueba importe, moneda y referencia externa, y procesa el evento una sola vez.
6. Solo una notificación válida de éxito puede cambiar el pago a `PAID`. El retorno del navegador o una respuesta de la app nunca bastan para confirmar el cobro.

Los eventos repetidos deben ser idempotentes mediante el identificador de evento del proveedor. Los eventos inválidos o con importes/monedas diferentes deben rechazarse y quedar registrados para revisión, sin marcar el pago como pagado.

## 5. Modelo de datos propuesto

Se recomienda separar el estado consolidado del pago de cada intento con proveedor. Así se puede reintentar un pago digital sin perder el historial.

El siguiente esquema es una **propuesta**, no debe copiarse a producción hasta implementar las relaciones, restricciones, migración y pruebas:

```prisma
enum PaymentAttemptStatus {
  CREATED
  PENDING
  SUCCEEDED
  FAILED
  CANCELLED
}

model RidePayment {
  id                    String        @id @default(cuid())
  rideId                String        @unique
  ride                  Ride          @relation(fields: [rideId], references: [id])
  amount                Decimal       @db.Decimal(10, 2)
  currency              String        @default("BOB")
  method                PaymentMethod
  status                PaymentStatus @default(PENDING)
  paidAt                DateTime?
  refundedAt            DateTime?
  cashConfirmedAt       DateTime?
  cashConfirmedByUserId String?
  cashConfirmedBy       User?         @relation("CashPaymentConfirmations", fields: [cashConfirmedByUserId], references: [id])
  attempts              PaymentAttempt[]
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
}

model PaymentAttempt {
  id                String               @id @default(cuid())
  paymentId         String
  payment           RidePayment          @relation(fields: [paymentId], references: [id])
  provider          String
  providerReference String?              @unique
  idempotencyKey    String               @unique
  status            PaymentAttemptStatus @default(CREATED)
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt
}

model PaymentWebhookEvent {
  id                String   @id @default(cuid())
  provider          String
  providerEventId   String
  payloadHash       String
  receivedAt        DateTime @default(now())
  processedAt       DateTime?

  @@unique([provider, providerEventId])
}
```

Relaciones inversas que habría que añadir al esquema existente:

- En `Ride`: `payment RidePayment?`.
- En `User`: `cashPaymentConfirmations RidePayment[] @relation("CashPaymentConfirmations")`.

No se guarda el contenido sensible de tarjetas ni el payload íntegro del proveedor. El hash y el identificador del evento sirven para trazabilidad; los detalles adicionales deben limitarse a datos no sensibles.

## 6. Estados y reglas

| Pago consolidado | Significado | Quién/qué lo puede producir |
|---|---|---|
| `PENDING` | Cobro aún no confirmado | Creación del pago |
| `PAID` | Cobro confirmado | Conductor asignado para efectivo; webhook verificado para digital |
| `FAILED` | Intento fallido sin cobro | Resultado verificado del proveedor |
| `REFUNDED` | Reembolso confirmado | Proveedor o proceso administrativo autorizado |

- Cada viaje tendrá como máximo un registro consolidado `RidePayment`; los reintentos se guardan como `PaymentAttempt`.
- Un reembolso no se considera completado hasta recibir confirmación verificable del proveedor o registrar el movimiento autorizado correspondiente.
- Cancelaciones antes de completar el viaje no generan un cobro por la tarifa final.
- No se define aquí comisión, porcentaje de plataforma ni liquidación a flotas: esas reglas requieren una decisión comercial explícita y no deben deducirse del importe del viaje.

## 7. API propuesta

- `POST /api/rides/:id/payment/cash-confirmation` — conductor asignado confirma efectivo recibido.
- `POST /api/rides/:id/payment/checkout` — pasajero solicita una sesión digital para su viaje.
- `POST /api/payments/webhooks/:provider` — recepción de eventos firmados del proveedor.
- `GET /api/rides/:id/payment` — pasajero y conductor consultan el estado del pago de su viaje.
- Operación administrativa protegida para iniciar y auditar reembolsos.

Todas las rutas deben aplicar autenticación y autorización por rol; las rutas de consulta deben verificar que el usuario pertenece al viaje. El webhook no usa sesión de usuario: autentica al proveedor mediante firma y controles propios.

## 8. Criterios de aceptación antes del piloto

- [ ] Efectivo: solo el conductor asignado puede confirmar el cobro de un viaje completado.
- [ ] Efectivo: una segunda confirmación no duplica ni modifica el pago.
- [ ] Digital: un retorno falso desde la app no marca el pago como `PAID`.
- [ ] Digital: webhook con firma inválida, importe incorrecto o moneda distinta no confirma el pago.
- [ ] Digital: webhook duplicado se procesa una sola vez.
- [ ] Un pasajero no puede consultar pagos de viajes ajenos.
- [ ] Todos los importes se calculan en el servidor y se almacenan con precisión decimal en BOB.
- [ ] La app pasajero, la app conductor y el panel administrativo usan estados y etiquetas coherentes; la identidad visual permanece verde oscuro, verde brillante y blanco.
- [ ] Se prueban reembolsos, conciliación y auditoría antes de habilitar dinero real.

## 9. Dependencia para integrar pagos reales

La especificación es independiente del proveedor. La integración real queda pendiente de seleccionar una pasarela disponible para comercios en Bolivia y revisar sus requisitos de alta, moneda, comisiones, webhooks y reembolsos. Hasta entonces, el modo digital debe permanecer como no disponible o de prueba; nunca simular un pago exitoso.
