# Sind.19-Mar — Aplicación del pasajero

Aplicación Android desarrollada con Expo SDK 57 y React Native. Mantiene la identidad visual verde oscuro, verde brillante y blanco.

## Funciones implementadas
- Registro e inicio de sesión de pasajeros y persistencia de sesión.
- Obtención del origen mediante GPS en primer plano y geocodificación de direcciones.
- Mapa interactivo configurable desde `GET /api/maps/config`, con selección del destino tocando el mapa.
- Consulta de rutas viales, distancia y duración estimada mediante la API.
- Presentación de tarifas en bolivianos (Bs) cuando el sindicato ha configurado la tarifa oficial.
- Confirmación explícita antes de enviar una solicitud de viaje.
- Historial y actualización periódica del estado de los viajes.
- Visualización de la ubicación reciente del conductor asignado durante el viaje activo.
- Cancelación de solicitudes propias cuando el estado lo permite.

## Configuración local
1. Copia `.env.example` como `.env`.
2. Define `EXPO_PUBLIC_API_URL` con la URL accesible de la API y el prefijo `/api`. En un teléfono físico no uses `localhost`; usa la IP LAN del equipo o una URL HTTPS.
3. Ejecuta `npm install` y `npx expo start`.
4. Autoriza ubicación en primer plano.

## Compilar APK de prueba
Requiere una cuenta Expo/EAS y vincular este proyecto con un proyecto EAS:
1. Instala EAS CLI: `npm install -g eas-cli`.
2. Inicia sesión: `eas login`.
3. Vincula el proyecto una sola vez con `eas init` y conserva el `projectId` generado en la configuración Expo.
4. Ejecuta `eas build --platform android --profile preview`. El perfil `preview` genera un APK instalable para pruebas.
5. Para una publicación de tienda, usa `eas build --platform android --profile production`; ese perfil genera un Android App Bundle.

La compilación remota requiere credenciales y configuración de firma gestionadas por la cuenta Expo del propietario. No incluyas secretos en Git.

## Límites conocidos
- GPS del pasajero y del conductor funciona en primer plano; no hay seguimiento de ubicación en segundo plano.
- La tarifa no se habilita hasta que el sindicato confirme y configure sus importes oficiales en el backend.
- El servidor público de OSRM y las teselas estándar de OpenStreetMap son sólo para pruebas de bajo volumen. Producción requiere proveedor o infraestructura apropiados y respetar sus condiciones y atribución.
- No se integran pagos digitales ni notificaciones push.
- Antes de producción deben completarse pruebas integrales en dispositivos reales y una revisión de seguridad/operación.
