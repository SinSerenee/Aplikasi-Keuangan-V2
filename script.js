// ========================
// KONFIGURASI SUPABASE (DIAMBIL DARI KREDENSIAL YANG ANDA BERIKAN)
// ========================
const supabaseUrl = 'https://sowkixwgtgdzfjmoerxq.supabase.co';
const supabaseKey = 'sb_publishable_zLfRnz9bTAD0W4lOKIFtmg_oflJNuPq';

// Pastikan Supabase SDK sudah dimuat
if (typeof supabase === 'undefined') {
    console.error('❌ Supabase SDK tidak dimuat! Periksa CDN di index.html');
} else {
    console.log('✅ Supabase SDK berhasil dimuat');
}

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
console.log('🔌 Supabase client initialized dengan URL:', supabaseUrl);

// ========================
// STATE GLOBAL
// ========================
let categories = [];
let editingId = null;
const STORAGE_CATEGORIES_KEY = 'fintrack_categories';

// ========================
// CEK ELEMEN DOM (DEBUGGING)
// ========================
function checkDOMElements() {
    console.log('=== CEK ELEMEN DOM ===');
    const elements = [
        'transactionForm', 'transactionName', 'transactionAmount',
        'transactionType', 'transactionCategory', 'openCategoryModalBtn',
        'categoryModal', 'newCategoryName', 'saveCategoryBtn',
        'transactionTableBody', 'totalBalance', 'totalIncome',
        'totalExpense', 'submitBtn', 'cancelEditBtn'
    ];
    
    let allFound = true;
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            console.log(`✅ ${id} ditemukan`);
        } else {
            console.error(`❌ ${id} TIDAK DITEMUKAN! Periksa ID di index.html`);
            allFound = false;
        }
    });
    console.log('========================\n');
    return allFound;
}

// ========================
// FUNGSI KATEGORI (localStorage)
// ========================
function loadCategories() {
    console.log('📂 Memuat kategori dari localStorage...');
    const stored = localStorage.getItem(STORAGE_CATEGORIES_KEY);
    
    if (stored) {
        categories = JSON.parse(stored);
        console.log('✅ Kategori dimuat dari localStorage:', categories);
    } else {
        // Kategori default
        categories = ['Makan', 'Transportasi', 'Gaji'];
        saveCategories();
        console.log('✅ Kategori default dibuat:', categories);
    }
    
    // Pastikan categories adalah array
    if (!Array.isArray(categories) || categories.length === 0) {
        console.warn('⚠️ Kategori kosong, menggunakan default');
        categories = ['Makan', 'Transportasi', 'Gaji'];
        saveCategories();
    }
}

function saveCategories() {
    localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories));
    console.log('💾 Kategori disimpan ke localStorage:', categories);
}

function addNewCategory(categoryName) {
    console.log('➕ Mencoba menambah kategori:', categoryName);
    const trimmed = categoryName.trim();
    
    if (trimmed === '') {
        alert('Nama kategori tidak boleh kosong!');
        console.warn('❌ Gagal: nama kosong');
        return false;
    }
    
    if (categories.includes(trimmed)) {
        alert(`Kategori "${trimmed}" sudah ada!`);
        console.warn('❌ Gagal: kategori sudah ada', categories);
        return false;
    }
    
    categories.push(trimmed);
    saveCategories();
    populateCategoryDropdown();
    console.log('✅ Kategori berhasil ditambahkan:', categories);
    return true;
}

// Mengisi dropdown <select id="transactionCategory">
function populateCategoryDropdown() {
    console.log('🔄 Mengisi dropdown kategori...');
    const select = document.getElementById('transactionCategory');
    
    if (!select) {
        console.error('❌ Element #transactionCategory tidak ditemukan!');
        return;
    }
    
    if (!categories || categories.length === 0) {
        console.warn('⚠️ categories kosong, reload dulu');
        loadCategories();
    }
    
    // Kosongkan dropdown terlebih dahulu
    select.innerHTML = '';
    console.log('📋 Data kategori yang akan ditampilkan:', categories);
    
    // Tambahkan option placeholder/pilihan
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
        console.log(`   - Opsi ditambahkan: ${cat}`);
    });
    
    console.log(`✅ Dropdown terisi dengan ${categories.length} kategori`);
}

// ========================
// RENDER TABEL TRANSAKSI (dari Supabase)
// ========================
async function renderTable() {
    console.log('🔄 Merender tabel transaksi...');
    const tbody = document.getElementById('transactionTableBody');
    if (!tbody) {
        console.error('❌ Element #transactionTableBody tidak ditemukan!');
        return;
    }

    console.log('📡 Mengambil data dari Supabase...');
    const { data: transactions, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching transactions:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Gagal memuat data: ${error.message}</td></tr>`;
        return;
    }

    console.log(`✅ Mendapat ${transactions?.length || 0} transaksi dari Supabase`);
    console.log('📊 Data transaksi:', transactions);

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Belum ada transaksi. Tambahkan sekarang!</td></tr>';
        updateDashboard([]);
        return;
    }

    let html = '';
    transactions.forEach(tr => {
        const formattedAmount = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(tr.amount);
        const typeLabel = tr.type === 'income' ? '💰 Pemasukan' : '💸 Pengeluaran';
        const categoryDisplay = tr.category ? tr.category : '-';
        
        html += `
            <tr>
                <td>${escapeHtml(tr.name)}</td>
                <td>${formattedAmount}</td>
                <td>${escapeHtml(categoryDisplay)}</td>
                <td>${typeLabel}</td>
                <td>
                    <button class="btn-edit" onclick="editTransaction('${tr.id}')">✏️ Edit</button>
                    <button class="btn-delete" onclick="deleteTransaction('${tr.id}')">🗑️ Hapus</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    console.log('✅ Tabel berhasil dirender');
    updateDashboard(transactions);
}

function updateDashboard(transactions) {
    console.log('📊 Update dashboard...');
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(tr => {
        if (tr.type === 'income') totalIncome += tr.amount;
        else totalExpense += tr.amount;
    });
    const balance = totalIncome - totalExpense;

    const formatRupiah = (val) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(val);
    };

    const balanceEl = document.getElementById('totalBalance');
    const incomeEl = document.getElementById('totalIncome');
    const expenseEl = document.getElementById('totalExpense');
    
    if (balanceEl) balanceEl.innerText = formatRupiah(balance);
    if (incomeEl) incomeEl.innerText = formatRupiah(totalIncome);
    if (expenseEl) expenseEl.innerText = formatRupiah(totalExpense);
    
    console.log(`💰 Saldo: ${formatRupiah(balance)}, Pemasukan: ${formatRupiah(totalIncome)}, Pengeluaran: ${formatRupiah(totalExpense)}`);
}

// ========================
// CRUD TRANSAKSI (Supabase)
// ========================
async function addTransaction(name, amount, type, category) {
    console.log('➕ Menambah transaksi:', { name, amount, type, category });
    const { data, error } = await supabaseClient
        .from('transactions')
        .insert([{
            name: name.trim(),
            amount: Number(amount),
            type: type,
            category: category,
            created_at: new Date().toISOString()
        }])
        .select();

    if (error) {
        console.error('❌ Error adding transaction:', error);
        alert('Gagal menambah transaksi: ' + error.message);
        return false;
    }
    console.log('✅ Transaksi berhasil ditambahkan:', data);
    return true;
}

async function updateTransaction(id, name, amount, type, category) {
    console.log('✏️ Mengupdate transaksi:', { id, name, amount, type, category });
    const { error } = await supabaseClient
        .from('transactions')
        .update({
            name: name.trim(),
            amount: Number(amount),
            type: type,
            category: category
        })
        .eq('id', id);

    if (error) {
        console.error('❌ Error updating transaction:', error);
        alert('Gagal mengupdate transaksi: ' + error.message);
        return false;
    }
    console.log('✅ Transaksi berhasil diupdate');
    return true;
}

window.deleteTransaction = async function(id) {
    console.log('🗑️ Menghapus transaksi dengan ID:', id);
    if (!confirm('Yakin ingin menghapus transaksi ini?')) {
        console.log('❌ Dibatalkan user');
        return;
    }
    
    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);
        
    if (error) {
        console.error('❌ Error deleting transaction:', error);
        alert('Gagal menghapus transaksi: ' + error.message);
    } else {
        console.log('✅ Transaksi berhasil dihapus');
        await renderTable();
        resetFormToAddMode();
    }
};

window.editTransaction = async function(id) {
    console.log('✏️ Mengedit transaksi dengan ID:', id);
    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();
        
    if (error || !data) {
        console.error('❌ Error fetching transaction for edit:', error);
        return;
    }
    
    editingId = id;
    document.getElementById('transactionName').value = data.name;
    document.getElementById('transactionAmount').value = data.amount;
    document.getElementById('transactionType').value = data.type;
    document.getElementById('transactionCategory').value = data.category || categories[0];

    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (submitBtn) submitBtn.textContent = '✏️ Update Transaksi';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    console.log('✅ Form terisi dengan data transaksi');
};

function resetFormToAddMode() {
    editingId = null;
    const form = document.getElementById('transactionForm');
    if (form) form.reset();
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (submitBtn) submitBtn.textContent = '➕ Tambah Transaksi';
    if (cancelBtn) cancelBtn.style.display = 'none';
    console.log('🔄 Form direset ke mode tambah');
}

// ========================
// HANDLER SUBMIT FORM
// ========================
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log('📝 Form submitted');
    
    const name = document.getElementById('transactionName').value;
    const amount = document.getElementById('transactionAmount').value;
    const type = document.getElementById('transactionType').value;
    const category = document.getElementById('transactionCategory').value;

    console.log('Data form:', { name, amount, type, category });

    if (!name || !amount || amount <= 0) {
        alert('Isi nama transaksi dan nominal (lebih dari 0)!');
        console.warn('❌ Validasi gagal');
        return;
    }
    
    if (!category) {
        alert('Pilih kategori terlebih dahulu!');
        console.warn('❌ Kategori belum dipilih');
        return;
    }

    let success = false;
    if (editingId) {
        success = await updateTransaction(editingId, name, amount, type, category);
    } else {
        success = await addTransaction(name, amount, type, category);
    }

    if (success) {
        await renderTable();
        resetFormToAddMode();
    }
}

// ========================
// MODAL TAMBAH KATEGORI
// ========================
function setupCategoryModal() {
    console.log('🔧 Setup modal kategori...');
    const modal = document.getElementById('categoryModal');
    const openBtn = document.getElementById('openCategoryModalBtn');
    const closeSpan = document.querySelector('.close-modal');
    const saveBtn = document.getElementById('saveCategoryBtn');
    const newCategoryInput = document.getElementById('newCategoryName');

    if (!modal) {
        console.error('❌ Element #categoryModal tidak ditemukan!');
        return;
    }
    if (!openBtn) {
        console.error('❌ Element #openCategoryModalBtn tidak ditemukan!');
        return;
    }
    if (!saveBtn) {
        console.error('❌ Element #saveCategoryBtn tidak ditemukan!');
        return;
    }

    // Hapus event listener lama jika ada (untuk menghindari duplikasi)
    openBtn.onclick = null;
    saveBtn.onclick = null;
    
    openBtn.onclick = () => {
        console.log('🔓 Membuka modal kategori');
        modal.style.display = 'flex';
        if (newCategoryInput) {
            newCategoryInput.value = '';
            newCategoryInput.focus();
        }
    };

    const closeModal = () => {
        console.log('🔒 Menutup modal kategori');
        modal.style.display = 'none';
    };
    
    if (closeSpan) {
        closeSpan.onclick = closeModal;
    }
    
    window.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    saveBtn.onclick = () => {
        if (!newCategoryInput) {
            console.error('❌ Element #newCategoryName tidak ditemukan!');
            return;
        }
        const newCat = newCategoryInput.value;
        console.log('💾 Menyimpan kategori baru:', newCat);
        
        if (addNewCategory(newCat)) {
            closeModal();
            alert(`Kategori "${newCat}" berhasil ditambahkan!`);
            // Refresh dropdown
            populateCategoryDropdown();
        }
    };
    
    console.log('✅ Modal kategori siap digunakan');
}

// ========================
// UTILITY ESCAPE HTML
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

// ========================
// INITIALIZE PAGE
// ========================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Aplikasi FinTrack dimulai...');
    
    // Cek semua elemen DOM
    const elementsOk = checkDOMElements();
    if (!elementsOk) {
        console.warn('⚠️ Ada elemen DOM yang tidak ditemukan, periksa index.html');
    }
    
    // Load kategori dari localStorage
    loadCategories();
    console.log('📋 Data kategori saat ini:', categories);
    
    // Isi dropdown kategori
    populateCategoryDropdown();
    
    // Setup modal
    setupCategoryModal();
    
    // Render tabel transaksi
    await renderTable();
    
    // Event listener form submit
    const form = document.getElementById('transactionForm');
    if (form) {
        // Hapus event listener lama untuk menghindari duplikasi
        form.removeEventListener('submit', handleFormSubmit);
        form.addEventListener('submit', handleFormSubmit);
        console.log('✅ Event listener form terpasang');
    } else {
        console.error('❌ Element #transactionForm tidak ditemukan!');
    }
    
    // Tombol batal edit
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.removeEventListener('click', resetFormToAddMode);
        cancelBtn.addEventListener('click', () => {
            resetFormToAddMode();
        });
        console.log('✅ Event listener cancel button terpasang');
    }
    
    console.log('🎉 FinTrack siap digunakan!');
    console.log('📌 Pastikan tabel "transactions" sudah ada di Supabase dengan kolom: id, name, amount, type, category, created_at');
});