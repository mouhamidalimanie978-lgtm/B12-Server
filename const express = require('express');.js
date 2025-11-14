const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

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

// تخزين البيانات في الذاكرة (للتشغيل الفوري)
let users = new Map();
let rooms = new Map();
let messages = new Map();

// Socket.io للأونلاين المباشر
io.on('connection', (socket) => {
  console.log('🔥 مستخدم اتصل: ' + socket.id);

  // تسجيل الدخول
  socket.on('user_login', (userData) => {
    users.set(socket.id, {
      id: socket.id,
      username: userData.username,
      online: true,
      avatar: userData.avatar
    });

    // إعلام الجميع بالمستخدم الجديد
    io.emit('user_online', {
      id: socket.id,
      username: userData.username,
      online: true
    });

    // إرسال قائمة المستخدمين المتصلين
    socket.emit('online_users', Array.from(users.values()));
  });

  // إرسال رسالة
  socket.on('send_message', (messageData) => {
    const user = users.get(socket.id);
    if (user) {
      const message = {
        id: Date.now(),
        sender: user.username,
        content: messageData.content,
        type: messageData.type || 'text',
        timestamp: new Date(),
        room: messageData.room || 'general'
      };

      // إرسال للجميع في الغرفة
      io.emit('new_message', message);
    }
  });

  // إنشاء غرفة
  socket.on('create_room', (roomData) => {
    const room = {
      id: Date.now().toString(),
      name: roomData.name,
      createdBy: socket.id,
      members: [socket.id]
    };
    
    rooms.set(room.id, room);
    io.emit('room_created', room);
  });

  // المكالمات الصوتية عبر WebRTC
  socket.on('call_user', (data) => {
    socket.to(data.to).emit('incoming_call', {
      from: socket.id,
      username: users.get(socket.id)?.username,
      offer: data.offer
    });
  });

  socket.on('call_accepted', (data) => {
    socket.to(data.to).emit('call_accepted', {
      from: socket.id,
      answer: data.answer
    });
  });

  // عند انقطاع الاتصال
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.emit('user_offline', socket.id);
    }
    console.log('❌ مستخدم انقطع: ' + socket.id);
  });
});

// مسارات API
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 سيرفر الشات يعمل بنجاح!',
    online_users: users.size,
    status: 'ACTIVE'
  });
});

app.get('/status', (req, res) => {
  res.json({
    online: true,
    users_online: users.size,
    rooms_count: rooms.size,
    timestamp: new Date()
  });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎉 السيرفر شغال على http://localhost:${PORT}`);
  console.log(`👥 مستخدمين أونلاين: ${users.size}`);
  console.log(`🌐 جاهز للاستخدام المباشر!`);
});