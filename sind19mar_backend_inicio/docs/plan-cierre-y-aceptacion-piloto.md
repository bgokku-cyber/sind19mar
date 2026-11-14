# Estado de entrega y plan de cierre — Sind.19-Mar

**Corte:** 14 de noviembre de 2026  
**Estado real:** desarrollo inicial; no apto todavía para operación con pasajeros o conductores reales.

Este documento separa lo que existe en el repositorio de lo que falta. No representa una certificación de pruebas ni un despliegue.

## Evidencia inspeccionada

- API NestJS inicial en `sind19mar_backend_inicio`, con scripts de build, test y Prisma.
- Endpoint `GET /health` que devuelve estado estático `ok`.
- Esquema Prisma PostgreSQL con usuarios, pasajeros, conductores, flotas, vehículos, viajes y métodos de pago `CASH` y `DIGITAL`.
- Modelo de flotas documentado como inicial y pendiente de validación/migración.
- Utilidades monetarias BOB y sus pruebas unitarias están presentes en el repositorio.

## Bloqueos para considerar el producto terminado

1. **Base de datos:** configurar PostgreSQL de desarrollo, validar el esquema Prisma, generar/aplicar migraciones y probar persistencia.
2. **Identidad y seguridad:** registro, inicio de sesión, hash de contraseñas, verificación de teléfono, recuperación, sesiones/tokens, roles y autorización por recurso.
3. **Viajes:** crear solicitud, estimar tarifa, buscar/asignar conductor, aceptar/rechazar, llegada, inicio, finalización, cancelación, historial y concurrencia para evitar doble asignación.
4. **Ubicación y mapas:** permisos de GPS, ubicación en segundo plano, geocodificación, rutas, configuración de proveedor y actualización en tiempo real. No hay proveedor configurado en el código inspeccionado.
5. **Conductor y flotas:** documentos y revisión administrativa, vehículos, disponibilidad, membresías y reglas de pertenencia.
6. **Pagos:** efectivo con registro de cobro y conciliación; pagos digitales requieren proveedor, credenciales, webhooks idempotentes, comprobantes y pruebas sandbox. El enum DIGITAL no es una pasarela.
7. **Interfaces:** aplicación pasajero, aplicación conductor y panel administrativo web, integradas a la API y coherentes con la identidad verde oscuro, verde brillante y blanco.
8. **Operación:** notificaciones, soporte, privacidad, términos, auditoría, monitoreo, copias de seguridad, seguridad y despliegue.
9. **Calidad:** pruebas unitarias, integración con PostgreSQL, extremo a extremo, seguridad, carga y pruebas de aceptación en dispositivos Android.

## Orden de cierre recomendado

### Fase A — API funcional en entorno de pruebas
- Validar Prisma y migraciones.
- Implementar autenticación y autorización.
- Implementar servicios y endpoints de pasajeros, conductores, vehículos, flotas y ciclo de vida del viaje.
- Añadir validaciones, transacciones y pruebas de integración.
- Documentar API OpenAPI y datos de demostración.

### Fase B — Experiencia de usuario
- Aplicación pasajero: registro, mapa configurable por ubicación, origen/destino, cotización, solicitud, seguimiento, pago e historial.
- Aplicación conductor: registro, documentos, disponibilidad, ofertas, navegación, estados del viaje, cobro e historial.
- Panel web: aprobación, usuarios, flotas, viajes, tarifas, pagos, incidencias y reportes.

### Fase C — Integraciones y piloto
- Configurar proveedor de mapas y notificaciones.
- Elegir pasarela digital disponible legal y comercialmente en Bolivia; configurar sandbox y credenciales fuera del repositorio.
- Ejecutar pruebas integrales con cuentas ficticias.
- Desplegar staging, realizar pruebas de aceptación y corregir hallazgos.
- Solo después de aprobación explícita, preparar producción y piloto controlado.

## Cómo comprobar el estado técnico actual

Desde la carpeta `sind19mar_backend_inicio` en un entorno Node.js:

```bash
npm install
npx prisma format
npx prisma validate
npm test -- --runInBand
npm run build
```

Para ejecutar la API se necesita un `DATABASE_URL` PostgreSQL válido en el entorno. No aplicar migraciones ni cargar datos reales hasta revisar el esquema y respaldar la base.

## Criterio de aceptación del piloto

El piloto solo se considera listo cuando una persona puede completar de principio a fin:
1. registrarse como pasajero y solicitar un viaje;
2. registrarse y ser aprobada como conductor;
3. recibir y aceptar la solicitud sin asignación duplicada;
4. compartir ubicación y completar el viaje;
5. registrar pago en efectivo o confirmar pago digital mediante una pasarela real en sandbox;
6. consultar el historial y el comprobante;
7. permitir al administrador auditar el viaje y resolver una incidencia.

**Importante:** no se deben usar pasajeros, conductores, tarjetas ni documentos reales en las pruebas iniciales. No publicar ni abrir el servicio al público hasta completar seguridad, privacidad, pruebas y revisión legal/operativa.
