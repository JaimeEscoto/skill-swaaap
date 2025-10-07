# Skill Swaaap MVP

Este repositorio contiene un prototipo funcional (MVP) de la plataforma Skill Swaaap con un backend en Node.js/Express y un frontend ligero en HTML + JavaScript.

## Requisitos previos

- Node.js 18 o superior

## Instalación y uso

1. Instala las dependencias del backend:

   ```bash
   cd backend
   npm install
   ```

2. Arranca la API:

   ```bash
   npm start
   ```

   La API se expone en `http://localhost:4000`.

3. Abre `index.html` en tu navegador (por ejemplo, arrastrándolo a una ventana del navegador).

4. Regístrate o inicia sesión para:

   - Completar tu perfil.
   - Explorar otros usuarios registrados.
   - Enviar solicitudes de intercambio de habilidades.
   - Chatear dentro de cada solicitud.

> **Nota:** Este MVP utiliza almacenamiento en memoria, por lo que los datos se reinician cada vez que se reinicia el servidor.

## Scripts disponibles

En la carpeta `backend`:

- `npm start`: ejecuta la API en modo producción.
- `npm run dev`: ejecuta la API con recarga automática mediante `nodemon`.
- `npm test`: placeholder que indica que aún no existen pruebas automatizadas.

## Arquitectura

- **Backend:** Node.js + Express con autenticación JWT, gestión de perfiles, solicitudes de intercambio y mensajería básica.
- **Frontend:** HTML, CSS y JavaScript vanilla con `fetch` para consumir la API y manejar el estado mínimo en el navegador.

## Próximos pasos sugeridos

- Persistencia con una base de datos (PostgreSQL, MongoDB, etc.).
- Validaciones adicionales y recuperación de contraseña.
- Chat en tiempo real con WebSockets.
- Despliegue en servicios gestionados (Railway, Render, Vercel, etc.).
