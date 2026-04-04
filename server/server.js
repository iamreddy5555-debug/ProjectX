require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000']
  : ['http://localhost:5173', 'http://localhost:3000'];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }
});

// Middleware
app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', message: 'CricketX API is running' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/players', require('./routes/players'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/contests', require('./routes/contests'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/bets', require('./routes/bets'));
app.use('/api/admin', require('./routes/admin'));

// Socket.IO
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
  });

  socket.on('chat:send', async (data) => {
    const { receiverId, senderRole } = data;
    if (receiverId) {
      const receiverSocket = onlineUsers.get(receiverId);
      if (receiverSocket) {
        io.to(receiverSocket).emit('chat:receive', data);
      }
    }
    if (senderRole === 'user') {
      socket.broadcast.emit('chat:newMessage', data);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) onlineUsers.delete(socket.userId);
  });
});

app.set('io', io);

// Seed demo data
const seedDemoData = async () => {
  const User = require('./models/User');
  const Match = require('./models/Match');

  // Create default admin
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    const admin = new User({
      name: 'Admin',
      email: 'admin@cricketx.com',
      phone: '9999999999',
      password: 'admin123',
      role: 'admin',
      balance: 0,
    });
    await admin.save();
    console.log('✅ Admin created: admin@cricketx.com / admin123');
  }

  // Seed IPL 2026 Data from Cricbuzz
  console.log('🌱 Syncing IPL 2026 data from Cricbuzz...');
  try {
    const cricbuzz = require('./services/cricbuzz');
    await cricbuzz.seedIPLData();
  } catch (error) {
    console.log('⚠️ Failed to sync IPL data:', error.message);
  }
};

// Start
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  const dbConnected = await connectDB();
  if (dbConnected) await seedDemoData();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (!dbConnected) console.log('⚠️  Database not connected.');
  });
};
startServer();
