# Guía de prueba de Sind.19-Mar

Esta guía prepara un entorno **local/de desarrollo**. La rama de integración no está desplegada y el repositorio no contiene credenciales ni una base de datos compartida.

## 1. Requisitos
- Node.js 20 o superior y npm.
- PostgreSQL local o una instancia de desarrollo vacía.
- Android físico con Expo Go compatible o emulador Android.
- El teléfono y el equipo que ejecuta la API deben poder comunicarse por la misma red local.

## 2. Preparar el backend
Desde `sind19mar_backend_inicio`:

1. Copia `.env.example` como `.env`.
2. Configura `DATABASE_URL` con una base de desarrollo vacía y `JWT_SECRET` con un secreto aleatorio largo.
3. Configura `ADMIN_PHONE`, `ADMIN_PASSWORD` (mínimo 14 caracteres) y `ADMIN_NAME`.
4. Para usar el panel web local, incluye su origen exacto en `CORS_ORIGINS`, normalmente `http://localhost:5173`.
5. Ejecuta:

   ```bash
   npm install
   npx prisma db push
   npx prisma generate
   npx prisma db seed
   npm run start:dev
   ```

**Importante:** `prisma db push` es sólo para una base de desarrollo descartable. Nunca lo ejecutes contra producción. Antes de producción se debe preparar una migración versionada y un respaldo.

La API queda en `http://localhost:3000/api`. Comprueba `GET /api/health`, `GET /api/health/ready` y `GET /api/maps/config`.

## 3. Configurar rutas y tarifas
- Para pruebas técnicas de bajo volumen, el ejemplo usa `ROUTING_BASE_URL=https://router.project-osrm.org`. No es un servicio con garantía de producción; producción requiere proveedor contratado o instancia propia.
- La cotización usa distancia vial del proveedor.
- El sindicato debe aprobar y configurar `FARE_BASE_BOB`, `FARE_PER_KM_BOB` y `FARE_MINIMUM_BOB` en el `.env` del backend.
- No se publican importes ficticios. Sin las tres variables válidas, la API puede cotizar ruta/distancia/duración, pero **no acepta crear viajes**.

## 4. Crear y aprobar cuentas de prueba
1. Registra un pasajero desde la app de pasajero.
2. Registra un conductor desde la app de conductor.
3. Inicia sesión en el panel administrativo con `ADMIN_PHONE` y `ADMIN_PASSWORD` configurados en el seed.
4. Revisa y aprueba al conductor y su vehículo. Debe estar activo y verificado para conectarse y aceptar solicitudes.
5. Usa datos ficticios; no introduzcas documentos ni datos personales reales en pruebas de interfaz.

## 5. Ejecutar las aplicaciones móviles
En `apps/passenger` y `apps/driver`, por separado:

1. Copia `.env.example` como `.env`.
2. Define `EXPO_PUBLIC_API_URL` con la IP LAN del equipo donde corre la API, por ejemplo `http://192.168.1.20:3000/api`. No uses `localhost` desde un teléfono físico.
3. Ejecuta:

   ```bash
   npm install
   npx expo start
   ```

Abre cada proyecto con Expo Go compatible o un emulador y autoriza ubicación en primer plano. Para probar ambos roles a la vez, inicia ambos proyectos en terminales separadas; idealmente usa dos teléfonos.

### Generar APK instalable
Cada app incluye un `eas.json` con perfil `preview` (APK para distribución interna) y `production` (Android App Bundle). Para compilar desde la cuenta del propietario:

1. Instala EAS CLI: `npm install -g eas-cli`.
2. Entra a la carpeta de cada app, inicia sesión con `eas login` y vincula el proyecto con `eas init`.
3. Conserva el `projectId` que EAS agrega a la configuración Expo.
4. Ejecuta `eas build --platform android --profile preview`.

La compilación remota necesita la cuenta Expo del propietario y configurar credenciales de firma. No requiere guardar contraseñas ni claves en el repositorio. Esta configuración de perfiles no significa que ya exista un APK compilado.

## 6. Ejecutar el panel administrativo web
En otra terminal:

1. Entra en `apps/admin` y copia `.env.example` como `.env`.
2. Define `VITE_API_URL=http://localhost:3000/api` si el panel y la API están en el mismo equipo.
3. Ejecuta:

   ```bash
   npm install
   npm run dev
   ```

Abre la dirección que indique Vite (normalmente `http://localhost:5173`) e inicia sesión con la cuenta ADMIN creada por el seed. Si aparece un error CORS, agrega el origen exacto del panel a `CORS_ORIGINS` del backend y reinicia la API.

## 7. Recorrido integral
1. El pasajero fija su origen GPS, elige destino y consulta ruta.
2. La API devuelve distancia y duración; con tarifas oficiales devuelve también el precio en Bs.
3. El pasajero confirma el precio y solicita el viaje.
4. El administrador aprueba al conductor y vehículo si están pendientes.
5. El conductor aprobado se conecta, recibe la solicitud y la acepta.
6. El conductor avanza los estados de llegada, inicio y finalización.
7. Durante un viaje activo, el pasajero ve la ubicación reciente del conductor si éste comparte GPS en primer plano.
8. Al completar el viaje, el conductor vuelve a estar disponible.

## 8. Límites antes de producción
- No se ha desplegado la API ni configurado una base de datos productiva.
- GPS, mapas y rutas aún requieren pruebas en dispositivos físicos.
- OSRM público y teselas públicas de OpenStreetMap son sólo para pruebas de bajo volumen; producción requiere proveedores/infraestructura adecuados y respetar sus condiciones.
- El seguimiento GPS del conductor funciona en primer plano, no en segundo plano.
- No están integrados cobros digitales, pasarela de pagos, notificaciones push ni monitoreo/alertas productivas.
- No fusionar ni desplegar esta rama hasta revisar pruebas, aprobar tarifas, configurar infraestructura y completar una prueba integral.
