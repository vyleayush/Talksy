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

// Different upload configurations
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

// Store active users and messages
const activeUsers = new Map();
const chatMessages = [];
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-chat', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      avatar: userData.avatar,
      joinedAt: new Date()
    };

    activeUsers.set(socket.id, user);

    socket.broadcast.emit('user-joined', {
      username: user.username,
      message: `${user.username} joined the chat!`,
      timestamp: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    });

    socket.emit('active-users', Array.from(activeUsers.values()));
    socket.emit('message-history', chatMessages);
    io.emit('active-users', Array.from(activeUsers.values()));

    console.log(`${userData.username} joined the chat`);
  });

  // Handle different message types
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
      type: messageData.type || 'text', // text, image, video, voice
      message: messageData.message,
      fileUrl: messageData.fileUrl,
      fileName: messageData.fileName,
      fileSize: messageData.fileSize,
      timestamp: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      sentAt: new Date()
    };

    chatMessages.push(message);

    // Keep only last 100 messages
    if (chatMessages.length > 100) {
      chatMessages.shift();
    }

    io.emit('new-message', message);
    console.log(`${messageData.type} message from ${user.username}`);
  });

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

  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);

    if (user) {
      activeUsers.delete(socket.id);

      socket.broadcast.emit('user-left', {
        username: user.username,
        message: `${user.username} left the chat`,
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      });

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
  console.log(`🚀 Enhanced WorldChat Server is running on http://localhost:${PORT}`);
  console.log(`📁 Upload directories created:`);
  console.log(`   • Profile pics: ${path.join(__dirname, 'public/uploads')}`);
  console.log(`   • Images: ${path.join(__dirname, 'public/uploads/images')}`);
  console.log(`   • Videos: ${path.join(__dirname, 'public/uploads/videos')}`);
  console.log(`   • Voice: ${path.join(__dirname, 'public/uploads/voice')}`);
  console.log(`🌐 Open your browser and navigate to http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Enhanced WorldChat Server...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});