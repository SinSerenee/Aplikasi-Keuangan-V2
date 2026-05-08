// ========================
//  DATA & STORAGE (localStorage)
// ========================

// Kunci untuk menyimpan data di localStorage
const STORAGE_TRANSACTIONS = 'fintrack_transactions';
const STORAGE_CATEGORIES = 'fintrack_categories';

// Data default kategori (akan dipakai jika belum ada data)
const DEFAULT_CATEGORIES = ['Makanan', 'Transportasi', 'Belanja', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'];

// Data default contoh transaksi (biar tidak kosong saat pertama kali)
const DEFAULT_TRANSACTIONS = [
  { id: '1', name: 'Makan Siang', amount: 35000, type: 'expense', category: 'Makanan' },
  { id: '2', name: 'Gaji Bulanan', amount: 5000000, type: 'income', category: 'Lainnya' },
  { id: '3', name: 'Bensin', amount: 50000, type: 'expense', category: 'Transportasi' },
];

// Variabel global untuk menyimpan data selama sesi (sinkron dengan localStorage)
let transactions = [];
let categories = [];

// Variabel untuk menandai mode edit (null jika bukan edit)
let editId = null;

// ========================
//  FUNGSI BANTU (Load & Save localStorage)
// ========================

/** Load data dari localStorage, jika kosong maka gunakan default */
function loadData() {
  // Ambil transaksi
  const storedTransactions = localStorage.getItem(STORAGE_TRANSACTIONS);
  if (storedTransactions) {
    transactions = JSON.parse(storedTransactions);
  } else {
    transactions = [...DEFAULT_TRANSACTIONS];
    saveTransactions();
  }

  // Ambil kategori
  const storedCategories = localStorage.getItem(STORAGE_CATEGORIES);
  if (storedCategories) {
    categories = JSON.parse(storedCategories);
  } else {
    categories = [...DEFAULT_CATEGORIES];
    saveCategories();
  }
}

/** Simpan transaksi ke localStorage */
function saveTransactions() {
  localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(transactions));
}

/** Simpan daftar kategori ke localStorage */
function saveCategories() {
  localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(categories));
}

// ========================
//  FUNGSI RENDER UI (Dashboard, Tabel, Dropdown)
// ========================

/** Hitung total pemasukan, pengeluaran, dan saldo, lalu update 3 card */
function updateDashboard() {
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(tr => {
    if (tr.type === 'income') {
      totalIncome += tr.amount;
    } else {
      totalExpense += tr.amount;
    }
  });

  const balance = totalIncome - totalExpense;

  // Format mata uang Rupiah (tanpa desimal)
  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  document.getElementById('totalBalance').innerText = formatRupiah(balance);
  document.getElementById('totalIncome').innerText = formatRupiah(totalIncome);
  document.getElementById('totalExpense').innerText = formatRupiah(totalExpense);
}

/** Menampilkan tabel transaksi */
function renderTable() {
  const tbody = document.getElementById('transactionTableBody');
  if (!transactions.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">✨ Belum ada transaksi. Yuk tambah!</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  transactions.forEach(tr => {
    const row = document.createElement('tr');
    // Format nominal
    const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(tr.amount);
    const typeLabel = tr.type === 'income' ? '💰 Pemasukan' : '💸 Pengeluaran';
    const typeClass = tr.type === 'income' ? 'income-text' : 'expense-text'; // untuk styling opsional

    row.innerHTML = `
      <td>${escapeHtml(tr.name)}</td>
      <td class="${typeClass}">${formattedAmount}</td>
      <td>${escapeHtml(tr.category)}</td>
      <td>${typeLabel}</td>
      <td>
        <button class="btn-edit" data-id="${tr.id}">✏️ Edit</button>
        <button class="btn-delete" data-id="${tr.id}">🗑️ Hapus</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Pasang event listener untuk tombol edit & hapus (event delegation lebih aman)
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      editTransactionById(id);
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      deleteTransactionById(id);
    });
  });
}

/** Mengisi dropdown kategori di form */
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

/** Render semua komponen UI yang perlu di-refresh setelah data berubah */
function refreshUI() {
  updateDashboard();
  renderTable();
  populateCategoryDropdown();
}

// ========================
//  FUNGSI MANAJEMEN TRANSAKSI (CRUD)
// ========================

/** Menambah transaksi baru */
function addTransaction(name, amount, type, category) {
  const newTransaction = {
    id: Date.now().toString(), // ID unik berdasarkan timestamp
    name: name.trim(),
    amount: Number(amount),
    type: type,
    category: category
  };
  transactions.push(newTransaction);
  saveTransactions();
  refreshUI();
}

/** Mengupdate transaksi yang sudah ada (edit) */
function updateTransaction(id, name, amount, type, category) {
  const index = transactions.findIndex(t => t.id === id);
  if (index !== -1) {
    transactions[index] = {
      id: id,
      name: name.trim(),
      amount: Number(amount),
      type: type,
      category: category
    };
    saveTransactions();
    refreshUI();
  }
}

/** Menghapus transaksi berdasarkan ID */
function deleteTransactionById(id) {
  if (confirm('Yakin ingin menghapus transaksi ini?')) {
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    refreshUI();
    // Jika sedang dalam mode edit dan transaksi yang diedit dihapus, batalkan edit
    if (editId === id) {
      resetFormToAddMode();
    }
  }
}

/** Mengisi form dengan data transaksi untuk diedit */
function editTransactionById(id) {
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;

  editId = id;
  // Isi form
  document.getElementById('transactionName').value = transaction.name;
  document.getElementById('transactionAmount').value = transaction.amount;
  document.getElementById('transactionType').value = transaction.type;
  document.getElementById('transactionCategory').value = transaction.category;

  // Ubah tampilan tombol
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  submitBtn.textContent = '✏️ Update Transaksi';
  cancelBtn.style.display = 'inline-block';
}

/** Kembalikan form ke mode tambah (batal edit) */
function resetFormToAddMode() {
  editId = null;
  document.getElementById('transactionForm').reset();
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  submitBtn.textContent = '➕ Tambah Transaksi';
  cancelBtn.style.display = 'none';
}

// ========================
//  FUNGSI KATEGORI KUSTOM
// ========================

/** Menambah kategori baru (tidak boleh duplikat) */
function addNewCategory(categoryName) {
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
  saveCategories();
  populateCategoryDropdown(); // update dropdown
  return true;
}

// ========================
//  EVENT HANDLER & MODAL
// ========================

/** Menangani submit form (tambah/edit) */
function handleFormSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('transactionName').value;
  const amount = document.getElementById('transactionAmount').value;
  const type = document.getElementById('transactionType').value;
  const category = document.getElementById('transactionCategory').value;

  if (!name || !amount || amount <= 0) {
    alert('Isi nama transaksi dan nominal (lebih dari 0)!');
    return;
  }

  if (editId) {
    // Mode edit
    updateTransaction(editId, name, amount, type, category);
    resetFormToAddMode();
  } else {
    // Mode tambah
    addTransaction(name, amount, type, category);
    document.getElementById('transactionForm').reset(); // bersihkan form
  }
}

/** Setup modal untuk tambah kategori */
function setupCategoryModal() {
  const modal = document.getElementById('categoryModal');
  const openBtn = document.getElementById('openCategoryModalBtn');
  const closeSpan = document.querySelector('.close-modal');
  const saveBtn = document.getElementById('saveCategoryBtn');
  const newCategoryInput = document.getElementById('newCategoryName');

  // Buka modal
  openBtn.onclick = () => {
    modal.style.display = 'flex';
    newCategoryInput.value = '';
    newCategoryInput.focus();
  };

  // Tutup modal
  const closeModal = () => {
    modal.style.display = 'none';
  };
  closeSpan.onclick = closeModal;
  window.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  // Simpan kategori baru
  saveBtn.onclick = () => {
    const newCat = newCategoryInput.value;
    if (addNewCategory(newCat)) {
      closeModal();
      // Optional: kasih feedback sukses
    }
  };
}

// ========================
//  UTILITY: Escape HTML (mencegah XSS)
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
//  INISIALISASI SAAT HALAMAN LOAD
// ========================
document.addEventListener('DOMContentLoaded', () => {
  loadData();              // baca dari localStorage atau set default
  refreshUI();            // tampilkan dashboard, tabel, dropdown
  setupCategoryModal();   // siapkan modal kategori

  // Pasang event listener form
  const form = document.getElementById('transactionForm');
  form.addEventListener('submit', handleFormSubmit);

  // Tombol "Batal Edit"
  const cancelBtn = document.getElementById('cancelEditBtn');
  cancelBtn.addEventListener('click', () => {
    resetFormToAddMode();
  });
});