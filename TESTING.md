# Guía de prueba de Sind.19-Mar

Esta guía prepara un entorno **local/de desarrollo**. La rama de integración no está desplegada y el repositorio no contiene credenciales ni una base de datos compartida.

## 1. Requisitos

- Node.js 20 o superior y npm.
- PostgreSQL local o una instancia de desarrollo vacía.
- Android físico con Expo Go compatible o emulador Android.
- El teléfono y el equipo que ejecuta la API deben poder comunicarse por la misma red local.

## 2. Preparar el backend

Desde la carpeta sind19mar_backend_inicio:

1. Copia el archivo .env.example como .env.
2. Configura DATABASE_URL con una base de datos de desarrollo vacía y JWT_SECRET con un secreto aleatorio largo.
3. Configura ADMIN_PHONE, ADMIN_PASSWORD (mínimo 14 caracteres) y ADMIN_NAME para crear la cuenta administradora inicial.
4. Instala dependencias y genera/sincroniza el esquema:

    npm install
    npx prisma db push
    npx prisma generate
    npx prisma db seed

**Importante:** prisma db push es sólo para una base de desarrollo descartable. No lo ejecutes contra producción. Antes de producción se debe preparar una migración versionada y un respaldo.

5. Inicia la API:

    npm run start:dev

La API queda en http://localhost:3000/api. Comprueba GET /api/health, GET /api/health/ready y GET /api/maps/config.

## 3. Configurar rutas y tarifas

- Para pruebas técnicas de bajo volumen, el ejemplo usa ROUTING_BASE_URL=https://router.project-osrm.org. No es un servicio con garantía de producción; para producción debe contratarse un proveedor o desplegar una instancia propia.
- La cotización usa distancia vial del proveedor, no distancia en línea recta.
- Antes de habilitar solicitudes reales, el sindicato debe aprobar los importes y configurar en el archivo .env del backend FARE_BASE_BOB, FARE_PER_KM_BOB y FARE_MINIMUM_BOB.
- No hay tarifas de ejemplo preestablecidas para evitar publicar precios que el sindicato no haya aprobado. Sin las tres variables válidas, la API puede calcular ruta, distancia y duración, pero **no acepta la creación de un viaje**.

## 4. Crear y aprobar cuentas de prueba

1. Registra un pasajero desde la app de pasajero.
2. Registra un conductor desde la app de conductor.
3. Inicia sesión en el panel administrativo con las credenciales configuradas en el seed.
4. Revisa y aprueba al conductor y su vehículo. La cuenta debe estar activa y el conductor verificado para conectarse y aceptar solicitudes.
5. Mantén el entorno de prueba aislado y usa datos ficticios; no uses documentos ni datos personales reales para pruebas de interfaz.

## 5. Ejecutar aplicaciones móviles

En las carpetas apps/passenger y apps/driver:

1. Copia .env.example como .env.
2. Cambia EXPO_PUBLIC_API_URL por la dirección LAN del equipo donde corre la API, por ejemplo http://192.168.1.20:3000/api. No uses localhost desde un teléfono físico.
3. Ejecuta npm install y npx expo start.

Abre el proyecto con Expo Go compatible o un emulador. Autoriza ubicación en primer plano cuando la aplicación lo solicite.

## 6. Recorrido de prueba esperado

1. El pasajero obtiene su origen GPS, elige un destino y consulta la ruta.
2. La API devuelve distancia y duración. Con tarifas oficiales configuradas, devuelve también el precio en Bs.
3. El pasajero confirma el precio y envía la solicitud.
4. El conductor aprobado se conecta, consulta solicitudes y acepta una.
5. El conductor avanza el estado: llegada, inicio y finalización.
6. Mientras comparte ubicación en primer plano, el pasajero puede ver la posición reciente del conductor en su viaje activo.
7. Al completar el viaje, el conductor vuelve a estar disponible.

## 7. Límites actuales antes de producción

- No se ha desplegado la API ni configurado una base de datos productiva.
- No se han probado todos los permisos, GPS, mapas y rutas en dispositivos físicos de distintas marcas.
- El servidor público de rutas y las teselas públicas de OpenStreetMap son sólo para pruebas de bajo volumen; producción requiere proveedores e infraestructura adecuados y respetar sus condiciones.
- El seguimiento GPS del conductor funciona en primer plano, no en segundo plano.
- No están integrados cobros digitales, pasarela de pagos, notificaciones push ni monitoreo/alertas productivas.
- No se debe fusionar ni desplegar esta rama hasta revisar las pruebas, aprobar tarifas, configurar infraestructura y completar una prueba integral.
