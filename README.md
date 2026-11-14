# Sind.19-Mar

Plataforma de transporte para La Paz, Bolivia.

## Componentes
- `sind19mar_backend_inicio/`: API central NestJS, Prisma y PostgreSQL.
- `apps/passenger/`: aplicación Android del pasajero (Expo / React Native).
- `apps/driver/`: aplicación Android del conductor (Expo / React Native).
- `apps/admin/`: panel administrativo web (React / Vite).

## Funcionalidad implementada en la rama de integración
- Autenticación y control de acceso por rol.
- Gestión administrativa de conductores, vehículos y flotas.
- Mapa configurable, cobertura geográfica y selección de puntos.
- Cotización de rutas viales y tarifa BOB configurable en backend.
- Solicitudes, aceptación, estados y cancelación de viajes.
- Ubicación del conductor en primer plano con reglas de privacidad.
- Panel web para revisar viajes y gestionar aprobaciones.

## Estado real
El proyecto está en integración y preparación de piloto, no en producción. Los controles automáticos de CI validan compilación/tipos y pruebas automatizadas, pero no sustituyen pruebas con teléfonos físicos. Aún se requiere configurar infraestructura, aprobar las tarifas oficiales, generar builds firmados, probar el recorrido integral y corregir incidencias. No están integrados pagos digitales ni notificaciones push; el GPS no funciona en segundo plano.

## Pruebas locales y APK
- Consulta [TESTING.md](./TESTING.md) para preparar PostgreSQL, iniciar el backend, las dos apps y el panel web.
- Las apps incluyen perfiles EAS: `eas build --platform android --profile preview` genera un APK de pruebas una vez vinculados los proyectos a la cuenta Expo del propietario.
- No conectes las aplicaciones a una base de datos productiva para pruebas.

## Identidad visual
Mantener verde oscuro, verde brillante y blanco de forma coherente en las aplicaciones de pasajero, conductor y el panel administrativo.
