# Sind.19-Mar — Aplicación del conductor

Aplicación Android desarrollada con Expo SDK 57 y React Native, con identidad visual compartida de Sind.19-Mar.

## Funciones implementadas
- Registro e inicio de sesión de conductores y persistencia de sesión.
- Registro de licencia y vehículos, sujetos a revisión administrativa.
- Consulta del perfil y estado de aprobación.
- Mapa configurable de la zona de servicio.
- Activación de disponibilidad sólo para cuentas aprobadas y vehículos habilitados.
- Consulta periódica de solicitudes y aceptación de viajes disponibles.
- Actualización de estados: conductor en camino, viaje iniciado y finalizado.
- Cancelación de viajes asignados cuando el estado lo permite.
- Compartición GPS en primer plano con consentimiento explícito, mientras el conductor está conectado; la API limita la visibilidad al pasajero del viaje activo.

## Configuración local
1. Copia `.env.example` como `.env`.
2. Define `EXPO_PUBLIC_API_URL` con la URL accesible de la API y el prefijo `/api`. En un teléfono físico no uses `localhost`.
3. Ejecuta `npm install` y `npx expo start`.
4. Autoriza ubicación en primer plano y pulsa «Mi ubicación» cuando quieras compartirla estando conectado.

## Compilar APK de prueba
Requiere una cuenta Expo/EAS:
1. Instala EAS CLI: `npm install -g eas-cli`.
2. Inicia sesión: `eas login`.
3. Vincula el proyecto con `eas init` y conserva el `projectId` generado.
4. Ejecuta `eas build --platform android --profile preview` para generar un APK instalable.
5. Para una publicación de tienda, usa `eas build --platform android --profile production`.

La firma y las credenciales de compilación deben configurarse desde la cuenta Expo del propietario. No guardes secretos en el repositorio.

## Límites conocidos
- La ubicación se comparte sólo en primer plano; no hay servicio de localización en segundo plano.
- No hay navegación giro a giro ni notificaciones push.
- La cuenta y el vehículo deben ser aprobados por administración antes de aceptar viajes.
- La integración requiere pruebas reales en Android y una API/base de datos de prueba disponibles.
