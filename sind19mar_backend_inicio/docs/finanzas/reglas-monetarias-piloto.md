# Reglas monetarias del piloto Sind.19-Mar

**Estado:** especificación inicial y utilidades locales implementadas; integración de cobros y persistencia pendientes.

## Moneda del piloto

- Moneda operativa: bolivianos (BOB).
- Símbolo de presentación: `Bs`.
- Precisión: dos decimales (1 boliviano = 100 centavos).
- No realizar conversión automática a USD ni aplicar tipos de cambio implícitos.
- Los importes de entrada de la API se reciben como cadenas decimales con punto, por ejemplo `"18.50"`. La interfaz en español puede mostrar `Bs 18,50`.

La elección de BOB es una regla propuesta para el piloto de La Paz; cualquier cobro real debe respetarla de forma uniforme en pasajero, conductor, flota y administración.

## Representación técnica

- En lógica de negocio, representar importes como enteros de centavos.
- En PostgreSQL/Prisma, persistir importes como `Decimal` con dos posiciones decimales; nunca como `Float` o `Double`.
- No sumar, dividir ni redondear importes mediante aritmética binaria de punto flotante.
- Rechazar importes negativos, notación exponencial y más de dos decimales en solicitudes de cobro.
- El backend calcula y confirma la tarifa final; no debe confiar en un importe final enviado por la aplicación del pasajero o conductor.

## Métodos y estados

- Efectivo: método `CASH`. El viaje permanece pendiente de pago hasta que el conductor confirme la recepción y el backend registre fecha, importe y actor que confirmó.
- Digital: método `DIGITAL`. El viaje permanece pendiente hasta recibir confirmación verificable del proveedor elegido. Una respuesta del cliente móvil por sí sola no confirma un pago.
- Estados admitidos actualmente en el esquema: `PENDING`, `PAID`, `FAILED`, `REFUNDED`.
- Transiciones propuestas: `PENDING -> PAID`, `PENDING -> FAILED` y `PAID -> REFUNDED`. No marcar como reembolsado un pago que nunca fue confirmado como pagado.

## Integridad y seguridad

1. Cada cobro debe asociarse a un único viaje y conservar importe, moneda, método, estado y marcas de tiempo.
2. La confirmación digital debe validar firma/autenticidad del proveedor en el backend.
3. Los avisos repetidos del proveedor deben ser idempotentes: procesar una misma referencia externa una sola vez.
4. Guardar referencia externa y datos mínimos de auditoría; nunca almacenar números completos de tarjeta, CVV, PIN ni credenciales bancarias.
5. Registrar quién confirmó un pago en efectivo y cuándo; permitir conciliación administrativa.
6. Los cambios de estado deben ser auditables y no borrar el historial financiero.

## Alcance no implementado

- No se ha elegido proveedor de pagos digitales.
- No existe todavía integración con pasarela, conciliación ni reembolsos.
- El esquema actual de `Ride` conserva `paymentMethod` y `paymentStatus`; aún falta decidir e implementar un registro financiero separado para transacciones y auditoría.
- La utilidad `src/shared/money/bob-money.ts` cubre conversión, formato y suma de importes BOB; no procesa ni autoriza pagos.
