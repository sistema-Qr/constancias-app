# Sistema de Constancias Académicas con verificación por QR
### (versión Vercel + Postgres)

Los empleados (usuario/contraseña) capturan los datos del alumno y el sistema
genera una constancia en PDF con un código QR. Cualquiera que escanee el QR
llega a una página pública (sin login) que certifica **"Constancia
Certificada: verificada en libros de la institución"**, o avisa si el token
no existe o la constancia fue revocada.

Arquitectura: Express corriendo como función serverless en **Vercel**,
datos en **Vercel Postgres**, sesión de empleado guardada en una cookie
firmada con **JWT** (sin estado en el servidor — por eso funciona bien en
serverless).

---

## 1. Súbelo a GitHub

```bash
cd constancias-app
git init
git add .
git commit -m "Sistema de constancias académicas"
gh repo create constancias-app --private --source=. --push
# (o crea el repo manualmente en github.com y luego:)
# git remote add origin https://github.com/TU_USUARIO/constancias-app.git
# git branch -M main
# git push -u origin main
```

## 2. Crea el proyecto en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New → Project**.
2. Importa el repo `constancias-app` que acabas de subir.
3. Framework Preset: déjalo en **Other** (no es Next.js, es Express plano).
   Vercel detecta `vercel.json` automáticamente.
4. Todavía **no despliegues** — primero agrega la base de datos (paso 3).

## 3. Agrega Vercel Postgres

1. Dentro del proyecto en Vercel, ve a la pestaña **Storage**.
2. **Create Database → Postgres** (plan gratuito alcanza para este caso de uso).
3. Vercel conecta la base automáticamente al proyecto y agrega la variable
   de entorno `POSTGRES_URL` (y variantes) por ti — no necesitas copiarla a mano.

## 4. Variables de entorno

En **Settings → Environment Variables** del proyecto agrega:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | una cadena larga y aleatoria (ej. `openssl rand -base64 48`) |
| `BASE_URL` | déjala vacía por ahora; después del primer deploy ponla como `https://tu-proyecto.vercel.app` (o tu dominio propio) y vuelve a desplegar — el QR usa esta URL |

`POSTGRES_URL` ya quedó puesta por el paso 3, no la agregues manualmente.

## 5. Crea las tablas y el usuario admin

Necesitas correr esto **una sola vez**, desde tu máquina, apuntando a la
base de datos real de Vercel:

```bash
npm install -g vercel      # si no lo tienes
vercel link                # conecta esta carpeta con el proyecto de Vercel
vercel env pull .env.development.local     # trae POSTGRES_URL real

npm install
npm run db:init             # crea las tablas
npm run db:seed             # crea el usuario admin / admin123
```

## 6. Despliega

```bash
vercel --prod
```

O simplemente hazle push a `main` en GitHub — Vercel despliega automático
en cada push una vez conectado el repo.

Tu app queda en algo como `https://constancias-app.vercel.app`. Actualiza
`BASE_URL` en las variables de entorno con esa URL final y vuelve a
desplegar, para que los QR apunten correctamente.

---

## Desarrollo local

```bash
npm install
vercel env pull .env.development.local   # una vez, para tener la BD real
npm run dev
```

Abre `http://localhost:3000`.

**Usuario de prueba (creado por `npm run db:seed`):**
- Usuario: `admin`
- Contraseña: `admin123`

⚠️ Cámbiala antes de usar el sistema con datos reales.

---

## Estructura del proyecto

```
constancias-app/
├── api/
│   └── index.js            # app Express — se exporta como función serverless
├── db/
│   ├── schema.js            # DDL de las tablas (Postgres)
│   ├── init.js              # crea las tablas
│   └── seed.js              # crea el usuario admin inicial
├── lib/
│   ├── auth.js               # login por JWT en cookie httpOnly
│   └── pdfConstancia.js      # generación del PDF con QR
├── views/                    # plantillas EJS
├── public/css/style.css
├── vercel.json                # ruteo de Vercel
└── .env.example
```

## Qué extendería primero (orden de prioridad)

1. **Gestión de usuarios desde la UI** — hoy solo hay un script de seed;
   se necesita una pantalla para crear/desactivar empleados.
2. **Roles y permisos** — diferenciar quién puede emitir de quién puede
   revocar constancias.
3. **Firma digital / logo real** en el PDF, en vez del espacio en blanco actual.
4. **Pantalla de auditoría** — ya se guarda cada consulta al QR en
   `verificaciones_log`, falta una vista para revisarlo.
5. **Rate limiting** en `/verify/:token` como defensa adicional.
6. **Exportar a Excel/CSV** el listado de constancias.
7. **Dominio propio** (ej. `constancias.tuescuela.edu.mx`) apuntado al
   proyecto de Vercel, en vez del subdominio `.vercel.app`.
