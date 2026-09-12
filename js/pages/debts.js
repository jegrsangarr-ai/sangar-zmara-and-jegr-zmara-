/**
 * Debts Center (ناوەندی قەرزەکان)
 * Combined overview of Customer & Company Debts and Supplier Debts with Full Details
 */
import { api, formatCurrency, showToast } from '../api.js';
import { openCustomerDebtDetailsModal, openPayDebtModal } from './customers.js';
import { openCompanyAccountModal, openPayCompanyDebtModal } from './companies.js';

export async function initDebtsPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">ناوەندی بەڕێوەبردنی قەرزەکان</h2>
        <div class="section-subtitle">کۆی قەرزەکانی سەر کڕیار و کۆمپانیاکان و قەرزەکانی سەر شانمان بۆ دابینکەران</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary" id="btn-refresh-debts">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon red">👥</div>
        <div class="stat-content">
          <div class="stat-label">کۆی قەرزی سەر کڕیاران و کۆمپانیاکان</div>
          <div class="stat-value" id="debts-total-customer" style="color: #dc2626;">0 د.ع</div>
          <div class="stat-sub" id="debts-cust-count">0 هەژماری قەرزدار</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon blue">🏢</div>
        <div class="stat-content">
          <div class="stat-label">قەرزی کۆمپانیا و شۆفێرەکان</div>
          <div class="stat-value" id="debts-company-amount" style="color: #7c3aed;">0 د.ع</div>
          <div class="stat-sub" id="debts-company-count">0 کۆمپانیا</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon amber">🚚</div>
        <div class="stat-content">
          <div class="stat-label">کۆی قەرزی دابینکەران (قەرز لەسەرمان)</div>
          <div class="stat-value" id="debts-total-supplier">0 د.ع</div>
          <div class="stat-sub" id="debts-supp-count">0 دابینکەر</div>
        </div>
      </div>
    </div>

    <!-- Debt Tabs -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
      <button class="btn btn-primary debt-tab active" data-tab="cust" style="font-weight: 700;">
        📋 قەرزی کڕیاران و کۆمپانیاکان (پارە لای خەڵک)
      </button>
      <button class="btn btn-secondary debt-tab" data-tab="supp" style="font-weight: 700;">
        🚚 قەرزی دابینکەران (کۆمپانیاکانی سەرشانمان)
      </button>
    </div>

    <!-- Customers Debts View -->
    <div id="tab-cust-debts" class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table" style="font-size: 13px;">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>جۆری هەژمار</th>
              <th>ناوی کڕیار / کۆمپانیا</th>
              <th>خاوەن کار</th>
              <th>شۆفێر</th>
              <th>بارهەڵگر / تابلۆ</th>
              <th>مۆبایل</th>
              <th>بڕی قەرز</th>
              <th style="text-align: center;">کردارەکان</th>
            </tr>
          </thead>
          <tbody id="cust-debts-body">
            <tr><td colspan="9" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Suppliers Debts View -->
    <div id="tab-supp-debts" class="card" style="padding: 0; overflow: hidden; display: none;">
      <div class="table-responsive">
        <table class="table" style="font-size: 13px;">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>ناوی کۆمپانیا / دابینکەر</th>
              <th>کەسی پەیوەندیدار</th>
              <th>مۆبایل</th>
              <th>ناونیشان</th>
              <th>بڕی قەرزی لەسەرمان</th>
              <th style="text-align: center;">کردار</th>
            </tr>
          </thead>
          <tbody id="supp-debts-body">
            <tr><td colspan="7" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-refresh-debts')?.addEventListener('click', () => loadAllDebts());

  // Tab switching
  document.querySelectorAll('.debt-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.debt-tab').forEach((t) => {
        t.classList.remove('btn-primary', 'active');
        t.classList.add('btn-secondary');
      });
      tab.classList.remove('btn-secondary');
      tab.classList.add('btn-primary', 'active');

      const target = tab.dataset.tab;
      const tabCust = document.getElementById('tab-cust-debts');
      const tabSupp = document.getElementById('tab-supp-debts');
      if (tabCust) tabCust.style.display = target === 'cust' ? 'block' : 'none';
      if (tabSupp) tabSupp.style.display = target === 'supp' ? 'block' : 'none';
    });
  });

  await loadAllDebts();
}

export async function loadAllDebts() {
  const [unifiedRes, suppRes] = await Promise.all([
    api.get('/debts/unified?only_indebted=1'),
    api.get('/suppliers'),
  ]);

  const custBody = document.getElementById('cust-debts-body');
  const suppBody = document.getElementById('supp-debts-body');

  const summary = unifiedRes.summary || {};
  const rows = (unifiedRes.data || []).filter((r) => Number(r.current_debt) > 0);
  const suppDebts = (suppRes.data || []).filter((s) => Number(s.balance_debt) > 0);

  const totalAllDebt = summary.totalAllDebt != null ? Number(summary.totalAllDebt) : rows.reduce((sum, r) => sum + (Number(r.current_debt) || 0), 0);
  const totalCompDebt = summary.totalCompDebt != null ? Number(summary.totalCompDebt) : 0;
  const totalSupp = suppDebts.reduce((sum, s) => sum + (Number(s.balance_debt) || 0), 0);

  const elTotCust = document.getElementById('debts-total-customer');
  const elCompAmt = document.getElementById('debts-company-amount');
  const elCompCount = document.getElementById('debts-company-count');
  const elTotSupp = document.getElementById('debts-total-supplier');
  const elCntCust = document.getElementById('debts-cust-count');
  const elCntSupp = document.getElementById('debts-supp-count');

  if (elTotCust) elTotCust.textContent = formatCurrency(totalAllDebt);
  if (elCompAmt) elCompAmt.textContent = formatCurrency(totalCompDebt);
  if (elCompCount) elCompCount.textContent = `${summary.indebtedCompCount || 0} کۆمپانیا`;
  if (elTotSupp) elTotSupp.textContent = formatCurrency(totalSupp);
  if (elCntCust) elCntCust.textContent = `${rows.length} هەژماری قەرزدار`;
  if (elCntSupp) elCntSupp.textContent = `${suppDebts.length} کۆمپانیا قەرزیان لای ئێمەیە`;

  // Render Unified Customers & Companies
  if (custBody) {
    if (rows.length === 0) {
      custBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: #16a34a; font-weight: 700;">هیچ قەرزێک لەسەر کڕیاران و کۆمپانیاکان تۆمار نەکراوە ✓</td></tr>`;
    } else {
      custBody.innerHTML = rows
        .map((r, idx) => {
          const isCompany = r.account_type === 'company';
          const typeBadge = isCompany
            ? `<span class="badge" style="font-size: 11px; font-weight: 800; background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; padding: 2px 6px;">🏢 کۆمپانیا</span>`
            : `<span class="badge" style="font-size: 11px; font-weight: 800; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 2px 6px;">👤 تاک</span>`;

          const ownerDisplay = isCompany && r.owner_name ? escapeHtml(r.owner_name) : '—';
          const driverDisplay = isCompany && r.driver_names ? `👨‍✈️ ${escapeHtml(r.driver_names)}` : '—';
          const vehicleDisplay = isCompany && r.vehicle_plates ? `🚛 ${escapeHtml(r.vehicle_plates)}` : '—';
          const debtNum = Number(r.current_debt) || 0;

          return `
            <tr>
              <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
              <td>${typeBadge}</td>
              <td>
                <a href="javascript:void(0)" class="btn-debt-account-name" data-type="${r.account_type}" data-id="${r.id}" style="font-weight: 800; color: ${isCompany ? '#6d28d9' : '#1d4ed8'}; text-decoration: underline;">
                  ${isCompany ? '🏢 ' : '👤 '}${escapeHtml(r.name)}
                </a>
              </td>
              <td>${ownerDisplay}</td>
              <td>${driverDisplay}</td>
              <td>${vehicleDisplay}</td>
              <td dir="ltr" style="font-family: monospace;">${escapeHtml(r.phone || '—')}</td>
              <td>
                <button class="btn-debt-amount-badge badge badge-danger" data-type="${r.account_type}" data-id="${r.id}" style="font-size: 13px; font-weight: 800; cursor: pointer; border: none; padding: 5px 10px;" title="کلیک بکە بۆ وردەکاری">
                  ${formatCurrency(debtNum)} 🔍
                </button>
              </td>
              <td style="text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                  <button class="btn btn-sm btn-success btn-quick-pay-unified" data-type="${r.account_type}" data-id="${r.id}" data-name="${escapeHtml(r.name)}" data-debt="${debtNum}" style="font-weight: 700;">
                    💵 وەرگرتنەوە
                  </button>
                  <button class="btn btn-sm btn-primary btn-view-unified-debt" data-type="${r.account_type}" data-id="${r.id}">
                    🔍 وردەکاری
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      custBody.querySelectorAll('.btn-debt-account-name, .btn-debt-amount-badge, .btn-view-unified-debt').forEach((el) => {
        el.addEventListener('click', () => {
          const type = el.dataset.type;
          const id = el.dataset.id;
          if (type === 'company') {
            openCompanyAccountModal(id);
          } else {
            openCustomerDebtDetailsModal(id);
          }
        });
      });

      custBody.querySelectorAll('.btn-quick-pay-unified').forEach((btn) => {
        btn.addEventListener('click', () => {
          const type = btn.dataset.type;
          const id = btn.dataset.id;
          const name = btn.dataset.name;
          const debt = Number(btn.dataset.debt);

          if (type === 'company') {
            openPayCompanyDebtModal(id, name, debt, () => {
              loadAllDebts();
            });
          } else {
            openPayDebtModal(id, name, debt, () => {
              loadAllDebts();
            });
          }
        });
      });
    }
  }

  // Render Suppliers
  if (suppBody) {
    if (suppDebts.length === 0) {
      suppBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: #16a34a; font-weight: 700;">هیچ قەرزێک بۆ دابینکەران لەسەرمان نییە ✓</td></tr>`;
    } else {
      suppBody.innerHTML = suppDebts
        .map(
          (s, idx) => `
        <tr>
          <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
          <td><strong>🏢 ${escapeHtml(s.name)}</strong></td>
          <td>${escapeHtml(s.contact_person || '—')}</td>
          <td dir="ltr" style="font-family: monospace;">${escapeHtml(s.phone || '—')}</td>
          <td>${escapeHtml(s.address || '—')}</td>
          <td><strong style="color: #dc2626; font-size: 14px;">${formatCurrency(s.balance_debt)}</strong></td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-danger btn-quick-pay-supp" data-id="${s.id}" style="font-weight: 700;">
              💸 دانەوەی قەرز
            </button>
          </td>
        </tr>
      `
        )
        .join('');

      suppBody.querySelectorAll('.btn-quick-pay-supp').forEach((btn) => {
        btn.addEventListener('click', () => {
          window.location.hash = '#suppliers';
        });
      });
    }
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
