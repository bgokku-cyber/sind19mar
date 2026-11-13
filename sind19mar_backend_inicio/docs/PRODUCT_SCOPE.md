# Sind.19-Mar — alcance funcional inicial

## Contexto
Plataforma de transporte para el piloto inicial en La Paz, Bolivia. La identidad visual de las interfaces será verde oscuro, verde brillante y blanco.

## Productos
1. Aplicación Android para pasajeros.
2. Aplicación Android para conductores.
3. Panel administrativo web.
4. API central.

## Tipos de operación
- Conductores independientes.
- Conductores asociados a empresas o flotas.
- Solicitud y seguimiento de viajes.
- Pago en efectivo y pagos digitales (integración sujeta a proveedor y validación local).

## Perfiles
- Pasajero: registro, solicitud, seguimiento, historial y calificación.
- Conductor: registro, revisión documental, disponibilidad, aceptación de viajes e historial.
- Gestor de flota: administración de conductores y vehículos de su empresa.
- Administrador: revisión de cuentas, operaciones, tarifas, viajes y reportes.

## Reglas fundamentales
- No permitir que un conductor no verificado tome viajes.
- Un viaje solo puede ser aceptado por un conductor disponible.
- Registrar cambios de estado y marcas de tiempo.
- No almacenar datos de tarjetas ni credenciales de pago.
- Proteger datos personales y ubicación; mostrar ubicación solo cuando sea necesaria para el viaje.
- La moneda oficial de operación del piloto en Bolivia es el boliviano (BOB). Todos los importes de viajes, tarifas, pagos, liquidaciones y reportes se expresan en bolivianos y se muestran con el prefijo `Bs` (por ejemplo, `Bs 25,00`); no convertir ni presentar importes en dólares estadounidenses (USD). Los importes se almacenan como decimales.

## Etapas de entrega
1. Base técnica, API y modelo de datos.
2. Autenticación y autorización por roles.
3. Flujo de solicitud y asignación de viajes.
4. Aplicación de pasajeros.
5. Aplicación de conductores.
6. Panel administrativo y gestión de flotas.
7. Pagos, notificaciones y mapas.
8. Pruebas integrales, seguridad y despliegue.

## Estado actual
La API inicial y el endpoint de salud fueron compilados y probados anteriormente en Codespaces. El esquema de datos de este repositorio es una primera definición; aún requiere migraciones, validaciones y pruebas antes de usarse con datos reales.
