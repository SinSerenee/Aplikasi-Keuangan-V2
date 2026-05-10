// ========================
// KONFIGURASI SUPABASE
// ========================
const supabaseUrl = 'https://sowkixwgtgdzfjmoerxq.supabase.co';
const supabaseKey = 'sb_publishable_zLfRnz9bTAD0W4lOKIFtmg_oflJNuPq';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ========================
// STATE GLOBAL
// ========================
let currentUser = null;
let categories = [];
let editingId = null;
let expenseChart = null;
let selectedAvatarEmoji = null;  // untuk galeri avatar default

// ========================
// UTILITY FUNCTIONS
// ========================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatRupiah(val) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(val);
}

function isValidEmail(email) {
    return /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(email);
}

// ========================
// CEK SESSION & REDIRECT VERIFIKASI
// ========================
async function checkSession() {
    console.log('🔍 Mengecek session...');
    
    // Cek hash URL untuk verifikasi reset password
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (type === 'recovery' && accessToken) {
        // Mode reset password
        const newPassword = prompt('🔐 Masukkan password baru Anda (minimal 6 karakter):');
        if (newPassword && newPassword.length >= 6) {
            const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
            if (error) {
                alert('Gagal update password: ' + error.message);
            } else {
                alert('✅ Password berhasil diubah! Silakan login dengan password baru.');
                window.location.hash = ''; // hapus hash
                window.location.reload();
            }
        } else if (newPassword) {
            alert('Password minimal 6 karakter');
        }
        return;
    }
    
    // Cek parameter URL untuk verifikasi email (Supabase kadang pakai query param)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('type') === 'confirm' || urlParams.get('confirmation') === 'success') {
        alert('✅ Verifikasi email berhasil! Silakan login.');
        // Bersihkan URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
        console.error('❌ Error cek session:', error);
        return false;
    }
    
    if (session) {
        currentUser = session.user;
        console.log('✅ User sudah login:', currentUser.email);
        await loadUserProfile();
        await loadUserCategories();
        await renderTable();
        showAppSection();
        return true;
    } else {
        showAuthSection();
        return false;
    }
}

// ========================
// LOAD & UPDATE USER PROFILE
// ========================
async function loadUserProfile() {
    if (!currentUser) return;
    
    const { data, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();
    
    if (error) {
        console.error('❌ Error load profile:', error);
        return;
    }
    
    if (data) {
        document.getElementById('userName').innerText = data.full_name || currentUser.email;
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            if (data.avatar_url) {
                // Jika avatar_url adalah emoji (bukan URL)
                if (data.avatar_url.startsWith('🐶') || data.avatar_url.startsWith('🐱') || 
                    data.avatar_url.startsWith('🦊') || data.avatar_url.startsWith('🐼') ||
                    data.avatar_url.startsWith('👨‍💻') || data.avatar_url.startsWith('👩‍🎨')) {
                    userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.avatar_url)}&background=8b5cf6&color=fff&bold=true&size=40`;
                    userAvatar.style.fontSize = '0'; // fallback
                } else {
                    userAvatar.src = data.avatar_url + '?t=' + Date.now();
                }
            } else {
                const initial = (data.full_name || currentUser.email).charAt(0).toUpperCase();
                userAvatar.src = `https://ui-avatars.com/api/?name=${initial}&background=8b5cf6&color=fff&bold=true&size=40`;
            }
        }
        currentUser.profile = data;
    } else {
        const defaultName = currentUser.email.split('@')[0];
        await supabaseClient
            .from('user_profiles')
            .insert([{ id: currentUser.id, full_name: defaultName, avatar_url: null }]);
        document.getElementById('userName').innerText = defaultName;
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            userAvatar.src = `https://ui-avatars.com/api/?name=${defaultName.charAt(0)}&background=8b5cf6&color=fff&bold=true&size=40`;
        }
        currentUser.profile = { full_name: defaultName, avatar_url: null };
    }
}

async function updateUserProfile(fullName, avatarFile, avatarEmoji) {
    if (!currentUser) return false;
    
    let avatarUrl = currentUser.profile?.avatar_url || null;
    
    // Prioritas: upload file > pilihan emoji > tetap lama
    if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${currentUser.id}/avatar_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(fileName, avatarFile, { upsert: true });
        if (uploadError) {
            alert('Gagal upload avatar: ' + uploadError.message);
            return false;
        }
        const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = urlData.publicUrl;
    } else if (avatarEmoji) {
        avatarUrl = avatarEmoji; // simpan emoji sebagai string
    }
    
    const updateData = { full_name: fullName };
    if (avatarUrl) updateData.avatar_url = avatarUrl;
    
    const { error } = await supabaseClient
        .from('user_profiles')
        .update(updateData)
        .eq('id', currentUser.id);
    
    if (error) {
        alert('Gagal update profil: ' + error.message);
        return false;
    }
    
    await loadUserProfile(); // refresh tampilan
    alert('✅ Profil berhasil diupdate!');
    return true;
}

// ========================
// CATEGORIES (hanya untuk pengeluaran, tapi tetap simpan semua)
// ========================
async function loadUserCategories() {
    if (!currentUser) return;
    
    const { data, error } = await supabaseClient
        .from('user_categories')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name');
    
    if (error) {
        console.error('Error load categories:', error);
        return;
    }
    
    if (data && data.length > 0) {
        categories = data.map(cat => cat.name);
    } else {
        categories = ['Makanan', 'Transportasi', 'Belanja', 'Hiburan', 'Kesehatan', 'Pendidikan'];
        await saveUserCategories();
    }
    populateCategoryDropdown();
}

async function saveUserCategories() {
    if (!currentUser) return;
    await supabaseClient.from('user_categories').delete().eq('user_id', currentUser.id);
    const categoriesToInsert = categories.map(name => ({ user_id: currentUser.id, name }));
    if (categoriesToInsert.length) {
        await supabaseClient.from('user_categories').insert(categoriesToInsert);
    }
}

async function addNewCategory(categoryName) {
    const trimmed = categoryName.trim();
    if (!trimmed) { alert('Nama kategori tidak boleh kosong!'); return false; }
    if (categories.includes(trimmed)) { alert('Kategori sudah ada!'); return false; }
    categories.push(trimmed);
    await saveUserCategories();
    populateCategoryDropdown();
    return true;
}

function populateCategoryDropdown() {
    const select = document.getElementById('transactionCategory');
    if (!select) return;
    select.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

// ========================
// RENDER TABLE & DASHBOARD & CHART
// ========================
async function renderTable() {
    if (!currentUser) return;
    const tbody = document.getElementById('transactionTableBody');
    if (!tbody) return;
    
    const { data: transactions, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Gagal memuat data: ${error.message}</td></tr>`;
        return;
    }
    
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Belum ada transaksi. Tambahkan sekarang!</td></tr>';
        updateDashboard([]);
        updateChart([]);
        return;
    }
    
    let html = '';
    transactions.forEach(tr => {
        html += `
            <tr>
                <td>${escapeHtml(tr.name)}</td>
                <td>${formatRupiah(tr.amount)}</td>
                <td>${escapeHtml(tr.category || '-')}</td>
                <td>${tr.type === 'income' ? '💰 Pemasukan' : '💸 Pengeluaran'}</td>
                <td>${escapeHtml(tr.note?.substring(0, 30) || '-')}</td>
                <td>
                    <button class="btn-edit" onclick="editTransaction('${tr.id}')">✏️ Edit</button>
                    <button class="btn-delete" onclick="deleteTransaction('${tr.id}')">🗑️ Hapus</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    updateDashboard(transactions);
    updateChart(transactions);
}

function updateDashboard(transactions) {
    let totalIncome = 0, totalExpense = 0;
    transactions.forEach(tr => {
        if (tr.type === 'income') totalIncome += tr.amount;
        else totalExpense += tr.amount;
    });
    document.getElementById('totalBalance').innerText = formatRupiah(totalIncome - totalExpense);
    document.getElementById('totalIncome').innerText = formatRupiah(totalIncome);
    document.getElementById('totalExpense').innerText = formatRupiah(totalExpense);
}

function updateChart(transactions) {
    const expenses = transactions.filter(tr => tr.type === 'expense');
    const categoryMap = new Map();
    expenses.forEach(exp => {
        const cat = exp.category || 'Lainnya';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + exp.amount);
    });
    if (expenseChart) expenseChart.destroy();
    const ctx = document.getElementById('expenseChart').getContext('2d');
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Array.from(categoryMap.keys()),
            datasets: [{
                data: Array.from(categoryMap.values()),
                backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf', '#8b5cf6']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: '#eef2ff' } } }
        }
    });
}

// ========================
// CRUD TRANSAKSI
// ========================
async function addTransaction(name, amount, type, category, note) {
    const { error } = await supabaseClient.from('transactions').insert([{
        user_id: currentUser.id,
        name: name.trim(),
        amount: Number(amount),
        type: type,
        category: category,
        note: note || null,
        created_at: new Date().toISOString()
    }]);
    if (error) { alert('Gagal menambah transaksi: ' + error.message); return false; }
    return true;
}

async function updateTransaction(id, name, amount, type, category, note) {
    const { error } = await supabaseClient
        .from('transactions')
        .update({ name: name.trim(), amount: Number(amount), type, category, note: note || null })
        .eq('id', id).eq('user_id', currentUser.id);
    if (error) { alert('Gagal mengupdate: ' + error.message); return false; }
    return true;
}

window.deleteTransaction = async function(id) {
    if (!confirm('Yakin hapus transaksi ini?')) return;
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) alert('Gagal hapus: ' + error.message);
    else { await renderTable(); resetFormToAddMode(); }
};

window.editTransaction = async function(id) {
    const { data, error } = await supabaseClient.from('transactions').select('*').eq('id', id).eq('user_id', currentUser.id).single();
    if (error || !data) return;
    editingId = id;
    document.getElementById('transactionName').value = data.name;
    document.getElementById('transactionAmount').value = data.amount;
    document.getElementById('transactionType').value = data.type;
    document.getElementById('transactionCategory').value = data.category || categories[0];
    document.getElementById('transactionNote').value = data.note || '';
    document.getElementById('submitBtn').textContent = '✏️ Update Transaksi';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
};

function resetFormToAddMode() {
    editingId = null;
    document.getElementById('transactionForm').reset();
    document.getElementById('submitBtn').textContent = '➕ Tambah Transaksi';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('transactionName').value;
    const amount = document.getElementById('transactionAmount').value;
    const type = document.getElementById('transactionType').value;
    const category = document.getElementById('transactionCategory').value;
    const note = document.getElementById('transactionNote').value;
    
    if (!name || !amount || amount <= 0) { alert('Isi nama dan nominal (lebih dari 0)!'); return; }
    
    let success = editingId
        ? await updateTransaction(editingId, name, amount, type, category, note)
        : await addTransaction(name, amount, type, category, note);
    if (success) { await renderTable(); resetFormToAddMode(); }
}

// ========================
// AUTHENTICATION
// ========================
async function handleLogin(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { alert('Login gagal: ' + error.message); return false; }
    currentUser = data.user;
    await loadUserProfile();
    await loadUserCategories();
    await renderTable();
    showAppSection();
    return true;
}

async function handleRegister(email, password, fullName) {
    // Validasi email
    if (!isValidEmail(email)) {
        alert('Email tidak valid! Contoh: nama@domain.com');
        return false;
    }
    const { error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
    });
    if (error) {
        alert('Registrasi gagal: ' + error.message);
        return false;
    }
    // Panduan cek email (poin 1)
    alert('✅ Pendaftaran berhasil! Silakan cek email Anda (termasuk folder Spam) untuk verifikasi akun sebelum login.');
    return true;
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    categories = [];
    showAuthSection();
}

function showAppSection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('appSection').style.display = 'block';
}

function showAuthSection() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('appSection').style.display = 'none';
}

// ========================
// RESET PASSWORD
// ========================
async function sendResetPassword(email) {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://aplikasi-keuangan-v2.vercel.app' // ganti dengan URL Anda
    });
    if (error) {
        alert('Gagal kirim link reset: ' + error.message);
    } else {
        alert('✅ Tautan reset password telah dikirim ke email Anda (cek folder Spam).');
    }
}

// ========================
// MODALS & UI
// ========================
function setupCategoryModal() {
    const modal = document.getElementById('categoryModal');
    const openBtn = document.getElementById('openCategoryModalBtn');
    const closeSpan = document.querySelector('#categoryModal .close-modal');
    const saveBtn = document.getElementById('saveCategoryBtn');
    const input = document.getElementById('newCategoryName');
    if (!modal || !openBtn) return;
    openBtn.onclick = () => { modal.style.display = 'flex'; input.value = ''; input.focus(); };
    const close = () => modal.style.display = 'none';
    if (closeSpan) closeSpan.onclick = close;
    window.onclick = (e) => { if (e.target === modal) close(); };
    saveBtn.onclick = async () => {
        if (await addNewCategory(input.value)) {
            close();
            alert(`Kategori "${input.value}" berhasil ditambahkan!`);
        }
    };
}

function setupProfileModal() {
    const modal = document.getElementById('profileModal');
    const userAvatar = document.getElementById('userAvatar');
    const closeSpan = document.getElementById('closeProfileModal');
    const saveBtn = document.getElementById('saveProfileBtn');
    const upload = document.getElementById('avatarUpload');
    const preview = document.getElementById('profileAvatarPreview');
    const nameInput = document.getElementById('profileFullName');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    
    if (!modal || !userAvatar) return;
    
    // Buka modal
    userAvatar.onclick = () => {
        modal.style.display = 'flex';
        nameInput.value = currentUser.profile?.full_name || '';
        const currentAvatar = currentUser.profile?.avatar_url;
        if (currentAvatar && (currentAvatar.startsWith('🐶') || currentAvatar.startsWith('🐱') || 
            currentAvatar.startsWith('🦊') || currentAvatar.startsWith('🐼') ||
            currentAvatar.startsWith('👨‍💻') || currentAvatar.startsWith('👩‍🎨'))) {
            preview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAvatar)}&background=8b5cf6&color=fff&bold=true&size=100`;
            selectedAvatarEmoji = currentAvatar;
        } else if (currentAvatar) {
            preview.src = currentAvatar;
            selectedAvatarEmoji = null;
        } else {
            preview.src = `https://ui-avatars.com/api/?name=${(currentUser.profile?.full_name || 'U').charAt(0)}&background=8b5cf6&color=fff&bold=true&size=100`;
            selectedAvatarEmoji = null;
        }
        upload.value = '';
        // highlight pilihan emoji
        avatarOptions.forEach(opt => opt.classList.remove('selected'));
        if (selectedAvatarEmoji) {
            const found = Array.from(avatarOptions).find(opt => opt.getAttribute('data-avatar') === selectedAvatarEmoji);
            if (found) found.classList.add('selected');
        }
    };
    
    const close = () => modal.style.display = 'none';
    if (closeSpan) closeSpan.onclick = close;
    window.onclick = (e) => { if (e.target === modal) close(); };
    
    // Preview upload file
    upload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { preview.src = ev.target.result; };
            reader.readAsDataURL(file);
            selectedAvatarEmoji = null;
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
        }
    };
    
    // Pilih avatar dari galeri
    avatarOptions.forEach(opt => {
        opt.onclick = () => {
            const emoji = opt.getAttribute('data-avatar');
            selectedAvatarEmoji = emoji;
            // generate preview sebagai teks (pakai UI Avatars untuk tampilan sementara)
            preview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(emoji)}&background=8b5cf6&color=fff&bold=true&size=100`;
            avatarOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            upload.value = ''; // reset file input
        };
    });
    
    saveBtn.onclick = async () => {
        const fullName = nameInput.value;
        const avatarFile = upload.files[0];
        await updateUserProfile(fullName, avatarFile, selectedAvatarEmoji);
        close();
    };
}

function setupResetPasswordModal() {
    const modal = document.getElementById('resetPasswordModal');
    const forgotLink = document.getElementById('forgotPasswordLink');
    const closeSpan = document.getElementById('closeResetModal');
    const sendBtn = document.getElementById('sendResetLinkBtn');
    const emailInput = document.getElementById('resetEmail');
    
    if (!modal || !forgotLink) return;
    forgotLink.onclick = (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
        emailInput.value = '';
    };
    const close = () => modal.style.display = 'none';
    if (closeSpan) closeSpan.onclick = close;
    window.onclick = (e) => { if (e.target === modal) close(); };
    sendBtn.onclick = async () => {
        const email = emailInput.value;
        if (!email) { alert('Masukkan email Anda!'); return; }
        await sendResetPassword(email);
        close();
    };
}

function setupAuthTabs() {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    const registerEmail = document.getElementById('registerEmail');
    const emailWarning = document.getElementById('emailWarning');
    
    const showLogin = () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    };
    const showRegister = () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    };
    loginTab.onclick = showLogin;
    registerTab.onclick = showRegister;
    if (switchToRegister) switchToRegister.onclick = showRegister;
    if (switchToLogin) switchToLogin.onclick = showLogin;
    
    // Validasi email real-time (poin 7)
    if (registerEmail && emailWarning) {
        registerEmail.addEventListener('input', function() {
            if (this.value && !isValidEmail(this.value)) {
                emailWarning.style.display = 'block';
            } else {
                emailWarning.style.display = 'none';
            }
        });
    }
    
    // Login submit
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin(
            document.getElementById('loginEmail').value,
            document.getElementById('loginPassword').value
        );
    });
    
    // Register submit
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirm = document.getElementById('registerConfirmPassword').value;
        
        if (!isValidEmail(email)) {
            alert('Email tidak valid!');
            return;
        }
        if (password !== confirm) {
            alert('Password dan konfirmasi password tidak cocok!');
            return;
        }
        if (password.length < 6) {
            alert('Password minimal 6 karakter!');
            return;
        }
        await handleRegister(email, password, fullName);
        showLogin();
    });
}

// ========================
// FITUR: KATEGORI HANYA UNTUK PENGELUARAN (poin 5)
// ========================
function setupTransactionTypeListener() {
    const typeSelect = document.getElementById('transactionType');
    const categorySelect = document.getElementById('transactionCategory');
    if (!typeSelect || !categorySelect) return;
    
    function updateCategoryState() {
        if (typeSelect.value === 'income') {
            categorySelect.disabled = true;
            categorySelect.value = 'Pemasukan'; // default
            // pastikan kategori 'Pemasukan' ada di daftar (tambahkan jika belum)
            if (!categories.includes('Pemasukan')) {
                categories.push('Pemasukan');
                saveUserCategories();
                populateCategoryDropdown();
            }
        } else {
            categorySelect.disabled = false;
            if (categorySelect.value === 'Pemasukan') categorySelect.value = categories[0] || '';
        }
    }
    typeSelect.addEventListener('change', updateCategoryState);
    updateCategoryState(); // initial call
}

// ========================
// INITIALIZE
// ========================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 SinTrack V2 - by @cceasenn');
    
    setupCategoryModal();
    setupProfileModal();
    setupResetPasswordModal();
    setupAuthTabs();
    setupTransactionTypeListener();
    
    document.getElementById('transactionForm')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('cancelEditBtn')?.addEventListener('click', resetFormToAddMode);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    
    await checkSession();
});