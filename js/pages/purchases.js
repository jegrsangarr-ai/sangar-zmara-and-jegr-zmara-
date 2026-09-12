/**
 * Purchases / Supplier Invoices Module
 * سەنگەر زمارەیی و جێگر زمارەیی - POS System
 * CRITICAL BUSINESS RULE: Purchase Receipts are strictly financial transactions
 * and completely separate from Inventory Management.
 */
import { api, formatCurrency, showToast, escapeHtml } from '../api.js';
import { printPurchaseInvoice } from '../receipt.js';

let purchaseItems = [];
let suppliersCache = [];
let productsCache = [];
let currentPurchasesList = [];

export async function initPurchasesPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">وەسڵی کڕینی کاڵا لە دابینکەران (Purchase Receipts)</h2>
        <div class="section-subtitle">تۆمارکردنی پسووڵەی کڕین، بەدواداچوونی پارەدان و قەرزی دابینکەر (سەربەخۆ لە کۆگا)</div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-primary" id="btn-new-purchase-modal">+ تۆمارکردنی وەسڵی نوێی کڕین</button>
        <button class="btn btn-secondary" id="btn-print-purchases-summary">🖨️ چاپی ڕاپۆرتی کڕینەکان (A4)</button>
        <button class="btn btn-secondary" id="btn-refresh-purchases">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="stat-grid" id="purchases-kpi-grid" style="margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
      <div class="stat-card" style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: var(--text-muted);">ژمارەی وەسڵەکان</div>
        <div style="font-size: 20px; font-weight: 800; color: #0f172a;" id="kpi-pur-count">0 وەسڵ</div>
      </div>
      <div class="stat-card" style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: var(--text-muted);">کۆی گشتی کڕینەکان</div>
        <div style="font-size: 20px; font-weight: 800; color: #0284c7;" id="kpi-pur-total">0 د.ع</div>
      </div>
      <div class="stat-card" style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: var(--text-muted);">کۆی پارەی دراو</div>
        <div style="font-size: 20px; font-weight: 800; color: #16a34a;" id="kpi-pur-paid">0 د.ع</div>
      </div>
      <div class="stat-card" style="background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: var(--text-muted);">قەرزی دروستبوو بۆ دابینکەران</div>
        <div style="font-size: 20px; font-weight: 800; color: #dc2626;" id="kpi-pur-debt">0 د.ع</div>
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <div class="form-row" style="align-items: flex-end; gap: 10px; margin: 0; flex-wrap: wrap;">
        <div class="form-col" style="flex: 1.5; min-width: 220px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700;">گەڕان لە وەسڵەکان:</label>
          <input type="text" id="pur-filter-search" class="form-control" placeholder="🔍 ژمارەی پسووڵە، دابینکەر، ناوی کاڵا یان کۆدی پارچە..." />
        </div>
        <div class="form-col" style="flex: 1; min-width: 160px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700;">فلتەری دابینکەر:</label>
          <select id="pur-filter-supplier" class="form-control">
            <option value="">-- هەموو دابینکەران --</option>
          </select>
        </div>
        <div class="form-col" style="flex: 0.9; min-width: 140px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700;">لە بەرواری:</label>
          <input type="date" id="pur-filter-from" class="form-control" />
        </div>
        <div class="form-col" style="flex: 0.9; min-width: 140px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700;">بۆ بەرواری:</label>
          <input type="date" id="pur-filter-to" class="form-control" />
        </div>
        <div class="form-col" style="flex: 0 0 auto; display: flex; gap: 6px;">
          <button class="btn btn-primary" id="btn-apply-pur-filter" style="height: 38px;">گەڕان</button>
          <button class="btn btn-secondary" id="btn-reset-pur-filter" style="height: 38px;">پاککردنەوە</button>
        </div>
      </div>
    </div>

    <!-- Purchases Invoices List -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>ژمارەی وەسڵ</th>
              <th>دابینکەر / کۆمپانیا</th>
              <th>بەرواری کڕین</th>
              <th>کۆی گشتی تێچوو</th>
              <th>پارەی دراو</th>
              <th>قەرز</th>
              <th>تۆمارکار</th>
              <th>کردار</th>
            </tr>
          </thead>
          <tbody id="purchases-table-body">
            <tr><td colspan="8" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-new-purchase-modal')?.addEventListener('click', () => openNewPurchaseModal());
  document.getElementById('btn-refresh-purchases')?.addEventListener('click', () => loadPurchasesTable());
  document.getElementById('btn-print-purchases-summary')?.addEventListener('click', () => printPurchasesSummaryReport(currentPurchasesList));

  document.getElementById('btn-apply-pur-filter')?.addEventListener('click', () => loadPurchasesTable());
  document.getElementById('btn-reset-pur-filter')?.addEventListener('click', () => {
    document.getElementById('pur-filter-search').value = '';
    document.getElementById('pur-filter-supplier').value = '';
    document.getElementById('pur-filter-from').value = '';
    document.getElementById('pur-filter-to').value = '';
    loadPurchasesTable();
  });

  const searchInput = document.getElementById('pur-filter-search');
  let searchTimeout = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadPurchasesTable(), 300);
  });

  await loadSuppliersFilter();
  await loadPurchasesTable();
}

async function loadSuppliersFilter() {
  const suppSelect = document.getElementById('pur-filter-supplier');
  if (!suppSelect) return;

  const res = await api.get('/suppliers');
  if (res.success && res.data) {
    suppliersCache = res.data;
    suppSelect.innerHTML = `<option value="">-- هەموو دابینکەران --</option>` +
      suppliersCache.map(s => `<option value="${s.id}">${escapeHtml(s.name)} ${s.company_name ? `(${escapeHtml(s.company_name)})` : ''}</option>`).join('');
  }
}

async function loadPurchasesTable() {
  const tbody = document.getElementById('purchases-table-body');
  if (!tbody) return;

  const search = document.getElementById('pur-filter-search')?.value.trim() || '';
  const supplier_id = document.getElementById('pur-filter-supplier')?.value || '';
  const from = document.getElementById('pur-filter-from')?.value || '';
  const to = document.getElementById('pur-filter-to')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (supplier_id) params.append('supplier_id', supplier_id);
  if (from) params.append('from', from);
  if (to) params.append('to', to);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const res = await api.get(`/purchases${queryString}`);

  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: #dc2626;">هەڵە لە بارکردنی وەسڵەکان</td></tr>`;
    return;
  }

  const purchases = Array.isArray(res.data) ? res.data : (res.data?.purchases || res.purchases || []);
  currentPurchasesList = purchases;

  // Update KPI Cards
  const totalCount = purchases.length;
  const totalAmount = purchases.reduce((acc, p) => acc + (Number(p.total_amount) || 0), 0);
  const totalPaid = purchases.reduce((acc, p) => acc + (Number(p.paid_amount) || 0), 0);
  const totalDebt = purchases.reduce((acc, p) => acc + (Number(p.debt_amount) || 0), 0);

  const kpiCount = document.getElementById('kpi-pur-count');
  const kpiTotal = document.getElementById('kpi-pur-total');
  const kpiPaid = document.getElementById('kpi-pur-paid');
  const kpiDebt = document.getElementById('kpi-pur-debt');

  if (kpiCount) kpiCount.textContent = `${totalCount} وەسڵ`;
  if (kpiTotal) kpiTotal.textContent = formatCurrency(totalAmount);
  if (kpiPaid) kpiPaid.textContent = formatCurrency(totalPaid);
  if (kpiDebt) kpiDebt.textContent = formatCurrency(totalDebt);

  if (purchases.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ وەسڵێکی کڕین نەدۆزرایەوە</td></tr>`;
    return;
  }

  tbody.innerHTML = purchases
    .map((p) => {
      return `
      <tr>
        <td><strong style="direction: ltr; font-family: monospace;">${escapeHtml(p.invoice_number)}</strong></td>
        <td><strong>${escapeHtml(p.supplier_name || 'دابینکەری گشتی')}</strong></td>
        <td>${escapeHtml(p.purchase_date)}</td>
        <td><strong style="color: var(--primary);">${formatCurrency(p.total_amount)}</strong></td>
        <td><span style="color: #16a34a; font-weight: bold;">${formatCurrency(p.paid_amount)}</span></td>
        <td>${p.debt_amount > 0 ? `<strong style="color: #dc2626;">${formatCurrency(p.debt_amount)}</strong>` : '<span style="color: #64748b;">-</span>'}</td>
        <td>${escapeHtml(p.user_name || 'سەرپەرشتیار')}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-sm btn-secondary btn-view-purchase" data-id="${p.id}" title="بینینی وردەکاری">👁️ وردەکاری</button>
            <button class="btn btn-sm btn-secondary btn-print-purchase-row" data-id="${p.id}" title="چاپکردنی وەسڵ">🖨️ چاپ</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  tbody.querySelectorAll('.btn-view-purchase').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pId = btn.dataset.id;
      const detRes = await api.get(`/purchases/${pId}`);
      if (detRes.success && detRes.data) {
        showPurchaseDetailModal(detRes.data);
      }
    });
  });

  tbody.querySelectorAll('.btn-print-purchase-row').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pId = btn.dataset.id;
      const detRes = await api.get(`/purchases/${pId}`);
      if (detRes.success && detRes.data) {
        printPurchaseInvoice(detRes.data);
      }
    });
  });
}

async function openNewPurchaseModal() {
  const [suppRes, prodRes] = await Promise.all([
    api.get('/suppliers'),
    api.get('/products/search?limit=150'),
  ]);

  suppliersCache = Array.isArray(suppRes?.data) ? suppRes.data : (suppRes?.data?.suppliers || suppRes?.suppliers || []);
  productsCache = Array.isArray(prodRes?.data) ? prodRes.data : (prodRes?.data?.products || prodRes?.products || []);
  purchaseItems = [];

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 920px; border-radius: 12px; overflow: hidden;">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 16px 20px;">
        <div>
          <h3 class="modal-title" style="margin: 0; font-size: 16px; color: #ffffff;">📥 تۆمارکردنی وەسڵی کڕین لە دابینکەر</h3>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">سەربەخۆ لە کۆگا — تەنها تۆماری فەرمی کڕین و قەرزی دابینکەر</div>
        </div>
        <button class="modal-close-btn" style="color: #94a3b8; font-size: 24px; line-height: 1; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        
        <!-- Separation Notice Banner -->
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #1e40af; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">ℹ️</span>
          <span><strong>تێبینی کارگێڕی:</strong> ئەم پسووڵەیە تەنها بۆ بەڵگەنامەی کڕین و بەدواداچوونی قەرزی دابینکەرە. کڕین کاریگەری لەسەر بڕی مەخزەن و کاڵاکان دروست ناکات (مەخزەن سەربەخۆ بەڕێوەدەبرێت).</span>
        </div>

        <!-- Header Info -->
        <div class="form-row" style="margin-bottom: 16px;">
          <div class="form-col" style="flex: 1.6;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">دابینکەر / کۆمپانیا *</label>
              <div style="display: flex; gap: 6px;">
                <select id="np-supplier" class="form-control" required style="flex: 1;">
                  <option value="">-- دابینکەر هەڵبژێرە --</option>
                  ${suppliersCache.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} ${s.company_name ? `(${escapeHtml(s.company_name)})` : ''} ${s.balance_debt > 0 ? `[قەرز: ${formatCurrency(s.balance_debt)}]` : ''}</option>`).join('')}
                </select>
                <button type="button" class="btn btn-sm btn-secondary" id="btn-quick-add-supplier" title="دابینکەری نوێ" style="white-space: nowrap;">+ دابینکەر</button>
              </div>
            </div>
          </div>
          <div class="form-col" style="flex: 1;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">ژمارەی پسووڵەی دابینکەر</label>
              <input type="text" id="np-inv-number" class="form-control" placeholder="بۆ نموونە: PUR-1002" />
            </div>
          </div>
          <div class="form-col" style="flex: 1;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">بەرواری کڕین</label>
              <input type="date" id="np-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
            </div>
          </div>
        </div>

        <!-- Add Items Row -->
        <div style="background: #f8fafc; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px;">
          <div style="font-weight: 800; color: #0f172a; font-size: 13px; margin-bottom: 10px;">
            📦 زیادکردنی بڕگەکانی وەسڵ (کاڵا و پارچەکان):
          </div>

          <div class="form-row" style="align-items: flex-end; gap: 8px; flex-wrap: wrap;">
            <div class="form-col" style="flex: 2; min-width: 180px;">
              <label class="form-label" style="font-size: 12px; font-weight: 700;">ناوی کاڵا / وەسف *</label>
              <input type="text" id="np-item-name" class="form-control" placeholder="ناوی کاڵا بنووسە یان لە خوارەوە هەڵبژێرە..." />
              <div style="margin-top: 4px;">
                <select id="np-item-preset" class="form-control" style="font-size: 11px; padding: 4px 8px; height: 28px; color: #475569;">
                  <option value="">-- یان هەڵبژاردنی کاڵای پێشینە بۆ پڕکردنەوەی خێرا --</option>
                  ${productsCache.map((p) => `<option value="${p.id}" data-name="${escapeHtml(p.name)}" data-part="${escapeHtml(p.part_number || '')}" data-cost="${p.purchase_price}">${escapeHtml(p.name)} [${escapeHtml(p.truck_brand || 'گشتی')}] ${p.part_number ? `(${escapeHtml(p.part_number)})` : ''}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-col" style="flex: 1.2; min-width: 120px;">
              <label class="form-label" style="font-size: 12px; font-weight: 700;">کۆدی پارچە (Part No)</label>
              <input type="text" id="np-item-part" class="form-control" placeholder="کۆد / ژمارەی پارچە" />
            </div>
            
            <div class="form-col" style="flex: 0.8; min-width: 80px;">
              <label class="form-label" style="font-size: 12px; font-weight: 700;">ژمارە (دانە) *</label>
              <input type="number" id="np-item-qty" class="form-control" value="1" min="1" />
            </div>

            <div class="form-col" style="flex: 1.2; min-width: 130px;">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #0f172a;">تێچووی کڕین (تاک) *</label>
              <input type="number" id="np-item-buy-price" class="form-control" value="0" min="0" style="font-weight: 700;" />
            </div>

            <div class="form-col" style="flex: 0 0 auto; align-self: flex-end;">
              <button type="button" class="btn btn-success" id="btn-add-p-item" style="padding: 8px 16px; font-weight: 700; height: 38px;">+ زیادکردن</button>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div class="table-responsive" style="margin-bottom: 16px; max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
          <table class="table" style="margin: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>#</th>
                <th>ناوی کاڵا</th>
                <th>کۆدی پارچە</th>
                <th>ژمارە</th>
                <th>تێچووی کڕینی تاک</th>
                <th>کۆی تێچوو</th>
                <th>سڕینەوە</th>
              </tr>
            </thead>
            <tbody id="np-items-body">
              <tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 20px;">هیچ کاڵایەک زیاد نەکراوە</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Payment & Total -->
        <div class="form-row" style="background: #f8fafc; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; align-items: center; margin-bottom: 12px;">
          <div class="form-col" style="flex: 1.2;">
            <div style="font-size: 12px; color: #64748b;">کۆی گشتی تێچووی وەسڵ:</div>
            <div style="font-size: 20px; font-weight: 900; color: var(--primary);" id="np-total-cost">0 د.ع</div>
          </div>
          <div class="form-col" style="flex: 1.2;">
            <label class="form-label" style="font-weight: 700; font-size: 13px;">پارەی دراو بە نەقد (لە قاسە)</label>
            <input type="number" id="np-paid-amount" class="form-control" value="0" min="0" style="font-weight: 700; font-size: 15px;" />
          </div>
          <div class="form-col" style="flex: 1.2;">
            <div style="font-size: 12px; color: #dc2626;">قەرزی ماوە بۆ دابینکەر:</div>
            <div style="font-size: 20px; font-weight: 800; color: #dc2626;" id="np-debt-amount">0 د.ع</div>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 12px;">تێبینی دەربارەی وەسڵی کڕین:</label>
          <input type="text" id="np-notes" class="form-control" placeholder="تێبینی، شێوازی بارکردن، ژمارەی بارنامە..." />
        </div>

      </div>
      <div class="modal-footer" style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
        <button class="btn btn-secondary np-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="np-submit-btn" style="font-weight: 800; font-size: 14px; padding: 10px 24px;">
          ✓ پاشەکەوتکردن و تۆمارکردنی وەسڵی کڕین
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.np-cancel').addEventListener('click', closeModal);

  const itemNameInput = modal.querySelector('#np-item-name');
  const itemPartInput = modal.querySelector('#np-item-part');
  const presetSelect = modal.querySelector('#np-item-preset');
  const buyPriceInput = modal.querySelector('#np-item-buy-price');
  const qtyInput = modal.querySelector('#np-item-qty');
  const paidInput = modal.querySelector('#np-paid-amount');
  let selectedProductId = null;

  presetSelect.addEventListener('change', () => {
    const opt = presetSelect.selectedOptions[0];
    if (opt && opt.value) {
      selectedProductId = Number(opt.value);
      itemNameInput.value = opt.dataset.name || '';
      itemPartInput.value = opt.dataset.part || '';
      buyPriceInput.value = opt.dataset.cost || '0';
    } else {
      selectedProductId = null;
    }
  });

  // Quick Supplier Add
  modal.querySelector('#btn-quick-add-supplier').addEventListener('click', () => {
    openInlineSupplierModal((newSupp) => {
      suppliersCache.unshift(newSupp);
      const suppSelect = modal.querySelector('#np-supplier');
      const opt = document.createElement('option');
      opt.value = newSupp.id;
      opt.textContent = `${newSupp.name} ${newSupp.phone ? `(${newSupp.phone})` : ''}`;
      opt.selected = true;
      suppSelect.insertBefore(opt, suppSelect.options[1]);
      showToast(`دابینکەر "${newSupp.name}" بە سەرکەوتوویی زیادکرا`, 'success');
    });
  });

  modal.querySelector('#btn-add-p-item').addEventListener('click', () => {
    const name = itemNameInput.value.trim();
    const partNo = itemPartInput.value.trim();
    const qty = Number(qtyInput.value);
    const buyPrice = Number(buyPriceInput.value);

    if (!name || qty <= 0 || buyPrice < 0) {
      showToast('تکایە ناوی کاڵا، ژمارە و تێچووی کڕین بە دروستی بنووسە', 'error');
      return;
    }

    purchaseItems.push({
      product_id: selectedProductId || null,
      item_name: name,
      part_number: partNo,
      quantity: qty,
      purchase_price: buyPrice,
    });

    renderPurchaseItemsList(modal);
    itemNameInput.value = '';
    itemPartInput.value = '';
    qtyInput.value = '1';
    buyPriceInput.value = '0';
    presetSelect.value = '';
    selectedProductId = null;
  });

  paidInput.addEventListener('input', () => {
    updatePurchaseTotals(modal);
  });

  modal.querySelector('#np-submit-btn').addEventListener('click', async () => {
    const supplier_id = modal.querySelector('#np-supplier').value;
    const invoice_number = modal.querySelector('#np-inv-number').value.trim();
    const purchase_date = modal.querySelector('#np-date').value;
    const paid_amount = Number(paidInput.value);
    const notes = modal.querySelector('#np-notes').value.trim();

    if (!supplier_id) {
      showToast('تکایە دابینکەر هەڵبژێرە', 'error');
      return;
    }

    if (purchaseItems.length === 0) {
      showToast('هیچ کاڵایەک بۆ وەسڵەکە زیاد نەکراوە', 'error');
      return;
    }

    const payload = {
      supplier_id: Number(supplier_id),
      invoice_number: invoice_number || null,
      purchase_date,
      paid_amount,
      notes,
      items: purchaseItems,
    };

    const res = await api.post('/purchases', payload);
    if (res.success) {
      showToast('وەسڵی کڕین بە سەرکەوتوویی تۆمارکرا و حسابی دابینکەر نوێکرایەوە ✓', 'success');
      closeModal();
      loadPurchasesTable();
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی وەسڵی کڕین', 'error');
    }
  });
}

function renderPurchaseItemsList(modal) {
  const tbody = modal.querySelector('#np-items-body');
  if (purchaseItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 20px;">هیچ کاڵایەک زیاد نەکراوە</td></tr>`;
    updatePurchaseTotals(modal);
    return;
  }

  tbody.innerHTML = purchaseItems
    .map(
      (it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(it.item_name)}</strong></td>
      <td style="font-family: monospace;" dir="ltr">${escapeHtml(it.part_number || '—')}</td>
      <td>${it.quantity}</td>
      <td>${formatCurrency(it.purchase_price)}</td>
      <td><strong>${formatCurrency(it.quantity * it.purchase_price)}</strong></td>
      <td>
        <button type="button" class="btn-cart-del btn-del-p-item" data-idx="${idx}" title="سڕینەوە">✕</button>
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('.btn-del-p-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      purchaseItems.splice(idx, 1);
      renderPurchaseItemsList(modal);
    });
  });

  updatePurchaseTotals(modal);
}

function updatePurchaseTotals(modal) {
  const total = purchaseItems.reduce((sum, it) => sum + it.quantity * it.purchase_price, 0);
  const paidInput = modal.querySelector('#np-paid-amount');
  const paid = Number(paidInput?.value || 0);

  const totalEl = modal.querySelector('#np-total-cost');
  const debtEl = modal.querySelector('#np-debt-amount');

  if (totalEl) totalEl.textContent = formatCurrency(total);
  const debt = Math.max(0, total - paid);
  if (debtEl) debtEl.textContent = formatCurrency(debt);
}

function openInlineSupplierModal(onCreated) {
  const subModal = document.createElement('div');
  subModal.className = 'modal-backdrop show';
  subModal.style.zIndex = '1050';

  subModal.innerHTML = `
    <div class="modal-box" style="max-width: 480px; border-radius: 12px;">
      <div class="modal-header" style="background: #1e293b; color: #ffffff; padding: 14px 18px;">
        <h3 class="modal-title" style="margin: 0; font-size: 15px; color: #ffffff;">🏢 زیادکردنی دابینکەری نوێ</h3>
        <button class="modal-close-btn" style="color: #94a3b8; font-size: 22px; line-height: 1; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 18px;">
        <div class="form-group">
          <label class="form-label">ناوی دابینکەر / کۆمپانیا *</label>
          <input type="text" id="ins-name" class="form-control" placeholder="ناوی دابینکەر" required />
        </div>
        <div class="form-group">
          <label class="form-label">کۆمپانیا</label>
          <input type="text" id="ins-company" class="form-control" placeholder="ناوی کۆمپانیا" />
        </div>
        <div class="form-group">
          <label class="form-label">ژمارەی مۆبایل</label>
          <input type="text" id="ins-phone" class="form-control" placeholder="0750xxxxxxx" />
        </div>
      </div>
      <div class="modal-footer" style="padding: 12px 18px; display: flex; justify-content: space-between;">
        <button class="btn btn-secondary sub-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="btn-save-inline-supp">✓ پاشەکەوتکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(subModal);

  const closeSub = () => {
    subModal.classList.remove('show');
    setTimeout(() => subModal.remove(), 200);
  };

  subModal.querySelector('.modal-close-btn').addEventListener('click', closeSub);
  subModal.querySelector('.sub-cancel').addEventListener('click', closeSub);

  subModal.querySelector('#btn-save-inline-supp').addEventListener('click', async () => {
    const name = subModal.querySelector('#ins-name').value.trim();
    const company_name = subModal.querySelector('#ins-company').value.trim();
    const phone = subModal.querySelector('#ins-phone').value.trim();

    if (!name) {
      showToast('تکایە ناوی دابینکەر بنووسە', 'error');
      return;
    }

    const res = await api.post('/suppliers', { name, company_name, phone });
    if (res.success && res.data) {
      const created = { id: res.data.id, name, company_name, phone, balance_debt: 0 };
      closeSub();
      if (typeof onCreated === 'function') {
        onCreated(created);
      }
    } else {
      showToast(res.message || 'هەڵە لە زیادکردنی دابینکەر', 'error');
    }
  });
}

function showPurchaseDetailModal(purchase) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const itemsRows = (purchase.items || [])
    .map(
      (it, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td>
        <strong>${escapeHtml(it.product_name)}</strong>
      </td>
      <td style="font-family: monospace;" dir="ltr">${escapeHtml(it.part_number || '—')}</td>
      <td style="text-align: center;">${it.quantity}</td>
      <td>${formatCurrency(it.purchase_price)}</td>
      <td><strong>${formatCurrency(it.total_price)}</strong></td>
    </tr>
  `
    )
    .join('');

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 760px; border-radius: 12px; overflow: hidden;">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 16px 20px;">
        <h3 class="modal-title" style="color: #ffffff; margin: 0;">وەسڵی کڕین: ${escapeHtml(purchase.invoice_number)}</h3>
        <button class="modal-close-btn" style="color: #cbd5e1; font-size: 24px; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div><strong>دابینکەر:</strong> ${escapeHtml(purchase.supplier_name || 'دابینکەری گشتی')}</div>
          <div><strong>بەرواری کڕین:</strong> ${escapeHtml(purchase.purchase_date)}</div>
          <div><strong>مۆبایلی دابینکەر:</strong> <span dir="ltr">${escapeHtml(purchase.supplier_phone || '—')}</span></div>
          <div><strong>تۆمارکار:</strong> ${escapeHtml(purchase.user_name || 'سەرپەرشتیار')}</div>
          <div><strong>کۆی گشتی وەسڵ:</strong> <strong style="color: var(--primary);">${formatCurrency(purchase.total_amount)}</strong></div>
          <div><strong>پارەی دراو:</strong> <span style="color: #16a34a; font-weight: bold;">${formatCurrency(purchase.paid_amount)}</span></div>
          <div><strong>قەرزی ماوەی وەسڵ:</strong> <span style="color: #dc2626; font-weight: bold;">${formatCurrency(purchase.debt_amount)}</span></div>
          ${purchase.notes ? `<div style="grid-column: span 2;"><strong>تێبینی:</strong> ${escapeHtml(purchase.notes)}</div>` : ''}
        </div>

        <div class="table-responsive" style="border: 1px solid #e2e8f0; border-radius: 6px;">
          <table class="table" style="margin: 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="width: 30px;">#</th>
                <th>ناوی کاڵا</th>
                <th>کۆدی پارچە</th>
                <th style="text-align: center;">ژمارە</th>
                <th>نرخی تێچووی تاک</th>
                <th>کۆی گشتی</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || '<tr><td colspan="6" style="text-align: center; padding: 16px;">هیچ کاڵایەک تۆمار نەکراوە</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer" style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" id="btn-print-this-purchase">🖨️ چاپی وەسڵ (A4 / PDF)</button>
        </div>
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

  modal.querySelector('#btn-print-this-purchase').addEventListener('click', () => {
    printPurchaseInvoice(purchase);
  });
}

function printPurchasesSummaryReport(purchases = []) {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const totalSpent = purchases.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
  const totalPaid = purchases.reduce((s, p) => s + (Number(p.paid_amount) || 0), 0);
  const totalDebt = purchases.reduce((s, p) => s + (Number(p.debt_amount) || 0), 0);

  const rows = purchases
    .map(
      (p, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-family: monospace; font-weight: bold;" dir="ltr">${escapeHtml(p.invoice_number)}</td>
      <td>${escapeHtml(p.supplier_name || 'دابینکەری گشتی')}</td>
      <td style="text-align: center;">${escapeHtml(p.purchase_date)}</td>
      <td style="text-align: left; font-weight: bold;">${formatCurrency(p.total_amount)}</td>
      <td style="text-align: left; color: #15803d;">${formatCurrency(p.paid_amount)}</td>
      <td style="text-align: left; color: #b91c1c; font-weight: bold;">${formatCurrency(p.debt_amount)}</td>
      <td>${escapeHtml(p.user_name || 'سەرپەرشتیار')}</td>
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
          ڕاپۆرتی گشتی وەسڵەکانی کڕین (Purchase Invoices Report)
        </div>
      </div>

      <table class="rep-summary-table" style="margin-bottom: 16px;">
        <thead>
          <tr>
            <th>کۆی پسووڵەکان</th>
            <th>کۆی گشتی تێچووی کڕین</th>
            <th>کۆی پارەی دراو</th>
            <th>کۆی قەرزی ماوە لەسەرمان</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold; text-align: center;">${purchases.length} پسووڵە</td>
            <td style="font-weight: bold; color: #0284c7;">${formatCurrency(totalSpent)}</td>
            <td style="font-weight: bold; color: #15803d;">${formatCurrency(totalPaid)}</td>
            <td style="font-size: 16px; font-weight: 900; color: ${totalDebt > 0 ? '#b91c1c' : '#15803d'};">
              ${formatCurrency(totalDebt)}
            </td>
          </tr>
        </tbody>
      </table>

      <table class="rep-table" style="margin-bottom: 24px; font-size: 12px;">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>ژمارەی وەسڵ</th>
            <th>دابینکەر / کۆمپانیا</th>
            <th>بەروار</th>
            <th>کۆی تێچوو</th>
            <th>دراو</th>
            <th>قەرز</th>
            <th>تۆمارکار</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="8" style="text-align:center;">هیچ وەسڵێکی کڕین نەدۆزرایەوە</td></tr>'}
        </tbody>
      </table>

      <div class="rep-footer" style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 20px;">
        <div style="text-align: center;">
          <div>واژووی سەرپەرشتیاری کڕین:</div>
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
