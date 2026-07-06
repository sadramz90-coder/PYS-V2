// ===== کانکشن به سرور =====
const socket = io();

// ===== وضعیت اپلیکیشن =====
let currentUser = null;
let currentChat = null;
let currentChatType = 'personal'; // personal | group | channel
let replyTo = null;

// ===== المان‌های DOM =====
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
    adminModal: document.getElementById('admin-modal'),
    // ... و بقیه المان‌ها
};

// ===== احراز هویت =====
// تابع بررسی وجود کاربر در localStorage
function checkAuth() {
    const savedUser = localStorage.getItem('pys_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            // اتصال به سرور با اطلاعات ذخیره شده
            socket.emit('auto-login', user);
            return true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

// ثبت‌نام
elements.registerBtn.addEventListener('click', async () => {
    const username = elements.regUsername.value.trim();
    const password = elements.regPassword.value.trim();
    const emoji = elements.regEmoji.value.trim() || '😎';
    
    if (username.length < 3) {
        alert('نام کاربری حداقل ۳ کاراکتر باشد!');
        return;
    }
    
    if (password.length < 6) {
        alert('رمز عبور حداقل ۶ کاراکتر باشد!');
        return;
    }
    
    socket.emit('register', { username, password, emoji });
});

// ورود
elements.loginBtn.addEventListener('click', () => {
    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value.trim();
    
    if (!username || !password) {
        alert('لطفاً نام کاربری و رمز عبور را وارد کنید!');
        return;
    }
    
    socket.emit('login', { username, password });
});

// ===== رویدادهای سرور =====
socket.on('auth-success', (data) => {
    currentUser = data.user;
    localStorage.setItem('pys_user', JSON.stringify(data.user));
    showMainApp();
    loadChats();
});

socket.on('auth-error', (msg) => {
    alert(msg);
});

// ===== نمایش اپلیکیشن اصلی =====
function showMainApp() {
    elements.authScreen.style.display = 'none';
    elements.mainApp.style.display = 'flex';
    
    // آپدیت پروفایل
    elements.userAvatar.textContent = currentUser.emoji || '😎';
    elements.userName.textContent = currentUser.username;
    updateStatus(currentUser.status || 'online');
    
    // اگر مالک هست، دکمه مدیریت رو نشون بده
    if (currentUser.username === 'MALEK') {
        // اضافه کردن دکمه مدیریت
        const adminBtn = document.createElement('button');
        adminBtn.className = 'icon-btn';
        adminBtn.textContent = '👑';
        adminBtn.title = 'پنل مدیریت';
        adminBtn.id = 'admin-btn';
        document.querySelector('.sidebar-actions').appendChild(adminBtn);
        adminBtn.addEventListener('click', () => {
            elements.adminModal.style.display = 'flex';
            loadAdminPanel();
        });
    }
}

// ===== مدیریت وضعیت =====
function updateStatus(status) {
    const statusMap = {
        'online': '🟢 آنلاین',
        'offline': '⚫ آفلاین',
        'busy': '🔴 مشغول',
        'sad': '😔 ناراحت'
    };
    elements.userStatus.textContent = statusMap[status] || '🟢 آنلاین';
    currentUser.status = status;
    socket.emit('update-status', status);
}

// ===== بارگذاری چت‌ها =====
function loadChats() {
    socket.emit('get-chats');
}

socket.on('chats-list', (chats) => {
    renderChats(chats);
});

function renderChats(chats) {
    const container = elements.chatList;
    container.innerHTML = '';
    
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
        
        chatItem.addEventListener('click', () => {
            openChat(chat.id, chat.type);
        });
        
        container.appendChild(chatItem);
    });
}

// ===== باز کردن چت =====
function openChat(chatId, type) {
    currentChat = chatId;
    currentChatType = type;
    
    // آپدیت هدر
    socket.emit('get-chat-info', { chatId, type });
}

socket.on('chat-info', (info) => {
    elements.chatHeaderName.textContent = info.name;
    elements.chatHeaderAvatar.textContent = info.avatar || '💬';
    
    // بارگذاری پیام‌ها
    loadMessages(info.id, info.type);
});

// ===== بارگذاری پیام‌ها =====
function loadMessages(chatId, type) {
    socket.emit('get-messages', { chatId, type });
}

socket.on('messages-history', (messages) => {
    const container = elements.messagesContainer;
    container.innerHTML = '';
    
    messages.forEach(msg => {
        renderMessage(msg);
    });
    
    container.scrollTop = container.scrollHeight;
});

// ===== رندر پیام =====
function renderMessage(msg) {
    const container = elements.messagesContainer;
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
                <button onclick="replyToMessage('${msg.id}', '${msg.user}', '${msg.text}')">↩️</button>
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
}

elements.sendBtn.addEventListener('click', sendMessage);
elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// ===== دریافت پیام جدید =====
socket.on('new-message', (msg) => {
    // اگر در چت فعلی هستیم، نمایش بده
    if (msg.chatId === currentChat) {
        renderMessage(msg);
    }
    // آپدیت لیست چت‌ها
    loadChats();
});

// ===== تایپ ایندیکیتور =====
let typingTimeout;
elements.messageInput.addEventListener('input', () => {
    if (!currentChat) return;
    
    socket.emit('typing', { chatId: currentChat, isTyping: true });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { chatId: currentChat, isTyping: false });
    }, 1000);
});

socket.on('user-typing', (data) => {
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
    if (newText) {
        socket.emit('edit-message', { msgId, text: newText });
    }
}

function deleteMessage(msgId) {
    if (confirm('آیا از حذف این پیام مطمئن هستید؟')) {
        socket.emit('delete-message', { msgId });
    }
}

function replyToMessage(msgId, user, text) {
    replyTo = { id: msgId, user, text };
    elements.messageInput.placeholder = `↩️ پاسخ به ${user}: ${text.substring(0, 20)}...`;
    elements.messageInput.focus();
}

socket.on('message-edited', (data) => {
    // پیدا کردن پیام و آپدیت متن
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
        if (msg.dataset.id === data.msgId) {
            const textDiv = msg.querySelector('.msg-text');
            if (textDiv) textDiv.textContent = data.text;
        }
    });
});

socket.on('message-deleted', (data) => {
    // حذف پیام از DOM
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
        if (msg.dataset.id === data.msgId) {
            msg.remove();
        }
    });
});

// ===== مدیریت گروه‌ها =====
function createGroup(name, members) {
    socket.emit('create-group', { name, members });
}

// ===== مدیریت کانال‌ها (فقط مالک) =====
function createChannel(name, description) {
    if (currentUser.username !== 'MALEK') {
        alert('فقط مالک میتواند کانال ایجاد کند!');
        return;
    }
    socket.emit('create-channel', { name, description });
}

// ===== پنل مدیریت (فقط مالک) =====
function loadAdminPanel() {
    if (currentUser.username !== 'MALEK') return;
    socket.emit('get-admin-data');
}

socket.on('admin-data', (data) => {
    // نمایش کاربران
    const usersList = document.getElementById('admin-users-list');
    usersList.innerHTML = data.users.map(u => `
        <div class="admin-item">
            <span>${u.emoji} ${u.username}</span>
            <div>
                <button onclick="editUser('${u.username}')">✏️</button>
                <button onclick="deleteUser('${u.username}')">🗑️</button>
            </div>
        </div>
    `).join('');
    
    // نمایش گروه‌ها
    const groupsList = document.getElementById('admin-groups-list');
    groupsList.innerHTML = data.groups.map(g => `
        <div class="admin-item">
            <span>👥 ${g.name}</span>
            <div>
                <button onclick="editGroup('${g.id}')">✏️</button>
                <button onclick="deleteGroup('${g.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
    
    // نمایش کانال‌ها
    const channelsList = document.getElementById('admin-channels-list');
    channelsList.innerHTML = data.channels.map(c => `
        <div class="admin-item">
            <span>📢 ${c.name}</span>
            <div>
                <button onclick="editChannel('${c.id}')">✏️</button>
                <button onclick="deleteChannel('${c.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
});

// ===== تنظیمات پروفایل =====
elements.settingsBtn.addEventListener('click', () => {
    elements.settingsModal.style.display = 'flex';
    document.getElementById('settings-emoji').value = currentUser.emoji || '😎';
    document.getElementById('settings-username').value = currentUser.username;
    document.getElementById('settings-bio').value = currentUser.bio || '';
});

document.getElementById('save-settings').addEventListener('click', () => {
    const emoji = document.getElementById('settings-emoji').value.trim() || '😎';
    const username = document.getElementById('settings-username').value.trim();
    const bio = document.getElementById('settings-bio').value.trim();
    
    if (username.length < 3) {
        alert('نام کاربری حداقل ۳ کاراکتر باشد!');
        return;
    }
    
    socket.emit('update-profile', { emoji, username, bio });
});

socket.on('profile-updated', (data) => {
    currentUser = data;
    localStorage.setItem('pys_user', JSON.stringify(data));
    elements.userAvatar.textContent = data.emoji;
    elements.userName.textContent = data.username;
    elements.settingsModal.style.display = 'none';
    alert('پروفایل با موفقیت به‌روزرسانی شد!');
});

// ===== وضعیت =====
elements.statusBtn.addEventListener('click', () => {
    elements.statusModal.style.display = 'flex';
});

document.querySelectorAll('.status-option').forEach(btn => {
    btn.addEventListener('click', () => {
        const status = btn.dataset.status;
        updateStatus(status);
        elements.statusModal.style.display = 'none';
    });
});

// ===== خروج =====
elements.logoutBtn.addEventListener('click', () => {
    if (confirm('آیا از خروج مطمئن هستید؟')) {
        localStorage.removeItem('pys_user');
        socket.disconnect();
        location.reload();
    }
});

// ===== بستن مودال‌ها =====
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.modal').style.display = 'none';
    });
});

// ===== کلیک خارج از مودال =====
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// ===== جستجو =====
elements.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.chat-item');
    items.forEach(item => {
        const name = item.querySelector('.name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
});

// ===== اموجی‌های سریع =====
const emojis = ['😊', '❤️', '🔥', '👍', '👏', '🎉', '😍', '🤩', '💪', '✨', '🌟', '💎'];
document.querySelector('.emoji-btn').addEventListener('click', () => {
    // نمایش پنل اموجی
    const emojiPanel = document.createElement('div');
    emojiPanel.className = 'emoji-panel';
    emojiPanel.innerHTML = emojis.map(e => 
        `<span style="font-size:24px;cursor:pointer;padding:5px;" onclick="insertEmoji('${e}')">${e}</span>`
    ).join('');
    
    // اگر پنل وجود نداشت، ایجاد کن
    if (!document.querySelector('.emoji-panel')) {
        document.querySelector('.chat-input-wrapper').appendChild(emojiPanel);
    } else {
        document.querySelector('.emoji-panel').remove();
    }
});

function insertEmoji(emoji) {
    elements.messageInput.value += emoji;
    elements.messageInput.focus();
}

// ===== مدیریت خطاها =====
socket.on('connect_error', () => {
    alert('ارتباط با سرور قطع شد! در حال تلاش مجدد...');
});

socket.on('disconnect', () => {
    alert('ارتباط با سرور برقرار نیست!');
});

// ===== شروع برنامه =====
// چک کردن احراز هویت
if (!checkAuth()) {
    // نمایش صفحه ورود
    elements.authScreen.style.display = 'flex';
}

// ===== پس‌زمینه ذرات طلایی =====
// (برای این بخش، یک اسکریپت جداگانه برای ذرات نوشته شده که در فایل جداگانه خواهد بود)