/**
 * Inventory / Stock Movements & Adjustment Module
 */
import { api, formatCurrency, showToast } from '../api.js';
import { isAdmin } from '../auth.js';

let currentPage = 1;
let currentTab = 'movements'; // 'movements' or 'batches'
let currentBatchesData = [];
let currentBatchesSummary = {};

export async function initInventoryPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const admin = isAdmin();

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">جووڵە و بەدواداچوونی مەخزەن (FIFO & Inventory)</h2>
        <div class="section-subtitle">تۆماری هەموو هاتن و چوونەکان، وەجبەکانی کڕین و بەهای خەمڵێنراوی مەخزەن بەپێی FIFO</div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" id="btn-print-inv-report">🖨️ چاپی ڕاپۆرتی مەخزەن (A4)</button>
        ${admin ? `<button class="btn btn-warning" id="btn-adjust-stock">⚙️ ڕێکخستنەوەی دەستی مەخزەن</button>` : ''}
        <button class="btn btn-secondary" id="btn-refresh-inv">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px;">
      <button class="btn ${currentTab === 'movements' ? 'btn-primary' : 'btn-secondary'}" id="tab-btn-movements">
        📋 مێژووی جووڵەکان (Movements)
      </button>
      <button class="btn ${currentTab === 'batches' ? 'btn-primary' : 'btn-secondary'}" id="tab-btn-batches">
        📦 وەجبەکانی بەردەست (FIFO Batches)
      </button>
    </div>

    <div id="inv-tab-content"></div>
  `;

  document.getElementById('btn-adjust-stock')?.addEventListener('click', () => openStockAdjustModal());
  document.getElementById('btn-print-inv-report')?.addEventListener('click', () => printInventoryReport());
  document.getElementById('btn-refresh-inv')?.addEventListener('click', () => {
    if (currentTab === 'movements') loadInventoryTable();
    else loadBatchesTable();
  });

  document.getElementById('tab-btn-movements')?.addEventListener('click', () => {
    currentTab = 'movements';
    document.getElementById('tab-btn-movements').className = 'btn btn-primary';
    document.getElementById('tab-btn-batches').className = 'btn btn-secondary';
    renderMovementsView();
  });

  document.getElementById('tab-btn-batches')?.addEventListener('click', () => {
    currentTab = 'batches';
    document.getElementById('tab-btn-batches').className = 'btn btn-primary';
    document.getElementById('tab-btn-movements').className = 'btn btn-secondary';
    renderBatchesView();
  });

  if (currentTab === 'movements') {
    renderMovementsView();
  } else {
    renderBatchesView();
  }
}

function renderMovementsView() {
  const content = document.getElementById('inv-tab-content');
  if (!content) return;

  content.innerHTML = `
    <!-- Filter Bar -->
    <div class="card" style="padding: 16px; margin-bottom: 16px;">
      <div class="form-row" style="align-items: center;">
        <div class="form-col">
          <select id="inv-filter-type" class="form-control">
            <option value="">-- هەموو جۆرەکانی جووڵە --</option>
            <option value="sale">فرۆشتن (چوونەدەرەوە)</option>
            <option value="purchase">کڕین (هاتنەژوورەوە)</option>
            <option value="return">گەڕانەوەی فرۆشراو</option>
            <option value="purchase_return">گەڕاندنەوە بۆ دابینکەر</option>
            <option value="stock_correction">ڕێکخستنەوەی دەستی</option>
            <option value="damage">تیاچوون / زەرەر</option>
          </select>
        </div>
        <div class="form-col">
          <input type="date" id="inv-from-date" class="form-control" />
        </div>
        <div class="form-col">
          <input type="date" id="inv-to-date" class="form-control" />
        </div>
        <div class="form-col" style="flex: 0 0 auto;">
          <button class="btn btn-secondary" id="btn-filter-inv">فلتەرکردن</button>
        </div>
      </div>
    </div>

    <!-- Movements Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>ناوی کاڵا</th>
              <th>مارکە / کۆد</th>
              <th>جۆری جووڵە</th>
              <th>گۆڕانکاری بڕ</th>
              <th>مەخزەنی دوای جووڵە</th>
              <th>بەکارهێنەر</th>
              <th>بەروار و کات</th>
              <th>تێبینی</th>
            </tr>
          </thead>
          <tbody id="inventory-table-body">
            <tr><td colspan="9" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="inv-pagination" style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-top: 1px solid var(--border-color);">
        <span id="inv-count-info" style="font-size: 13px; color: var(--text-muted);">...</span>
        <div style="display: flex; gap: 6px;" id="inv-page-btns"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-filter-inv')?.addEventListener('click', () => {
    currentPage = 1;
    loadInventoryTable();
  });

  loadInventoryTable();
}

async function renderBatchesView() {
  const content = document.getElementById('inv-tab-content');
  if (!content) return;

  content.innerHTML = `
    <!-- Valuation summary banner -->
    <div id="fifo-valuation-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px;">
      <div class="card" style="padding: 16px; border-left: 4px solid var(--primary);">
        <div style="font-size: 12px; color: var(--text-muted);">کۆی بەهای مەخزەن بەپێی FIFO:</div>
        <div id="val-fifo-total" style="font-size: 20px; font-weight: 800; color: var(--primary); margin-top: 4px;">...</div>
      </div>
      <div class="card" style="padding: 16px; border-left: 4px solid #10b981;">
        <div style="font-size: 12px; color: var(--text-muted);">کۆی گشتی دانە بەردەستەکان:</div>
        <div id="val-fifo-units" style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 4px;">...</div>
      </div>
      <div class="card" style="padding: 16px; border-left: 4px solid #6366f1;">
        <div style="font-size: 12px; color: var(--text-muted);">ژمارەی کاڵا وەجبەکراوەکان:</div>
        <div id="val-fifo-prods" style="font-size: 20px; font-weight: 800; color: #6366f1; margin-top: 4px;">...</div>
      </div>
    </div>

    <!-- Active Batches Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>ناوی کاڵا</th>
              <th>کۆدی پارچە</th>
              <th>کۆدی وەجبە</th>
              <th>جۆری وەجبە</th>
              <th>بەرواری کڕین</th>
              <th>تێچووی دانە (IQD)</th>
              <th>بڕی سەرەتا</th>
              <th>بڕی ماوە</th>
              <th>کۆی بەهای وەجبە (IQD)</th>
              <th>دابینکەر / پسووڵە</th>
            </tr>
          </thead>
          <tbody id="batches-table-body">
            <tr><td colspan="11" style="text-align:center; padding: 30px;">خەریکی بارکردنی وەجبەکانە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  loadBatchesTable();
}

async function loadBatchesTable() {
  const tbody = document.getElementById('batches-table-body');
  if (!tbody) return;

  const res = await api.get('/inventory/batches?limit=150');
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color: #dc2626;">هەڵە لە بارکردنی وەجبەکانی کۆگا</td></tr>`;
    return;
  }

  const batches = Array.isArray(res.data) ? res.data : (res.data?.batches || res.batches || []);
  const summary = res.summary || (res.data && res.data.summary) || {};
  currentBatchesData = batches;
  currentBatchesSummary = summary;

  const totalValEl = document.getElementById('val-fifo-total');
  const unitsEl = document.getElementById('val-fifo-units');
  const prodsEl = document.getElementById('val-fifo-prods');

  if (totalValEl) totalValEl.textContent = formatCurrency(summary.total_fifo_valuation || 0);
  if (unitsEl) unitsEl.textContent = (summary.total_fifo_units || 0) + ' دانە';
  if (prodsEl) prodsEl.textContent = (summary.total_batched_products || 0) + ' جۆر';

  if (batches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ وەجبەیەکی چالاک بەردەست نییە</td></tr>`;
    return;
  }

  tbody.innerHTML = batches
    .map((b, idx) => {
      const typeLabel =
        b.batch_type === 'PURCHASE'
          ? 'کڕین'
          : b.batch_type === 'OPENING_BALANCE'
          ? 'سەرەتایی'
          : b.batch_type === 'RETURN'
          ? 'گەڕاندنەوە'
          : 'دەستکاری';

      return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${b.product_name}</strong></td>
        <td><code>${b.part_number || '-'}</code></td>
        <td><code>${b.batch_number}</code></td>
        <td><span class="badge ${b.batch_type === 'PURCHASE' ? 'badge-primary' : 'badge-secondary'}">${typeLabel}</span></td>
        <td>${b.purchase_date || '-'}</td>
        <td style="color: var(--primary); font-weight: 700;">${formatCurrency(b.unit_cost)}</td>
        <td>${b.original_quantity}</td>
        <td><strong style="color: #059669; font-size: 14px;">${b.remaining_quantity}</strong></td>
        <td style="font-weight: 800; color: #1e293b;">${formatCurrency(b.total_batch_value)}</td>
        <td>${b.supplier_name || b.purchase_invoice_number || '-'}</td>
      </tr>
    `;
    })
    .join('');
}

async function loadInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const movementType = document.getElementById('inv-filter-type')?.value || '';
  const fromDate = document.getElementById('inv-from-date')?.value || '';
  const toDate = document.getElementById('inv-to-date')?.value || '';

  let url = `/inventory/movements?page=${currentPage}&limit=30`;
  if (movementType) url += `&movement_type=${movementType}`;
  if (fromDate) url += `&from_date=${fromDate}`;
  if (toDate) url += `&to_date=${toDate}`;

  const res = await api.get(url);
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: #dc2626;">هەڵە لە بارکردنی جووڵەی کۆگا</td></tr>`;
    return;
  }

  const movements = Array.isArray(res.data) ? res.data : (res.data?.movements || res.movements || []);

  if (movements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ جووڵەیەک نەدۆزرایەوە</td></tr>`;
    return;
  }

  const typeLabels = {
    sale: '<span class="badge badge-info">🛒 فرۆشتن</span>',
    purchase: '<span class="badge badge-success">📦 کڕین</span>',
    return: '<span class="badge badge-warning">↩️ گەڕانەوە</span>',
    stock_correction: '<span class="badge badge-secondary">⚙️ ڕێکخستنەوە</span>',
    manual_adjustment: '<span class="badge badge-secondary">⚙️ ڕێکخستنەوەی دەستی</span>',
    damage: '<span class="badge badge-danger">💥 تیاچوون / شکانی کاڵا</span>',
    correction: '<span class="badge badge-secondary">⚙️ هەڵەی ژماردن</span>',
    found: '<span class="badge badge-success">🔍 دۆزینەوە</span>',
    other: '<span class="badge badge-secondary">📝 تر</span>',
  };

  tbody.innerHTML = movements
    .map((m, idx) => {
      const isPositive = m.quantity_change > 0;
      return `
      <tr>
        <td>${(currentPage - 1) * 30 + idx + 1}</td>
        <td><strong>${m.product_name}</strong></td>
        <td><code>${m.part_number || m.truck_brand || '-'}</code></td>
        <td>${typeLabels[m.movement_type] || m.movement_type}</td>
        <td>
          <strong style="color: ${isPositive ? '#16a34a' : '#dc2626'}; direction: ltr; display: inline-block;">
            ${isPositive ? '+' : ''}${m.quantity_change}
          </strong>
        </td>
        <td><strong>${m.stock_after} دانە</strong></td>
        <td>${m.user_name || 'سەرپەرشتیار'}</td>
        <td>${m.created_at}</td>
        <td><span style="font-size: 12px; color: var(--text-muted);">${m.notes || '-'}</span></td>
      </tr>
    `;
    })
    .join('');

  // Pagination
  const countInfo = document.getElementById('inv-count-info');
  const paginationDiv = document.getElementById('inv-page-btns');
  if (res.pagination) {
    if (countInfo) {
      countInfo.textContent = `کۆی گشتی: ${res.pagination.total} جووڵە | پەڕەی ${res.pagination.page} لە ${res.pagination.totalPages || 1}`;
    }
    if (paginationDiv) {
      let btns = '';
      if (res.pagination.page > 1) {
        btns += `<button class="btn btn-sm btn-secondary btn-inv-prev">« پێشوو</button>`;
      }
      if (res.pagination.page < res.pagination.totalPages) {
        btns += `<button class="btn btn-sm btn-secondary btn-inv-next">دواتر »</button>`;
      }
      paginationDiv.innerHTML = btns;

      paginationDiv.querySelector('.btn-inv-prev')?.addEventListener('click', () => {
        currentPage--;
        loadInventoryTable();
      });
      paginationDiv.querySelector('.btn-inv-next')?.addEventListener('click', () => {
        currentPage++;
        loadInventoryTable();
      });
    }
  }
}

async function openStockAdjustModal() {
  const prodRes = await api.get('/products?limit=200');
  const products = Array.isArray(prodRes?.data) ? prodRes.data : (prodRes?.data?.products || prodRes?.products || []);

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 520px;">
      <div class="modal-header">
        <h3 class="modal-title">ڕێکخستنەوەی دەستی مەخزەن</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">کاڵا هەڵبژێرە *</label>
          <select id="adj-prod-select" class="form-control">
            <option value="">-- کاڵا هەڵبژێرە --</option>
            ${products
              .map(
                (p) =>
                  `<option value="${p.id}" data-qty="${p.quantity}">${p.name} ${p.part_number ? `[کۆد: ${p.part_number}]` : ''} [ئێستا: ${p.quantity} دانە]</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="form-col">
            <label class="form-label">بڕی ئێستا لە کۆگا</label>
            <input type="text" id="adj-current-qty" class="form-control" value="0" disabled />
          </div>
          <div class="form-col">
            <label class="form-label">ژمارەی نوێی دروست *</label>
            <input type="number" id="adj-new-qty" class="form-control" min="0" placeholder="0" required />
          </div>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label">هۆکاری گۆڕانکاری *</label>
          <select id="adj-reason" class="form-control">
            <option value="damage">تیاچوون / شکانی کاڵا</option>
            <option value="stock_correction">ژماردنەوەی دەستی مەخزەن</option>
            <option value="manual_adjustment">ڕێکخستنی دەستی</option>
            <option value="correction">هەڵەی ژماردن</option>
            <option value="found">دۆزینەوەی کاڵا</option>
            <option value="other">هۆکاری تر</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">تێبینی (ئارەزوومەندانە)</label>
          <input type="text" id="adj-notes" class="form-control" placeholder="تێبینی زیاتر..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary adj-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-warning" id="adj-submit-btn">✓ پاشەکەوتکردنی نوێکردنەوە</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.adj-cancel').addEventListener('click', closeModal);

  const prodSelect = modal.querySelector('#adj-prod-select');
  const curQtyInput = modal.querySelector('#adj-current-qty');
  const newQtyInput = modal.querySelector('#adj-new-qty');

  prodSelect.addEventListener('change', () => {
    const opt = prodSelect.selectedOptions[0];
    if (opt && opt.dataset.qty !== undefined) {
      curQtyInput.value = opt.dataset.qty;
      newQtyInput.value = opt.dataset.qty;
    } else {
      curQtyInput.value = '0';
      newQtyInput.value = '';
    }
  });

  modal.querySelector('#adj-submit-btn').addEventListener('click', async () => {
    const product_id = prodSelect.value;
    const newQtyVal = newQtyInput.value.trim();
    const reason = modal.querySelector('#adj-reason').value;
    const notes = modal.querySelector('#adj-notes').value.trim();

    if (!product_id) {
      showToast('تکایە کاڵا هەڵبژێرە', 'error');
      return;
    }

    if (newQtyVal === '') {
      showToast('تکایە ژمارەی نوێی کاڵا بنووسە', 'error');
      return;
    }

    const new_quantity = Number(newQtyVal);
    if (isNaN(new_quantity) || !Number.isInteger(new_quantity) || new_quantity < 0) {
      showToast('ژمارەی کاڵا نادروستە (دەبێت ژمارەیەکی ئەرێنی یان سفڕ بێت)', 'error');
      return;
    }

    const submitBtn = modal.querySelector('#adj-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'خەریکی پاشەکەوتکردنە...';

    try {
      const res = await api.post('/inventory/adjust', {
        product_id: Number(product_id),
        new_quantity: new_quantity,
        movement_type: reason,
        reason: reason,
        notes: notes,
      });

      if (res.success) {
        showToast(res.message || 'کۆگا بە سەرکەوتوویی نوێکرایەوە', 'success');
        closeModal();
        loadInventoryTable();
      } else {
        showToast(res.message || 'هەڵە لە ڕێکخستنی کۆگا', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '✓ پاشەکەوتکردنی نوێکردنەوە';
      }
    } catch (err) {
      showToast(err.message || 'هەڵەیەک لە پەیوەندی بە سێرڤەر ڕوویدا', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '✓ پاشەکەوتکردنی نوێکردنەوە';
    }
  });
}

async function printInventoryReport() {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  let batches = currentBatchesData;
  let summary = currentBatchesSummary;

  if (!batches || batches.length === 0) {
    const res = await api.get('/inventory/batches?limit=200');
    if (res.success && res.data) {
      batches = Array.isArray(res.data) ? res.data : (res.data?.batches || res.batches || []);
      summary = res.summary || (res.data && res.data.summary) || {};
    }
  }

  const rows = (batches || [])
    .map(
      (b, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-weight: bold;">${b.product_name}</td>
      <td style="direction: ltr; text-align: center; font-family: monospace;">${b.part_number || '-'}</td>
      <td style="direction: ltr; text-align: center; font-family: monospace; font-size: 11px;">${b.batch_number}</td>
      <td style="text-align: center;">${b.purchase_date || '-'}</td>
      <td style="text-align: left; font-weight: bold;">${formatCurrency(b.unit_cost)}</td>
      <td style="text-align: center;">${b.original_quantity}</td>
      <td style="text-align: center; font-weight: bold; color: #15803d;">${b.remaining_quantity}</td>
      <td style="text-align: left; font-weight: bold; color: #0284c7;">${formatCurrency(b.total_batch_value)}</td>
      <td>${b.supplier_name || b.purchase_invoice_number || '-'}</td>
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
          ڕاپۆرتی بەهای مەخزەن و وەجبەکانی کڕین (FIFO Inventory Valuation Report)
        </div>
      </div>

      <div class="rep-meta-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 14px;">
        <div><strong>بەرواری ڕاپۆرت:</strong> ${new Date().toISOString().split('T')[0]}</div>
        <div><strong>کۆی جۆری کاڵا:</strong> ${summary.total_batched_products || 0} جۆر</div>
        <div><strong>کۆی دانەکانی مەخزەن:</strong> ${summary.total_fifo_units || 0} دانە</div>
      </div>

      <table class="rep-summary-table" style="margin-bottom: 16px;">
        <thead>
          <tr>
            <th>ژمارەی وەجبە چالاکەکان</th>
            <th>کۆی گشتی دانە بەردەستەکان</th>
            <th>کۆی گشتی بەهای سەرمایەی مەخزەن (FIFO Valuation)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold; text-align: center;">${(batches || []).length} وەجبە</td>
            <td style="font-weight: bold; text-align: center; color: #15803d;">${summary.total_fifo_units || 0} دانە</td>
            <td style="font-size: 18px; font-weight: 900; color: #0284c7; text-align: center;">
              ${formatCurrency(summary.total_fifo_valuation || 0)}
            </td>
          </tr>
        </tbody>
      </table>

      <table class="rep-table" style="margin-bottom: 24px; font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th>ناوی کاڵا</th>
            <th>کۆدی پارچە</th>
            <th>کۆدی وەجبە</th>
            <th>بەرواری کڕین</th>
            <th>تێچووی دانە</th>
            <th>سەرەتا</th>
            <th>ماوە</th>
            <th>کۆی بەها</th>
            <th>دابینکەر / پسووڵە</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="10" style="text-align:center;">هیچ وەجبەیەکی چالاک بەردەست نییە</td></tr>'}
        </tbody>
      </table>

      <div class="rep-footer" style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 20px;">
        <div style="text-align: center;">
          <div>واژووی بەرپرسی کۆگا:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
        <div style="text-align: center;">
          <div>مۆر و پەسەندکردنی کارگێڕی:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 100);
}

