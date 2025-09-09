const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 50e6 // 50MB for large files
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

// Enhanced multer configuration for different media types
const createStorage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = `public/uploads/${folder}`;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Upload configurations
const uploadProfile = multer({
  storage: createStorage(''),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed for profile pictures!'), false);
    }
  }
});

const uploadImage = multer({
  storage: createStorage('images'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed!'), false);
    }
  }
});

const uploadVideo = multer({
  storage: createStorage('videos'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files allowed!'), false);
    }
  }
});

const uploadVoice = multer({
  storage: createStorage('voice'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files allowed!'), false);
    }
  }
});

// Store active users, messages, and calls
const activeUsers = new Map();
const chatMessages = [];
const activeCalls = new Map(); // Store ongoing calls
let messageIdCounter = 1;

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload endpoints
app.post('/upload-profile', uploadProfile.single('profilePic'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, fileUrl, message: 'Profile picture uploaded!' });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/upload-image', uploadImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    const fileUrl = `/uploads/images/${req.file.filename}`;
    res.json({ 
      success: true, 
      fileUrl, 
      fileName: req.file.originalname,
      fileSize: req.file.size,
      message: 'Image uploaded successfully!' 
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

app.post('/upload-video', uploadVideo.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }
    const fileUrl = `/uploads/videos/${req.file.filename}`;
    res.json({ 
      success: true, 
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      message: 'Video uploaded successfully!' 
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

app.post('/upload-voice', uploadVoice.single('voice'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No voice file uploaded' });
    }
    const fileUrl = `/uploads/voice/${req.file.filename}`;
    res.json({ 
      success: true, 
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      message: 'Voice message uploaded successfully!' 
    });
  } catch (error) {
    console.error('Voice upload error:', error);
    res.status(500).json({ error: 'Voice upload failed' });
  }
});

// Socket.io connection handling with advanced features
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-chat', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      avatar: userData.avatar,
      isOnline: true,
      lastSeen: new Date(),
      joinedAt: new Date()
    };

    activeUsers.set(socket.id, user);

    // Broadcast user joined with notification
    socket.broadcast.emit('user-joined', {
      userId: socket.id,
      username: user.username,
      avatar: user.avatar,
      message: `${user.username} joined the chat!`,
      timestamp: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      type: 'user-joined'
    });

    // Send current state to new user
    socket.emit('active-users', Array.from(activeUsers.values()));
    socket.emit('message-history', chatMessages);

    // Broadcast updated user list to all clients
    io.emit('active-users', Array.from(activeUsers.values()));

    console.log(`${userData.username} joined the chat`);
  });

  // Handle different message types with notifications
  socket.on('send-message', (messageData) => {
    const user = activeUsers.get(socket.id);

    if (!user) {
      socket.emit('error', 'User not found. Please rejoin the chat.');
      return;
    }

    const message = {
      id: messageIdCounter++,
      userId: socket.id,
      username: user.username,
      avatar: user.avatar,
      type: messageData.type || 'text',
      message: messageData.message,
      fileUrl: messageData.fileUrl,
      fileName: messageData.fileName,
      fileSize: messageData.fileSize,
      timestamp: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      sentAt: new Date(),
      isNotification: true // Enable notifications for messages
    };

    chatMessages.push(message);

    // Keep only last 100 messages
    if (chatMessages.length > 100) {
      chatMessages.shift();
    }

    // Broadcast message with notification flag
    io.emit('new-message', message);
    console.log(`${messageData.type} message from ${user.username}`);
  });

  // Voice/Video calling features
  socket.on('initiate-call', (data) => {
    const caller = activeUsers.get(socket.id);
    const targetUser = Array.from(activeUsers.values()).find(u => u.id === data.targetUserId);

    if (caller && targetUser) {
      const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      activeCalls.set(callId, {
        callId,
        callerId: socket.id,
        callerUsername: caller.username,
        callerAvatar: caller.avatar,
        targetId: data.targetUserId,
        targetUsername: targetUser.username,
        callType: data.callType, // 'voice' or 'video'
        status: 'ringing',
        startedAt: new Date()
      });

      // Send call invitation to target user
      socket.to(data.targetUserId).emit('incoming-call', {
        callId,
        callerId: socket.id,
        callerUsername: caller.username,
        callerAvatar: caller.avatar,
        callType: data.callType
      });

      // Confirm call initiated to caller
      socket.emit('call-initiated', { callId });
    }
  });

  socket.on('respond-to-call', (data) => {
    const call = activeCalls.get(data.callId);
    if (call) {
      if (data.accepted) {
        call.status = 'accepted';
        activeCalls.set(data.callId, call);

        // Notify both users that call was accepted
        socket.emit('call-accepted', { callId: data.callId });
        socket.to(call.callerId).emit('call-accepted', { callId: data.callId });
      } else {
        // Call declined
        activeCalls.delete(data.callId);
        socket.to(call.callerId).emit('call-declined', { callId: data.callId });
      }
    }
  });

  socket.on('end-call', (data) => {
    const call = activeCalls.get(data.callId);
    if (call) {
      activeCalls.delete(data.callId);

      // Notify both participants
      socket.emit('call-ended', { callId: data.callId });
      socket.to(call.callerId === socket.id ? call.targetId : call.callerId)
        .emit('call-ended', { callId: data.callId });
    }
  });

  // WebRTC signaling for calls
  socket.on('webrtc-offer', (data) => {
    socket.to(data.targetId).emit('webrtc-offer', {
      callId: data.callId,
      offer: data.offer,
      senderId: socket.id
    });
  });

  socket.on('webrtc-answer', (data) => {
    socket.to(data.targetId).emit('webrtc-answer', {
      callId: data.callId,
      answer: data.answer,
      senderId: socket.id
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    socket.to(data.targetId).emit('webrtc-ice-candidate', {
      callId: data.callId,
      candidate: data.candidate,
      senderId: socket.id
    });
  });

  // Typing indicators
  socket.on('typing-start', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user-typing', {
        userId: socket.id,
        username: user.username,
        isTyping: true
      });
    }
  });

  socket.on('typing-stop', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user-typing', {
        userId: socket.id,
        username: user.username,
        isTyping: false
      });
    }
  });

  // Enhanced disconnect handling with notifications
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);

    if (user) {
      // Mark user as offline instead of removing
      user.isOnline = false;
      user.lastSeen = new Date();
      activeUsers.set(socket.id, user);

      // End any active calls
      for (const [callId, call] of activeCalls) {
        if (call.callerId === socket.id || call.targetId === socket.id) {
          const otherUserId = call.callerId === socket.id ? call.targetId : call.callerId;
          socket.to(otherUserId).emit('call-ended', { callId, reason: 'user-disconnected' });
          activeCalls.delete(callId);
        }
      }

      // Broadcast user left with notification
      socket.broadcast.emit('user-left', {
        userId: socket.id,
        username: user.username,
        message: `${user.username} left the chat`,
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        type: 'user-left',
        isNotification: true
      });

      // Remove from active users after delay
      setTimeout(() => {
        activeUsers.delete(socket.id);
        io.emit('active-users', Array.from(activeUsers.values()));
      }, 60000); // Remove after 1 minute

      // Broadcast updated user list
      io.emit('active-users', Array.from(activeUsers.values()));

      console.log(`${user.username} disconnected`);
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Check size limits.' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Advanced WorldChat Server is running on http://localhost:${PORT}`);
  console.log(`📁 Upload directories:`);
  console.log(`   • Profile pics: ${path.join(__dirname, 'public/uploads')}`);
  console.log(`   • Images: ${path.join(__dirname, 'public/uploads/images')}`);
  console.log(`   • Videos: ${path.join(__dirname, 'public/uploads/videos')}`);
  console.log(`   • Voice: ${path.join(__dirname, 'public/uploads/voice')}`);
  console.log(`🔔 Advanced notifications enabled`);
  console.log(`📞 Voice/Video calling enabled`);
  console.log(`🌐 Open your browser and navigate to http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Advanced WorldChat Server...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});
