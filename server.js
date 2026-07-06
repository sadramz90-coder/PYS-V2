const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

// ===== دیتابیس =====
const DATA_DIR = './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

function readData(file) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify([]));
        }
        return JSON.parse(fs.readFileSync(file));
    } catch (e) {
        return [];
    }
}

function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getUsers() { return readData(USERS_FILE); }
function saveUsers(users) { writeData(USERS_FILE, users); }
function findUser(username) {
    const users = getUsers();
    return users.find(u => u.username === username);
}

function getMessages(chatId) {
    const allMessages = readData(MESSAGES_FILE);
    return allMessages.filter(m => m.chatId === chatId);
}

function saveMessage(message) {
    const allMessages = readData(MESSAGES_FILE);
    allMessages.push(message);
    const MAX_MESSAGES = 1000;
    if (allMessages.length > MAX_MESSAGES) {
        allMessages.splice(0, allMessages.length - MAX_MESSAGES);
    }
    writeData(MESSAGES_FILE, allMessages);
}

function deleteMessageFromDB(msgId) {
    const allMessages = readData(MESSAGES_FILE);
    const filtered = allMessages.filter(m => m.id !== msgId);
    writeData(MESSAGES_FILE, filtered);
}

function getGroups() { return readData(GROUPS_FILE); }
function saveGroups(groups) { writeData(GROUPS_FILE, groups); }

const onlineUsers = new Map();

// ===== سوکت =====
io.on('connection', (socket) => {
    console.log('🔌 کاربر جدید متصل شد:', socket.id);

    // ثبت‌نام
    socket.on('register', (data) => {
        const { username, password, emoji } = data;
        
        if (findUser(username)) {
            socket.emit('auth-error', 'این نام کاربری قبلاً ثبت شده است!');
            return;
        }
        
        const users = getUsers();
        users.push({
            username,
            password,
            emoji: emoji || '😎',
            status: 'online',
            bio: '',
            isAdmin: username === 'MALEK',
            createdAt: new Date().toISOString()
        });
        saveUsers(users);
        
        socket.emit('auth-success', { 
            user: { username, emoji: emoji || '😎', status: 'online', bio: '' } 
        });
    });

    // ورود
    socket.on('login', (data) => {
        const { username, password } = data;
        const user = findUser(username);
        
        if (!user || user.password !== password) {
            socket.emit('auth-error', 'نام کاربری یا رمز عبور اشتباه است!');
            return;
        }
        
        user.status = 'online';
        saveUsers(getUsers());
        
        onlineUsers.set(socket.id, {
            username: user.username,
            status: user.status
        });
        
        socket.emit('auth-success', { 
            user: { 
                username: user.username, 
                emoji: user.emoji, 
                status: user.status,
                bio: user.bio 
            } 
        });
        
        socket.broadcast.emit('system-message', {
            text: `⚜️ ${user.username} وارد قلمرو شد`,
            type: 'user-join'
        });
        
        updateOnlineUsers();
    });

    // خودکار ورود
    socket.on('auto-login', (userData) => {
        const user = findUser(userData.username);
        if (!user) {
            socket.emit('auth-error', 'کاربر یافت نشد!');
            return;
        }
        
        user.status = 'online';
        saveUsers(getUsers());
        
        onlineUsers.set(socket.id, {
            username: user.username,
            status: user.status
        });
        
        socket.emit('auth-success', { 
            user: { 
                username: user.username, 
                emoji: user.emoji, 
                status: user.status,
                bio: user.bio 
            } 
        });
        
        socket.broadcast.emit('system-message', {
            text: `⚜️ ${user.username} وارد قلمرو شد`,
            type: 'user-join'
        });
        
        updateOnlineUsers();
    });

    // دریافت چت‌ها
    socket.on('get-chats', () => {
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        const allUsers = getUsers();
        const groups = getGroups();
        const chats = [];
        
        allUsers.forEach(u => {
            if (u.username !== user.username) {
                chats.push({
                    id: u.username,
                    type: 'personal',
                    name: u.username,
                    avatar: u.emoji || '👤',
                    lastMessage: getLastMessage(user.username, u.username)
                });
            }
        });
        
        groups.forEach(g => {
            if (g.members && g.members.includes(user.username)) {
                chats.push({
                    id: g.id,
                    type: 'group',
                    name: g.name,
                    avatar: '👥',
                    lastMessage: getLastMessage(g.id, 'group')
                });
            }
        });
        
        socket.emit('chats-list', chats);
    });

    // دریافت اطلاعات چت
    socket.on('get-chat-info', (data) => {
        const { chatId, type } = data;
        let info = { id: chatId, type };
        
        if (type === 'personal') {
            const user = findUser(chatId);
            if (user) {
                info.name = user.username;
                info.avatar = user.emoji || '👤';
                info.status = user.status === 'online' ? '🟢 آنلاین' : '⚫ آفلاین';
            }
        } else if (type === 'group') {
            const groups = getGroups();
            const group = groups.find(g => g.id === chatId);
            if (group) {
                info.name = group.name;
                info.avatar = '👥';
                info.status = `👥 ${group.members ? group.members.length : 0} عضو`;
            }
        }
        
        socket.emit('chat-info', info);
    });

    // دریافت پیام‌ها
    socket.on('get-messages', (data) => {
        const { chatId, type } = data;
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        let messages = getMessages(chatId);
        
        if (type === 'personal') {
            messages = messages.filter(m => 
                (m.from === user.username && m.to === chatId) ||
                (m.from === chatId && m.to === user.username)
            );
        }
        
        const formatted = messages.map(m => ({
            id: m.id,
            user: m.from,
            text: m.text,
            time: formatTime(m.timestamp),
            isOwn: m.from === user.username,
            replyTo: m.replyTo
        }));
        
        socket.emit('messages-history', formatted);
    });

    // ارسال پیام
    socket.on('send-message', (data) => {
        const { chatId, type, text, replyTo } = data;
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        const message = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            from: user.username,
            to: chatId,
            chatId: chatId,
            text: text,
            replyTo: replyTo,
            timestamp: new Date().toISOString(),
            type: type
        };
        
        saveMessage(message);
        
        if (type === 'personal') {
            socket.emit('new-message', {
                id: message.id,
                user: user.username,
                text: text,
                time: formatTime(message.timestamp),
                isOwn: true,
                chatId: chatId,
                replyTo: replyTo
            });
            
            const receiverSocket = getSocketByUsername(chatId);
            if (receiverSocket) {
                io.to(receiverSocket).emit('new-message', {
                    id: message.id,
                    user: user.username,
                    text: text,
                    time: formatTime(message.timestamp),
                    isOwn: false,
                    chatId: chatId,
                    replyTo: replyTo
                });
            }
        } else {
            io.emit('new-message', {
                id: message.id,
                user: user.username,
                text: text,
                time: formatTime(message.timestamp),
                isOwn: false,
                chatId: chatId,
                replyTo: replyTo
            });
        }
    });

    // ویرایش پیام
    socket.on('edit-message', (data) => {
        const { msgId, text } = data;
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        const allMessages = readData(MESSAGES_FILE);
        const msgIndex = allMessages.findIndex(m => m.id === msgId);
        if (msgIndex !== -1 && allMessages[msgIndex].from === user.username) {
            allMessages[msgIndex].text = text;
            writeData(MESSAGES_FILE, allMessages);
            io.emit('message-edited', { msgId, text });
        }
    });

    // حذف پیام
    socket.on('delete-message', (data) => {
        const { msgId } = data;
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        const allMessages = readData(MESSAGES_FILE);
        const msg = allMessages.find(m => m.id === msgId);
        if (msg && msg.from === user.username) {
            deleteMessageFromDB(msgId);
            io.emit('message-deleted', { msgId });
        }
    });

    // تایپ
    socket.on('typing', (data) => {
        const { chatId, isTyping } = data;
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        socket.broadcast.emit('user-typing', {
            chatId: chatId,
            user: user.username,
            isTyping: isTyping
        });
    });

    // آپدیت وضعیت
    socket.on('update-status', (status) => {
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        const users = getUsers();
        const userIndex = users.findIndex(u => u.username === user.username);
        if (userIndex !== -1) {
            users[userIndex].status = status;
            saveUsers(users);
            
            if (onlineUsers.has(socket.id)) {
                onlineUsers.set(socket.id, { ...onlineUsers.get(socket.id), status });
            }
            updateOnlineUsers();
        }
    });

    // آپدیت پروفایل
    socket.on('update-profile', (data) => {
        const { emoji, username, bio } = data;
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        if (username !== user.username && findUser(username)) {
            socket.emit('auth-error', 'این نام کاربری قبلاً ثبت شده است!');
            return;
        }
        
        const users = getUsers();
        const userIndex = users.findIndex(u => u.username === user.username);
        if (userIndex !== -1) {
            users[userIndex].emoji = emoji;
            users[userIndex].username = username;
            users[userIndex].bio = bio;
            saveUsers(users);
            
            const updatedUser = users[userIndex];
            socket.emit('profile-updated', {
                username: updatedUser.username,
                emoji: updatedUser.emoji,
                bio: updatedUser.bio
            });
            
            if (onlineUsers.has(socket.id)) {
                onlineUsers.set(socket.id, {
                    username: updatedUser.username,
                    status: updatedUser.status
                });
            }
        }
    });

    // ایجاد گروه
    socket.on('create-group', (data) => {
        const { name, members } = data;
        const user = getUserBySocket(socket.id);
        if (!user) return;
        
        const groups = getGroups();
        const group = {
            id: 'g_' + Date.now().toString(36),
            name: name,
            creator: user.username,
            members: [user.username, ...(members || [])],
            createdAt: new Date().toISOString()
        };
        
        groups.push(group);
        saveGroups(groups);
        
        io.emit('system-message', {
            text: `👥 گروه ${name} ایجاد شد`,
            type: 'group-created'
        });
    });

    // دریافت دیتا مدیریت
    socket.on('get-admin-data', () => {
        const user = getUserBySocket(socket.id);
        if (!user || user.username !== 'MALEK') return;
        
        const users = getUsers();
        const groups = getGroups();
        const channels = readData(CHANNELS_FILE);
        
        socket.emit('admin-data', {
            users: users.map(u => ({ username: u.username, emoji: u.emoji, status: u.status })),
            groups: groups.map(g => ({ id: g.id, name: g.name, members: g.members ? g.members.length : 0 })),
            channels: channels.map(c => ({ id: c.id, name: c.name }))
        });
    });

    // قطع اتصال
    socket.on('disconnect', () => {
        const user = getUserBySocket(socket.id);
        if (user) {
            const users = getUsers();
            const userIndex = users.findIndex(u => u.username === user.username);
            if (userIndex !== -1) {
                users[userIndex].status = 'offline';
                saveUsers(users);
            }
            
            onlineUsers.delete(socket.id);
            socket.broadcast.emit('system-message', {
                text: `⚰️ ${user.username} قلمرو را ترک کرد`,
                type: 'user-leave'
            });
            updateOnlineUsers();
        }
    });
});

// ===== توابع کمکی =====
function getUserBySocket(socketId) {
    const userData = onlineUsers.get(socketId);
    if (!userData) return null;
    return findUser(userData.username);
}

function getSocketByUsername(username) {
    for (const [socketId, data] of onlineUsers) {
        if (data.username === username) {
            return socketId;
        }
    }
    return null;
}

function getLastMessage(chatId, type) {
    const messages = getMessages(chatId);
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    return last.text.substring(0, 30) + (last.text.length > 30 ? '...' : '');
}

function updateOnlineUsers() {
    const onlineList = Array.from(onlineUsers.values());
    io.emit('online-users', {
        users: onlineList,
        count: onlineList.length
    });
}

function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

// ===== شروع =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 PYS 2.0 طلایی روشن شد: http://localhost:${PORT}`);
});
