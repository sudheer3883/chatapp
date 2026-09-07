const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { initSocketServer } = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend client (supports localhost, tunnels, and production URLs)
const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Initialize Socket.io
const io = new Server(server, {
  cors: corsOptions,
});

// Attach io to express app for use inside route controllers
app.set('io', io);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static build if available
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback SPA routing for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Frontend not built yet. Please run npm run build in /frontend');
    }
  });
});

// Initialize real-time Socket.io logic
initSocketServer(io);

// Port & DB configuration
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp';

server.listen(PORT, () => {
  console.log(`[Server] Real-time communication server running on http://localhost:${PORT}`);
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[MongoDB] Connected successfully');
  })
  .catch((err) => {
    console.warn('[MongoDB] Warning: MongoDB connection failed (make sure MongoDB service or Atlas is running):', err.message);
  });
