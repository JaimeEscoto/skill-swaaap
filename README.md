# Skill Swaaap MVP

Este repositorio contiene un prototipo funcional (MVP) de la plataforma Skill Swaaap con un backend en Node.js/Express y un frontend ligero en HTML + JavaScript.

## Requisitos previos

- Node.js 18 o superior.
- Una cuenta gratuita en [MongoDB Atlas](https://www.mongodb.com/atlas/database) u otro proveedor que exponga un clúster de MongoDB compatible.

## Instalación y uso

1. Instala las dependencias del backend:

   ```bash
   cd backend
   npm install
   ```

2. Configura las variables de entorno necesarias (puedes usar un archivo `.env` y cargarlo con herramientas como `dotenv` o exportarlas en tu terminal):

   - `MONGODB_URI`: cadena de conexión a tu base de datos MongoDB.
   - `JWT_SECRET`: clave usada para firmar los tokens JWT (define un valor seguro en producción).

3. Arranca la API:

   ```bash
   npm start
   ```

   La API se expone en `http://localhost:4000`.

4. Abre `index.html` en tu navegador (por ejemplo, arrastrándolo a una ventana del navegador).

5. Regístrate o inicia sesión para:

   - Completar tu perfil.
   - Explorar otros usuarios registrados.
   - Enviar solicitudes de intercambio de habilidades.
   - Chatear dentro de cada solicitud.

## Configuración de la base de datos en la nube

Una forma sencilla y gratuita de hospedar la base de datos es mediante el plan **Free Forever** de MongoDB Atlas. Sigue estos pasos resumidos:

1. Crea una cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas/database) y selecciona la opción **Create** para iniciar un nuevo clúster (elige el nivel gratuito "M0").
2. Define el proveedor, región y nombre del clúster según tus preferencias. Para ambientes de prueba cualquier región cercana a tus usuarios funciona bien.
3. Cuando Atlas cree el clúster, ve a **Database Access** y crea un usuario con permisos de lectura/escritura. Guarda el usuario y contraseña, los necesitarás para la cadena de conexión.
4. En **Network Access**, agrega tu IP (o `0.0.0.0/0` temporalmente para desarrollo) para permitir conexiones entrantes.
5. Regresa al panel del clúster y haz clic en **Connect → Drivers**. Copia la cadena de conexión que luce como:

   ```
   mongodb+srv://<usuario>:<contraseña>@<cluster>.mongodb.net/skill-swaaap?retryWrites=true&w=majority
   ```

   Reemplaza `<usuario>` y `<contraseña>` por las credenciales que creaste y el nombre de la base de datos (`skill-swaaap` en el ejemplo) por el que prefieras.

6. Establece la variable de entorno `MONGODB_URI` con esa cadena de conexión antes de iniciar el servidor (`export MONGODB_URI="..."` en Linux/macOS o usando el panel de variables en tu proveedor de hosting).

Con esta configuración, los datos de usuarios, solicitudes y mensajes persistirán en tu clúster gestionado en la nube.

## Scripts disponibles

En la carpeta `backend`:

- `npm start`: ejecuta la API en modo producción.
- `npm run dev`: ejecuta la API con recarga automática mediante `nodemon`.
- `npm test`: placeholder que indica que aún no existen pruebas automatizadas.

## Arquitectura

- **Backend:** Node.js + Express con autenticación JWT, persistencia en MongoDB, gestión de perfiles, solicitudes de intercambio y mensajería básica.
- **Frontend:** HTML, CSS y JavaScript vanilla con `fetch` para consumir la API y manejar el estado mínimo en el navegador.

## Próximos pasos sugeridos

- Validaciones adicionales y recuperación de contraseña.
- Chat en tiempo real con WebSockets.
- Despliegue en servicios gestionados (Railway, Render, Vercel, etc.).
