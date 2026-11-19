# Puertas de salida para el piloto de Sind.19-Mar

**Ámbito:** piloto controlado en La Paz, Bolivia.  
**Moneda:** bolivianos (BOB / Bs).  
**Identidad visual:** verde oscuro, verde brillante y blanco en pasajero, conductor y administración.

Este documento evita confundir una compilación correcta con un sistema listo para transportar pasajeros. Cada puerta debe quedar marcada como **APROBADA**, **FALLIDA** o **NO PROBADA**, con evidencia y fecha.

## Estado comprobado en GitHub al preparar este documento

- La rama `feat/api-readiness-check` tiene CI exitoso para Backend, Passenger App, Driver App, Mobile Apps y Admin Web.
- La rama `chore/local-postgres-setup` tiene CI de Backend exitoso.
- La rama `docs/payment-lifecycle` tiene CI de Backend exitoso.
- Las tres solicitudes de cambios están abiertas y no integradas en `main`.
- CI acredita las tareas automatizadas ejecutadas en esas ramas; no acredita despliegue, APK firmado, conexión desde teléfonos ni recorridos reales.

## Puerta A — Integración de código

- [ ] Revisar diferencias entre las tres ramas y resolver conflictos sin perder funcionalidades.
- [ ] Verificar que el esquema Prisma final incluya los modelos y enums usados por viajes y pagos.
- [ ] Preparar migraciones versionadas para entornos compartidos; no usar `prisma db push` en producción.
- [ ] Ejecutar CI completo después de integrar cambios.
- [ ] Revisar dependencias, secretos, CORS y autorización por rol.

**Criterio:** una sola rama candidata contiene backend, apps, panel, configuración de PostgreSQL y cambios de pago compatibles; todos los workflows obligatorios pasan.

## Puerta B — Infraestructura de pruebas

- [ ] Crear una base PostgreSQL aislada para pruebas.
- [ ] Configurar `DATABASE_URL`, `JWT_SECRET`, credenciales de administrador y CORS en variables de entorno; nunca versionar `.env`.
- [ ] Ejecutar migraciones y seed de prueba.
- [ ] Verificar `GET /api/health` y `GET /api/health/ready`.
- [ ] Hacer accesible la API a los teléfonos mediante una URL de pruebas segura.
- [ ] Configurar proveedor de rutas/teselas apropiado y comprobar sus límites y atribución.

**Criterio:** backend y base de datos disponibles desde los clientes de prueba, sin credenciales dentro del repositorio.

## Puerta C — Tarifas y viajes

- [ ] El sindicato confirma tarifa base, tarifa por kilómetro y tarifa mínima en Bs.
- [ ] La API calcula distancia, duración y precio; el cliente no puede imponer ni alterar la tarifa.
- [ ] Rechazar destinos fuera de la cobertura configurada.
- [ ] Aprobar conductor, vehículo y flota antes de habilitar disponibilidad.
- [ ] Probar solicitud, aceptación, llegada, inicio, finalización y cancelación.
- [ ] Verificar que un conductor no pueda aceptar dos viajes simultáneos.
- [ ] Verificar privacidad de viajes y ubicación entre cuentas distintas.

**Criterio:** el precio autoritativo procede del backend y el ciclo de viaje respeta autorización, disponibilidad y transiciones válidas.

## Puerta D — Cobros

### Efectivo
- [ ] El viaje completado tiene una tarifa final positiva calculada por el servidor.
- [ ] Sólo el conductor asignado puede confirmar el efectivo.
- [ ] La confirmación actualiza pago y viaje en una transacción.
- [ ] Reintentos no crean un segundo cobro ni cambian el importe.

### Digital
- [ ] Mantener el pago como pendiente hasta recibir confirmación auténtica del proveedor.
- [ ] Verificar firma del webhook y protección contra eventos repetidos.
- [ ] Registrar referencia del proveedor, importe, moneda y estado.
- [ ] Probar rechazo, expiración, reembolso y conciliación.
- [ ] No mostrar un pago digital como pagado mediante una confirmación manual del conductor.

**Criterio:** no se considera integrado el pago digital hasta que exista proveedor configurado y pruebas de webhook verificadas. No procesar dinero real en el entorno de pruebas.

## Puerta E — Android y recorrido físico

- [ ] Vincular cada app a la cuenta Expo/EAS del propietario y configurar firma.
- [ ] Generar APK de prueba de pasajero y conductor.
- [ ] Instalar ambos APK en dispositivos Android físicos.
- [ ] Verificar permisos de ubicación, mapas, rutas y recuperación ante pérdida de conexión.
- [ ] Ejecutar un viaje completo con cuentas de prueba separadas.
- [ ] Verificar estados y ubicación del conductor asignado desde el teléfono del pasajero.
- [ ] Registrar capturas y resultados sin exponer tokens, teléfonos ni documentos reales.

**Criterio:** ambos APK se instalan y completan un viaje de prueba de extremo a extremo sin fallos críticos.

## Puerta F — Decisión de piloto

No iniciar el piloto con pasajeros reales mientras falte cualquiera de estos puntos:

- [ ] Todas las puertas anteriores aprobadas o con excepción documentada y autorizada.
- [ ] Tarifas y cobertura aprobadas por el sindicato.
- [ ] HTTPS, copias de seguridad, monitoreo, gestión de secretos y procedimiento de incidentes.
- [ ] Revisión de seguridad y privacidad.
- [ ] Responsable operativo y soporte definidos.
- [ ] Plan de reversión y suspensión del servicio.

## Límites conocidos

- No se ha verificado un despliegue productivo.
- No se ha verificado la generación de APK firmados.
- No se ha completado una prueba integral en teléfonos físicos.
- El flujo digital continúa pendiente de proveedor, checkout y webhooks verificados.
- El GPS documentado funciona en primer plano; no debe anunciarse seguimiento en segundo plano.
- Los importes oficiales no deben inventarse: deben ser proporcionados y aprobados por el sindicato.

