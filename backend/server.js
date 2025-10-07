const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'skill-swaaap-dev-secret';
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/skill-swaaap';

const app = express();
app.use(cors());
app.use(express.json());

let usersCollection;
let swapRequestsCollection;
let requestMessagesCollection;

async function initDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  usersCollection = db.collection('users');
  swapRequestsCollection = db.collection('swapRequests');
  requestMessagesCollection = db.collection('requestMessages');

  await usersCollection.createIndex({ emailLower: 1 }, { unique: true });
  await swapRequestsCollection.createIndex({ fromUserId: 1 });
  await swapRequestsCollection.createIndex({ toUserId: 1 });
  await requestMessagesCollection.createIndex({ requestId: 1 });
}

function formatTimestamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, emailLower, ...safeUser } = user;
  if (safeUser._id) {
    safeUser.id = safeUser._id.toString();
    delete safeUser._id;
  }
  if (safeUser.createdAt) {
    safeUser.createdAt = formatTimestamp(safeUser.createdAt);
  }
  if (safeUser.updatedAt) {
    safeUser.updatedAt = formatTimestamp(safeUser.updatedAt);
  }
  return safeUser;
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No se encontró token de autenticación.' });
  }

  const [, token] = authHeader.split(' ');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    let userId;
    try {
      userId = new ObjectId(payload.userId);
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
    const user = await usersCollection.findOne({ _id: userId });
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
  const emailLower = email.toLowerCase();
  const existingUser = await usersCollection.findOne({ emailLower });
  if (existingUser) {
    return res.status(409).json({ error: 'El email ya está registrado.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const user = {
    email,
    emailLower,
    name,
    passwordHash,
    profile: {
      bio: '',
      skillsOffering: '',
      skillsSeeking: '',
      availability: ''
    },
    createdAt: now,
    updatedAt: now
  };

  const { insertedId } = await usersCollection.insertOne(user);
  user._id = insertedId;

  const token = generateToken(insertedId.toString());
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  const user = await usersCollection.findOne({ emailLower: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const token = generateToken(user._id.toString());
  res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/profile', authMiddleware, async (req, res) => {
  const { bio = '', skillsOffering = '', skillsSeeking = '', availability = '' } = req.body;
  await usersCollection.updateOne(
    { _id: req.user._id },
    {
      $set: {
        profile: { bio, skillsOffering, skillsSeeking, availability },
        updatedAt: new Date()
      }
    }
  );
  const updatedUser = await usersCollection.findOne({ _id: req.user._id });
  res.json({ user: sanitizeUser(updatedUser) });
});

app.get('/api/users', authMiddleware, async (req, res) => {
  const list = await usersCollection
    .find({ _id: { $ne: req.user._id } })
    .sort({ createdAt: -1 })
    .toArray();
  const sanitized = list.map((user) => sanitizeUser(user));
  res.json({ users: sanitized });
});

function toObjectId(value) {
  try {
    return new ObjectId(value);
  } catch (error) {
    return null;
  }
}

async function enrichRequest(request) {
  const fromUser = await usersCollection.findOne({ _id: request.fromUserId });
  const toUser = await usersCollection.findOne({ _id: request.toUserId });
  return {
    id: request._id.toString(),
    fromUserId: request.fromUserId.toString(),
    toUserId: request.toUserId.toString(),
    message: request.message,
    status: request.status,
    createdAt: formatTimestamp(request.createdAt),
    updatedAt: formatTimestamp(request.updatedAt),
    fromUser: sanitizeUser(fromUser),
    toUser: sanitizeUser(toUser)
  };
}

app.post('/api/requests', authMiddleware, async (req, res) => {
  const { toUserId, message = '' } = req.body;
  if (!toUserId) {
    return res.status(400).json({ error: 'El destinatario es obligatorio.' });
  }
  const toUserObjectId = toObjectId(toUserId);
  if (!toUserObjectId) {
    return res.status(400).json({ error: 'Identificador de destinatario inválido.' });
  }

  const toUser = await usersCollection.findOne({ _id: toUserObjectId });
  if (!toUser) {
    return res.status(404).json({ error: 'El destinatario no existe.' });
  }
  if (toUserObjectId.equals(req.user._id)) {
    return res.status(400).json({ error: 'No puedes enviarte solicitudes a ti mismo.' });
  }

  const now = new Date();
  const request = {
    fromUserId: req.user._id,
    toUserId: toUserObjectId,
    message,
    status: 'pendiente',
    createdAt: now,
    updatedAt: now
  };

  const { insertedId } = await swapRequestsCollection.insertOne(request);
  request._id = insertedId;

  const enriched = await enrichRequest(request);

  res.status(201).json({ request: enriched });
});

app.get('/api/requests', authMiddleware, async (req, res) => {
  const list = await swapRequestsCollection
    .find({
      $or: [{ fromUserId: req.user._id }, { toUserId: req.user._id }]
    })
    .sort({ createdAt: -1 })
    .toArray();

  const userIds = new Set();
  list.forEach((request) => {
    userIds.add(request.fromUserId.toString());
    userIds.add(request.toUserId.toString());
  });

  const users = await usersCollection
    .find({ _id: { $in: Array.from(userIds).map((id) => new ObjectId(id)) } })
    .toArray();

  const userMap = new Map(users.map((user) => [user._id.toString(), sanitizeUser(user)]));

  const enriched = list.map((request) => ({
    id: request._id.toString(),
    fromUserId: request.fromUserId.toString(),
    toUserId: request.toUserId.toString(),
    message: request.message,
    status: request.status,
    createdAt: formatTimestamp(request.createdAt),
    updatedAt: formatTimestamp(request.updatedAt),
    fromUser: userMap.get(request.fromUserId.toString()) || null,
    toUser: userMap.get(request.toUserId.toString()) || null
  }));

  res.json({ requests: enriched });
});

app.post('/api/requests/:requestId/status', authMiddleware, async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body;
  const validStatuses = ['pendiente', 'aceptado', 'rechazado', 'completado'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  const objectId = toObjectId(requestId);
  if (!objectId) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }

  const request = await swapRequestsCollection.findOne({ _id: objectId });
  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }
  if (!request.toUserId.equals(req.user._id)) {
    return res.status(403).json({ error: 'Solo el receptor puede actualizar el estado.' });
  }

  await swapRequestsCollection.updateOne(
    { _id: objectId },
    { $set: { status, updatedAt: new Date() } }
  );
  const updatedRequest = await swapRequestsCollection.findOne({ _id: objectId });
  const enriched = await enrichRequest(updatedRequest);
  res.json({ request: enriched });
});

app.post('/api/requests/:requestId/messages', authMiddleware, async (req, res) => {
  const { requestId } = req.params;
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const objectId = toObjectId(requestId);
  if (!objectId) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }

  const request = await swapRequestsCollection.findOne({ _id: objectId });
  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }

  if (!request.fromUserId.equals(req.user._id) && !request.toUserId.equals(req.user._id)) {
    return res.status(403).json({ error: 'No tienes acceso a esta solicitud.' });
  }

  const message = {
    requestId: request._id,
    senderId: req.user._id,
    text,
    createdAt: new Date()
  };

  const { insertedId } = await requestMessagesCollection.insertOne(message);
  message._id = insertedId;

  res.status(201).json({
    message: {
      id: insertedId.toString(),
      requestId: request._id.toString(),
      senderId: req.user._id.toString(),
      text: message.text,
      createdAt: formatTimestamp(message.createdAt),
      sender: sanitizeUser(req.user)
    }
  });
});

app.get('/api/requests/:requestId/messages', authMiddleware, async (req, res) => {
  const { requestId } = req.params;
  const objectId = toObjectId(requestId);
  if (!objectId) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }

  const request = await swapRequestsCollection.findOne({ _id: objectId });
  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }
  if (!request.fromUserId.equals(req.user._id) && !request.toUserId.equals(req.user._id)) {
    return res.status(403).json({ error: 'No tienes acceso a esta solicitud.' });
  }

  const messages = await requestMessagesCollection
    .find({ requestId: request._id })
    .sort({ createdAt: 1 })
    .toArray();

  const senderIds = Array.from(new Set(messages.map((message) => message.senderId.toString())));
  const senders = await usersCollection
    .find({ _id: { $in: senderIds.map((id) => new ObjectId(id)) } })
    .toArray();
  const senderMap = new Map(senders.map((sender) => [sender._id.toString(), sanitizeUser(sender)]));

  const formatted = messages.map((message) => ({
    id: message._id.toString(),
    requestId: message.requestId.toString(),
    senderId: message.senderId.toString(),
    text: message.text,
    createdAt: formatTimestamp(message.createdAt),
    sender: senderMap.get(message.senderId.toString()) || null
  }));

  res.json({ messages: formatted });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Skill Swaaap API escuchando en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('No se pudo inicializar la base de datos:', error);
    process.exit(1);
  });
