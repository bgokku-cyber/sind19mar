# Panel administrativo Sind.19-Mar

Panel web inicial para personal administrador. Permite iniciar sesión con una cuenta cuyo rol sea ADMIN, revisar conductores y flotas pendientes, y aprobar vehículos y cuentas.

## Configuración local
1. Asegúrate de que el backend y PostgreSQL de desarrollo estén ejecutándose.
2. Copia `.env.example` como `.env`.
3. Define `VITE_API_URL=http://localhost:3000/api` si la API corre en el mismo equipo. Si está en otro equipo, usa una URL accesible desde el navegador.
4. Incluye el origen exacto del panel (Vite usa normalmente `http://localhost:5173`) en `CORS_ORIGINS` del backend y reinicia la API.
5. Ejecuta:

   ```bash
   npm install
   npm run dev
   ```

Abre la dirección que indique Vite e inicia sesión con la cuenta ADMIN creada por el seed del backend (`ADMIN_PHONE` y `ADMIN_PASSWORD`).

## Seguridad
- No existe una contraseña administrativa universal ni credenciales predeterminadas.
- No publiques credenciales, tokens ni archivos `.env`.
- Usa datos ficticios y una base aislada para pruebas.
- El panel requiere una API accesible y una base de datos de desarrollo configurada.
