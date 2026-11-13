# Sind.19-Mar — Aplicación del conductor

Aplicación Android construida con Expo y React Native.

## Funciones incluidas
- Inicio de sesión y registro con número de licencia.
- Sesión persistente en el dispositivo.
- Consulta del perfil y estado de aprobación.
- Registro de vehículos, que quedan pendientes de aprobación.
- Cambio entre disponible y desconectado, sujeto a las reglas del backend.

## Configuración
1. Copia `.env.example` como `.env`.
2. Define `EXPO_PUBLIC_API_URL` con la URL HTTPS pública de la API, terminada en `/api`.
3. Ejecuta `npm install` y luego `npx expo start`.

No uses `localhost` en un teléfono físico. La URL debe ser accesible desde el dispositivo.

## Pendiente
La recepción y aceptación de viajes, navegación, ubicación en segundo plano, notificaciones y compilación APK se incorporarán en siguientes fases. No se permite conectarse hasta que la cuenta y un vehículo hayan sido aprobados por administración.
