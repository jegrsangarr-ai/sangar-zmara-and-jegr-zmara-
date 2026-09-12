/**
 * Cash Register & Drawer Management Module (سندووق و قاسەی نەقد)
 * Business: سەنگەر زمارەیی و جێگر زمارەیی
 */
import { api, formatCurrency, getErbilToday, getErbilTimeString, showToast } from '../api.js';
import { isAdmin, getUser } from '../auth.js';

let currentSummary = null;
let currentSession = null;
let currentTransactions = [];

export async function initCashRegisterPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const today = getErbilToday();

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">قاسە و سندووقی پارەی نەقد (Cash Register)</h2>
        <div class="section-subtitle">بەڕێوەبردنی شیفتی سندووق، ئەژمارکردنی پارەی فیزیکی، تۆماری تەواوی جووڵەکانی پارەی نەقد</div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${isAdmin() ? `<button class="btn btn-warning" id="btn-sync-legacy-cash" title="هاوکاتکردنی هەموو مامەڵە کۆنەکان لەگەڵ قاسە">🔄 هاوکاتکردنی مامەڵە کۆنەکان</button>` : ''}
        <button class="btn btn-secondary" id="btn-pdf-cash-sheet" title="پاشەکەوتکردنی پسووڵەی سندووق بە PDF">📥 پاشەکەوتکردن بە PDF</button>
        <button class="btn btn-secondary" id="btn-print-cash-sheet">🖨️ چاپی پسووڵەی سندووق</button>
        <button class="btn btn-secondary" id="btn-refresh-cash">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Active Session Banner / Drawer Controls -->
    <div id="cash-session-banner" class="card" style="margin-bottom: 20px; border-right: 5px solid #2563eb; padding: 18px 20px; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div id="session-status-icon" style="width: 46px; height: 46px; border-radius: 12px; background: #dbeafe; color: #1e40af; display: flex; align-items: center; justify-content: center; font-size: 22px;">
            💼
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 16px; font-weight: 800; color: #0f172a;" id="session-title">دۆخی سندووق: خەریکی پشکنینە...</span>
              <span id="session-badge" class="badge badge-info" style="font-size: 12px;">پشکنین</span>
            </div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;" id="session-details">
              بارکردنی زانیارییەکانی شیفت...
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="session-action-buttons">
          <!-- Populated dynamically -->
        </div>
      </div>
    </div>

    <!-- Real-time Cash Metric Cards -->
    <div class="stat-grid" style="margin-bottom: 20px;">
      <!-- Total Live Cash -->
      <div class="stat-card" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; border: none;">
        <div class="stat-icon" style="background: rgba(255,255,255,0.15); color: #38bdf8;">💵</div>
        <div class="stat-content">
          <div class="stat-label" style="color: #94a3b8; font-weight: 700;">کۆی پارەی نەقدی ناو قاسە (لەم ساتەدا)</div>
          <div class="stat-value" id="stat-live-balance" style="color: #38bdf8; font-size: 26px; font-weight: 900;">0 د.ع</div>
          <div class="stat-sub" id="stat-active-session-sub" style="color: #cbd5e1;">بڕی سەرەتایی شیفت: 0 د.ع</div>
        </div>
      </div>

      <!-- Today's Cash Inflow -->
      <div class="stat-card" style="border-top: 4px solid #16a34a;">
        <div class="stat-icon green">📥</div>
        <div class="stat-content">
          <div class="stat-label">کۆی پارەی هاتووی نەقد (ئەمڕۆ)</div>
          <div class="stat-value" id="stat-today-in" style="color: #16a34a; font-weight: 900;">0 د.ع</div>
          <div class="stat-sub" id="stat-in-breakdown">فرۆشتن + وەرگرتنەوەی قەرز + تێکردن</div>
        </div>
      </div>

      <!-- Today's Cash Outflow -->
      <div class="stat-card" style="border-top: 4px solid #dc2626;">
        <div class="stat-icon red">📤</div>
        <div class="stat-content">
          <div class="stat-label">کۆی پارەی دەرچووی نەقد (ئەمڕۆ)</div>
          <div class="stat-value" id="stat-today-out" style="color: #dc2626; font-weight: 900;">0 د.ع</div>
          <div class="stat-sub" id="stat-out-breakdown">کڕین + دانەوەی قەرز + خەرجی + گەڕاوە</div>
        </div>
      </div>

      <!-- Net Cash Movement -->
      <div class="stat-card" style="border-top: 4px solid #8b5cf6;">
        <div class="stat-icon purple">⚖️</div>
        <div class="stat-content">
          <div class="stat-label">جووڵەی خاوێنی سندووق (ئەمڕۆ)</div>
          <div class="stat-value" id="stat-today-net" style="color: #8b5cf6; font-weight: 900;">0 د.ع</div>
          <div class="stat-sub">جیاوازی هاتوو و دەرچووی نەقد</div>
        </div>
      </div>
    </div>

    <!-- Detailed Inflow / Outflow Breakdown -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
      <!-- Inflows Card -->
      <div class="card" style="padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #16a34a; display: flex; align-items: center; gap: 6px;">
          <span>📥</span> وردەکاری پارەی هاتووی سندووق (ئەمڕۆ)
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; font-size: 13px;">
            <span>🛒 فرۆشتنی دەستبەجێ (نەقد):</span>
            <strong id="bk-sales-cash" style="color: #16a34a;">0 د.ع</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; font-size: 13px;">
            <span>📋 وەرگرتنەوەی قەرزی کڕیاران و کۆمپانیاکان (نەقد):</span>
            <strong id="bk-debt-cash" style="color: #16a34a;">0 د.ع</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; font-size: 13px;">
            <span>💵 تێکردنی پارە بە دەست (Manual Deposit):</span>
            <strong id="bk-manual-in" style="color: #16a34a;">0 د.ع</strong>
          </div>
        </div>
      </div>

      <!-- Outflows Card -->
      <div class="card" style="padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #dc2626; display: flex; align-items: center; gap: 6px;">
          <span>📤</span> وردەکاری پارەی دەرچووی سندووق (ئەمڕۆ)
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #fef2f2; border-radius: 6px; font-size: 13px;">
            <span>📦 کڕینی کاڵا لە دابینکەران (نەقد):</span>
            <strong id="bk-purchases-cash" style="color: #dc2626;">0 د.ع</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #fef2f2; border-radius: 6px; font-size: 13px;">
            <span>🏢 دانەوەی قەرزی دابینکەران (نەقد):</span>
            <strong id="bk-supplier-debt-cash" style="color: #dc2626;">0 د.ع</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #fef2f2; border-radius: 6px; font-size: 13px;">
            <span>💸 خەرجییە گشتییەکان (نەقد):</span>
            <strong id="bk-expenses-cash" style="color: #dc2626;">0 د.ع</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #fef2f2; border-radius: 6px; font-size: 13px;">
            <span>🔄 گەڕانەوەی کاڵا بە نەقد (Refund):</span>
            <strong id="bk-returns-cash" style="color: #dc2626;">0 د.ع</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #fef2f2; border-radius: 6px; font-size: 13px;">
            <span>📤 ڕاکێشانی پارە بە دەست (Manual Withdrawal):</span>
            <strong id="bk-manual-out" style="color: #dc2626;">0 د.ع</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter & Search Bar for Ledger -->
    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <div class="form-row" style="align-items: center; gap: 12px; flex-wrap: wrap;">
        <div class="form-col" style="flex: 2; min-width: 220px;">
          <input type="text" id="cash-search-input" class="form-control" placeholder="🔍 گەڕان بەپێی تێبینی، ژمارەی پسووڵە، ناوی کڕیار یان دابینکەر..." />
        </div>
        <div class="form-col" style="flex: 1; min-width: 160px;">
          <select id="cash-type-filter" class="form-control">
            <option value="">-- هەموو جۆرەکانی جووڵە --</option>
            <option value="in">تەنها پارەی هاتوو (Inflows)</option>
            <option value="out">تەنها پارەی دەرچوو (Outflows)</option>
            <option value="sale">فرۆشتنی نەقد</option>
            <option value="customer_debt_payment">وەرگرتنەوەی قەرز</option>
            <option value="purchase">کڕینی کاڵا</option>
            <option value="supplier_debt_payment">دانەوەی قەرزی دابینکەر</option>
            <option value="expense">خەرجی</option>
            <option value="sale_return">گەڕانەوەی کاڵا</option>
            <option value="manual_deposit">تێکردنی دەستی</option>
            <option value="manual_withdrawal">ڕاکێشانی دەستی</option>
          </select>
        </div>
        <div class="form-col" style="flex: 0 0 160px;">
          <input type="date" id="cash-date-filter" class="form-control" value="${today}" />
        </div>
        <div class="form-col" style="flex: 0 0 auto;">
          <button class="btn btn-secondary" id="btn-reset-filters">پاککردنەوەی فلتەر</button>
        </div>
      </div>
    </div>

    <!-- Cash Transactions Ledger Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="card-header" style="background: #f8fafc; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <h3 class="card-title" style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">
          📜 تۆماری جووڵەکانی قاسە و سندووق (Audit Trail)
        </h3>
        <span class="badge badge-secondary" id="ledger-count-badge" style="font-size: 12px;">0 تۆمار</span>
      </div>
      <div class="table-responsive">
        <table class="table" style="margin: 0;">
          <thead>
            <tr>
              <th>#</th>
              <th>کات و بەروار</th>
              <th>جۆری جووڵە</th>
              <th>بڕی پارە</th>
              <th>باڵانسی پێشتر</th>
              <th>باڵانسی دواتر</th>
              <th>سەرچاوە / پسووڵە</th>
              <th>تێبینی</th>
              <th>بەکارهێنەر</th>
            </tr>
          </thead>
          <tbody id="cash-ledger-tbody">
            <tr><td colspan="9" style="text-align:center; padding: 30px;">خەریکی بارکردنی تۆماری قاسەیە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach Top Events
  document.getElementById('btn-refresh-cash')?.addEventListener('click', () => loadCashData());
  document.getElementById('btn-print-cash-sheet')?.addEventListener('click', () => printDailyCashSheet());
  document.getElementById('btn-pdf-cash-sheet')?.addEventListener('click', () => printDailyCashSheet());
  document.getElementById('btn-sync-legacy-cash')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-legacy-cash');
    if (btn) btn.disabled = true;
    try {
      showToast('خەریکی هاوکاتکردنی مامەڵە کۆنەکان لەگەڵ قاسەیە...', 'info');
      const res = await api.post('/cash-register/backfill');
      if (res.success) {
        showToast(res.message || 'هاوکاتکردنی قاسە بە سەرکەوتوویی ئەنجامدرا ✓', 'success');
        await loadCashData();
      } else {
        showToast(res.message || 'هەڵە لە هاوکاتکردنی مامەڵەکان', 'error');
      }
    } catch (err) {
      showToast('هەڵە لە پەیوەندی بە سێرڤەر', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
    const sInput = document.getElementById('cash-search-input');
    const tSelect = document.getElementById('cash-type-filter');
    const dInput = document.getElementById('cash-date-filter');
    if (sInput) sInput.value = '';
    if (tSelect) tSelect.value = '';
    if (dInput) dInput.value = '';
    loadTransactions();
  });

  const searchInput = document.getElementById('cash-search-input');
  let searchTimeout = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadTransactions(), 300);
  });

  document.getElementById('cash-type-filter')?.addEventListener('change', () => loadTransactions());
  document.getElementById('cash-date-filter')?.addEventListener('change', () => loadTransactions());

  await loadCashData();
}

export async function loadCashData() {
  await Promise.all([loadCashSummary(), loadActiveSession(), loadTransactions()]);
}

async function loadCashSummary() {
  try {
    const res = await api.get('/cash-register/summary');
    if (!res.success || !res.data) {
      showToast(res.message || 'هەڵە لە بارکردنی زانیارییەکانی قاسە', 'error');
      return;
    }

    currentSummary = res.data;
    const s = currentSummary;

    const liveEl = document.getElementById('stat-live-balance');
    const todayInEl = document.getElementById('stat-today-in');
    const todayOutEl = document.getElementById('stat-today-out');
    const todayNetEl = document.getElementById('stat-today-net');

    const liveBal = s.current_cash_balance !== undefined ? s.current_cash_balance : (s.currentBalance || 0);
    const inBal = s.today_inflows !== undefined ? s.today_inflows : (s.cashIn || 0);
    const outBal = s.today_outflows !== undefined ? s.today_outflows : (s.cashOut || 0);
    const netBal = s.today_net_movement !== undefined ? s.today_net_movement : (s.todayNet || (inBal - outBal));

    if (liveEl) liveEl.textContent = formatCurrency(liveBal);
    if (todayInEl) todayInEl.textContent = formatCurrency(inBal);
    if (todayOutEl) todayOutEl.textContent = formatCurrency(outBal);
    if (todayNetEl) {
      todayNetEl.textContent = (netBal >= 0 ? '+' : '') + formatCurrency(netBal);
      todayNetEl.style.color = netBal >= 0 ? '#16a34a' : '#dc2626';
    }

    // Breakdown values
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatCurrency(val || 0);
    };

    const b = s.breakdown || {};
    setEl('bk-sales-cash', b.sales_cash || s.todaySalesCash || 0);
    setEl('bk-debt-cash', b.debt_payments_cash || s.todayDebtCollected || 0);
    setEl('bk-manual-in', b.manual_deposits || s.todayDeposits || 0);
    setEl('bk-purchases-cash', b.purchases_cash || s.todayPurchasesPaid || 0);
    setEl('bk-supplier-debt-cash', b.supplier_debt_cash || s.todaySupplierPaid || 0);
    setEl('bk-expenses-cash', b.expenses_cash || s.todayExpenses || 0);
    setEl('bk-returns-cash', b.sale_returns_cash || s.todayRefunds || 0);
    setEl('bk-manual-out', b.manual_withdrawals || s.todayWithdrawals || 0);
  } catch (err) {
    console.error('loadCashSummary error:', err);
    showToast('هەڵە لە پەیوەندی بە سێرڤەر بۆ وەرگرتنی باڵانسی قاسە', 'error');
  }
}

async function loadActiveSession() {
  const banner = document.getElementById('cash-session-banner');
  const iconEl = document.getElementById('session-status-icon');
  const titleEl = document.getElementById('session-title');
  const badgeEl = document.getElementById('session-badge');
  const detailsEl = document.getElementById('session-details');
  const actionsEl = document.getElementById('session-action-buttons');
  const activeSubEl = document.getElementById('stat-active-session-sub');

  if (!banner || !actionsEl) return;

  const res = await api.get('/cash-register/sessions/current');
  currentSession = (res.success && res.data) ? res.data : (currentSummary?.activeSession || currentSummary?.active_session || null);

  if (currentSession) {
    banner.style.borderRightColor = '#16a34a';
    banner.style.background = '#f0fdf4';
    if (iconEl) {
      iconEl.style.background = '#dcfce7';
      iconEl.style.color = '#15803d';
      iconEl.textContent = '🟢';
    }
    if (titleEl) titleEl.textContent = `شیفتی سندووق کراوەیە (#${currentSession.id})`;
    if (badgeEl) {
      badgeEl.className = 'badge badge-success';
      badgeEl.textContent = 'چالاک (Open)';
    }

    const openTime = String(currentSession.opened_at || '').slice(0, 19).replace('T', ' ');
    if (detailsEl) {
      detailsEl.textContent = `کاشێر: ${currentSession.user_name || 'سەرپەرشتیار'} | کاتی کردنەوە: ${openTime} | بڕی پارەی سەرەتایی: ${formatCurrency(currentSession.opening_balance)}`;
    }
    if (activeSubEl) {
      activeSubEl.textContent = `پارەی دەستپێکی شیفت: ${formatCurrency(currentSession.opening_balance)}`;
    }

    actionsEl.innerHTML = `
      <button class="btn btn-sm btn-outline" id="btn-manual-deposit" style="background:#ffffff; color:#16a34a; border-color:#16a34a; font-weight:700;">
        📥 + تێکردنی پارە
      </button>
      <button class="btn btn-sm btn-outline" id="btn-manual-withdraw" style="background:#ffffff; color:#dc2626; border-color:#dc2626; font-weight:700;">
        📤 - ڕاکێشانی پارە
      </button>
      <button class="btn btn-sm btn-danger" id="btn-close-session" style="font-weight:800; padding:8px 16px;">
        🔒 داخستنی سندووق و ئەژمارکردن
      </button>
    `;

    document.getElementById('btn-close-session')?.addEventListener('click', () => openCloseSessionModal(currentSession));
    document.getElementById('btn-manual-deposit')?.addEventListener('click', () => openManualDepositModal());
    document.getElementById('btn-manual-withdraw')?.addEventListener('click', () => openManualWithdrawModal());
  } else {
    banner.style.borderRightColor = '#eab308';
    banner.style.background = '#fffbeb';
    if (iconEl) {
      iconEl.style.background = '#fef3c7';
      iconEl.style.color = '#b45309';
      iconEl.textContent = '🟡';
    }
    if (titleEl) titleEl.textContent = 'سندووق داخراوە (هیچ شیفتێک چالاک نییە)';
    if (badgeEl) {
      badgeEl.className = 'badge badge-warning';
      badgeEl.textContent = 'داخراو (Closed)';
    }
    if (detailsEl) {
      detailsEl.textContent = 'بۆ دەستپێکردنی ڕۆژ و فرۆشتن، تکایە سەرەتا سندووق بکەرەوە بە دیاریکردنی پارەی سەرەتایی ناو قاسە.';
    }
    if (activeSubEl) {
      activeSubEl.textContent = 'سندووق داخراوە';
    }

    actionsEl.innerHTML = `
      <button class="btn btn-sm btn-outline" id="btn-manual-deposit" style="background:#ffffff; color:#16a34a; border-color:#16a34a; font-weight:700;">
        📥 تێکردنی دەستی
      </button>
      <button class="btn btn-sm btn-primary" id="btn-open-session" style="font-weight:800; padding:8px 18px;">
        🔓 کردنەوەی شیفتی نوێی سندووق
      </button>
    `;

    document.getElementById('btn-open-session')?.addEventListener('click', () => openOpenSessionModal());
    document.getElementById('btn-manual-deposit')?.addEventListener('click', () => openManualDepositModal());
  }
}

async function loadTransactions() {
  const tbody = document.getElementById('cash-ledger-tbody');
  const countBadge = document.getElementById('ledger-count-badge');
  if (!tbody) return;

  const search = document.getElementById('cash-search-input')?.value.trim() || '';
  const type = document.getElementById('cash-type-filter')?.value || '';
  const date = document.getElementById('cash-date-filter')?.value || '';

  let url = `/cash-register/transactions?limit=150`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (type) url += `&type=${encodeURIComponent(type)}`;
  if (date) url += `&date=${encodeURIComponent(date)}`;

  const res = await api.get(url);
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#dc2626; padding: 24px;">هەڵە لە بارکردنی تۆماری قاسە</td></tr>`;
    return;
  }

  currentTransactions = Array.isArray(res.data) ? res.data : (res.data?.transactions || res.transactions || []);
  if (countBadge) countBadge.textContent = `${currentTransactions.length} جووڵە`;

  if (currentTransactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ جووڵەیەکی دارایی نەدۆزرایەوە بەپێی ئەم فلتەرە</td></tr>`;
    return;
  }

  tbody.innerHTML = currentTransactions
    .map((tx, idx) => {
      const isPositive = tx.direction === 'IN';
      const typeInfo = getTransactionTypeInfo(tx.transaction_type || tx.source);
      const timeStr = String(tx.created_at || '').slice(0, 19).replace('T', ' ');

      return `
      <tr>
        <td>${idx + 1}</td>
        <td style="direction: ltr; font-family: monospace; font-size: 12px; color: #64748b;">${timeStr}</td>
        <td>
          <span class="badge ${typeInfo.badgeClass}" style="font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
            <span>${typeInfo.icon}</span> ${typeInfo.label}
          </span>
        </td>
        <td>
          <strong style="font-size: 14px; font-weight: 900; color: ${isPositive ? '#16a34a' : '#dc2626'};">
            ${isPositive ? '+' : '-'}${formatCurrency(Math.abs(tx.amount))}
          </strong>
        </td>
        <td style="color: #64748b; font-size: 13px;">${formatCurrency(tx.balance_before)}</td>
        <td style="font-weight: 700; color: #0f172a; font-size: 13px;">${formatCurrency(tx.balance_after)}</td>
        <td style="font-family: monospace; font-size: 12px;">${tx.reference_number || '-'}</td>
        <td style="font-size: 12px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${tx.notes || tx.description || ''}">
          ${tx.notes || tx.description || '-'}
        </td>
        <td style="font-size: 12px; color: #475569;">${tx.user_name || 'سیستەم'}</td>
      </tr>
    `;
    })
    .join('');
}

function getTransactionTypeInfo(rawType) {
  const type = String(rawType || '').toLowerCase();
  switch (type) {
    case 'sale':
    case 'sale_cash':
      return { label: 'فرۆشتنی نەقد', icon: '🛒', badgeClass: 'badge-success' };
    case 'sale_partial_cash':
      return { label: 'فرۆشتنی بەشە نەقد', icon: '🛒', badgeClass: 'badge-success' };
    case 'customer_debt_payment':
      return { label: 'وەرگرتنەوەی قەرزی کڕیار', icon: '📋', badgeClass: 'badge-success' };
    case 'company_debt_payment':
      return { label: 'وەرگرتنەوەی قەرزی کۆمپانیا', icon: '🏢', badgeClass: 'badge-success' };
    case 'purchase':
    case 'purchase_payment':
      return { label: 'کڕینی کاڵا (نەقد)', icon: '📦', badgeClass: 'badge-danger' };
    case 'supplier_payment':
    case 'supplier_debt_payment':
      return { label: 'دانەوەی قەرزی دابینکەر', icon: '🏢', badgeClass: 'badge-danger' };
    case 'expense':
      return { label: 'خەرجی گشتی', icon: '💸', badgeClass: 'badge-danger' };
    case 'expense_reversal':
      return { label: 'پوچەڵکردنەوەی خەرجی', icon: '↩️', badgeClass: 'badge-info' };
    case 'customer_refund':
    case 'sale_return':
      return { label: 'گەڕانەوەی کاڵا (نەقد)', icon: '🔄', badgeClass: 'badge-danger' };
    case 'cash_deposit':
    case 'manual_deposit':
      return { label: 'تێکردنی دەستی', icon: '📥', badgeClass: 'badge-info' };
    case 'cash_withdrawal':
    case 'manual_withdrawal':
      return { label: 'ڕاکێشانی دەستی', icon: '📤', badgeClass: 'badge-warning' };
    case 'session_open':
      return { label: 'کردنەوەی سندووق', icon: '🔓', badgeClass: 'badge-info' };
    case 'session_close':
      return { label: 'داخستنی سندووق', icon: '🔒', badgeClass: 'badge-secondary' };
    default:
      return { label: rawType || 'جووڵە', icon: '💳', badgeClass: 'badge-secondary' };
  }
}

function openOpenSessionModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const defaultBal = currentSummary?.current_cash_balance || 0;

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 480px; border-radius: 14px; overflow: hidden;">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 16px 20px;">
        <h3 class="modal-title" style="margin: 0; font-size: 16px; color: #ffffff;">🔓 کردنەوەی شیفتی نوێی سندووق</h3>
        <button class="modal-close-btn" style="color: #94a3b8; font-size: 24px; line-height: 1; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #64748b;">باڵانسی تۆمارکراوی کۆتایی پێشوو:</div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a;">${formatCurrency(defaultBal)}</div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">بڕی پارەی سەرەتایی ناو قاسە (IQD) *</label>
          <input type="number" id="mos-opening-balance" class="form-control" value="${defaultBal}" min="0" style="font-size: 18px; font-weight: 800; color: #1e40af;" required />
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">ئەو بڕە پارەیەی کە لەم دەقەیەدا بە فیزیکی لە ناو سندووقەکە دایە.</div>
        </div>

        <div class="form-group">
          <label class="form-label">تێبینی سەرەتایی (ئارەزوومەندانە)</label>
          <textarea id="mos-notes" class="form-control" rows="2" placeholder="بۆ نموونە: دەستپێکی شیفتی بەیانی..."></textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding: 14px 20px; background: #f8fafc; display: flex; justify-content: space-between;">
        <button class="btn btn-secondary mos-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="mos-submit-btn" style="font-weight: 800; padding: 10px 20px;">✓ پەسەندکردن و کردنەوەی سندووق</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.mos-cancel').addEventListener('click', closeModal);

  modal.querySelector('#mos-submit-btn').addEventListener('click', async () => {
    const opening_balance = Number(modal.querySelector('#mos-opening-balance').value);
    const notes = modal.querySelector('#mos-notes').value.trim();

    if (isNaN(opening_balance) || opening_balance < 0) {
      showToast('تکایە بڕی پارەی سەرەتایی بە دروستی بنووسە', 'error');
      return;
    }

    const res = await api.post('/cash-register/sessions/open', { opening_balance, notes });
    if (res.success) {
      showToast('شیفتی سندووق بە سەرکەوتوویی کرایەوە ✓', 'success');
      closeModal();
      loadCashData();
    } else {
      showToast(res.message || 'هەڵە لە کردنەوەی سندووق', 'error');
    }
  });
}

function openCloseSessionModal(session) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const expectedCash = currentSummary?.current_cash_balance || 0;

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 540px; border-radius: 14px; overflow: hidden;">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 16px 20px;">
        <h3 class="modal-title" style="margin: 0; font-size: 16px; color: #ffffff;">🔒 داخستنی سندووق و ئەژمارکردنی پارەی نەقد</h3>
        <button class="modal-close-btn" style="color: #94a3b8; font-size: 24px; line-height: 1; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        
        <!-- Summary Comparison Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 10px; margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 13px; color: #64748b;">پارەی سەرەتایی شیفت:</span>
            <strong style="color: #0f172a;">${formatCurrency(session.opening_balance)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
            <span style="font-size: 13px; color: #64748b;">پارەی چاوەڕوانکراوی سیستەم (Expected Cash):</span>
            <strong style="color: #1e40af; font-size: 16px;">${formatCurrency(expectedCash)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 700; color: #0f172a;">جیاوازی ئەژمار (Variance):</span>
            <strong id="mcs-diff-display" style="font-size: 16px; font-weight: 900; color: #16a34a;">0 د.ع (ڕێکە)</strong>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 800; color: #0f172a; font-size: 14px;">
            پارەی ئەژمارکراوی فیزیکی (Physical Counted Cash) *
          </label>
          <input type="number" id="mcs-closing-balance" class="form-control" value="${expectedCash}" min="0" style="font-size: 20px; font-weight: 900; color: #0f172a; padding: 10px;" required />
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">تکایە هەموو پارەی نەقدی ناو سندووقەکە بژمێرە و بڕە ڕاستەقینەکەی لێرە بنووسە.</div>
        </div>

        <div class="form-group">
          <label class="form-label">تێبینی و هۆکاری جیاوازی (ئەگەر کەم یان زیاد بوو)</label>
          <textarea id="mcs-notes" class="form-control" rows="2" placeholder="تێبینی داخستنی شیفت..."></textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding: 14px 20px; background: #f8fafc; display: flex; justify-content: space-between;">
        <button class="btn btn-secondary mcs-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-danger" id="mcs-submit-btn" style="font-weight: 800; padding: 10px 22px;">
          🔒 داخستنی کۆتایی شیفت
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
  modal.querySelector('.mcs-cancel').addEventListener('click', closeModal);

  const countInput = modal.querySelector('#mcs-closing-balance');
  const diffDisplay = modal.querySelector('#mcs-diff-display');

  const updateDiff = () => {
    const counted = Number(countInput.value) || 0;
    const diff = counted - expectedCash;
    if (diff === 0) {
      diffDisplay.textContent = '0 د.ع (ڕێکە ✓)';
      diffDisplay.style.color = '#16a34a';
    } else if (diff > 0) {
      diffDisplay.textContent = `+${formatCurrency(diff)} (زیادە / Surplus)`;
      diffDisplay.style.color = '#2563eb';
    } else {
      diffDisplay.textContent = `-${formatCurrency(Math.abs(diff))} (کورتهێنان / Shortage ⚠️)`;
      diffDisplay.style.color = '#dc2626';
    }
  };

  countInput.addEventListener('input', updateDiff);
  updateDiff();

  modal.querySelector('#mcs-submit-btn').addEventListener('click', async () => {
    const closing_balance = Number(countInput.value);
    const notes = modal.querySelector('#mcs-notes').value.trim();

    if (isNaN(closing_balance) || closing_balance < 0) {
      showToast('تکایە پارەی ئەژمارکراوی فیزیکی بە دروستی بنووسە', 'error');
      return;
    }

    if (!confirm('دڵنیایت دەتەوێت ئەم شیفتە دابخەیت؟ دوای داخستن ناتوانرێت دەستکاری بکرێت.')) {
      return;
    }

    const res = await api.post(`/cash-register/sessions/${session.id}/close`, { closing_balance, notes });
    if (res.success) {
      showToast('شیفتی سندووق بە سەرکەوتوویی داخرا ✓', 'success');
      closeModal();
      loadCashData();
    } else {
      showToast(res.message || 'هەڵە لە داخستنی سندووق', 'error');
    }
  });
}

function openManualDepositModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 460px; border-radius: 12px;">
      <div class="modal-header" style="background: #15803d; color: #ffffff; padding: 14px 18px;">
        <h3 class="modal-title" style="margin: 0; font-size: 15px; color: #ffffff;">📥 تێکردنی پارە بۆ ناو سندووق (Manual Deposit)</h3>
        <button class="modal-close-btn" style="color: #bbf7d0; font-size: 22px; line-height: 1; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 18px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">بڕی پارەی هێنراو (IQD) *</label>
          <input type="number" id="md-amount" class="form-control" placeholder="بۆ نموونە: 500000" min="1" required style="font-size: 16px; font-weight: 800;" />
        </div>
        <div class="form-group">
          <label class="form-label">هۆکار یان جۆری تێکردن *</label>
          <select id="md-category" class="form-control">
            <option value="زیادکردنی سەرمایە / کاپیتاڵ">زیادکردنی سەرمایەی کار (Capital Injection)</option>
            <option value="پارەی وردە (خوردە)">پارەی وردەی سندووق (Petty Cash)</option>
            <option value="گەڕانەوەی قەرز یان پارەی زیادە">گەڕانەوەی پارەی زیادە</option>
            <option value="تر">هۆکاری تر</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">تێبینی و ڕوونکردنەوە</label>
          <input type="text" id="md-notes" class="form-control" placeholder="ناوی کەس یان سەرچاوەی پارە..." />
        </div>
      </div>
      <div class="modal-footer" style="padding: 12px 18px; display: flex; justify-content: space-between;">
        <button class="btn btn-secondary md-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-success" id="md-submit-btn">✓ تۆمارکردن و زیادکردن بۆ قاسە</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.md-cancel').addEventListener('click', closeModal);

  modal.querySelector('#md-submit-btn').addEventListener('click', async () => {
    const amount = Number(modal.querySelector('#md-amount').value);
    const category = modal.querySelector('#md-category').value;
    const notes = modal.querySelector('#md-notes').value.trim();

    if (!amount || amount <= 0) {
      showToast('تکایە بڕی پارە دیاری بکە', 'error');
      return;
    }

    const fullNotes = category + (notes ? ` - ${notes}` : '');
    const res = await api.post('/cash-register/deposit', { amount, notes: fullNotes });
    if (res.success) {
      showToast('پارە بە سەرکەوتوویی تێکرایە ناو قاسە ✓', 'success');
      closeModal();
      loadCashData();
    } else {
      showToast(res.message || 'هەڵە لە تێکردنی پارە', 'error');
    }
  });
}

function openManualWithdrawModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const maxCash = currentSummary?.current_cash_balance || 0;

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 460px; border-radius: 12px;">
      <div class="modal-header" style="background: #b91c1c; color: #ffffff; padding: 14px 18px;">
        <h3 class="modal-title" style="margin: 0; font-size: 15px; color: #ffffff;">📤 ڕاکێشانی پارە لە سندووق (Manual Withdrawal)</h3>
        <button class="modal-close-btn" style="color: #fecaca; font-size: 22px; line-height: 1; border: none; background: none; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 18px;">
        <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
          پارەی بەردەست لە قاسە: <strong style="color: #0f172a;">${formatCurrency(maxCash)}</strong>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">بڕی پارەی ڕاکێشراو (IQD) *</label>
          <input type="number" id="mw-amount" class="form-control" placeholder="بۆ نموونە: 1000000" min="1" max="${maxCash}" required style="font-size: 16px; font-weight: 800;" />
        </div>
        <div class="form-group">
          <label class="form-label">هۆکار یان مەبەستی ڕاکێشان *</label>
          <select id="mw-category" class="form-control">
            <option value="ڕاکێشان بۆ خاوەنکار (سەنگەر / جێگر)">ڕاکێشان بۆ خاوەنکار (Owner Drawing)</option>
            <option value="گواستنەوە بۆ قاسەی سەرەکی (Safe)">گواستنەوە بۆ قاسەی سەرەکی یان بانکی</option>
            <option value="پارەی پێشەکی کارمەند">پێشەکی مووچەی کارمەند</option>
            <option value="تر">هۆکاری تر</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">تێبینی و ناوی وەرگر</label>
          <input type="text" id="mw-notes" class="form-control" placeholder="ناوی وەرگر یان مەبەست..." />
        </div>
      </div>
      <div class="modal-footer" style="padding: 12px 18px; display: flex; justify-content: space-between;">
        <button class="btn btn-secondary mw-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-danger" id="mw-submit-btn">✓ پەسەندکردن و دەرکردن لە قاسە</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.mw-cancel').addEventListener('click', closeModal);

  modal.querySelector('#mw-submit-btn').addEventListener('click', async () => {
    const amount = Number(modal.querySelector('#mw-amount').value);
    const category = modal.querySelector('#mw-category').value;
    const notes = modal.querySelector('#mw-notes').value.trim();

    if (!amount || amount <= 0) {
      showToast('تکایە بڕی پارە دیاری بکە', 'error');
      return;
    }

    if (amount > maxCash) {
      showToast(`پارەی بەس لە قاسە نییە (تەنها ${formatCurrency(maxCash)} بەردەستە)`, 'error');
      return;
    }

    const fullNotes = category + (notes ? ` - ${notes}` : '');
    const res = await api.post('/cash-register/withdraw', { amount, notes: fullNotes });
    if (res.success) {
      showToast('پارە بە سەرکەوتوویی لە سندووق دەرکرا ✓', 'success');
      closeModal();
      loadCashData();
    } else {
      showToast(res.message || 'هەڵە لە ڕاکێشانی پارە', 'error');
    }
  });
}

function printDailyCashSheet() {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const today = getErbilToday();
  const time = getErbilTimeString();
  const user = getUser();
  const s = currentSummary || {};
  const b = s.breakdown || {};

  printArea.innerHTML = `
    <div style="font-family: Arial, sans-serif; direction: rtl; padding: 20px; color: #000000; width: 100%; max-width: 700px; margin: auto;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px;">
        <h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: bold;">سەنگەر زمارەیی و جێگر زمارەیی</h2>
        <div style="font-size: 14px; font-weight: bold;">پسووڵەی ڕێکخستن و تەرازوی سندووق (Daily Cash Reconciliation)</div>
        <div style="font-size: 12px; margin-top: 4px;">بەروار: ${today} | کات: ${time} | کاشێر: ${user?.full_name || user?.name || 'کاشێر'}</div>
      </div>

      <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #ccc;">
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
          <span>کۆی پارەی نەقدی ناو قاسە:</span>
          <span>${formatCurrency(s.current_cash_balance)}</span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
        <thead>
          <tr style="background: #e5e7eb; border-bottom: 1px solid #999;">
            <th style="padding: 8px; text-align: right;">جۆری جووڵەی دارایی</th>
            <th style="padding: 8px; text-align: left;">بڕی پارە (د.ع)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">(+) فرۆشتنی نەقد:</td>
            <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold; color: green;">${formatCurrency(b.sales_cash || 0)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">(+) وەرگرتنەوەی قەرزی کڕیاران و کۆمپانیاکان:</td>
            <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold; color: green;">${formatCurrency(b.debt_payments_cash || 0)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">(+) تێکردنی دەستی:</td>
            <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold; color: green;">${formatCurrency(b.manual_deposits || 0)}</td>
          </tr>
          <tr style="background: #f9fafb; font-weight: bold;">
            <td style="padding: 6px; border-bottom: 2px solid #ccc;">کۆی گشتی هاتووی نەقد:</td>
            <td style="padding: 6px; border-bottom: 2px solid #ccc; text-align: left; color: green;">${formatCurrency(s.today_inflows || 0)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">(-) کڕینی کاڵا بە نەقد:</td>
            <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold; color: red;">${formatCurrency(b.purchases_cash || 0)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">(-) دانەوەی قەرزی دابینکەران:</td>
            <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold; color: red;">${formatCurrency(b.supplier_debt_cash || 0)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">(-) خەرجییە گشتییەکان:</td>
            <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold; color: red;">${formatCurrency(b.expenses_cash || 0)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">(-) گەڕانەوەی کاڵا:</td>
            <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold; color: red;">${formatCurrency(b.sale_returns_cash || 0)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">(-) ڕاکێشانی دەستی:</td>
            <td style="padding: 6px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold; color: red;">${formatCurrency(b.manual_withdrawals || 0)}</td>
          </tr>
          <tr style="background: #f9fafb; font-weight: bold;">
            <td style="padding: 6px; border-bottom: 2px solid #ccc;">کۆی گشتی دەرچووی نەقد:</td>
            <td style="padding: 6px; border-bottom: 2px solid #ccc; text-align: left; color: red;">${formatCurrency(s.today_outflows || 0)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px;">
        <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 6px;">
          واژۆی کاشێر
        </div>
        <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 6px;">
          واژۆی سەرپەرشتیار / بەڕێوەبەر
        </div>
      </div>
    </div>
  `;

  window.print();
}
