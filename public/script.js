// ===== اتصال به سرور =====
const socket = io();

// ===== وضعیت =====
let currentUser = null;
let currentChat = null;
let currentChatType = 'personal';
let replyTo = null;

// ===== المان‌ها =====
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const regUsername = document.getElementById('reg-username');
const regPassword = document.getElementById('reg-password');
const regEmoji = document.getElementById('reg-emoji');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userStatus = document.getElementById('user-status');
const chatList = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatHeaderName = document.getElementById('chat-header-name');
const chatHeaderAvatar = document.getElementById('chat-header-avatar');
const chatHeaderStatus = document.getElementById('chat-header-status');
const typingIndicator = document.getElementById('typing-indicator');
const searchInput = document.getElementById('search-input');
const settingsBtn = document.getElementById('settings-btn');
const statusBtn = document.getElementById('status-btn');
const logoutBtn = document.getElementById('logout-btn');
const onlineCounter = document.getElementById('online-counter');
const settingsModal = document.getElementById('settings-modal');
const statusModal = document.getElementById('status-modal');
const adminModal = document.getElementById('admin-modal');

// ===== مدیریت تب‌ها =====
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        const tabName = this.dataset.tab;
        if (tabName === 'login') {
            document.getElementById('login-form').classList.add('active');
        } else if (tabName === 'register') {
            document.getElementById('register-form').classList.add('active');
        }
    });
});

// ===== ثبت‌نام =====
registerBtn.addEventListener('click', function() {
    const username = regUsername.value.trim();
    const password = regPassword.value.trim();
    const emoji = regEmoji.value.trim() || '😎';
    
    if (username.length < 3) {
        alert('❌ نام کاربری حداقل ۳ کاراکتر باشد!');
        return;
    }
    if (password.length < 6) {
        alert('❌ رمز عبور حداقل ۶ کاراکتر باشد!');
        return;
    }
    socket.emit('register', { username, password, emoji });
});

// ===== ورود =====
loginBtn.addEventListener('click', function() {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) {
        alert('❌ لطفاً نام کاربری و رمز عبور را وارد کنید!');
        return;
    }
    socket.emit('login', { username, password });
});

// Enter برای ورود
loginUsername.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });
loginPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });
regUsername.addEventListener('keypress', (e) => { if (e.key === 'Enter') registerBtn.click(); });
regPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') registerBtn.click(); });

// ===== رویدادهای سرور =====
socket.on('auth-success', function(data) {
    currentUser = data.user;
    localStorage.setItem('pys_user', JSON.stringify(data.user));
    showMainApp();
    loadChats();
});

socket.on('auth-error', function(msg) {
    alert('❌ ' + msg);
});

// ===== نمایش اپلیکیشن =====
function showMainApp() {
    authScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    
    userAvatar.textContent = currentUser.emoji || '😎';
    userName.textContent = currentUser.username;
    updateStatus(currentUser.status || 'online');
    
    if (currentUser.username === 'MALEK') {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'icon-btn';
        adminBtn.textContent = '👑';
        adminBtn.title = 'پنل مدیریت';
        adminBtn.id = 'admin-btn';
        document.querySelector('.sidebar-actions').appendChild(adminBtn);
        adminBtn.addEventListener('click', function() {
            adminModal.style.display = 'flex';
            loadAdminPanel();
        });
    }
}

// ===== وضعیت =====
function updateStatus(status) {
    const statusMap = {
        'online': '🟢 آنلاین',
        'offline': '⚫ آفلاین',
        'busy': '🔴 مشغول',
        'sad': '😔 ناراحت'
    };
    userStatus.textContent = statusMap[status] || '🟢 آنلاین';
    if (currentUser) {
        currentUser.status = status;
        socket.emit('update-status', status);
    }
}

// ===== بارگذاری چت‌ها =====
function loadChats() {
    socket.emit('get-chats');
}

socket.on('chats-list', function(chats) {
    chatList.innerHTML = '';
    if (!chats || chats.length === 0) {
        chatList.innerHTML = '<div style="text-align:center;color:#555;padding:20px;">هیچ چتی وجود ندارد</div>';
        return;
    }
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.id = chat.id;
        chatItem.dataset.type = chat.type;
        chatItem.innerHTML = `
            <div class="avatar">${chat.avatar || '💬'}</div>
            <div class="info">
                <div class="name">${chat.name}</div>
                <div class="last-msg">${chat.lastMessage || 'شروع مکالمه'}</div>
            </div>
            <div class="time">${chat.time || ''}</div>
        `;
        chatItem.addEventListener('click', function() {
            openChat(this.dataset.id, this.dataset.type);
        });
        chatList.appendChild(chatItem);
    });
});

// ===== باز کردن چت =====
function openChat(chatId, type) {
    currentChat = chatId;
    currentChatType = type;
    messagesContainer.innerHTML = '<div style="text-align:center;color:#555;padding:40px;">⏳ در حال بارگذاری...</div>';
    socket.emit('get-chat-info', { chatId, type });
}

socket.on('chat-info', function(info) {
    chatHeaderName.textContent = info.name;
    chatHeaderAvatar.textContent = info.avatar || '💬';
    chatHeaderStatus.textContent = info.status || '🔹';
    loadMessages(info.id, info.type);
});

// ===== بارگذاری پیام‌ها =====
function loadMessages(chatId, type) {
    socket.emit('get-messages', { chatId, type });
}

socket.on('messages-history', function(messages) {
    messagesContainer.innerHTML = '';
    if (!messages || messages.length === 0) {
        messagesContainer.innerHTML = '<div style="text-align:center;color:#555;padding:40px;">💬 پیامی وجود ندارد</div>';
        return;
    }
    messages.forEach(msg => {
        renderMessage(msg);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// ===== رندر پیام در محیط چت =====
function renderMessage(msg) {
    // حذف پیام خالی اگر وجود داشته باشد
    const emptyMsg = messagesContainer.querySelector('div[style*="text-align:center"]');
    if (emptyMsg) emptyMsg.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.isOwn ? 'own' : 'other'}`;
    messageDiv.dataset.id = msg.id;
    
    let replyHtml = '';
    if (msg.replyTo) {
        replyHtml = `<div class="reply-to">↩️ ${msg.replyTo}</div>`;
    }
    
    messageDiv.innerHTML = `
        <div class="msg-header">
            <span class="msg-user">${msg.isOwn ? '👤 شما' : msg.user}</span>
            <span class="msg-time">${msg.time}</span>
        </div>
        ${replyHtml}
        <div class="msg-text">${msg.text}</div>
        ${msg.isOwn ? `
            <div class="msg-actions">
                <button onclick="editMessage('${msg.id}')">✏️</button>
                <button onclick="deleteMessage('${msg.id}')">🗑️</button>
            </div>
        ` : `
            <div class="msg-actions">
                <button onclick="replyToMessage('${msg.id}', '${msg.user}', '${msg.text.replace(/'/g, "\\'")}')">↩️</button>
            </div>
        `}
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ===== ارسال پیام =====
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChat) {
        alert('لطفاً یک پیام بنویسید یا یک چت انتخاب کنید!');
        return;
    }
    
    const messageData = {
        chatId: currentChat,
        type: currentChatType,
        text: text,
        replyTo: replyTo
    };
    
    socket.emit('send-message', messageData);
    messageInput.value = '';
    replyTo = null;
    messageInput.placeholder = 'پیام طلایی خود را بنویس...';
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
});

// ===== دریافت پیام جدید =====
socket.on('new-message', function(msg) {
    // نمایش در محیط چت اگر در همان چت هستیم
    if (msg.chatId === currentChat) {
        renderMessage(msg);
    }
    // به‌روزرسانی لیست چت‌ها
    loadChats();
});

// ===== تایپ ایندیکیتور =====
let typingTimeout;
messageInput.addEventListener('input', function() {
    if (!currentChat) return;
    socket.emit('typing', { chatId: currentChat, isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() {
        socket.emit('typing', { chatId: currentChat, isTyping: false });
    }, 1000);
});

socket.on('user-typing', function(data) {
    if (data.chatId === currentChat) {
        if (data.isTyping) {
            typingIndicator.textContent = `⚜️ ${data.user} در حال نوشتن است...`;
            typingIndicator.classList.add('active');
        } else {
            typingIndicator.classList.remove('active');
        }
    }
});

// ===== ویرایش و حذف پیام =====
function editMessage(msgId) {
    const newText = prompt('متن جدید را وارد کنید:');
    if (newText && newText.trim()) {
        socket.emit('edit-message', { msgId, text: newText.trim() });
    }
}

function deleteMessage(msgId) {
    if (confirm('آیا از حذف این پیام مطمئن هستید؟')) {
        socket.emit('delete-message', { msgId });
    }
}

function replyToMessage(msgId, user, text) {
    replyTo = { id: msgId, user, text: text.substring(0, 30) };
    messageInput.placeholder = `↩️ پاسخ به ${user}: ${text.substring(0, 20)}...`;
    messageInput.focus();
}

socket.on('message-edited', function(data) {
    document.querySelectorAll('.message').forEach(msg => {
        if (msg.dataset.id === data.msgId) {
            const textDiv = msg.querySelector('.msg-text');
            if (textDiv) textDiv.textContent = data.text;
        }
    });
});

socket.on('message-deleted', function(data) {
    document.querySelectorAll('.message').forEach(msg => {
        if (msg.dataset.id === data.msgId) {
            msg.remove();
        }
    });
});

// ===== آنلاین‌ها =====
socket.on('online-users', function(data) {
    onlineCounter.textContent = `🟢 ${data.count} آنلاین`;
});

// ===== تنظیمات =====
settingsBtn.addEventListener('click', function() {
    settingsModal.style.display = 'flex';
    document.getElementById('settings-emoji').value = currentUser.emoji || '😎';
    document.getElementById('settings-username').value = currentUser.username;
    document.getElementById('settings-bio').value = currentUser.bio || '';
});

document.getElementById('save-settings').addEventListener('click', function() {
    const emoji = document.getElementById('settings-emoji').value.trim() || '😎';
    const username = document.getElementById('settings-username').value.trim();
    const bio = document.getElementById('settings-bio').value.trim();
    if (username.length < 3) {
        alert('❌ نام کاربری حداقل ۳ کاراکتر باشد!');
        return;
    }
    socket.emit('update-profile', { emoji, username, bio });
});

socket.on('profile-updated', function(data) {
    currentUser = data;
    localStorage.setItem('pys_user', JSON.stringify(data));
    userAvatar.textContent = data.emoji;
    userName.textContent = data.username;
    settingsModal.style.display = 'none';
    alert('✅ پروفایل با موفقیت به‌روزرسانی شد!');
});

// ===== وضعیت =====
statusBtn.addEventListener('click', function() {
    statusModal.style.display = 'flex';
});

document.querySelectorAll('.status-option').forEach(function(btn) {
    btn.addEventListener('click', function() {
        updateStatus(this.dataset.status);
        statusModal.style.display = 'none';
    });
});

// ===== پنل مدیریت =====
function loadAdminPanel() {
    if (currentUser.username !== 'MALEK') return;
    socket.emit('get-admin-data');
}

socket.on('admin-data', function(data) {
    document.getElementById('admin-users-list').innerHTML = data.users.map(u => `
        <div class="admin-item">
            <span>${u.emoji} ${u.username} ${u.status === 'online' ? '🟢' : '⚫'}</span>
            <div>
                <button onclick="alert('ویرایش کاربر')">✏️</button>
                <button onclick="if(confirm('حذف شود؟')) alert('حذف شد')">🗑️</button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('admin-groups-list').innerHTML = data.groups.map(g => `
        <div class="admin-item">
            <span>👥 ${g.name} (${g.members} عضو)</span>
            <div>
                <button onclick="alert('ویرایش گروه')">✏️</button>
                <button onclick="if(confirm('حذف شود؟')) alert('حذف شد')">🗑️</button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('admin-channels-list').innerHTML = data.channels.map(c => `
        <div class="admin-item">
            <span>📢 ${c.name}</span>
            <div>
                <button onclick="alert('ویرایش کانال')">✏️</button>
                <button onclick="if(confirm('حذف شود؟')) alert('حذف شد')">🗑️</button>
            </div>
        </div>
    `).join('');
});

// ===== خروج =====
logoutBtn.addEventListener('click', function() {
    if (confirm('آیا از خروج مطمئن هستید؟')) {
        localStorage.removeItem('pys_user');
        socket.disconnect();
        location.reload();
    }
});

// ===== بستن مودال‌ها =====
document.querySelectorAll('.modal-close').forEach(function(btn) {
    btn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
    });
});

document.querySelectorAll('.modal').forEach(function(modal) {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
        }
    });
});

// ===== جستجو =====
searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
});

// ===== اموجی‌ها =====
const emojis = ['😊', '❤️', '🔥', '👍', '👏', '🎉', '😍', '🤩', '💪', '✨', '🌟', '💎'];

document.querySelector('.emoji-btn').addEventListener('click', function() {
    let panel = document.querySelector('.emoji-panel');
    if (panel) { panel.remove(); return; }
    
    panel = document.createElement('div');
    panel.className = 'emoji-panel';
    panel.style.cssText = `
        position: absolute;
        bottom: 70px;
        left: 10px;
        background: rgba(10,10,10,0.95);
        border: 1px solid rgba(212,175,55,0.2);
        border-radius: 16px;
        padding: 10px;
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 5px;
        z-index: 100;
        backdrop-filter: blur(20px);
    `;
    
    emojis.forEach(function(e) {
        const span = document.createElement('span');
        span.textContent = e;
        span.style.cssText = 'font-size:24px;cursor:pointer;padding:5px;text-align:center;transition:all 0.3s;';
        span.onmouseover = function() { this.style.transform = 'scale(1.3)'; };
        span.onmouseout = function() { this.style.transform = 'scale(1)'; };
        span.onclick = function() {
            messageInput.value += e;
            messageInput.focus();
            panel.remove();
        };
        panel.appendChild(span);
    });
    
    document.querySelector('.chat-input-wrapper').style.position = 'relative';
    document.querySelector('.chat-input-wrapper').appendChild(panel);
});

// ===== خودکار ورود =====
function checkAuth() {
    const savedUser = localStorage.getItem('pys_user');
    if (savedUser) {
        try {
            socket.emit('auto-login', JSON.parse(savedUser));
            return true;
        } catch(e) {
            return false;
        }
    }
    return false;
}

if (!checkAuth()) {
    authScreen.style.display = 'flex';
}

// ===== ذرات طلایی =====
const canvas = document.getElementById('particlesCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${this.opacity})`;
        ctx.fill();
        ctx.shadowColor = 'rgba(212, 175, 55, 0.3)';
        ctx.shadowBlur = 10;
    }
}

for (let i = 0; i < 80; i++) {
    particles.push(new Particle());
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
}
animateParticles();

console.log('✅ PYS 2.0 با موفقیت اجرا شد!');
