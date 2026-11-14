# Sind.19-Mar — Aplicación del pasajero

Aplicación Android construida con Expo y React Native.

## Incluye en esta primera entrega
- Pantalla de inicio de sesión y registro de pasajeros.
- Conexión con los endpoints `/api/auth/login` y `/api/auth/register/passenger`.
- Almacenamiento local del token de sesión.
- Pantalla inicial con campos de origen y destino, y método de pago en efectivo.
- Permiso de ubicación en primer plano con Expo Location (SDK 57).
- Captura de GPS para el punto de recogida y geocodificación del destino escrito.
- Validación preliminar del radio de cobertura antes de habilitar futuras solicitudes.
- Diseño adaptable con la identidad verde oscuro, verde brillante y blanco.

## Configuración
1. Copiar `.env.example` como `.env`.
2. Definir `EXPO_PUBLIC_API_URL` con la URL HTTPS pública de la API, terminada en `/api`.
3. Instalar dependencias con `npm install`.
4. Ejecutar `npx expo start` y abrir el proyecto con Expo Go o un emulador Android.

No usar `localhost` en un teléfono físico: debe indicarse una dirección accesible desde el dispositivo.

## Funciones pendientes
La pantalla de mapa sigue siendo una maqueta visual: todavía no hay mapa interactivo, selección de puntos sobre el mapa ni rutas. El GPS y la geocodificación permiten validar coordenadas reales, pero el botón no crea un viaje ni busca conductores hasta completar la integración cartográfica y el flujo operativo de conductor. Faltan seguimiento en vivo, notificaciones y pruebas en dispositivos Android.


## Moneda
La moneda de operación de Sind.19-Mar en Bolivia es el boliviano (BOB). Los importes visibles deben mostrarse con el prefijo `Bs` (por ejemplo, `Bs 25,00`) y formato decimal español. No presentar tarifas en dólares estadounidenses (USD) ni usar el símbolo `$` para precios.
