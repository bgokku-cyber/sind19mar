# Panel administrativo Sind.19-Mar

Panel web inicial para personal administrador. Permite iniciar sesión con una cuenta cuyo rol sea ADMIN, revisar conductores y flotas pendientes, aprobar vehículos y cuentas.

## Configuración
1. Copiar .env.example a .env.
2. Definir VITE_API_URL con la URL pública de la API y el prefijo /api.
3. Ejecutar npm install y npm run dev.

No existe cuenta administrativa predeterminada. No publicar credenciales ni tokens. El panel requiere que la API y su base de datos estén desplegadas.