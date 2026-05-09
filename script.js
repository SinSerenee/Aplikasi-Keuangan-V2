// 1. Inisialisasi Supabase
const supabaseUrl = 'https://sowkixwgtgdzfjmoerxq.supabase.co'; // Ganti dengan URL Anda
const supabaseKey = 'sb_publishable_zLfRnz9bTAD0W4lOKIFtmg_oflJNuPq'; // Ganti dengan Anon Key Anda
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const form = document.getElementById('transactionForm');
const tableBody = document.getElementById('transactionTableBody');

// 2. Fungsi Mengambil Data dari Supabase (Read)
async function fetchTransactions() {
    const { data, error } = await _supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return console.error('Gagal ambil data:', error);
    
    renderTable(data);
    updateDashboard(data);
}

// 3. Fungsi Menyimpan Transaksi (Create)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newTransaction = {
        name: document.getElementById('transactionName').value,
        amount: parseInt(document.getElementById('transactionAmount').value),
        type: document.getElementById('transactionType').value,
        category: document.getElementById('transactionCategory').value
    };

    const { error } = await _supabase
        .from('transactions')
        .insert([newTransaction]);

    if (error) {
        alert('Gagal menyimpan data!');
    } else {
        form.reset();
        fetchTransactions(); // Refresh data
    }
});

// 4. Fungsi Menghapus Data (Delete)
async function deleteTransaction(id) {
    if (confirm('Hapus transaksi ini?')) {
        const { error } = await _supabase
            .from('transactions')
            .delete()
            .eq('id', id);
        
        if (!error) fetchTransactions();
    }
}

// 5. Update Tampilan Tabel & Dashboard
function renderTable(transactions) {
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-row">Belum ada transaksi.</td></tr>';
        return;
    }

    tableBody.innerHTML = transactions.map(t => `
        <tr>
            <td>${t.name}</td>
            <td>Rp${t.amount.toLocaleString()}</td>
            <td>${t.category}</td>
            <td style="color: ${t.type === 'income' ? '#4ade80' : '#f87171'}">${t.type.toUpperCase()}</td>
            <td>
                <button onclick="deleteTransaction(${t.id})" class="btn-delete">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function updateDashboard(transactions) {
    let income = 0; let expense = 0;
    transactions.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
    });

    document.getElementById('totalIncome').innerText = `Rp${income.toLocaleString()}`;
    document.getElementById('totalExpense').innerText = `Rp${expense.toLocaleString()}`;
    document.getElementById('totalBalance').innerText = `Rp${(income - expense).toLocaleString()}`;
}

// Jalankan fungsi ambil data saat pertama kali buka web
fetchTransactions();
