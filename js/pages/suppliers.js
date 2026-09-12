/**
 * Suppliers Management Module
 * سەنگەر زمارەیی و جێگر زمارەیی - POS System
 */
import { api, formatCurrency, showToast, escapeHtml } from '../api.js';
import { isAdmin } from '../auth.js';
import { printSupplierStatement } from '../receipt.js';

let cachedSuppliers = [];

export async function initSuppliersPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const admin = isAdmin();

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">بەڕێوەبردنی دابینکەران و کۆمپانیاکان</h2>
        <div class="section-subtitle">تۆماری دابینکەران، بەدواداچوونی قەرز، دانەوەی پارە و دەرهێنانی کشف حساب</div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${admin ? `<button class="btn btn-primary" id="btn-add-supplier">+ دابینکەری نوێ</button>` : ''}
        <button class="btn btn-secondary" id="btn-refresh-suppliers">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="stat-grid" id="suppliers-kpi-grid" style="margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
      <div class="stat-card" style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: var(--text-muted);">کۆی دابینکەران</div>
        <div style="font-size: 20px; font-weight: 800; color: #0f172a;" id="kpi-supp-count">0 دابینکەر</div>
      </div>
      <div class="stat-card" style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: var(--text-muted);">کۆی قەرزی ماوەی دابینکەران</div>
        <div style="font-size: 20px; font-weight: 800; color: #dc2626;" id="kpi-supp-debt">0 د.ع</div>
      </div>
      <div class="stat-card" style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: var(--text-muted);">کۆی گشتی کڕین لە سەرەتاوە</div>
        <div style="font-size: 20px; font-weight: 800; color: #0284c7;" id="kpi-supp-purchases">0 د.ع</div>
      </div>
      <div class="stat-card" style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: var(--text-muted);">کۆی گشتی پارەی دراو</div>
        <div style="font-size: 20px; font-weight: 800; color: #16a34a;" id="kpi-supp-paid">0 د.ع</div>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center;">
        <input type="text" id="supp-search-input" class="form-control" placeholder="🔍 گەڕان بەپێی ناوی دابینکەر، کۆمپانیا، کەسی پەیوەندیدار یان ژمارەی مۆبایل..." style="flex: 1;" />
      </div>
    </div>

    <!-- Suppliers Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>ناوی دابینکەر / کۆمپانیا</th>
              <th>کەسی پەیوەندیدار</th>
              <th>ژمارەی مۆبایل</th>
              <th>ناونیشان</th>
              <th>قەرزی لەسەرمان</th>
              <th>کردارەکان</th>
            </tr>
          </thead>
          <tbody id="suppliers-table-body">
            <tr><td colspan="7" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-add-supplier')?.addEventListener('click', () => openSupplierModal());
  document.getElementById('btn-refresh-suppliers')?.addEventListener('click', () => {
    loadDebtOverview();
    loadSuppliersTable();
  });

  const searchInput = document.getElementById('supp-search-input');
  let timeout = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => loadSuppliersTable(), 250);
  });

  await loadDebtOverview();
  await loadSuppliersTable();
}

async function loadDebtOverview() {
  const res = await api.get('/suppliers/debt-overview');
  if (res.success && res.data) {
    const data = res.data;
    const kpiCount = document.getElementById('kpi-supp-count');
    const kpiDebt = document.getElementById('kpi-supp-debt');
    const kpiPur = document.getElementById('kpi-supp-purchases');
    const kpiPaid = document.getElementById('kpi-supp-paid');

    if (kpiCount) kpiCount.textContent = `${data.total_suppliers || 0} دابینکەر`;
    if (kpiDebt) kpiDebt.textContent = formatCurrency(data.total_debt || 0);
    if (kpiPur) kpiPur.textContent = formatCurrency(data.total_purchases || 0);
    if (kpiPaid) kpiPaid.textContent = formatCurrency(data.total_paid || 0);
  }
}

async function loadSuppliersTable() {
  const tbody = document.getElementById('suppliers-table-body');
  if (!tbody) return;

  const search = document.getElementById('supp-search-input')?.value.trim() || '';
  const url = search ? `/suppliers/search?q=${encodeURIComponent(search)}` : '/suppliers';

  const res = await api.get(url);
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #dc2626;">هەڵە لە وەرگرتنی دابینکەران</td></tr>`;
    return;
  }

  const suppliers = res.data;
  cachedSuppliers = suppliers;
  const admin = isAdmin();

  if (suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ دابینکەرێک تۆمار نەکراوە</td></tr>`;
    return;
  }

  tbody.innerHTML = suppliers
    .map((s, idx) => {
      const hasDebt = Number(s.balance_debt) > 0;
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <strong>${escapeHtml(s.name)}</strong>
          ${s.company_name ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(s.company_name)}</div>` : ''}
        </td>
        <td>${escapeHtml(s.contact_person || '-')}</td>
        <td><span dir="ltr">${escapeHtml(s.phone || '-')}</span></td>
        <td>${escapeHtml(s.address || '-')}</td>
        <td>
          <span class="badge ${hasDebt ? 'badge-danger' : 'badge-success'}" style="font-size: 13px;">
            ${formatCurrency(s.balance_debt)}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${
              admin && hasDebt
                ? `<button class="btn btn-sm btn-danger btn-pay-supp" data-id="${s.id}" data-name="${escapeHtml(s.name)}" data-debt="${s.balance_debt}" title="تۆمارکردنی دانەوەی قەرز">
                    💸 دانەوەی قەرز
                   </button>`
                : ''
            }
            <button class="btn btn-sm btn-secondary btn-statement-supp" data-id="${s.id}" title="کشف حسابی تەواو و چاپکردن">
              📜 کشف حساب
            </button>
            <button class="btn btn-sm btn-secondary btn-payments-supp" data-id="${s.id}" title="مێژووی پارەدانەکانی پێشوو">
              📋 پارەدانەکان
            </button>
            ${admin ? `<button class="btn btn-sm btn-secondary btn-edit-supp" data-id="${s.id}" title="دەستکاری دابینکەر">✏️</button>` : ''}
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  tbody.querySelectorAll('.btn-pay-supp').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const debt = Number(btn.dataset.debt);
      openPaySupplierModal(id, name, debt);
    });
  });

  tbody.querySelectorAll('.btn-statement-supp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await openSupplierStatementModal(id);
    });
  });

  tbody.querySelectorAll('.btn-payments-supp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const supp = cachedSuppliers.find(s => String(s.id) === String(id));
      await openSupplierPaymentsModal(id, supp?.name || 'دابینکەر');
    });
  });

  tbody.querySelectorAll('.btn-edit-supp').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const supp = suppliers.find((s) => String(s.id) === String(id));
      if (supp) openSupplierModal(supp);
    });
  });
}

function openSupplierModal(supplier = null) {
  const isEdit = !!supplier;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 480px; border-radius: 12px;">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'دەستکاریکردنی دابینکەر' : 'زیادکردنی دابینکەری نوێ'}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">ناوی دابینکەر *</label>
          <input type="text" id="ms-name" class="form-control" value="${supplier?.name || ''}" placeholder="ناوی دابینکەر..." required />
        </div>
        <div class="form-group">
          <label class="form-label">ناوی کۆمپانیا</label>
          <input type="text" id="ms-company" class="form-control" value="${supplier?.company_name || ''}" placeholder="کۆمپانیا..." />
        </div>
        <div class="form-group">
          <label class="form-label">کەسی پەیوەندیدار</label>
          <input type="text" id="ms-contact" class="form-control" value="${supplier?.contact_person || ''}" placeholder="ناوی نوێنەر..." />
        </div>
        <div class="form-group">
          <label class="form-label">ژمارەی مۆبایل</label>
          <input type="text" id="ms-phone" class="form-control" value="${supplier?.phone || ''}" placeholder="0750xxxxxxx" />
        </div>
        <div class="form-group">
          <label class="form-label">ناونیشان</label>
          <input type="text" id="ms-address" class="form-control" value="${supplier?.address || ''}" placeholder="شار / شوێن..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary ms-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="ms-save-btn">${isEdit ? 'پاشەکەوتکردن' : 'تۆمارکردن'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.ms-cancel').addEventListener('click', closeModal);

  modal.querySelector('#ms-save-btn').addEventListener('click', async () => {
    const name = modal.querySelector('#ms-name').value.trim();
    const company_name = modal.querySelector('#ms-company').value.trim();
    const contact_person = modal.querySelector('#ms-contact').value.trim();
    const phone = modal.querySelector('#ms-phone').value.trim();
    const address = modal.querySelector('#ms-address').value.trim();

    if (!name) {
      showToast('ناوی دابینکەر پێویستە', 'error');
      return;
    }

    const payload = { 
      name, 
      company_name: company_name || null,
      contact_person: contact_person || null, 
      phone: phone || null, 
      address: address || null 
    };

    let res;
    if (isEdit) {
      res = await api.put(`/suppliers/${supplier.id}`, payload);
    } else {
      res = await api.post('/suppliers', payload);
    }

    if (res.success) {
      showToast(res.message || 'سەرکەوتوو بوو', 'success');
      closeModal();
      loadDebtOverview();
      loadSuppliersTable();
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردن', 'error');
    }
  });
}

function openPaySupplierModal(supplierId, supplierName, currentDebt) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 450px; border-radius: 12px;">
      <div class="modal-header" style="background: #0f172a; color: #ffffff;">
        <h3 class="modal-title" style="color: #ffffff; margin: 0;">دانەوەی قەرزی دابینکەر</h3>
        <button class="modal-close-btn" style="color: #cbd5e1;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 18px;">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <div style="font-weight: 700; color: #991b1b;">دابینکەر: ${escapeHtml(supplierName)}</div>
          <div style="font-size: 16px; color: #dc2626; font-weight: 800; margin-top: 4px;">
            کۆی قەرزی ماوە لەسەرمان: ${formatCurrency(currentDebt)}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">بڕی پارەی دراو (د.ع) *</label>
          <input type="number" id="ps-amount" class="form-control" style="font-size: 16px; font-weight: bold;" value="${currentDebt}" min="1" max="${currentDebt}" required />
        </div>

        <div class="form-group">
          <label class="form-label">بەرواری دانەوە</label>
          <input type="date" id="ps-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
        </div>

        <div class="form-group">
          <label class="form-label">تێبینی</label>
          <input type="text" id="ps-notes" class="form-control" placeholder="حەواڵە، نەقد لە قاسە، ژمارەی پسووڵە..." />
        </div>
      </div>
      <div class="modal-footer" style="padding: 12px 18px; display: flex; justify-content: space-between;">
        <button class="btn btn-secondary ps-cancel">داخستن</button>
        <button class="btn btn-danger" id="ps-submit-btn">✓ تۆمارکردنی دانەوەی قەرز</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.ps-cancel').addEventListener('click', closeModal);

  modal.querySelector('#ps-submit-btn').addEventListener('click', async () => {
    const amount = Number(modal.querySelector('#ps-amount').value);
    const paymentDate = modal.querySelector('#ps-date').value;
    const notes = modal.querySelector('#ps-notes').value.trim();

    if (!amount || amount <= 0) {
      showToast('تکایە بڕی دروستی پارە بنووسە', 'error');
      return;
    }

    const res = await api.post('/suppliers/pay', {
      supplier_id: Number(supplierId),
      amount,
      payment_date: paymentDate,
      notes: notes || null,
    });

    if (res.success) {
      showToast('دانەوەی قەرز بە سەرکەوتوویی تۆمارکرا ✓', 'success');
      closeModal();
      loadDebtOverview();
      loadSuppliersTable();
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی دانەوەی قەرز', 'error');
    }
  });
}

async function openSupplierStatementModal(supplierId) {
  const res = await api.get(`/suppliers/${supplierId}/statement`);
  if (!res.success || !res.data) {
    showToast('هەڵە لە وەرگرتنی کشف حسابی دابینکەر', 'error');
    return;
  }

  const { supplier, purchases, payments, summary } = res.data;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const purchaseRows = purchases.map((p, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-family: monospace; font-weight: bold;" dir="ltr">${escapeHtml(p.invoice_number)}</td>
      <td style="text-align: center;">${escapeHtml(p.purchase_date)}</td>
      <td style="text-align: left; font-weight: bold; color: var(--primary);">${formatCurrency(p.total_amount)}</td>
      <td style="text-align: left; color: #15803d;">${formatCurrency(p.paid_amount)}</td>
      <td style="text-align: left; color: ${Number(p.debt_amount) > 0 ? '#b91c1c' : '#475569'}; font-weight: bold;">
        ${formatCurrency(p.debt_amount)}
      </td>
      <td>${escapeHtml(p.notes || '—')}</td>
    </tr>
  `).join('');

  const paymentRows = payments.map((pay, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="text-align: center;">${escapeHtml(pay.payment_date)}</td>
      <td style="text-align: left; font-weight: bold; color: #15803d;">${formatCurrency(pay.amount)}</td>
      <td style="text-align: left;">${formatCurrency(pay.previous_balance)}</td>
      <td style="text-align: left; color: #b91c1c; font-weight: bold;">${formatCurrency(pay.new_balance)}</td>
      <td>${escapeHtml(pay.notes || pay.user_name || 'دانەوەی قەرز')}</td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 820px; border-radius: 12px; overflow: hidden;">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 16px 20px;">
        <h3 class="modal-title" style="color: #ffffff; margin: 0;">کشف حسابی دارایی: ${escapeHtml(supplier.name)}</h3>
        <button class="modal-close-btn" style="color: #cbd5e1; font-size: 24px; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px; max-height: 70vh; overflow-y: auto;">
        
        <!-- Summary Strip -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted);">کۆی گشتی کڕینەکان:</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--primary);">${formatCurrency(summary.total_purchases)}</div>
            <div style="font-size: 11px; color: #64748b;">${purchases.length} وەسڵی کڕین</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--text-muted);">کۆی گشتی دراو:</div>
            <div style="font-size: 18px; font-weight: 800; color: #16a34a;">${formatCurrency(summary.total_paid)}</div>
            <div style="font-size: 11px; color: #64748b;">کڕین + دانەوەی قەرز</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--text-muted);">قەرزی ماوە لەسەرمان:</div>
            <div style="font-size: 18px; font-weight: 800; color: ${summary.balance_debt > 0 ? '#dc2626' : '#16a34a'};">
              ${formatCurrency(summary.balance_debt)}
            </div>
            <div style="font-size: 11px; color: #64748b;">باڵانسی ئێستا</div>
          </div>
        </div>

        <h4 style="font-size: 14px; font-weight: 800; margin-bottom: 8px; color: #0f172a;">وەسڵەکانی کڕین (Purchases)</h4>
        <div class="table-responsive" style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 6px;">
          <table class="table" style="margin: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="width: 30px;">#</th>
                <th>ژمارەی وەسڵ</th>
                <th>بەروار</th>
                <th>کۆی وەسڵ</th>
                <th>دراو</th>
                <th>قەرز</th>
                <th>تێبینی</th>
              </tr>
            </thead>
            <tbody>
              ${purchaseRows || '<tr><td colspan="7" style="text-align: center; padding: 14px;">هیچ وەسڵێکی کڕین نییە</td></tr>'}
            </tbody>
          </table>
        </div>

        <h4 style="font-size: 14px; font-weight: 800; margin-bottom: 8px; color: #0f172a;">مێژووی دانەوەی قەرز (Payments)</h4>
        <div class="table-responsive" style="border: 1px solid #e2e8f0; border-radius: 6px;">
          <table class="table" style="margin: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="width: 30px;">#</th>
                <th>بەروار</th>
                <th>بڕی پارە</th>
                <th>قەرزی پێشوو</th>
                <th>قەرزی نوێ</th>
                <th>تێبینی / تۆمارکار</th>
              </tr>
            </thead>
            <tbody>
              ${paymentRows || '<tr><td colspan="6" style="text-align: center; padding: 14px;">هیچ پارەدانێک تۆمار نەکراوە</td></tr>'}
            </tbody>
          </table>
        </div>

      </div>
      <div class="modal-footer" style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
        <button class="btn btn-primary" id="btn-print-statement">🖨️ چاپی کشف حساب (A4 / PDF)</button>
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

  modal.querySelector('#btn-print-statement').addEventListener('click', () => {
    printSupplierStatement(res.data);
  });
}

async function openSupplierPaymentsModal(supplierId, supplierName) {
  const res = await api.get(`/suppliers/${supplierId}/payments`);
  if (!res.success || !res.data) {
    showToast('هەڵە لە وەرگرتنی مێژووی پارەدانەکان', 'error');
    return;
  }

  const payments = res.data;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const rows = payments.map((pay, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="text-align: center;">${escapeHtml(pay.payment_date)}</td>
      <td style="text-align: left; font-weight: bold; color: #15803d;">${formatCurrency(pay.amount)}</td>
      <td style="text-align: left;">${formatCurrency(pay.previous_balance)}</td>
      <td style="text-align: left; color: #b91c1c; font-weight: bold;">${formatCurrency(pay.new_balance)}</td>
      <td>${escapeHtml(pay.notes || '—')}</td>
      <td>${escapeHtml(pay.user_name || 'سەرپەرشتیار')}</td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 680px; border-radius: 12px; overflow: hidden;">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 14px 18px;">
        <h3 class="modal-title" style="color: #ffffff; margin: 0;">مێژووی پارەدانەکانی دابینکەر: ${escapeHtml(supplierName)}</h3>
        <button class="modal-close-btn" style="color: #cbd5e1; font-size: 22px; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 18px;">
        <div class="table-responsive" style="border: 1px solid #e2e8f0; border-radius: 6px;">
          <table class="table" style="margin: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="width: 30px;">#</th>
                <th>بەرواری پارەدان</th>
                <th>بڕی پارە</th>
                <th>قەرزی پێشوو</th>
                <th>قەرزی نوێ</th>
                <th>تێبینی</th>
                <th>تۆمارکار</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="7" style="text-align: center; padding: 16px;">هیچ پارەدانێکی قەرز تۆمار نەکراوە</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer" style="padding: 12px 18px; display: flex; justify-content: flex-end;">
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
}
