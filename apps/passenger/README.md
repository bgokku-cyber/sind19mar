# Sind.19-Mar — Aplicación del pasajero

Aplicación Android construida con Expo y React Native.

## Incluye en esta primera entrega
- Pantalla de inicio de sesión y registro de pasajeros.
- Conexión con los endpoints `/api/auth/login` y `/api/auth/register/passenger`.
- Almacenamiento local del token de sesión.
- Pantalla inicial con campos de origen y destino, y método de pago en efectivo.
- Diseño adaptable con la identidad verde oscuro, verde brillante y blanco.

## Configuración
1. Copiar `.env.example` como `.env`.
2. Definir `EXPO_PUBLIC_API_URL` con la URL HTTPS pública de la API, terminada en `/api`.
3. Instalar dependencias con `npm install`.
4. Ejecutar `npx expo start` y abrir el proyecto con Expo Go o un emulador Android.

No usar `localhost` en un teléfono físico: debe indicarse una dirección accesible desde el dispositivo.

## Funciones pendientes
La pantalla de mapa es solo una maqueta visual. La solicitud de viajes permanece deshabilitada hasta integrar mapas, permisos de ubicación y coordenadas reales. También faltan historial conectado, seguimiento en vivo, notificaciones y pruebas en dispositivos Android.
