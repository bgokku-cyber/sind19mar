# Sind.19-Mar

Plataforma de transporte para La Paz, Bolivia.

## Componentes
- `sind19mar_backend_inicio/`: API central NestJS y Prisma.
- `apps/passenger/`: aplicación Android del pasajero (Expo / React Native).
- `apps/driver/`: aplicación Android del conductor (Expo / React Native).
- `apps/admin/`: panel administrativo web (React / Vite).

## Estado
Desarrollo en integración. La API incluye autenticación, viajes, conductores, administración, flotas, cobertura geográfica, ubicación del conductor y cotización de rutas viales. La app pasajero consulta rutas y puede enviar solicitudes cuando existe una tarifa oficial configurada; la app conductor gestiona disponibilidad, solicitudes y estados de viaje; el panel permite revisar y aprobar conductores, vehículos y flotas. Todavía no existe despliegue de producción, pagos integrados ni validación integral en dispositivos y una base de datos desplegada.

Consulta los README de cada componente para instrucciones específicas.

## Probar en entorno local

Consulta [TESTING.md](./TESTING.md) para preparar PostgreSQL, configurar la API, ejecutar las aplicaciones y conocer los requisitos previos de aprobación y tarifas. No conectes las aplicaciones a una base de datos productiva para estas pruebas.
