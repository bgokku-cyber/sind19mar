# Puertas de salida para el piloto de Sind.19-Mar

**Ámbito:** piloto controlado en La Paz, Bolivia.  
**Moneda:** bolivianos (BOB / Bs).  
**Identidad visual:** verde oscuro, verde brillante y blanco en pasajero, conductor y administración.

Este documento evita confundir una compilación correcta con un sistema listo para transportar pasajeros. Cada puerta debe quedar marcada como **APROBADA**, **FALLIDA** o **NO PROBADA**, con evidencia y fecha.

## Estado comprobado — 20 de noviembre de 2026

La rama candidata vigente es `integration/pilot-ready-candidate`.

- PR [#4](https://github.com/bgokku-cyber/sind19mar/pull/4): abierta, en borrador, destino `main`, todavía sin fusionar.
- Commit inspeccionado: `b59b82ae5f631bee82b2d3bb1be9a4a1128bed9e`.
- Comparación con `main`: 193 commits por delante y 0 por detrás; la PR contiene 70 archivos modificados.
- No se modificó `main`, no se fusionó la PR y no se realizó despliegue.

### Evidencia de CI del commit inspeccionado

Los cinco workflows terminaron con conclusión `success`:

| Flujo | Ejecución | Comprobaciones completadas |
|---|---:|---|
| Backend CI | [44758344550](https://github.com/bgokku-cyber/sind19mar/actions/runs/44758344550) | PostgreSQL 16 efímero, Prisma generate, db push, ESLint, build y Jest |
| Passenger App CI | [44758344445](https://github.com/bgokku-cyber/sind19mar/actions/runs/44758344445) | TypeScript y exportación Android de Expo |
| Driver App CI | [44758344529](https://github.com/bgokku-cyber/sind19mar/actions/runs/44758344529) | TypeScript y exportación Android de Expo |
| Mobile Apps CI | [44758344390](https://github.com/bgokku-cyber/sind19mar/actions/runs/44758344390) | Typecheck de pasajero y conductor |
| Admin Web CI | [44758344443](https://github.com/bgokku-cyber/sind19mar/actions/runs/44758344443) | Compilación web |

**Alcance de esta evidencia:** son comprobaciones automatizadas de CI sobre el commit indicado. El PostgreSQL de CI es efímero y se prepara con `prisma db push`; esto no demuestra una migración versionada ni una base persistente de producción. La exportación de Expo tampoco demuestra que exista un APK firmado instalado y probado en un teléfono.

### Hallazgos que siguen abiertos

- No existe `sind19mar_backend_inicio/package-lock.json` en la rama inspeccionada. El workflow usa `npm install`, por lo que no fija el árbol completo de dependencias con `npm ci`.
- El backend no contiene todavía una migración Prisma inicial versionada; CI aplica el esquema con `prisma db push`.
- El esquema de intentos y eventos de pago digital es preliminar. La creación de viajes con método `DIGITAL` continúa bloqueada con HTTP 503; no hay checkout ni webhook funcional.
- Docker Compose documenta PostgreSQL local para desarrollo. No se verificó una base administrada persistente para producción.
- No se verificó despliegue productivo, APK firmado, prueba integral en teléfonos físicos, GPS en segundo plano ni notificaciones push de producción.

## Puerta A — Integración y reproducibilidad

- [ ] Revisar la PR #4 completa y conservar una sola rama candidata coherente.
- [ ] Añadir y revisar `package-lock.json` del backend y de cada aplicación npm que corresponda.
- [ ] Cambiar CI de `npm install` a `npm ci` sólo después de incorporar los lockfiles.
- [ ] Ejecutar auditoría de dependencias sobre el árbol bloqueado; revisar cada actualización antes de aplicarla.
- [ ] Preparar y revisar una migración Prisma inicial versionada.
- [ ] Ejecutar CI completo después de cada cambio de integración.
- [ ] Revisar secretos, CORS, autorización por rol y exposición de datos personales.

**Criterio:** instalación reproducible desde lockfiles, migraciones versionadas y todos los workflows obligatorios aprobados en el mismo commit.

## Puerta B — Infraestructura de pruebas

- [ ] Levantar PostgreSQL local aislado con el Docker Compose del backend.
- [ ] Configurar `DATABASE_URL`, `JWT_SECRET`, credenciales de administrador y CORS mediante variables de entorno; nunca versionar `.env`.
- [ ] Aplicar migraciones versionadas y seed de prueba.
- [ ] Verificar `GET /api/health` y `GET /api/health/ready`.
- [ ] Hacer accesible la API a los teléfonos mediante una URL de pruebas HTTPS.
- [ ] Configurar proveedor de rutas/teselas apropiado y comprobar límites y atribución.
- [ ] Preparar una base persistente, backups y restauración antes de producción.

**Criterio:** backend y base de datos disponibles desde los clientes de prueba, con persistencia y sin credenciales dentro del repositorio.

## Puerta C — Tarifas y viajes

- [ ] El sindicato confirma por escrito tarifa base, tarifa por kilómetro, tarifa mínima, recargo nocturno y horario.
- [ ] La API calcula distancia, duración y precio; el cliente no puede imponer ni alterar la tarifa.
- [ ] Rechazar destinos fuera de la cobertura configurada.
- [ ] Aprobar conductor, vehículo y flota antes de habilitar disponibilidad.
- [ ] Probar solicitud, aceptación, llegada, inicio, finalización y cancelación.
- [ ] Verificar que un conductor no pueda aceptar dos viajes simultáneos.
- [ ] Verificar privacidad de viajes y ubicación entre cuentas distintas.
- [ ] Probar conductores independientes y conductores asociados a flotas activas.

**Criterio:** el precio autoritativo procede del backend y el ciclo de viaje respeta autorización, disponibilidad, transiciones válidas y reglas aprobadas.

## Puerta D — Cobros

### Efectivo

- [ ] El viaje completado tiene una tarifa final positiva calculada por el servidor.
- [ ] Sólo el conductor asignado puede confirmar el efectivo.
- [ ] La confirmación actualiza pago y viaje en una transacción.
- [ ] Reintentos no crean un segundo cobro ni cambian el importe.
- [ ] Probar el flujo desde ambos teléfonos con cuentas de prueba.

### Digital

- [ ] Seleccionar y aprobar un proveedor compatible con Bolivia y BOB.
- [ ] Mantener el pago como pendiente hasta recibir confirmación auténtica del proveedor.
- [ ] Implementar checkout en backend y un adaptador aislado del proveedor.
- [ ] Verificar firma del webhook sobre el cuerpo original y protección contra eventos repetidos.
- [ ] Registrar referencia externa, importe, moneda y estado.
- [ ] Probar rechazo, expiración, reembolso y conciliación.
- [ ] No mostrar un pago digital como pagado mediante una confirmación manual del conductor.
- [ ] Mantener los cobros digitales deshabilitados hasta completar pruebas en sandbox.

**Criterio:** no se considera integrado el pago digital hasta que exista proveedor configurado, checkout, webhooks verificados y conciliación probada. No procesar dinero real en el entorno de pruebas.

## Puerta E — Android y recorrido físico

- [ ] Vincular cada app a la cuenta Expo/EAS del propietario y configurar firma.
- [ ] Generar APK de prueba de pasajero y conductor.
- [ ] Instalar ambos APK en dispositivos Android físicos.
- [ ] Verificar permisos de ubicación, mapas, rutas y recuperación ante pérdida de conexión.
- [ ] Ejecutar un viaje completo con cuentas de prueba separadas.
- [ ] Verificar estados y ubicación del conductor asignado desde el teléfono del pasajero.
- [ ] Probar flujo de efectivo y mostrar correctamente el estado pendiente de pagos digitales.
- [ ] Registrar resultados sin exponer tokens, teléfonos ni documentos reales.

**Criterio:** ambos APK se instalan y completan un viaje de prueba de extremo a extremo sin fallos críticos.

## Puerta F — Decisión de piloto

No iniciar el piloto con pasajeros reales mientras falte cualquiera de estos puntos:

- [ ] Todas las puertas anteriores aprobadas o con excepción documentada y autorizada.
- [ ] Tarifas y cobertura aprobadas por el sindicato.
- [ ] HTTPS, copias de seguridad, monitoreo, gestión de secretos y procedimiento de incidentes.
- [ ] Revisión de seguridad y privacidad.
- [ ] Responsable operativo y soporte definidos.
- [ ] Plan de reversión y suspensión del servicio.
- [ ] Prueba de restauración de base de datos y procedimiento de atención a incidentes.

**Criterio:** autorización explícita del responsable del piloto tras revisar evidencias de todas las puertas.

## Regla de actualización de este documento

Cada cambio de estado debe incluir fecha, commit o enlace de ejecución que lo respalde. Una tarea sólo se marca como **APROBADA** cuando existe evidencia reproducible; si no hay evidencia, permanece **NO PROBADA**.

