// ===== اتصال به سرور =====
const socket = io();

// ===== وضعیت =====
let currentUser = null;
let currentChat = null;
let currentChatType = 'personal';
let replyTo = null;
let allMessages = []; // ذخیره پیام‌ها برای نمایش

// ===== المان‌ها =====
const elements = {
    authScreen: document.getElementById('auth-screen'),
    mainApp: document.getElementById('main-app'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    regUsername: document.getElementById('reg-username'),
    regPassword: document.getElementById('reg-password'),
    regEmoji: document.getElementById('reg-emoji'),
    loginBtn: document.getElementById('login-btn'),
    registerBtn: document.getElementById('register-btn'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    userStatus: document.getElementById('user-status'),
    chatList: document.getElementById('chat-list'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    chatHeaderName: document.getElementById('chat-header-name'),
    chatHeaderAvatar: document.getElementById('chat-header-avatar'),
    chatHeaderStatus: document.getElementById('chat-header-status'),
    typingIndicator: document.getElementById('typing-indicator'),
    searchInput: document.getElementById('search-input'),
    settingsBtn: document.getElementById('settings-btn'),
    statusBtn: document.getElementById('status-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    onlineCounter: document.getElementById('online-counter'),
    settingsModal: document.getElementById('settings-modal'),
    statusModal: document.getElementById('status-modal'),
    adminModal: document.getElementById('admin-modal')
};

// ===== مدیریت تب‌های احراز هویت =====
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
elements.registerBtn.addEventListener('click', function() {
    const username = elements.regUsername.value.trim();
    const password = elements.regPassword.value.trim();
    const emoji = elements.regEmoji.value.trim() || '😎';
    
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
elements.loginBtn.addEventListener('click', function() {
    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value.trim();
    
    if (!username || !password) {
        alert('❌ لطفاً نام کاربری و رمز عبور را وارد کنید!');
        return;
    }
    
    socket.emit('login', { username, password });
});

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
    elements.authScreen.style.display = 'none';
    elements.mainApp.style.display = 'flex';
    
    elements.userAvatar.textContent = currentUser.emoji || '😎';
    elements.userName.textContent = currentUser.username;
    updateStatus(currentUser.status || 'online');
    
    if (currentUser.username === 'MALEK') {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'icon-btn';
        adminBtn.textContent = '👑';
        adminBtn.title = 'پنل مدیریت';
        adminBtn.id = 'admin-btn';
        document.querySelector('.sidebar-actions').appendChild(adminBtn);
        adminBtn.addEventListener('click', function() {
            elements.adminModal.style.display = 'flex';
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
    elements.userStatus.textContent = statusMap[status] || '🟢 آنلاین';
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
    renderChats(chats);
});

function renderChats(chats) {
    const container = elements.chatList;
    container.innerHTML = '';
    
    if (!chats || chats.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#555;padding:20px;">هیچ چتی وجود ندارد</div>';
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
        
        container.appendChild(chatItem);
    });
}

// ===== باز کردن چت =====
function openChat(chatId, type) {
    currentChat = chatId;
    currentChatType = type;
    
    // پاک کردن پیام‌های قبلی
    elements.messagesContainer.innerHTML = '';
    allMessages = [];
    
    socket.emit('get-chat-info', { chatId, type });
}

socket.on('chat-info', function(info) {
    elements.chatHeaderName.textContent = info.name;
    elements.chatHeaderAvatar.textContent = info.avatar || '💬';
    elements.chatHeaderStatus.textContent = info.status || '🔹';
    
    loadMessages(info.id, info.type);
});

// ===== بارگذاری پیام‌ها =====
function loadMessages(chatId, type) {
    socket.emit('get-messages', { chatId, type });
}

socket.on('messages-history', function(messages) {
    const container = elements.messagesContainer;
    container.innerHTML = '';
    allMessages = messages || [];
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#555;padding:40px;">💬 پیامی وجود ندارد</div>';
        return;
    }
    
    messages.forEach(msg => {
        renderMessage(msg);
    });
    
    container.scrollTop = container.scrollHeight;
});

// ===== رندر پیام در محیط چت =====
function renderMessage(msg) {
    const container = elements.messagesContainer;
    
    // حذف پیام "پیامی وجود ندارد"
    const emptyMsg = container.querySelector('div[style*="text-align:center"]');
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
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// ===== ارسال پیام =====
function sendMessage() {
    const text = elements.messageInput.value.trim();
    if (!text || !currentChat) return;
    
    const messageData = {
        chatId: currentChat,
        type: currentChatType,
        text: text,
        replyTo: replyTo
    };
    
    socket.emit('send-message', messageData);
    elements.messageInput.value = '';
    replyTo = null;
    elements.messageInput.placeholder = 'پیام طلایی خود را بنویس...';
}

elements.sendBtn.addEventListener('click', sendMessage);
elements.messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
});

// ===== دریافت پیام جدید =====
socket.on('new-message', function(msg) {
    // ذخیره پیام در لیست
    allMessages.push(msg);
    
    // نمایش در محیط چت اگر در همان چت هستیم
    if (msg.chatId === currentChat) {
        renderMessage(msg);
    }
    
    // به‌روزرسانی لیست چت‌ها برای نمایش آخرین پیام
    loadChats();
});

// ===== تایپ ایندیکیتور =====
let typingTimeout;
elements.messageInput.addEventListener('input', function() {
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
            elements.typingIndicator.textContent = `⚜️ ${data.user} در حال نوشتن است...`;
            elements.typingIndicator.classList.add('active');
        } else {
            elements.typingIndicator.classList.remove('active');
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
    elements.messageInput.placeholder = `↩️ پاسخ به ${user}: ${text.substring(0, 20)}...`;
    elements.messageInput.focus();
}

socket.on('message-edited', function(data) {
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
        if (msg.dataset.id === data.msgId) {
            const textDiv = msg.querySelector('.msg-text');
            if (textDiv) textDiv.textContent = data.text;
        }
    });
});

socket.on('message-deleted', function(data) {
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
        if (msg.dataset.id === data.msgId) {
            msg.remove();
        }
    });
});

// ===== آنلاین‌ها =====
socket.on('online-users', function(data) {
    elements.onlineCounter.textContent = `🟢 ${data.count} آنلاین`;
});

// ===== تنظیمات =====
elements.settingsBtn.addEventListener('click', function() {
    elements.settingsModal.style.display = 'flex';
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
    elements.userAvatar.textContent = data.emoji;
    elements.userName.textContent = data.username;
    elements.settingsModal.style.display = 'none';
    alert('✅ پروفایل با موفقیت به‌روزرسانی شد!');
});

// ===== وضعیت =====
elements.statusBtn.addEventListener('click', function() {
    elements.statusModal.style.display = 'flex';
});

document.querySelectorAll('.status-option').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const status = this.dataset.status;
        updateStatus(status);
        elements.statusModal.style.display = 'none';
    });
});

// ===== پنل مدیریت =====
function loadAdminPanel() {
    if (currentUser.username !== 'MALEK') return;
    socket.emit('get-admin-data');
}

socket.on('admin-data', function(data) {
    const usersList = document.getElementById('admin-users-list');
    usersList.innerHTML = data.users.map(function(u) {
        return `
            <div class="admin-item">
                <span>${u.emoji} ${u.username} ${u.status === 'online' ? '🟢' : '⚫'}</span>
                <div>
                    <button onclick="alert('ویرایش کاربر')">✏️</button>
                    <button onclick="if(confirm('حذف شود؟')) alert('حذف شد')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    const groupsList = document.getElementById('admin-groups-list');
    groupsList.innerHTML = data.groups.map(function(g) {
        return `
            <div class="admin-item">
                <span>👥 ${g.name} (${g.members} عضو)</span>
                <div>
                    <button onclick="alert('ویرایش گروه')">✏️</button>
                    <button onclick="if(confirm('حذف شود؟')) alert('حذف شد')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    const channelsList = document.getElementById('admin-channels-list');
    channelsList.innerHTML = data.channels.map(function(c) {
        return `
            <div class="admin-item">
                <span>📢 ${c.name}</span>
                <div>
                    <button onclick="alert('ویرایش کانال')">✏️</button>
                    <button onclick="if(confirm('حذف شود؟')) alert('حذف شد')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
});

// ===== خروج =====
elements.logoutBtn.addEventListener('click', function() {
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
elements.searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    const items = document.querySelectorAll('.chat-item');
    items.forEach(function(item) {
        const name = item.querySelector('.name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
});

// ===== اموجی‌ها =====
const emojis = ['😊', '❤️', '🔥', '👍', '👏', '🎉', '😍', '🤩', '💪', '✨', '🌟', '💎'];

document.querySelector('.emoji-btn').addEventListener('click', function() {
    let panel = document.querySelector('.emoji-panel');
    if (panel) {
        panel.remove();
        return;
    }
    
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
        span.style.cssText = 'font-size:24px;cursor:pointer;padding:5px;transition:all 0.3s;';
        span.onmouseover = function() { this.style.transform = 'scale(1.3)'; };
        span.onmouseout = function() { this.style.transform = 'scale(1)'; };
        span.onclick = function() {
            elements.messageInput.value += e;
            elements.messageInput.focus();
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
            const user = JSON.parse(savedUser);
            socket.emit('auto-login', user);
            return true;
        } catch(e) {
            return false;
        }
    }
    return false;
}

// ===== شروع =====
if (!checkAuth()) {
    elements.authScreen.style.display = 'flex';
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
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animateParticles);
}

animateParticles();

// ===== سیستم نمایش پیام‌ها در محیط چت =====
// این تابع برای اطمینان از نمایش پیام‌ها در محیط چت اضافه شده
console.log('✅ PYS 2.0 آماده است!');
