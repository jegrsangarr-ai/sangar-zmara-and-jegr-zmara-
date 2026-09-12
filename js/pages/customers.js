/**
 * Customers & Debts Management Module (کڕیاران و قەرزەکان)
 * Unified Debt Center for Individual Customers, Companies, Drivers & Vehicles
 * Kurdish Sorani RTL Interface
 */
import { api, formatCurrency, showToast } from '../api.js';
import {
  openCompanyModal,
  openCompanyAccountModal,
  openPayCompanyDebtModal,
} from './companies.js';

export function getRelativeDebtAge(dateStr) {
  if (!dateStr) return '-';
  try {
    const dStr = String(dateStr).slice(0, 10);
    const [y1, m1, d1] = dStr.split('-').map(Number);
    if (!y1 || !m1 || !d1) return dateStr;

    // Current date in Asia/Baghdad timezone
    const baghdadFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const baghdadToday = baghdadFormatter.format(new Date());
    const [y2, m2, d2] = baghdadToday.split('-').map(Number);

    let years = y2 - y1;
    let months = m2 - m1;
    let days = d2 - d1;

    if (days < 0) {
      months -= 1;
      const prevMonthDays = new Date(y2, m2 - 1, 0).getDate();
      days += prevMonthDays;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years < 0 || (years === 0 && months === 0 && days === 0)) {
      return 'ئەمڕۆ (نوێ)';
    }

    const parts = [];
    if (years > 0) parts.push(`${years} ساڵ`);
    if (months > 0) parts.push(`${months} مانگ`);
    if (days > 0) parts.push(`${days} ڕۆژ`);

    if (parts.length === 0) return 'ئەمڕۆ (نوێ)';
    return parts.join(' و ') + ' پێش ئێستا';
  } catch (e) {
    return dateStr;
  }
}

let activeTypeFilter = 'all'; // 'all' | 'individual' | 'company'
let currentDebtsData = [];

export async function initCustomersPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">کڕیاران و قەرزەکان</h2>
        <div class="section-subtitle">
          بینین و بەڕێوەبردنی یەکگرتووی قەرزەکان بۆ کڕیارانی تاک، کۆمپانیاکان، شۆفێرەکان و بارهەڵگرەکان
        </div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-primary" id="btn-add-customer">+ کڕیاری نوێ (تاک)</button>
        <button class="btn btn-primary" id="btn-add-company" style="background: #7c3aed; border-color: #7c3aed;">+ کۆمپانیای نوێ</button>
        <button class="btn btn-secondary" id="btn-print-debts-report">🖨️ چاپی ڕاپۆرت</button>
        <button class="btn btn-secondary" id="btn-refresh-customers">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Summary Stats Bar -->
    <div class="stat-grid" style="margin-bottom: 20px;">
      <div class="stat-card">
        <div class="stat-icon red">💳</div>
        <div class="stat-content">
          <div class="stat-label">کۆی گشتی قەرزەکان (پارە لای کڕیاران)</div>
          <div class="stat-value" id="stat-total-all-debt" style="color: #dc2626;">0 د.ع</div>
          <div class="stat-sub" id="stat-total-debt-sub">0 هەژماری قەرزدار</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon blue">🏢</div>
        <div class="stat-content">
          <div class="stat-label">قەرزی کۆمپانیا و شۆفێرەکان</div>
          <div class="stat-value" id="stat-company-debt" style="color: #7c3aed;">0 د.ع</div>
          <div class="stat-sub" id="stat-company-debt-sub">0 کۆمپانیا</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon green">👤</div>
        <div class="stat-content">
          <div class="stat-label">قەرزی کڕیارانی تاک (Individual)</div>
          <div class="stat-value" id="stat-individual-debt" style="color: #2563eb;">0 د.ع</div>
          <div class="stat-sub" id="stat-individual-debt-sub">0 کڕیار</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon amber">🚚</div>
        <div class="stat-content">
          <div class="stat-label">قەرزی کۆمپانیاکانی دابینکەر (سەرمان)</div>
          <div class="stat-value" id="stat-supplier-debt">0 د.ع</div>
          <div class="stat-sub">دابینکەرانی کەلوپەل</div>
        </div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="card" style="padding: 16px; margin-bottom: 16px;">
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Top row: Tabs & Checkbox -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <!-- Account Type Filter Buttons -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-sm btn-primary filter-type-btn active" data-type="all" style="font-weight: 700;">
              🔘 هەموو هەژمارەکان
            </button>
            <button class="btn btn-sm btn-secondary filter-type-btn" data-type="individual" style="font-weight: 700;">
              👤 کڕیارانی تاک
            </button>
            <button class="btn btn-sm btn-secondary filter-type-btn" data-type="company" style="font-weight: 700;">
              🏢 کۆمپانیا و شۆفێرەکان
            </button>
          </div>

          <!-- Indebted only toggle -->
          <div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; cursor: pointer; user-select: none; background: var(--bg-hover, #f1f5f9); padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-color, #e2e8f0);">
              <input type="checkbox" id="cust-filter-indebted" checked style="width: 16px; height: 16px; accent-color: #dc2626;" />
              <span>📋 تەنها خاوەن قەرزەکان (قەرزی ئێستا > 0)</span>
            </label>
          </div>
        </div>

        <!-- Search Bar -->
        <div>
          <input 
            type="text" 
            id="cust-search-input" 
            class="form-control" 
            placeholder="🔍 گەڕانی خێرا بەپێی: ناوی کڕیار، ناوی کۆمپانیا، خاوەن کار، ناوی شۆفێر، ڕەقەم/تابلۆی بارهەڵگر، ژمارەی مۆبایل، ناونیشان..." 
            style="font-size: 14px; padding: 10px 14px;"
          />
        </div>
      </div>
    </div>

    <!-- Unified Debt Overview Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
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
              <th>ژمارەی مۆبایل</th>
              <th>ناونیشان</th>
              <th>بڕی قەرزی ئێستا</th>
              <th style="text-align: center;">کردارەکان</th>
            </tr>
          </thead>
          <tbody id="customers-table-body">
            <tr><td colspan="10" style="text-align:center; padding: 40px;">خەریکی بارکردنی زانیاری قەرزەکانە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach Header Actions
  document.getElementById('btn-add-customer')?.addEventListener('click', () => openCustomerModal());
  document.getElementById('btn-add-company')?.addEventListener('click', () => openCompanyModal());
  document.getElementById('btn-refresh-customers')?.addEventListener('click', () => loadCustomersTable());
  document.getElementById('btn-print-debts-report')?.addEventListener('click', () => printUnifiedDebtsReport());

  // Attach Type Filters
  document.querySelectorAll('.filter-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-type-btn').forEach((b) => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-secondary');
      });
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary', 'active');
      activeTypeFilter = btn.dataset.type || 'all';
      loadCustomersTable();
    });
  });

  // Attach Search Debounce
  const searchInput = document.getElementById('cust-search-input');
  let timeout = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => loadCustomersTable(), 250);
  });

  // Attach Indebted Toggle
  document.getElementById('cust-filter-indebted')?.addEventListener('change', () => {
    loadCustomersTable();
  });

  await loadCustomersTable();
}

/**
 * Load Unified Debts Table from Backend
 */
export async function loadCustomersTable() {
  const tbody = document.getElementById('customers-table-body');
  if (!tbody) return;

  const search = document.getElementById('cust-search-input')?.value.trim() || '';
  const onlyDebt = document.getElementById('cust-filter-indebted')?.checked ? '1' : '';

  let url = `/debts/unified?type=${activeTypeFilter}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (onlyDebt) url += `&only_indebted=1`;

  const res = await api.get(url);
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: #dc2626; padding: 30px;">هەڵە لە وەرگرتنی زانیاری قەرزەکان لە بنکەی زانیاری</td></tr>`;
    return;
  }

  const rows = Array.isArray(res.data) ? res.data : (res.data?.customers || res.customers || []);
  currentDebtsData = rows;
  const summary = res.summary || (res.data && res.data.summary) || {};

  // Update Summary Stats
  const elTotAll = document.getElementById('stat-total-all-debt');
  const elTotSub = document.getElementById('stat-total-debt-sub');
  const elCompDebt = document.getElementById('stat-company-debt');
  const elCompSub = document.getElementById('stat-company-debt-sub');
  const elCustDebt = document.getElementById('stat-individual-debt');
  const elCustSub = document.getElementById('stat-individual-debt-sub');
  const elSuppDebt = document.getElementById('stat-supplier-debt');

  if (elTotAll) elTotAll.textContent = formatCurrency(summary.totalAllDebt || 0);
  if (elTotSub) elTotSub.textContent = `${summary.totalIndebtedAccounts || 0} هەژماری قەرزدار لە کۆی ${summary.totalAccounts || 0}`;
  if (elCompDebt) elCompDebt.textContent = formatCurrency(summary.totalCompDebt || 0);
  if (elCompSub) elCompSub.textContent = `${summary.indebtedCompCount || 0} کۆمپانیای قەرزدار`;
  if (elCustDebt) elCustDebt.textContent = formatCurrency(summary.totalCustDebt || 0);
  if (elCustSub) elCustSub.textContent = `${summary.indebtedCustCount || 0} کڕیاری قەرزدار`;
  if (elSuppDebt) elSuppDebt.textContent = formatCurrency(summary.totalSuppDebt || 0);

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center; padding: 40px; color: var(--text-muted);">
          هیچ کڕیار یان کۆمپانیایەک نەدۆزرایەوە بەپێی ئەم فلتەرە
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((r, idx) => {
      const isCompany = r.account_type === 'company';
      const debtNum = Number(r.current_debt) || 0;
      const hasDebt = debtNum > 0;

      // Badge for account type
      const typeBadge = isCompany
        ? `<span class="badge" style="font-size: 11px; font-weight: 800; background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; padding: 3px 8px; border-radius: 4px;">🏢 کۆمپانیا</span>`
        : `<span class="badge" style="font-size: 11px; font-weight: 800; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 4px;">👤 تاک</span>`;

      // Formatted fields with fallbacks
      const ownerDisplay = isCompany && r.owner_name ? escapeHtml(r.owner_name) : '—';
      const driverDisplay = isCompany && r.driver_names ? `<span title="${escapeHtml(r.driver_names)}">👨‍✈️ ${escapeHtml(r.driver_names)}</span>` : '—';
      const vehicleDisplay = isCompany && r.vehicle_plates ? `<span title="${escapeHtml(r.vehicle_plates)}">🚛 ${escapeHtml(r.vehicle_plates)}</span>` : '—';
      const phoneDisplay = r.phone ? `<span dir="ltr" style="font-family: monospace;">${escapeHtml(r.phone)}</span>` : '—';
      const addressDisplay = r.address ? escapeHtml(r.address) : '—';

      return `
        <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0);">
          <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
          <td>${typeBadge}</td>
          <td>
            <a href="javascript:void(0)" class="btn-account-name-link" data-type="${r.account_type}" data-id="${r.id}" style="font-weight: 800; color: ${isCompany ? '#6d28d9' : '#1d4ed8'}; text-decoration: underline; font-size: 14px;">
              ${isCompany ? '🏢 ' : '👤 '}${escapeHtml(r.name)}
            </a>
          </td>
          <td>${ownerDisplay}</td>
          <td>${driverDisplay}</td>
          <td>${vehicleDisplay}</td>
          <td>${phoneDisplay}</td>
          <td>${addressDisplay}</td>
          <td>
            ${
              hasDebt
                ? `<button class="btn-debt-badge badge badge-danger" data-type="${r.account_type}" data-id="${r.id}" style="font-size: 13px; font-weight: 800; cursor: pointer; border: none; padding: 5px 10px;" title="کلیک بکە بۆ بینینی وردەکاری و کەشف حیساب">
                    ${formatCurrency(debtNum)} 🔍
                   </button>`
                : `<span class="badge badge-success" style="font-size: 12px; font-weight: 700; padding: 4px 8px;">0 د.ع (پاکە)</span>`
            }
          </td>
          <td>
            <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
              ${
                hasDebt
                  ? `<button class="btn btn-sm btn-success btn-quick-pay" data-type="${r.account_type}" data-id="${r.id}" data-name="${escapeHtml(r.name)}" data-debt="${debtNum}" style="font-weight: 700;">
                      💵 وەرگرتن
                     </button>`
                  : ''
              }
              <button class="btn btn-sm btn-primary btn-view-account" data-type="${r.account_type}" data-id="${r.id}" style="font-weight: 700;">
                🔍 وردەکاری
              </button>
              <button class="btn btn-sm btn-secondary btn-edit-account" data-type="${r.account_type}" data-id="${r.id}" title="دەستکاری">
                ✏️
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Row Event Listeners
  // 1. Click Name or Debt Badge or View Details
  tbody.querySelectorAll('.btn-account-name-link, .btn-debt-badge, .btn-view-account').forEach((el) => {
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

  // 2. Click Pay Debt
  tbody.querySelectorAll('.btn-quick-pay').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const debt = Number(btn.dataset.debt);

      if (type === 'company') {
        openPayCompanyDebtModal(id, name, debt, () => {
          loadCustomersTable();
        });
      } else {
        openPayDebtModal(id, name, debt, () => {
          loadCustomersTable();
        });
      }
    });
  });

  // 3. Click Edit Account
  tbody.querySelectorAll('.btn-edit-account').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      const id = btn.dataset.id;

      if (type === 'company') {
        openCompanyModal(id);
      } else {
        const custRes = await api.get(`/customers/${id}`);
        if (custRes.success && custRes.data) {
          openCustomerModal(custRes.data);
        } else {
          openCustomerModal({ id });
        }
      }
    });
  });
}

/**
 * Print General A4 Debts Report (کەشف حیسابی گشتی قەرزەکان)
 */
export function printUnifiedDebtsReport() {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const filtered = currentDebtsData.filter((r) => Number(r.current_debt) > 0);
  const totalDebt = filtered.reduce((sum, r) => sum + (Number(r.current_debt) || 0), 0);

  const html = `
    <div class="a4-invoice-wrapper" dir="rtl">
      <div class="a4-invoice-container" style="padding: 24px; font-family: 'Vazirmatn', sans-serif;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a;">سەنگەر زمارەیی و جێگر زمارەیی</h1>
            <div style="font-size: 13px; color: #475569; margin-top: 2px;">بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و چاککردنەوە</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">مۆبایل: 07503149696 - 07504687412 | هەولێر - ناوچەی پیشەسازی باکوور</div>
          </div>
          <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 16px; border-radius: 8px;">
            <div style="font-size: 16px; font-weight: 900; color: #0f172a;">ڕاپۆرتی گشتی قەرزەکان</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">ALL ACTIVE DEBTS STATEMENT</div>
            <div style="font-size: 12px; font-weight: 700; margin-top: 4px;">بەروار: ${dateStr}</div>
          </div>
        </div>

        <!-- Summary Strip -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 20px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 13px; color: #991b1b; font-weight: 700;">ژمارەی هەژمارە قەرزدارەکان:</div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px;">${filtered.length} هەژمار</div>
          </div>
          <div style="text-align: left;">
            <div style="font-size: 13px; color: #991b1b; font-weight: 700;">کۆی گشتی قەرزی ماوە:</div>
            <div style="font-size: 22px; font-weight: 900; color: #dc2626; margin-top: 2px;">${formatCurrency(totalDebt)}</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd5e1; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; text-align: center; width: 30px;">#</th>
              <th style="padding: 8px; text-align: right;">جۆر</th>
              <th style="padding: 8px; text-align: right;">ناوی کڕیار / کۆمپانیا</th>
              <th style="padding: 8px; text-align: right;">خاوەن کار / پەیوەندیدار</th>
              <th style="padding: 8px; text-align: right;">شۆفێر</th>
              <th style="padding: 8px; text-align: right;">بارهەڵگر</th>
              <th style="padding: 8px; text-align: right;">مۆبایل</th>
              <th style="padding: 8px; text-align: left; color: #dc2626;">بڕی قەرز</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length === 0
                ? `<tr><td colspan="8" style="text-align: center; padding: 25px; color: #16a34a;">هیچ قەرزێک تۆمار نەکراوە ✓</td></tr>`
                : filtered
                    .map(
                      (r, idx) => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
                    <td style="padding: 6px 8px;">${r.account_type === 'company' ? 'کۆمپانیا' : 'تاک'}</td>
                    <td style="padding: 6px 8px; font-weight: 700;">${escapeHtml(r.name)}</td>
                    <td style="padding: 6px 8px;">${escapeHtml(r.owner_name || '—')}</td>
                    <td style="padding: 6px 8px;">${escapeHtml(r.driver_names || '—')}</td>
                    <td style="padding: 6px 8px;">${escapeHtml(r.vehicle_plates || '—')}</td>
                    <td style="padding: 6px 8px;" dir="ltr">${escapeHtml(r.phone || '—')}</td>
                    <td style="padding: 6px 8px; text-align: left; font-weight: 900; color: #dc2626;">${formatCurrency(r.current_debt)}</td>
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <!-- Signatures -->
        <div style="border-top: 2px solid #0f172a; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 13px; font-weight: 700;">واژۆ و مۆری وردبین / ژمێریاری:</div>
            <div style="height: 50px;"></div>
            <div style="font-size: 12px; color: #64748b;">................................................</div>
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700;">بەڕێوەبەری کۆگا:</div>
            <div style="height: 50px;"></div>
            <div style="font-size: 12px; color: #64748b;">سەنگەر و جێگر زمارەیی</div>
          </div>
        </div>
      </div>
    </div>
  `;

  printArea.innerHTML = html;
  setTimeout(() => {
    window.print();
  }, 100);
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

export function openCustomerModal(customer = null) {
  const isEdit = !!customer;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 480px;">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'دەستکاریکردنی کڕیار' : 'زیادکردنی کڕیاری نوێ'}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">ناوی کڕیار *</label>
          <input type="text" id="mc-name" class="form-control" value="${customer?.name || ''}" placeholder="ناوی تەواو..." required />
        </div>
        <div class="form-group">
          <label class="form-label">ژمارەی مۆبایل</label>
          <input type="text" id="mc-phone" class="form-control" value="${customer?.phone || ''}" placeholder="0750xxxxxxx" />
        </div>
        <div class="form-group">
          <label class="form-label">ناونیشان</label>
          <input type="text" id="mc-address" class="form-control" value="${customer?.address || ''}" placeholder="شار / ناوچەی پیشەسازی..." />
        </div>
        <div class="form-group">
          <label class="form-label">تێبینی</label>
          <input type="text" id="mc-notes" class="form-control" value="${customer?.notes || ''}" placeholder="تێبینی ئارەزوومەندانە..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary mc-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="mc-save-btn">${isEdit ? 'پاشەکەوتکردن' : 'تۆمارکردن'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.mc-cancel').addEventListener('click', closeModal);

  modal.querySelector('#mc-save-btn').addEventListener('click', async () => {
    const name = modal.querySelector('#mc-name').value.trim();
    const phone = modal.querySelector('#mc-phone').value.trim();
    const address = modal.querySelector('#mc-address').value.trim();
    const notes = modal.querySelector('#mc-notes').value.trim();

    if (!name) {
      showToast('ناوی کڕیار پێویستە', 'error');
      return;
    }

    const payload = { name, phone: phone || null, address: address || null, notes: notes || null };

    let res;
    if (isEdit) {
      res = await api.put(`/customers/${customer.id}`, payload);
    } else {
      res = await api.post('/customers', payload);
    }

    if (res.success) {
      showToast(res.message || 'سەرکەوتوو بوو', 'success');
      closeModal();
      loadCustomersTable();
    } else {
      showToast(res.message || 'هەڵە لە پاشەکەوتکردن', 'error');
    }
  });
}

export function openPayDebtModal(customerId, customerName, currentDebt, onSuccess = null) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 460px;">
      <div class="modal-header">
        <h3 class="modal-title">وەرگرتنەوەی قەرزی کڕیار</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
          <div style="font-weight: 700; color: var(--text-main); font-size: 14px;">کڕیار: ${customerName}</div>
          <div style="font-size: 18px; color: #dc2626; font-weight: 900; margin-top: 6px;">
            کۆی قەرزی ئێستا: ${formatCurrency(currentDebt)}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">بڕی پارەی دراو (د.ع) *</label>
          <input type="number" id="pd-amount" class="form-control" style="font-size: 17px; font-weight: 800; color: #16a34a;" value="${currentDebt}" min="1" max="${currentDebt}" required />
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            دەتوانیت هەموو بڕەکە یان بەشێکی لێ وەرگریتەوە (کەمتر یان یەکسان بە قەرزی ئێستا).
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">بەرواری پارەدان</label>
          <input type="date" id="pd-date" class="form-control" value="${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date())}" />
        </div>

        <div class="form-group">
          <label class="form-label">تێبینی (ئارەزوومەندانە)</label>
          <input type="text" id="pd-notes" class="form-control" placeholder="بۆ نموونە: قیستی مانگانە / پارەدان لە دووکان..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary pd-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-success" id="pd-submit-btn">✓ تۆمارکردنی پارەدان</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.pd-cancel').addEventListener('click', closeModal);

  modal.querySelector('#pd-submit-btn').addEventListener('click', async () => {
    const amount = Number(modal.querySelector('#pd-amount').value);
    const paymentDate = modal.querySelector('#pd-date').value;
    const notes = modal.querySelector('#pd-notes').value.trim();

    if (!amount || amount <= 0) {
      showToast('تکایە بڕی دروستی پارە بنووسە', 'error');
      return;
    }

    if (amount > currentDebt) {
      showToast('بڕی پارەدان ناتوانێت لە قەرزی ماوە زیاتر بێت', 'error');
      return;
    }

    const res = await api.post('/customers/pay-debt', {
      customer_id: Number(customerId),
      amount,
      payment_date: paymentDate,
      notes: notes || null,
    });

    if (res.success) {
      showToast('پارەی قەرز بە سەرکەوتوویی تۆمارکرا ✓', 'success');
      closeModal();
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی پارەدان', 'error');
    }
  });
}

/**
 * Open Detailed Customer Debt & Invoices History Modal
 */
export async function openCustomerDebtDetailsModal(customerId) {
  const loadingModal = document.createElement('div');
  loadingModal.className = 'modal-backdrop show';
  loadingModal.innerHTML = `
    <div class="modal-box" style="max-width: 400px; text-align: center; padding: 30px;">
      <div style="font-size: 24px; margin-bottom: 12px;">⏳</div>
      <div style="font-weight: 700;">خەریکی بارکردنی تەواوی مێژووی قەرزەکانە...</div>
    </div>
  `;
  document.body.appendChild(loadingModal);

  const res = await api.get(`/customers/${customerId}/debt-details`);
  loadingModal.remove();

  if (!res.success || !res.data) {
    showToast('هەڵە لە بارکردنی زانیاری قەرزی کڕیار', 'error');
    return;
  }

  const { customer, summary, debts: rawDebts, payments: rawPayments } = res.data;
  let activeFilter = 'all';
  let activeSort = 'newest';

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.style.zIndex = '9999';

  function renderModalContent() {
    // Filter Debts
    let filteredDebts = [...rawDebts];
    const baghdadToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date());
    const currentYear = baghdadToday.slice(0, 4);
    const currentMonth = baghdadToday.slice(0, 7);

    if (activeFilter === 'remaining') {
      filteredDebts = filteredDebts.filter((d) => d.remaining_debt > 0);
    } else if (activeFilter === 'paid') {
      filteredDebts = filteredDebts.filter((d) => d.remaining_debt === 0);
    } else if (activeFilter === 'this_month') {
      filteredDebts = filteredDebts.filter((d) => (d.sale_date || '').startsWith(currentMonth));
    } else if (activeFilter === 'last_3_months') {
      const dLimit = new Date();
      dLimit.setMonth(dLimit.getMonth() - 3);
      const isoLimit = dLimit.toISOString().slice(0, 10);
      filteredDebts = filteredDebts.filter((d) => (d.sale_date || '') >= isoLimit);
    } else if (activeFilter === 'last_6_months') {
      const dLimit = new Date();
      dLimit.setMonth(dLimit.getMonth() - 6);
      const isoLimit = dLimit.toISOString().slice(0, 10);
      filteredDebts = filteredDebts.filter((d) => (d.sale_date || '') >= isoLimit);
    } else if (activeFilter === 'this_year') {
      filteredDebts = filteredDebts.filter((d) => (d.sale_date || '').startsWith(currentYear));
    }

    // Sort Debts
    if (activeSort === 'newest') {
      filteredDebts.sort((a, b) => (b.sale_date || '').localeCompare(a.sale_date || '') || b.sale_id - a.sale_id);
    } else if (activeSort === 'oldest') {
      filteredDebts.sort((a, b) => (a.sale_date || '').localeCompare(b.sale_date || '') || a.sale_id - b.sale_id);
    } else if (activeSort === 'highest_debt') {
      filteredDebts.sort((a, b) => b.debt_created - a.debt_created);
    } else if (activeSort === 'lowest_debt') {
      filteredDebts.sort((a, b) => a.debt_created - b.debt_created);
    }

    // Debt Cards / Table
    const debtsHtml = filteredDebts.length
      ? filteredDebts
          .map((d, index) => {
            const ageLabel = getRelativeDebtAge(d.sale_date);
            let statusBadge = '';
            if (d.status === 'paid' || d.remaining_debt === 0) {
              statusBadge = `<span class="badge badge-success" style="font-size: 12px; font-weight: 800;">✓ تەواو دراوە</span>`;
            } else if (d.status === 'partial' || (d.paid_later > 0 && d.remaining_debt > 0)) {
              statusBadge = `<span class="badge badge-warning" style="font-size: 12px; font-weight: 800;">⏳ بەشێکی دراوە</span>`;
            } else {
              statusBadge = `<span class="badge badge-danger" style="font-size: 12px; font-weight: 800;">⚠️ نەدراوە</span>`;
            }

            const itemsRows = (d.items || []).length
              ? d.items
                  .map(
                    (it, itIdx) => `
                <tr>
                  <td>${itIdx + 1}</td>
                  <td><strong>${it.product_name}</strong></td>
                  <td style="direction: ltr; text-align: right;">${it.part_number || '-'}</td>
                  <td>${it.quantity}</td>
                  <td>${formatCurrency(it.unit_price)}</td>
                  <td><strong>${formatCurrency(it.total_price)}</strong></td>
                </tr>
              `
                  )
                  .join('')
              : `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 10px;">کاڵاکان بار نەکراون</td></tr>`;

            return `
            <div class="debt-invoice-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                  <span style="font-weight: 800; font-size: 14px; color: var(--text-main);">
                    پسووڵەی فرۆشتن: <strong style="direction: ltr; display: inline-block;">#${d.receipt_number}</strong>
                  </span>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    📅 بەرواری فرۆشتن: <strong>${d.sale_date}</strong> | کاشێر: ${d.cashier_name || 'جێگر'}
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 12px; border: 1px solid #cbd5e1;">
                    🕒 ماوەی قەرز: ${ageLabel}
                  </span>
                  ${statusBadge}
                </div>
              </div>

              <!-- Financial Breakdown for this specific invoice -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 12px;">
                <div>
                  <span style="color: var(--text-muted);">کۆی کڕین:</span>
                  <div style="font-weight: 700; font-size: 13px;">${formatCurrency(d.original_sale_total)}</div>
                </div>
                <div>
                  <span style="color: var(--text-muted);">پارەی دراو سەرەتا:</span>
                  <div style="font-weight: 700; font-size: 13px; color: #16a34a;">${formatCurrency(d.paid_at_sale)}</div>
                </div>
                <div>
                  <span style="color: var(--text-muted);">قەرزی دروستکراو:</span>
                  <div style="font-weight: 700; font-size: 13px; color: #dc2626;">${formatCurrency(d.debt_created)}</div>
                </div>
                <div>
                  <span style="color: var(--text-muted);">پارەی دراو دواتر:</span>
                  <div style="font-weight: 700; font-size: 13px; color: #2563eb;">${formatCurrency(d.paid_later)}</div>
                </div>
                <div>
                  <span style="color: var(--text-muted);">قەرزی ماوە:</span>
                  <div style="font-weight: 900; font-size: 14px; color: ${d.remaining_debt > 0 ? '#dc2626' : '#16a34a'};">
                    ${formatCurrency(d.remaining_debt)}
                  </div>
                </div>
              </div>

              <!-- Itemized Products in this Debt Invoice -->
              <details style="margin-top: 6px; cursor: pointer;">
                <summary style="font-size: 12px; font-weight: 700; color: var(--primary, #1e40af); outline: none; padding: 4px 0;">
                  📦 ئەم قەرزە بۆ ئەم کاڵایانە بوو (${d.items?.length || 0} کاڵا - کرتە بکە بۆ پیشاندان)
                </summary>
                <div class="table-responsive" style="margin-top: 8px;">
                  <table class="table" style="font-size: 12px;">
                    <thead>
                      <tr style="background: #f1f5f9;">
                        <th>#</th>
                        <th>ناوی کاڵا</th>
                        <th>Part Number</th>
                        <th>ژمارە</th>
                        <th>نرخی تاک</th>
                        <th>کۆی گشتی</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsRows}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          `;
          })
          .join('')
      : `<div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 8px; color: var(--text-muted);">هیچ پسووڵەیەکی قەرز بۆ ئەم فلتەرە نەدۆزرایەوە</div>`;

    // Debt Payments History Table
    const paymentsHtml = (rawPayments || []).length
      ? rawPayments
          .map(
            (p, pIdx) => `
          <tr>
            <td>${pIdx + 1}</td>
            <td><strong>${p.payment_date}</strong></td>
            <td><strong style="color: #16a34a; font-size: 14px;">${formatCurrency(p.amount)}</strong></td>
            <td><span style="color: #dc2626;">${formatCurrency(p.previous_balance)}</span></td>
            <td><span style="color: #16a34a; font-weight: 700;">${formatCurrency(p.new_balance)}</span></td>
            <td>${p.cashier_name || 'کاشێر'}</td>
            <td>${p.notes || '-'}</td>
          </tr>
        `
          )
          .join('')
      : `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">هیچ پارەدانێک تۆمار نەکراوە</td></tr>`;

    // Last payment summary line
    const lastPayInfo = summary.last_payment
      ? `${formatCurrency(summary.last_payment.amount)} لە بەرواری ${summary.last_payment.payment_date} (${summary.last_payment.cashier_name || 'کاشێر'})`
      : 'تۆمار نەکراوە';

    // Last purchase summary line
    const lastPurchInfo = summary.last_purchase
      ? `پسووڵەی #${summary.last_purchase.receipt_number} لە ${summary.last_purchase.sale_date} (${formatCurrency(summary.last_purchase.total_amount)})`
      : 'تۆمار نەکراوە';

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 900px; width: 95vw; max-height: 92vh; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div class="modal-header" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
          <div>
            <h3 class="modal-title" style="font-size: 18px; display: flex; align-items: center; gap: 8px;">
              <span>📋 کەشف هەژمار و وردەکاری قەرزی کڕیار:</span>
              <span style="color: var(--primary); font-weight: 900;">${customer.name}</span>
            </h3>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              تەواوی مێژووی پسووڵە قەرزەکان، کاڵاکان، و وەرگرتنەوەی قیستەکان
            </div>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="modal-body" style="overflow-y: auto; padding: 16px; flex: 1;">
          
          <!-- 1. Customer Summary Card -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">ناوی کڕیار:</div>
                <div style="font-size: 15px; font-weight: 800;">${customer.name}</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">ژمارەی مۆبایل:</div>
                <div style="font-size: 14px; font-weight: 700; direction: ltr; text-align: right;">${customer.phone || '-'}</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">ناونیشان:</div>
                <div style="font-size: 13px;">${customer.address || '-'}</div>
              </div>
              <div style="background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px solid ${summary.current_debt > 0 ? '#fca5a5' : '#86efac'};">
                <div style="font-size: 12px; color: var(--text-muted);">کۆی قەرزی ئێستا:</div>
                <div style="font-size: 20px; font-weight: 900; color: ${summary.current_debt > 0 ? '#dc2626' : '#16a34a'};">
                  ${formatCurrency(summary.current_debt)}
                </div>
              </div>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;" />

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 13px;">
              <div><strong>کۆی کڕین:</strong> ${formatCurrency(summary.total_spent)}</div>
              <div><strong>کۆی پارەی دراو:</strong> <span style="color: #16a34a; font-weight: 700;">${formatCurrency(summary.total_paid)}</span></div>
              <div><strong>دوا پارەدان:</strong> ${lastPayInfo}</div>
              <div><strong>کۆتا کڕین:</strong> ${lastPurchInfo}</div>
            </div>
          </div>

          <!-- Total Debt Breakdown banner -->
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-weight: 800; color: #92400e; font-size: 13px;">📊 دابەشبوونی کۆی قەرزەکان:</div>
              <div style="font-size: 12px; color: #78350f; margin-top: 2px;">
                کۆی قەرزی دروستکراو لە ${summary.total_debt_invoices} پسووڵە = <strong>${formatCurrency(summary.total_original_debt)}</strong> | 
                پارەی دراو دواتر = <strong>${formatCurrency(summary.total_debt_paid_later)}</strong> | 
                ماوەی تەواو = <strong style="color: #b91c1c; font-size: 14px;">${formatCurrency(summary.current_debt)}</strong>
              </div>
            </div>
            ${
              summary.current_debt > 0
                ? `<button class="btn btn-success btn-sm btn-modal-quick-pay" style="font-weight: 800;">
                    💵 وەرگرتنی قەرز
                   </button>`
                : ''
            }
          </div>

          <!-- 2. Debt History Header & Filters -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
            <h4 style="font-size: 15px; font-weight: 800; margin: 0;">
              مێژووی قەرزەکان و پسووڵەکان (${rawDebts.length} پسووڵە)
            </h4>
            
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <!-- Filter Dropdown / Buttons -->
              <select id="modal-filter-debt" class="form-control" style="width: auto; padding: 4px 8px; font-size: 12px; height: 32px;">
                <option value="all" ${activeFilter === 'all' ? 'selected' : ''}>هەموو پسووڵەکان</option>
                <option value="remaining" ${activeFilter === 'remaining' ? 'selected' : ''}>تەنها قەرزی ماوە</option>
                <option value="paid" ${activeFilter === 'paid' ? 'selected' : ''}>تەواو دراوە</option>
                <option value="this_month" ${activeFilter === 'this_month' ? 'selected' : ''}>ئەم مانگە</option>
                <option value="last_3_months" ${activeFilter === 'last_3_months' ? 'selected' : ''}>3 مانگی ڕابردوو</option>
                <option value="last_6_months" ${activeFilter === 'last_6_months' ? 'selected' : ''}>6 مانگی ڕابردوو</option>
                <option value="this_year" ${activeFilter === 'this_year' ? 'selected' : ''}>ساڵی ئەمساڵ</option>
              </select>

              <!-- Sort Dropdown -->
              <select id="modal-sort-debt" class="form-control" style="width: auto; padding: 4px 8px; font-size: 12px; height: 32px;">
                <option value="newest" ${activeSort === 'newest' ? 'selected' : ''}>نوێترین بەروار</option>
                <option value="oldest" ${activeSort === 'oldest' ? 'selected' : ''}>کۆنترین بەروار</option>
                <option value="highest_debt" ${activeSort === 'highest_debt' ? 'selected' : ''}>بەرزترین بڕی قەرز</option>
                <option value="lowest_debt" ${activeSort === 'lowest_debt' ? 'selected' : ''}>کەمترین بڕی قەرز</option>
              </select>
            </div>
          </div>

          <!-- Debt Invoices Cards Container -->
          <div id="modal-debts-list-container" style="margin-bottom: 24px;">
            ${debtsHtml}
          </div>

          <!-- 3. Debt Payment History Section -->
          <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 8px;">
            💵 مێژووی پارەدان و گەڕاندنەوەی قەرز (${rawPayments.length} جار)
          </h4>
          <div class="table-responsive" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <table class="table" style="font-size: 13px; margin: 0;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th>#</th>
                  <th>بەرواری پارەدان</th>
                  <th>بڕی پارەی دراو</th>
                  <th>قەرزی پێش پارەدان</th>
                  <th>قەرزی دوای پارەدان</th>
                  <th>کاشێر</th>
                  <th>تێبینی</th>
                </tr>
              </thead>
              <tbody>
                ${paymentsHtml}
              </tbody>
            </table>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="modal-footer" style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" id="btn-pdf-cust-acc" title="پاشەکەوتکردنی هەژماری کڕیار بە PDF">
              📥 پاشەکەوتکردن بە PDF
            </button>
            <button class="btn btn-secondary btn-print-customer-account" id="btn-print-cust-acc">
              🖨️ چاپی هەژماری کڕیار
            </button>
            ${
              summary.current_debt > 0
                ? `<button class="btn btn-success btn-modal-quick-pay">
                    💵 وەرگرتنی قەرز
                   </button>`
                : ''
            }
          </div>
          <button class="btn btn-secondary modal-close-btn-bottom">داخستن</button>
        </div>

      </div>
    `;

    // Attach internal event handlers
    modal.querySelectorAll('.modal-close-btn, .modal-close-btn-bottom').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });

    modal.querySelector('#modal-filter-debt')?.addEventListener('change', (e) => {
      activeFilter = e.target.value;
      renderModalContent();
    });

    modal.querySelector('#modal-sort-debt')?.addEventListener('change', (e) => {
      activeSort = e.target.value;
      renderModalContent();
    });

    modal.querySelectorAll('.btn-modal-quick-pay').forEach((btn) => {
      btn.addEventListener('click', () => {
        openPayDebtModal(customer.id, customer.name, summary.current_debt, () => {
          closeModal();
          openCustomerDebtDetailsModal(customer.id);
          loadCustomersTable();
        });
      });
    });

    modal.querySelector('#btn-print-cust-acc')?.addEventListener('click', () => {
      printCustomerAccount({ customer, summary, debts: rawDebts, payments: rawPayments });
    });

    modal.querySelector('#btn-pdf-cust-acc')?.addEventListener('click', () => {
      printCustomerAccount({ customer, summary, debts: rawDebts, payments: rawPayments });
    });
  }

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  renderModalContent();
}

/**
 * Print Official Kurdish Customer Account Statement (A4 Standard)
 */
export function printCustomerAccount({ customer, summary, debts, payments }) {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const baghdadToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date());

  const debtsRows = (debts || [])
    .map((d, idx) => {
      const age = getRelativeDebtAge(d.sale_date);
      const itemsList = (d.items || []).map((it) => `${it.product_name} (${it.quantity} دانە)`).join('، ') || '-';
      const statusText = d.remaining_debt === 0 ? 'تەواو دراوە' : d.paid_later > 0 ? 'بەشێکی دراوە' : 'نەدراوە';

      return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="direction: ltr; text-align: center;">#${d.receipt_number}</td>
        <td style="text-align: center;">${d.sale_date}</td>
        <td style="font-size: 11px;">${itemsList}</td>
        <td style="text-align: left;">${formatCurrency(d.original_sale_total)}</td>
        <td style="text-align: left;">${formatCurrency(d.paid_at_sale)}</td>
        <td style="text-align: left;">${formatCurrency(d.debt_created)}</td>
        <td style="text-align: left;">${formatCurrency(d.paid_later)}</td>
        <td style="text-align: left; font-weight: bold; color: ${d.remaining_debt > 0 ? '#b91c1c' : '#15803d'};">${formatCurrency(d.remaining_debt)}</td>
        <td style="text-align: center;">${statusText}</td>
        <td style="text-align: center; font-size: 11px;">${age}</td>
      </tr>
    `;
    })
    .join('');

  const paymentsRows = (payments || [])
    .map(
      (p, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="text-align: center;">${p.payment_date}</td>
        <td style="text-align: left; font-weight: bold; color: #15803d;">${formatCurrency(p.amount)}</td>
        <td style="text-align: left;">${formatCurrency(p.previous_balance)}</td>
        <td style="text-align: left;">${formatCurrency(p.new_balance)}</td>
        <td style="text-align: center;">${p.cashier_name || 'کاشێر'}</td>
        <td>${p.notes || '-'}</td>
      </tr>
    `
    )
    .join('');

  printArea.innerHTML = `
    <div class="report-print-a4" dir="rtl">
      <!-- Store Header -->
      <div class="rep-header">
        <div class="rep-title" style="font-size: 22px; font-weight: 900;">سەنگەر زمارەیی و جێگر زمارەیی</div>
        <div class="rep-subtitle">بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و تڕێلە (ئەکتڕۆس، مان، سکانیا، ڤۆڵڤۆ، ئیڤیکۆ)</div>
        <div style="font-size: 12px; margin-top: 4px; color: #475569;">
          📍 هەولێر - ناوچەی پیشەسازی باکوور | 📱 جێگر: 07503149696 - سەنگەر: 07504687412
        </div>
        <div style="font-size: 16px; font-weight: 800; margin-top: 10px; text-decoration: underline;">
          کەشف هەژمار و مێژووی قەرزی کڕیار (Customer Debt Statement)
        </div>
      </div>

      <!-- Customer & Statement Meta -->
      <div class="rep-meta-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 14px;">
        <div><strong>ناوی کڕیار:</strong> ${customer.name}</div>
        <div><strong>ژمارەی مۆبایل:</strong> <span style="direction: ltr; display: inline-block;">${customer.phone || '-'}</span></div>
        <div><strong>ناونیشان:</strong> ${customer.address || '-'}</div>
        <div><strong>بەرواری چاپ:</strong> ${baghdadToday}</div>
      </div>

      <!-- Financial Balance Summary -->
      <table class="rep-summary-table" style="margin-bottom: 16px;">
        <thead>
          <tr>
            <th>کۆی کڕینەکان</th>
            <th>کۆی پارەی دراو</th>
            <th>کۆی قەرزی ئێستا</th>
            <th>ژمارەی پسووڵە قەرزەکان</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold;">${formatCurrency(summary.total_spent)}</td>
            <td style="font-weight: bold; color: #15803d;">${formatCurrency(summary.total_paid)}</td>
            <td style="font-size: 16px; font-weight: 900; color: ${summary.current_debt > 0 ? '#b91c1c' : '#15803d'};">
              ${formatCurrency(summary.current_debt)}
            </td>
            <td>${summary.total_debt_invoices || debts.length} پسووڵە</td>
          </tr>
        </tbody>
      </table>

      <!-- Debt Invoices History Table -->
      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">مێژووی پسووڵە قەرزەکان و کاڵاکانی فرۆشراو:</div>
      <table class="rep-table" style="margin-bottom: 16px; font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th>پسووڵە</th>
            <th>بەروار</th>
            <th>کاڵاکان</th>
            <th>کۆی کڕین</th>
            <th>سەرەتا دراو</th>
            <th>قەرزی دروستکراو</th>
            <th>دواتر دراو</th>
            <th>قەرزی ماوە</th>
            <th>دۆخ</th>
            <th>ماوەی قەرز</th>
          </tr>
        </thead>
        <tbody>
          ${debtsRows || '<tr><td colspan="11" style="text-align:center;">هیچ قەرزێک تۆمار نەکراوە</td></tr>'}
        </tbody>
      </table>

      <!-- Payments Table -->
      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">مێژووی وەرگرتنەوەی پارەدانەکانی قەرز:</div>
      <table class="rep-table" style="margin-bottom: 24px; font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th>بەرواری پارەدان</th>
            <th>بڕی پارەی دراو</th>
            <th>قەرزی پێشوو</th>
            <th>قەرزی نوێ</th>
            <th>کاشێر</th>
            <th>تێبینی</th>
          </tr>
        </thead>
        <tbody>
          ${paymentsRows || '<tr><td colspan="7" style="text-align:center;">هیچ پارەدانێک تۆمار نەکراوە</td></tr>'}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <div class="rep-footer" style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 20px;">
        <div style="text-align: center;">
          <div>واژووی کڕیار:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
        <div style="text-align: center;">
          <div>مۆر و واژووی کۆگا / ژمێریاری:</div>
          <div style="margin-top: 35px; border-top: 1px dashed #334155; width: 160px;"></div>
        </div>
      </div>
    </div>
  `;

  window.print();
  setTimeout(() => {
    printArea.innerHTML = '';
  }, 1000);
}
