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
app.use(express.static(path.join(__dirname, 'public')));

// تخزين البيانات
const users = new Map();
const messagesHistory = [];

// Socket.io events
io.on('connection', (socket) => {
  console.log('🔗 مستخدم متصل:', socket.id);

  socket.on('join_server', (userData) => {
    const user = {
      id: socket.id,
      userId: generateUserId(),
      ...userData,
      joinTime: new Date(),
      isOnline: true
    };
    
    users.set(socket.id, user);
    
    // إرسال التاريخ للمستخدم الجديد
    socket.emit('load_messages', messagesHistory.slice(-100));
    
    // إعلام الجميع
    socket.broadcast.emit('user_joined', {
      user: user,
      onlineUsers: Array.from(users.values()).filter(u => u.isOnline)
    });
    
    // رسالة ترحيب
    const welcomeMsg = {
      id: generateId(),
      userId: 'system',
      userName: 'النظام',
      content: `🎉 انضم ${user.realName} إلى الدردشة`,
      time: new Date(),
      type: 'system'
    };
    
    messagesHistory.push(welcomeMsg);
    io.emit('new_message', welcomeMsg);
    
    console.log(`✅ ${user.realName} انضم إلى السيرفر`);
  });

  socket.on('send_message', (messageData) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const message = {
      id: generateId(),
      userId: user.id,
      userDisplayId: user.userId,
      userName: user.realName,
      userIsAdmin: user.isAdmin,
      ...messageData,
      time: new Date()
    };
    
    messagesHistory.push(message);
    io.emit('new_message', message);
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      user.isOnline = false;
      
      const leaveMsg = {
        id: generateId(),
        userId: 'system',
        userName: 'النظام',
        content: `👋 غادر ${user.realName} الدردشة`,
        time: new Date(),
        type: 'system'
      };
      
      messagesHistory.push(leaveMsg);
      socket.broadcast.emit('new_message', leaveMsg);
      socket.broadcast.emit('user_left', user);
      
      users.delete(socket.id);
      console.log(`❌ ${user.realName} غادر السيرفر`);
    }
  });
});

function generateUserId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 B12 Server running on port ${PORT}`);
});