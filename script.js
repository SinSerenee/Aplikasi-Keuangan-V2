// ========================
// KONFIGURASI SUPABASE
// ========================
const supabaseUrl = 'https://sowkixwgtgdzfjmoerxq.supabase.co';
const supabaseKey = 'sb_publishable_zLfRnz9bTAD0W4lOKIFtmg_oflJNuPq';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ========================
// STATE GLOBAL
// ========================
let currentUser = null;           // Menyimpan data user yang sedang login
let categories = [];              // Kategori custom milik user
let editingId = null;             // ID transaksi yang sedang diedit
let expenseChart = null;          // Instance Chart.js untuk grafik

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

// ========================
// CEK SESSION LOGIN (Apakah user sudah login sebelumnya)
// ========================
async function checkSession() {
    console.log('🔍 Mengecek session...');
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
        console.log('ℹ️ Tidak ada session, tampilkan login');
        showAuthSection();
        return false;
    }
}

// ========================
// LOAD & SAVE USER PROFILE
// ========================
async function loadUserProfile() {
    if (!currentUser) return;
    
    const { data, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('❌ Error load profile:', error);
        return;
    }
    
    if (data) {
        // Update tampilan
        document.getElementById('userName').innerText = data.full_name || currentUser.email;
        if (data.avatar_url) {
            document.getElementById('userAvatar').src = data.avatar_url;
        }
        // Simpan ke state
        currentUser.profile = data;
    } else {
        // Buat profile baru jika belum ada
        const { error: insertError } = await supabaseClient
            .from('user_profiles')
            .insert([{
                id: currentUser.id,
                full_name: currentUser.email.split('@')[0],
                avatar_url: null
            }]);
        
        if (insertError) {
            console.error('❌ Error create profile:', insertError);
        } else {
            document.getElementById('userName').innerText = currentUser.email.split('@')[0];
        }
    }
}

async function updateUserProfile(fullName, avatarFile) {
    if (!currentUser) return false;
    
    let avatarUrl = currentUser.profile?.avatar_url || null;
    
    // Upload avatar jika ada file baru
    // Upload avatar jika ada file baru
if (avatarFile) {
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(fileName, avatarFile, {
            cacheControl: '3600',
            upsert: true
        });
    
    if (uploadError) {
        console.error('❌ Error upload avatar:', uploadError);
        alert('Gagal upload avatar: ' + uploadError.message);
        return false;
    }
    
    // Dapatkan public URL
    const { data: urlData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(fileName);
    
    avatarUrl = urlData.publicUrl;
}
    
    // Update profile di database
    const { error } = await supabaseClient
        .from('user_profiles')
        .update({
            full_name: fullName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);
    
    if (error) {
        console.error('❌ Error update profile:', error);
        alert('Gagal update profil: ' + error.message);
        return false;
    }
    
    // Update tampilan
    document.getElementById('userName').innerText = fullName;
    if (avatarUrl) {
        document.getElementById('userAvatar').src = avatarUrl;
    }
    
    alert('✅ Profil berhasil diupdate!');
    return true;
}

// ========================
// CUSTOM CATEGORIES (per user)
// ========================
async function loadUserCategories() {
    if (!currentUser) return;
    
    console.log('📂 Memuat kategori user...');
    const { data, error } = await supabaseClient
        .from('user_categories')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name');
    
    if (error) {
        console.error('❌ Error load categories:', error);
        return;
    }
    
    if (data && data.length > 0) {
        categories = data.map(cat => cat.name);
    } else {
        // Kategori default untuk user baru
        categories = ['Makanan', 'Transportasi', 'Belanja', 'Hiburan', 'Kesehatan', 'Pendidikan'];
        await saveUserCategories();
    }
    
    console.log('✅ Kategori dimuat:', categories);
    populateCategoryDropdown();
}

async function saveUserCategories() {
    if (!currentUser) return;
    
    // Hapus semua kategori lama user
    await supabaseClient
        .from('user_categories')
        .delete()
        .eq('user_id', currentUser.id);
    
    // Insert kategori baru
    const categoriesToInsert = categories.map(name => ({
        user_id: currentUser.id,
        name: name
    }));
    
    if (categoriesToInsert.length > 0) {
        const { error } = await supabaseClient
            .from('user_categories')
            .insert(categoriesToInsert);
        
        if (error) {
            console.error('❌ Error saving categories:', error);
        }
    }
}

async function addNewCategory(categoryName) {
    const trimmed = categoryName.trim();
    if (trimmed === '') {
        alert('Nama kategori tidak boleh kosong!');
        return false;
    }
    
    if (categories.includes(trimmed)) {
        alert(`Kategori "${trimmed}" sudah ada!`);
        return false;
    }
    
    categories.push(trimmed);
    await saveUserCategories();
    populateCategoryDropdown();
    console.log('✅ Kategori berhasil ditambahkan:', categories);
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
// RENDER TABEL & DASHBOARD
// ========================
async function renderTable() {
    if (!currentUser) return;
    
    console.log('🔄 Merender tabel transaksi...');
    const tbody = document.getElementById('transactionTableBody');
    if (!tbody) return;
    
    const { data: transactions, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('❌ Error fetching transactions:', error);
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
        const formattedAmount = formatRupiah(tr.amount);
        const typeLabel = tr.type === 'income' ? '💰 Pemasukan' : '💸 Pengeluaran';
        const categoryDisplay = tr.category || '-';
        const noteDisplay = tr.note ? tr.note.substring(0, 30) : '-';
        
        html += `
            <tr>
                <td>${escapeHtml(tr.name)}</td>
                <td>${formattedAmount}</td>
                <td>${escapeHtml(categoryDisplay)}</td>
                <td>${typeLabel}</td>
                <td>${escapeHtml(noteDisplay)}</td>
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
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(tr => {
        if (tr.type === 'income') totalIncome += tr.amount;
        else totalExpense += tr.amount;
    });
    const balance = totalIncome - totalExpense;
    
    document.getElementById('totalBalance').innerText = formatRupiah(balance);
    document.getElementById('totalIncome').innerText = formatRupiah(totalIncome);
    document.getElementById('totalExpense').innerText = formatRupiah(totalExpense);
}

// ========================
// GRAFIK DENGAN CHART.JS
// ========================
function updateChart(transactions) {
    // Filter hanya pengeluaran
    const expenses = transactions.filter(tr => tr.type === 'expense');
    
    // Kelompokkan berdasarkan kategori
    const categoryMap = new Map();
    expenses.forEach(exp => {
        const cat = exp.category || 'Lainnya';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + exp.amount);
    });
    
    const categories_chart = Array.from(categoryMap.keys());
    const amounts = Array.from(categoryMap.values());
    
    // Hancurkan chart lama jika ada
    if (expenseChart) {
        expenseChart.destroy();
    }
    
    const ctx = document.getElementById('expenseChart').getContext('2d');
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories_chart,
            datasets: [{
                data: amounts,
                backgroundColor: [
                    '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0',
                    '#9966ff', '#ff9f40', '#c9cbcf', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#84cc16'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#eef2ff', font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = ((value / total) * 100).toFixed(1);
                            return `${label}: ${formatRupiah(value)} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ========================
// CRUD TRANSAKSI
// ========================
async function addTransaction(name, amount, type, category, note) {
    if (!currentUser) return false;
    
    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            user_id: currentUser.id,
            name: name.trim(),
            amount: Number(amount),
            type: type,
            category: category,
            note: note || null,
            created_at: new Date().toISOString()
        }]);
    
    if (error) {
        console.error('❌ Error adding transaction:', error);
        alert('Gagal menambah transaksi: ' + error.message);
        return false;
    }
    return true;
}

async function updateTransaction(id, name, amount, type, category, note) {
    const { error } = await supabaseClient
        .from('transactions')
        .update({
            name: name.trim(),
            amount: Number(amount),
            type: type,
            category: category,
            note: note || null
        })
        .eq('id', id)
        .eq('user_id', currentUser.id);
    
    if (error) {
        console.error('❌ Error updating transaction:', error);
        alert('Gagal mengupdate transaksi: ' + error.message);
        return false;
    }
    return true;
}

window.deleteTransaction = async function(id) {
    if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
    
    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);
    
    if (error) {
        console.error('❌ Error deleting transaction:', error);
        alert('Gagal menghapus transaksi: ' + error.message);
    } else {
        await renderTable();
        resetFormToAddMode();
    }
};

window.editTransaction = async function(id) {
    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', currentUser.id)
        .single();
    
    if (error || !data) {
        console.error('❌ Error fetching transaction:', error);
        return;
    }
    
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
    document.getElementById('transactionNote').value = '';
    document.getElementById('submitBtn').textContent = '➕ Tambah Transaksi';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('transactionName').value;
    const amount = document.getElementById('transactionAmount').value;
    const type = document.getElementById('transactionType').value;
    const category = document.getElementById('transactionCategory').value;
    const note = document.getElementById('transactionNote').value;
    
    if (!name || !amount || amount <= 0) {
        alert('Isi nama transaksi dan nominal (lebih dari 0)!');
        return;
    }
    
    let success = false;
    if (editingId) {
        success = await updateTransaction(editingId, name, amount, type, category, note);
    } else {
        success = await addTransaction(name, amount, type, category, note);
    }
    
    if (success) {
        await renderTable();
        resetFormToAddMode();
    }
}

// ========================
// AUTHENTICATION (Login, Register, Logout)
// ========================
async function handleLogin(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) {
        alert('Login gagal: ' + error.message);
        return false;
    }
    
    currentUser = data.user;
    await loadUserProfile();
    await loadUserCategories();
    await renderTable();
    showAppSection();
    return true;
}

async function handleRegister(email, password, fullName) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { full_name: fullName }
        }
    });
    
    if (error) {
        alert('Registrasi gagal: ' + error.message);
        return false;
    }
    
    alert('✅ Registrasi berhasil! Silakan login.');
    return true;
}

async function handleLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Error logout:', error);
    }
    currentUser = null;
    categories = [];
    showAuthSection();
}

// ========================
// UI NAVIGATION (Tampilkan/Menyembunyikan Section)
// ========================
function showAppSection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('appSection').style.display = 'block';
}

function showAuthSection() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('appSection').style.display = 'none';
    // Reset form auth
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
}

// ========================
// MODAL HANDLERS
// ========================
function setupCategoryModal() {
    const modal = document.getElementById('categoryModal');
    const openBtn = document.getElementById('openCategoryModalBtn');
    const closeSpan = document.querySelector('#categoryModal .close-modal');
    const saveBtn = document.getElementById('saveCategoryBtn');
    const newCategoryInput = document.getElementById('newCategoryName');
    
    if (!modal || !openBtn) return;
    
    openBtn.onclick = () => {
        modal.style.display = 'flex';
        newCategoryInput.value = '';
        newCategoryInput.focus();
    };
    
    const closeModal = () => modal.style.display = 'none';
    if (closeSpan) closeSpan.onclick = closeModal;
    window.onclick = (e) => { if (e.target === modal) closeModal(); };
    
    saveBtn.onclick = async () => {
        const newCat = newCategoryInput.value;
        if (await addNewCategory(newCat)) {
            closeModal();
            alert(`Kategori "${newCat}" berhasil ditambahkan!`);
        }
    };
}

function setupProfileModal() {
    const modal = document.getElementById('profileModal');
    const userAvatar = document.getElementById('userAvatar');
    const closeSpan = document.getElementById('closeProfileModal');
    const saveBtn = document.getElementById('saveProfileBtn');
    const avatarUpload = document.getElementById('avatarUpload');
    const profilePreview = document.getElementById('profileAvatarPreview');
    const profileName = document.getElementById('profileFullName');
    
    // Buka modal saat avatar diklik
    userAvatar.onclick = () => {
        modal.style.display = 'flex';
        profileName.value = currentUser.profile?.full_name || '';
        profilePreview.src = currentUser.profile?.avatar_url || 'https://via.placeholder.com/100';
    };
    
    const closeModal = () => modal.style.display = 'none';
    if (closeSpan) closeSpan.onclick = closeModal;
    window.onclick = (e) => { if (e.target === modal) closeModal(); };
    
    // Preview avatar sebelum upload
    avatarUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                profilePreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
    
    // Simpan profile
    saveBtn.onclick = async () => {
        const fullName = profileName.value;
        const avatarFile = avatarUpload.files[0];
        await updateUserProfile(fullName, avatarFile);
        closeModal();
    };
}

// ========================
// AUTH FORM HANDLERS & TAB SWITCHING
// ========================
function setupAuthTabs() {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    
    function showLogin() {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    }
    
    function showRegister() {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
    
    loginTab.onclick = showLogin;
    registerTab.onclick = showRegister;
    if (switchToRegister) switchToRegister.onclick = showRegister;
    if (switchToLogin) switchToLogin.onclick = showLogin;
    
    // Login form submit
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        await handleLogin(email, password);
    });
    
    // Register form submit
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        
        if (password !== confirmPassword) {
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
// INITIALIZE PAGE
// ========================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 FinTrack V3 dimulai...');
    console.log('📌 by @cceasenn');
    
    // Setup semua modal dan form
    setupCategoryModal();
    setupProfileModal();
    setupAuthTabs();
    
    // Event listener untuk form transaksi
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Tombol cancel edit
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetFormToAddMode);
    }
    
    // Tombol logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Cek session login
    await checkSession();
});