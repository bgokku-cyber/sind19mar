# Contrato inicial de API

Prefijo global: `/api`

## Salud
- `GET /api/health` — comprueba que la API responde.

## Convenciones
- JSON UTF-8.
- Fechas en ISO 8601 UTC.
- Identificadores opacos generados por el servidor.
- Validación en servidor de todos los datos recibidos.
- Errores con códigos HTTP estándar; no exponer trazas ni secretos.

## Recursos previstos
- `/auth`: registro, inicio de sesión y renovación de sesión.
- `/passengers`: perfil e historial del pasajero.
- `/drivers`: perfil, documentos y disponibilidad.
- `/vehicles`: vehículos asociados a conductores o flotas.
- `/rides`: solicitud, aceptación, estados, cancelación e historial.
- `/fleets`: empresas y administración de flotas.
- `/admin`: operaciones administrativas protegidas.

Los recursos anteriores son el contrato objetivo; solo `/health` está implementado en esta etapa.
