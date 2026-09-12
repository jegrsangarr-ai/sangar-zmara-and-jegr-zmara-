/**
 * Expenses Management Module
 */
import { api, formatCurrency, showToast } from '../api.js';
import { isAdmin } from '../auth.js';

let expenseCats = [];
let currentExpensesList = [];
let currentTotalExpenseAmount = 0;

export async function initExpensesPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const admin = isAdmin();
  const today = new Date().toISOString().split('T')[0];
  const firstDay = today.slice(0, 7) + '-01';

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">تۆماری خەرجییەکان</h2>
        <div class="section-subtitle">تۆمارکردن، جیاکردنەوە و کۆی گشتی خەرجی ڕۆژانە و مانگانە</div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-primary" id="btn-add-expense">+ تۆمارکردنی خەرجی نوێ</button>
        <button class="btn btn-secondary" id="btn-print-expenses">🖨️ چاپی ڕاپۆرتی خەرجییەکان (A4)</button>
        ${admin ? `<button class="btn btn-secondary" id="btn-manage-exp-cats">📁 جۆرەکانی خەرجی</button>` : ''}
      </div>
    </div>

    <!-- Filter & Summary -->
    <div class="card" style="padding: 16px; margin-bottom: 16px;">
      <div class="form-row" style="align-items: center;">
        <div class="form-col">
          <select id="exp-filter-cat" class="form-control">
            <option value="">-- هەموو جۆرەکانی خەرجی --</option>
          </select>
        </div>
        <div class="form-col">
          <input type="date" id="exp-from-date" class="form-control" value="${firstDay}" />
        </div>
        <div class="form-col">
          <input type="date" id="exp-to-date" class="form-control" value="${today}" />
        </div>
        <div class="form-col" style="flex: 0 0 auto;">
          <button class="btn btn-secondary" id="btn-filter-exp">فلتەرکردن</button>
        </div>
        <div class="form-col" style="text-align: left;">
          <span style="font-size: 13px; color: var(--text-muted);">کۆی خەرجی:</span>
          <strong id="exp-total-sum" style="font-size: 18px; color: #dc2626; margin-right: 6px;">0 د.ع</strong>
        </div>
      </div>
    </div>

    <!-- Expenses Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>جۆری خەرجی</th>
              <th>بڕی پارە</th>
              <th>وەسف / ڕوونکردنەوە</th>
              <th>بەرواری خەرجی</th>
              <th>تۆمارکار</th>
              <th>تێبینی</th>
              <th>کردار</th>
            </tr>
          </thead>
          <tbody id="expenses-table-body">
            <tr><td colspan="8" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-add-expense')?.addEventListener('click', () => openNewExpenseModal());
  document.getElementById('btn-manage-exp-cats')?.addEventListener('click', () => openExpenseCategoriesModal());
  document.getElementById('btn-filter-exp')?.addEventListener('click', () => loadExpensesTable());
  document.getElementById('btn-print-expenses')?.addEventListener('click', () => {
    const fromDate = document.getElementById('exp-from-date')?.value || '';
    const toDate = document.getElementById('exp-to-date')?.value || '';
    printExpensesReport(currentExpensesList, currentTotalExpenseAmount, { fromDate, toDate });
  });

  await loadExpenseCategories();
  await loadExpensesTable();
}

async function loadExpenseCategories() {
  const res = await api.get('/expense-categories');
  if (res.success && res.data) {
    expenseCats = res.data;
    const sel = document.getElementById('exp-filter-cat');
    if (sel) {
      sel.innerHTML = `
        <option value="">-- هەموو جۆرەکانی خەرجی --</option>
        ${expenseCats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
      `;
    }
  }
}

async function loadExpensesTable() {
  const tbody = document.getElementById('expenses-table-body');
  const sumEl = document.getElementById('exp-total-sum');
  if (!tbody) return;

  const catId = document.getElementById('exp-filter-cat')?.value || '';
  const fromDate = document.getElementById('exp-from-date')?.value || '';
  const toDate = document.getElementById('exp-to-date')?.value || '';

  let url = '/expenses?1=1';
  if (catId) url += `&category_id=${catId}`;
  if (fromDate) url += `&from_date=${fromDate}`;
  if (toDate) url += `&to_date=${toDate}`;

  const res = await api.get(url);
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: #dc2626;">هەڵە لە وەرگرتنی خەرجییەکان</td></tr>`;
    return;
  }

  const expenses = Array.isArray(res.data) ? res.data : (res.data?.expenses || res.expenses || []);
  currentExpensesList = expenses;
  currentTotalExpenseAmount = res.totalAmount || 0;
  const admin = isAdmin();

  if (sumEl) sumEl.textContent = formatCurrency(res.totalAmount || 0);

  if (expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ خەرجییەک نەدۆزرایەوە</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses
    .map((e, idx) => {
      return `
      <tr>
        <td>${idx + 1}</td>
        <td><span class="badge badge-secondary">${e.category_name || 'گشتی'}</span></td>
        <td><strong style="color: #dc2626; font-size: 15px;">${formatCurrency(e.amount)}</strong></td>
        <td><strong>${e.description}</strong></td>
        <td>${e.expense_date}</td>
        <td>${e.user_name || 'سەرپەرشتیار'}</td>
        <td><span style="font-size: 12px; color: var(--text-muted);">${e.notes || '-'}</span></td>
        <td>
          ${
            admin
              ? `<button class="btn btn-sm btn-secondary btn-del-exp" data-id="${e.id}" style="color: #dc2626;" title="سڕینەوە">🗑️</button>`
              : ''
          }
        </td>
      </tr>
    `;
    })
    .join('');

  tbody.querySelectorAll('.btn-del-exp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('دڵنیایت دەتەوێت ئەم تۆماری خەرجییە بسڕیتەوە؟')) {
        const delRes = await api.delete(`/expenses/${id}`);
        if (delRes.success) {
          showToast('خەرجی سڕایەوە', 'success');
          loadExpensesTable();
        } else {
          showToast(delRes.message || 'هەڵە لە سڕینەوە', 'error');
        }
      }
    });
  });
}

function openNewExpenseModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 480px;">
      <div class="modal-header">
        <h3 class="modal-title">تۆمارکردنی خەرجی نوێ</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">جۆری خەرجی *</label>
          <select id="ne-cat" class="form-control" required>
            <option value="">-- جۆری خەرجی هەڵبژێرە --</option>
            ${expenseCats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">بڕی پارە (د.ع) *</label>
          <input type="number" id="ne-amount" class="form-control" style="font-size: 16px; font-weight: bold;" min="1" required />
        </div>

        <div class="form-group">
          <label class="form-label">وەسف / ڕوونکردنەوە *</label>
          <input type="text" id="ne-desc" class="form-control" placeholder="بۆ نموونە: کرێی کارەبا، ئاو، نانی کرێکار..." required />
        </div>

        <div class="form-group">
          <label class="form-label">بەرواری خەرجی</label>
          <input type="date" id="ne-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
        </div>

        <div class="form-group">
          <label class="form-label">تێبینی</label>
          <input type="text" id="ne-notes" class="form-control" placeholder="تێبینی زیاتر..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary ne-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-danger" id="ne-submit-btn">✓ پاشەکەوتکردنی خەرجی</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.ne-cancel').addEventListener('click', closeModal);

  modal.querySelector('#ne-submit-btn').addEventListener('click', async () => {
    const category_id = modal.querySelector('#ne-cat').value;
    const amount = Number(modal.querySelector('#ne-amount').value);
    const description = modal.querySelector('#ne-desc').value.trim();
    const expense_date = modal.querySelector('#ne-date').value;
    const notes = modal.querySelector('#ne-notes').value.trim();

    if (!category_id || !amount || amount <= 0 || !description) {
      showToast('تکایە خانە پێویستەکان پڕبکەرەوە', 'error');
      return;
    }

    const res = await api.post('/expenses', {
      category_id: Number(category_id),
      amount,
      description,
      expense_date,
      notes: notes || null,
    });

    if (res.success) {
      showToast('خەرجی بە سەرکەوتوویی تۆمارکرا ✓', 'success');
      closeModal();
      loadExpensesTable();
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی خەرجی', 'error');
    }
  });
}

function openExpenseCategoriesModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 500px;">
      <div class="modal-header">
        <h3 class="modal-title">بەڕێوەبردنی جۆرەکانی خەرجی</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <input type="text" id="nec-name" class="form-control" placeholder="ناوی جۆری نوێی خەرجی..." />
          <button class="btn btn-primary" id="btn-save-exp-cat">+ زیادکردن</button>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>ناوی جۆر</th>
              </tr>
            </thead>
            <tbody id="exp-cats-list">
              ${expenseCats.map((c, i) => `<tr><td>${i + 1}</td><td><strong>${c.name}</strong></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close-btn-bottom">داخستن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.modal-close-btn-bottom').addEventListener('click', closeModal);

  modal.querySelector('#btn-save-exp-cat').addEventListener('click', async () => {
    const name = modal.querySelector('#nec-name').value.trim();
    if (!name) return;

    const res = await api.post('/expense-categories', { name });
    if (res.success) {
      showToast('جۆری خەرجی زیادکرا', 'success');
      await loadExpenseCategories();
      modal.querySelector('#nec-name').value = '';
      modal.querySelector('#exp-cats-list').innerHTML = expenseCats
        .map((c, i) => `<tr><td>${i + 1}</td><td><strong>${c.name}</strong></td></tr>`)
        .join('');
    } else {
      showToast(res.message || 'هەڵە لە زیادکردن', 'error');
    }
  });
}

function printExpensesReport(expenses = [], totalAmount = 0, meta = {}) {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const rows = expenses
    .map(
      (e, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-weight: bold;">${e.category_name || 'گشتی'}</td>
      <td style="text-align: left; font-weight: bold; color: #dc2626;">${formatCurrency(e.amount)}</td>
      <td><strong>${e.description}</strong></td>
      <td style="text-align: center;">${e.expense_date}</td>
      <td>${e.user_name || 'سەرپەرشتیار'}</td>
      <td style="font-size: 11px;">${e.notes || '—'}</td>
    </tr>
  `
    )
    .join('');

  printArea.innerHTML = `
    <div class="report-print-a4" dir="rtl">
      <div class="rep-header">
        <div class="rep-title" style="font-size: 22px; font-weight: 900;">سەنگەر زمارەیی و جێگر زمارەیی</div>
        <div class="rep-subtitle">بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و چاککردنەوە</div>
        <div style="font-size: 12px; margin-top: 4px; color: #475569;">
          📍 هەولێر - ناوچەی پیشەسازی باکوور | 📱 جێگر: 07503149696 - سەنگەر: 07504687412
        </div>
        <div style="font-size: 16px; font-weight: 800; margin-top: 10px; text-decoration: underline;">
          ڕاپۆرتی گشتی خەرجییەکان (General Expenses Statement)
        </div>
      </div>

      <div class="rep-meta-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 14px;">
        <div><strong>لە بەرواری:</strong> ${meta.fromDate || 'سەرەتا'}</div>
        <div><strong>تا بەرواری:</strong> ${meta.toDate || 'ئەمڕۆ'}</div>
        <div><strong>بەرواری چاپ:</strong> ${new Date().toISOString().split('T')[0]}</div>
      </div>

      <table class="rep-summary-table" style="margin-bottom: 16px;">
        <thead>
          <tr>
            <th>کۆی ژمارەی خەرجییەکان</th>
            <th>کۆی گشتی بڕی پارەی خەرجکراو</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold; text-align: center;">${expenses.length} خەرجی</td>
            <td style="font-size: 18px; font-weight: 900; color: #dc2626; text-align: center;">${formatCurrency(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <table class="rep-table" style="margin-bottom: 24px; font-size: 12px;">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>جۆری خەرجی</th>
            <th>بڕی پارە</th>
            <th>وەسف و ڕوونکردنەوە</th>
            <th>بەروار</th>
            <th>تۆمارکار</th>
            <th>تێبینی</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" style="text-align:center;">هیچ خەرجییەک تۆمار نەکراوە</td></tr>'}
        </tbody>
      </table>

      <div class="rep-footer" style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 20px;">
        <div style="text-align: center;">
          <div>واژووی ژمێریار:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
        <div style="text-align: center;">
          <div>مۆر و واژووی بەڕێوەبەر:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 100);
}

