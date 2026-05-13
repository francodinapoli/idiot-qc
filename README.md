# IDIOT QC

App de control de calidad: **Express** + frontend estático + **MySQL**, con **login JWT** y API protegida.

## Requisitos

- Node.js 18+
- MySQL 8 (o solo Docker)

## Configuración local

1. Copiá variables de entorno:

   ```bash
   cp .env.example .env
   ```

2. Definí **`JWT_SECRET`** (obligatorio): cadena larga y aleatoria, por ejemplo:

   ```bash
   openssl rand -hex 32
   ```

3. Ajustá **`MYSQL_*`** si tu base no coincide con los valores por defecto.

4. **Primer arranque sin usuarios**: si la tabla `qc_users` está vacía, el servidor crea un usuario con `DEFAULT_ADMIN_USERNAME` y `DEFAULT_ADMIN_PASSWORD` del `.env`. Cambiá esa contraseña después del primer login.

5. Instalá dependencias y generá el cliente:

   ```bash
   npm install
   npm run extract-products
   npm run build:client
   ```

6. Iniciá el servidor:

   ```bash
   npm start
   ```

   Abrí [http://localhost:3000](http://localhost:3000) e iniciá sesión.

## Autenticación

- Tras el login, el token JWT se guarda en **`sessionStorage`** (sobrevive al refresco de la pestaña; se borra al cerrar la pestaña).
- Las peticiones a `GET /api/bootstrap`, `PUT /api/state` y `GET /api/me` envían `Authorization: Bearer <token>`.
- Sin token válido, la API responde **401**.

## Docker

Definí **`JWT_SECRET`** (y opcionalmente `DEFAULT_ADMIN_PASSWORD`, etc.) en un archivo `.env` en la raíz del repo; Docker Compose lo usa para el servicio `app`.

```bash
docker compose up --build
```

La app queda en el puerto **3000** del host. MySQL publica el puerto configurado en `MYSQL_PUBLISH_PORT` (por defecto **3306**).

## API interna

- `POST /api/login` — body JSON `{ "username", "password" }` → `{ token, user }`.
- `POST /api/logout` — sin cuerpo (compatibilidad UI; el token se invalida en el cliente).
- `GET /api/me` — requiere Bearer; devuelve `{ user: { username } }`.
- `GET /api/bootstrap` — requiere Bearer; productos, sesiones y pesos.
- `PUT /api/state` — requiere Bearer; persiste estado en MySQL.

## Scripts útiles

- `npm run extract-products` — genera `data/defaultProducts.json` desde `index.html`.
- `npm run build:client` — genera `public/js/app.js` a partir del script de `index.html` (desde `const SEV_LABELS`).
