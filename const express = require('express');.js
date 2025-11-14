const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// تخزين البيانات
const servers = new Map();
const users = new Map();
const voiceChannels = new Map();

// السيرفر الافتراضي
servers.set('default', {
  id: 'default',
  name: 'سيرفر الرائع',
  icon: '🎮',
  channels: [
    { id: 'welcome', name: '🔊 الترحيب', type: 'voice' },
    { id: 'general', name: '💬 عام', type: 'text' },
    { id: 'gaming', name: '🎮 جيمز', type: 'text' },
    { id: 'music', name: '🎵 مزيكا', type: 'voice' }
  ],
  members: new Set()
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('🎮 مستخدم انضم: ' + socket.id);

  // انضمام للسيرفر
  socket.on('join_server', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      discriminator: Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
      avatar: userData.avatar || '👤',
      status: 'online',
      currentChannel: null,
      currentVoiceChannel: null
    };

    users.set(socket.id, user);
    servers.get('default').members.add(socket.id);

    // إرسال بيانات السيرفر للمستخدم
    socket.emit('server_data', {
      server: servers.get('default'),
      currentUser: user
    });

    // تحديث قائمة الأعضاء للجميع
    io.emit('members_update', Array.from(users.values()));
  });

  // تغيير القناة
  socket.on('switch_channel', (channelId) => {
    const user = users.get(socket.id);
    if (user) {
      user.currentChannel = channelId;
      socket.join(channelId);
      
      // إرسال رسائل القناة
      socket.emit('channel_messages', []);
    }
  });

  // إرسال رسالة
  socket.on('send_message', (messageData) => {
    const user = users.get(socket.id);
    if (user && user.currentChannel) {
      const message = {
        id: Date.now(),
        author: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar
        },
        content: messageData.content,
        timestamp: new Date(),
        channelId: user.currentChannel,
        attachments: messageData.attachments || []
      };

      // إرسال للجميع في القناة
      io.to(user.currentChannel).emit('new_message', message);
    }
  });

  // الانضمام لقناة صوتية
  socket.on('join_voice', (channelId) => {
    const user = users.get(socket.id);
    if (user) {
      user.currentVoiceChannel = channelId;
      socket.join(`voice_${channelId}`);
      
      io.emit('voice_update', {
        channelId,
        user: user,
        action: 'join'
      });
    }
  });

  // مغادرة القناة الصوتية
  socket.on('leave_voice', () => {
    const user = users.get(socket.id);
    if (user && user.currentVoiceChannel) {
      const channelId = user.currentVoiceChannel;
      user.currentVoiceChannel = null;
      
      io.emit('voice_update', {
        channelId,
        user: user,
        action: 'leave'
      });
    }
  });

  // WebRTC signaling للمكالمات
  socket.on('webrtc_offer', (data) => {
    socket.to(data.target).emit('webrtc_offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('webrtc_answer', (data) => {
    socket.to(data.target).emit('webrtc_answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('webrtc_ice_candidate', (data) => {
    socket.to(data.target).emit('webrtc_ice_candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // عند الانقطاع
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      servers.get('default').members.delete(socket.id);
      
      io.emit('user_offline', socket.id);
      io.emit('members_update', Array.from(users.values()));
    }
    console.log('❌ مستخدم غادر: ' + socket.id);
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    servers: servers.size,
    users_online: users.size,
    timestamp: new Date()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 B12 Clone running on http://localhost:${PORT}`);
  console.log(`👥 Online: ${users.size} users`);
});