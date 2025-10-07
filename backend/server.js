const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'skill-swaaap-dev-secret';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory stores for MVP purposes.
const users = new Map(); // id -> user
const emailIndex = new Map(); // email -> id
const swapRequests = new Map(); // id -> request
const requestMessages = new Map(); // requestId -> [messages]

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No se encontró token de autenticación.' });
  }

  const [, token] = authHeader.split(' ');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = users.get(payload.userId);
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios.' });
  }
  if (emailIndex.has(email.toLowerCase())) {
    return res.status(409).json({ error: 'El email ya está registrado.' });
  }

  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: userId,
    email,
    name,
    passwordHash,
    profile: {
      bio: '',
      skillsOffering: '',
      skillsSeeking: '',
      availability: ''
    },
    createdAt: new Date().toISOString()
  };

  users.set(userId, user);
  emailIndex.set(email.toLowerCase(), userId);

  const token = generateToken(userId);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  const userId = emailIndex.get(email.toLowerCase());
  if (!userId) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const user = users.get(userId);
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const token = generateToken(userId);
  res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/profile', authMiddleware, (req, res) => {
  const { bio = '', skillsOffering = '', skillsSeeking = '', availability = '' } = req.body;
  req.user.profile = { bio, skillsOffering, skillsSeeking, availability };
  users.set(req.user.id, req.user);
  res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/users', authMiddleware, (req, res) => {
  const list = Array.from(users.values())
    .filter((user) => user.id !== req.user.id)
    .map((user) => sanitizeUser(user));
  res.json({ users: list });
});

app.post('/api/requests', authMiddleware, (req, res) => {
  const { toUserId, message = '' } = req.body;
  if (!toUserId) {
    return res.status(400).json({ error: 'El destinatario es obligatorio.' });
  }
  if (!users.has(toUserId)) {
    return res.status(404).json({ error: 'El destinatario no existe.' });
  }
  if (toUserId === req.user.id) {
    return res.status(400).json({ error: 'No puedes enviarte solicitudes a ti mismo.' });
  }

  const requestId = uuidv4();
  const request = {
    id: requestId,
    fromUserId: req.user.id,
    toUserId,
    message,
    status: 'pendiente',
    createdAt: new Date().toISOString()
  };

  swapRequests.set(requestId, request);
  requestMessages.set(requestId, []);

  res.status(201).json({ request });
});

app.get('/api/requests', authMiddleware, (req, res) => {
  const list = Array.from(swapRequests.values()).filter(
    (request) => request.fromUserId === req.user.id || request.toUserId === req.user.id
  );

  const enriched = list.map((request) => ({
    ...request,
    fromUser: sanitizeUser(users.get(request.fromUserId)),
    toUser: sanitizeUser(users.get(request.toUserId))
  }));

  res.json({ requests: enriched });
});

app.post('/api/requests/:requestId/status', authMiddleware, (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body;
  const validStatuses = ['pendiente', 'aceptado', 'rechazado', 'completado'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  const request = swapRequests.get(requestId);
  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }
  if (request.toUserId !== req.user.id) {
    return res.status(403).json({ error: 'Solo el receptor puede actualizar el estado.' });
  }

  request.status = status;
  swapRequests.set(requestId, request);
  res.json({ request });
});

app.post('/api/requests/:requestId/messages', authMiddleware, (req, res) => {
  const { requestId } = req.params;
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const request = swapRequests.get(requestId);
  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }

  if (request.fromUserId !== req.user.id && request.toUserId !== req.user.id) {
    return res.status(403).json({ error: 'No tienes acceso a esta solicitud.' });
  }

  const message = {
    id: uuidv4(),
    requestId,
    senderId: req.user.id,
    text,
    createdAt: new Date().toISOString()
  };

  const messages = requestMessages.get(requestId) || [];
  messages.push(message);
  requestMessages.set(requestId, messages);

  res.status(201).json({ message });
});

app.get('/api/requests/:requestId/messages', authMiddleware, (req, res) => {
  const { requestId } = req.params;
  const request = swapRequests.get(requestId);
  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }
  if (request.fromUserId !== req.user.id && request.toUserId !== req.user.id) {
    return res.status(403).json({ error: 'No tienes acceso a esta solicitud.' });
  }

  const messages = (requestMessages.get(requestId) || []).map((message) => ({
    ...message,
    sender: sanitizeUser(users.get(message.senderId))
  }));

  res.json({ messages });
});

app.listen(PORT, () => {
  console.log(`Skill Swaaap API escuchando en puerto ${PORT}`);
});
