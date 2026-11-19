# Especificación e implementación parcial de pagos — Sind.19-Mar

**Ámbito:** piloto de transporte en La Paz, Bolivia.  
**Moneda:** bolivianos (BOB); las aplicaciones deben mostrar importes como **Bs**.  
**Estado:** registro consolidado de pagos y confirmación de efectivo implementados en esta rama. Se añadió el esquema persistente preliminar para intentos digitales y eventos webhook; todavía no existe checkout ni procesamiento de webhooks. Los cambios no están integrados en \`main\`.

## 1. Situación comprobada

El backend dispone de \`Ride.paymentMethod\` (\`CASH\` o \`DIGITAL\`), \`Ride.paymentStatus\`, \`Ride.finalFare\` y un registro consolidado \`RidePayment\` por viaje.

En esta rama:
- \`RidePayment\` conserva importe decimal en BOB, método, estado y auditoría de confirmación de efectivo.
- El conductor asignado puede confirmar efectivo sólo después de completar el viaje y con una tarifa final positiva calculada por el servidor.
- La actualización del pago y de \`Ride.paymentStatus\` ocurre en una transacción.
- La confirmación de efectivo es idempotente.
- El esquema ahora incluye \`PaymentAttempt\` y \`PaymentWebhookEvent\` para preparar reintentos y deduplicación de notificaciones digitales.

**Límite importante:** el esquema de intentos/webhooks es una estructura de datos, no una pasarela funcional. No hay checkout, cliente de proveedor, endpoint webhook, verificación criptográfica ni procesamiento de reembolsos. Los pagos digitales permanecen bloqueados en la creación de viajes.

La CI de GitHub valida Prisma, compilación y pruebas automatizadas por commit. Esto no equivale a ejecutar migraciones contra una base PostgreSQL real ni a probar los flujos en teléfonos físicos.

## 2. Regla principal

**Un viaje completado no equivale a un pago confirmado.**

El importe cobrable procede de \`Ride.finalFare\`, fijado por el backend a partir de la tarifa cotizada y guardada por el servidor. Nunca se acepta como importe oficial un monto enviado por la aplicación.

Si \`finalFare\` es nulo, cero o negativo, el backend impide confirmar el cobro. La moneda del piloto es BOB y la interfaz debe presentar importes como Bs.

## 3. Flujo de efectivo implementado

1. El viaje llega a \`COMPLETED\`.
2. El servidor fija una tarifa final positiva en \`finalFare\`.
3. El conductor asignado llama a \`POST /api/rides/:id/payment/cash/confirm\`.
4. El backend verifica conductor, viaje completado, método \`CASH\` y tarifa final.
5. En una transacción, crea o recupera el único \`RidePayment\`, marca el pago como \`PAID\` y actualiza \`Ride.paymentStatus\`.
6. Registra fecha y usuario que declaró haber recibido el efectivo.

La confirmación del conductor es un registro operativo, no una prueba bancaria. Una repetición devuelve el registro ya confirmado sin duplicarlo ni cambiar su importe.

## 4. Flujo digital — todavía no habilitado

Cuando se seleccione y apruebe un proveedor, el flujo previsto será:

1. El viaje debe estar completado y tener \`finalFare\` positiva en BOB.
2. El backend crea o recupera \`RidePayment\` usando exclusivamente el importe y moneda almacenados.
3. El backend crea un \`PaymentAttempt\` con clave de idempotencia generada en servidor y un hash de la solicitud normalizada.
4. El adaptador del proveedor crea el checkout. La aplicación sólo recibe la URL o mecanismo seguro requerido por el proveedor.
5. El proveedor envía un webhook al backend.
6. El backend verifica la firma sobre el cuerpo HTTP original, la antigüedad de la notificación y los identificadores del proveedor antes de registrar el evento.
7. Se registra el evento usando la combinación única proveedor + identificador de evento. Los duplicados no se procesan otra vez.
8. Antes de marcar el pago como \`PAID\`, el backend compara referencia externa, importe y moneda con el intento y con \`RidePayment\`.
9. Sólo una notificación auténtica y coherente puede confirmar el pago. El retorno de la aplicación nunca confirma el cobro.

La aplicación no debe recoger ni almacenar números de tarjeta, CVV, PIN ni claves bancarias. Los webhooks no utilizan sesión JWT de pasajero o conductor: se autentican mediante el mecanismo criptográfico documentado por el proveedor.

## 5. Modelo de datos

### \`RidePayment\` — consolidado por viaje

- \`rideId\` único: como máximo un registro consolidado por viaje.
- \`amount Decimal(10,2)\` y \`currency\` (\`BOB\`).
- Método y estado reutilizando los enums existentes.
- \`paidAt\`, \`cashConfirmedAt\` y \`cashConfirmedByUserId\` para auditoría del efectivo.
- Relación con varios intentos digitales mediante \`attempts\`.

El estado también se refleja en \`Ride.paymentStatus\` para mantener compatibilidad con respuestas y pantallas existentes.

### \`PaymentAttempt\` — historial de intentos

- Relación obligatoria con \`RidePayment\`.
- \`providerCode\`: identificador técnico normalizado del proveedor; se mantiene como texto para no elegir un proveedor por adelantado.
- \`idempotencyKey\`: clave generada por el servidor, única por proveedor.
- \`requestHash\`: SHA-256 de los datos normalizados del intento, para detectar reutilización de una clave con parámetros distintos.
- \`providerReference\`: referencia externa, única por proveedor cuando exista.
- Importe y moneda copiados del registro consolidado para poder contrastar lo que informe el proveedor.
- Estado del intento, vencimiento y marcas de tiempo.

### \`PaymentWebhookEvent\` — deduplicación y auditoría técnica

- Identificador del proveedor y \`providerEventId\`, únicos en conjunto.
- Tipo de evento y hash SHA-256 del cuerpo recibido.
- Relación opcional con \`PaymentAttempt\`, para poder conservar un evento verificado que todavía no se haya podido asociar.
- Estado de procesamiento, fechas de recepción/procesamiento y código de error no sensible.

**Minimización de datos:** no se guarda el cuerpo completo del webhook ni datos de tarjetas. El evento se registra en esta tabla sólo después de verificar la autenticidad del proveedor. Las solicitudes con firma inválida deben rechazarse y registrarse únicamente en los logs de seguridad con datos sensibles redactados.

## 6. Estados y reglas

| Entidad | Estado | Significado |
|---|---|---|
| Pago consolidado | \`PENDING\` | Aún no confirmado |
| Pago consolidado | \`PAID\` | Efectivo declarado por el conductor o digital confirmado por webhook verificado |
| Pago consolidado | \`FAILED\` | Resultado final fallido confirmado |
| Pago consolidado | \`REFUNDED\` | Reembolso confirmado mediante proceso autorizado |
| Intento | \`CREATED\` | Persistido antes de contactar al proveedor |
| Intento | \`PENDING\` | El proveedor aceptó la operación o está pendiente |
| Intento | \`SUCCEEDED\` | Éxito confirmado y validado por el backend |
| Intento | \`FAILED\`, \`EXPIRED\`, \`CANCELLED\` | Resultado final del intento |
| Webhook | \`RECEIVED\` | Autenticidad verificada y evento persistido |
| Webhook | \`PROCESSED\` | Evento aplicado correctamente |
| Webhook | \`REJECTED\` | Evento auténtico, pero incoherente o no aplicable |
| Webhook | \`RETRYABLE_FAILURE\` | Error transitorio; puede reintentarse el procesamiento |

Reglas:
- Reutilizar una clave de idempotencia con un \`requestHash\` diferente debe producir conflicto.
- Un evento repetido con el mismo proveedor e ID no debe duplicarse ni volver a liquidarse.
- Una notificación con importe, moneda o referencia distinta nunca debe marcar el pago como pagado.
- El procesamiento debe actualizar intento, pago consolidado y viaje dentro de una transacción.
- Un reembolso no se considera completado hasta recibir confirmación verificable o registrar el movimiento autorizado correspondiente.
- No se define comisión, porcentaje de plataforma ni liquidación a flotas: esas reglas requieren una decisión comercial explícita.

## 7. API

| Ruta | Estado |
|---|---|
| \`POST /api/rides/:id/payment/cash/confirm\` | Implementada en esta rama |
| \`POST /api/rides/:id/payment/checkout\` | Pendiente de proveedor y servicio |
| \`POST /api/payments/webhooks/:provider\` | Pendiente de adaptador y verificación de firma |
| \`GET /api/rides/:id/payment\` | Pendiente |
| Operación administrativa de reembolso y auditoría | Pendiente |

Los endpoints de usuario deben aplicar autenticación, autorización por rol y pertenencia al viaje. El webhook no utiliza JWT de usuario; debe verificar firma, timestamp y protección contra repetición conforme a la documentación oficial del proveedor.

## 8. Criterios de aceptación antes del piloto

- [ ] Efectivo: sólo el conductor asignado confirma un viaje completado.
- [ ] Efectivo: una segunda confirmación no duplica ni modifica el pago.
- [ ] El servidor fija una tarifa final positiva antes de cobrar.
- [ ] Reutilizar una clave de idempotencia con otro hash se rechaza.
- [ ] Webhook con firma inválida no cambia ningún estado de pago.
- [ ] Webhook repetido se procesa una sola vez.
- [ ] Importe, moneda y referencia externa deben coincidir.
- [ ] Un pasajero no puede consultar pagos de viajes ajenos.
- [ ] Todos los importes se calculan en el servidor y se almacenan con precisión decimal en BOB.
- [ ] Pasajero, conductor y administración muestran estados coherentes y la identidad visual verde oscuro, verde brillante y blanco.
- [ ] Se prueban reembolsos, conciliación y auditoría antes de habilitar dinero real.

## 9. Dependencia para integrar pagos reales

La integración digital depende de seleccionar una pasarela disponible para comercios en Bolivia y revisar sus requisitos de alta, moneda, comisiones, webhooks y reembolsos. Hasta entonces, el modo digital debe permanecer no disponible; nunca se debe simular un pago exitoso.

Antes de usar estas tablas en un entorno compartido, se debe generar y revisar una migración Prisma versionada. No ejecutar \`prisma db push\` en producción.
