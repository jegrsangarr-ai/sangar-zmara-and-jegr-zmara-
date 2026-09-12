/**
 * Companies, Drivers, Vehicles & Company Debts Module
 * Kurdish Sorani RTL Interface
 * Specifically designed for truck parts and fleet accounts
 */
import { api, formatCurrency, showToast } from '../api.js';
import { printSaleReceipt, downloadSaleInvoicePdf, printDriverReport, printVehicleReport } from '../receipt.js';

export async function initCompaniesPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">کۆمپانیا و شۆفێرەکان</h2>
        <div class="section-subtitle">بەڕێوەبردنی ئەژمێری کۆمپانیاکان، شۆفێر، بارهەڵگر، و قەرزی کەڵەکەبوو</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary" id="btn-add-company">➕ کۆمپانیای نوێ</button>
        <button class="btn btn-secondary" id="btn-refresh-companies">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="stat-grid" style="margin-bottom: 20px;">
      <div class="stat-card">
        <div class="stat-icon blue">🏢</div>
        <div class="stat-content">
          <div class="stat-label">کۆی کۆمپانیا تۆمارکراوەکان</div>
          <div class="stat-value" id="stat-total-companies">0</div>
          <div class="stat-sub">کۆمپانیای چالاک</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon red">💳</div>
        <div class="stat-content">
          <div class="stat-label">کۆی قەرزی سەر کۆمپانیاکان</div>
          <div class="stat-value" id="stat-total-company-debt" style="color: #dc2626;">0 د.ع</div>
          <div class="stat-sub" id="stat-indebted-companies-count">0 کۆمپانیا قەرزدارن</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon green">🚛</div>
        <div class="stat-content">
          <div class="stat-label">کۆی شۆفێر و بارهەڵگرەکان</div>
          <div class="stat-value" id="stat-total-drivers-vehicles">0</div>
          <div class="stat-sub">شۆفێری تۆمارکراو</div>
        </div>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="card" style="padding: 16px; margin-bottom: 16px;">
      <div class="form-row" style="align-items: center; gap: 16px;">
        <div class="form-col" style="flex: 2;">
          <input type="text" id="company-search-input" class="form-control" placeholder="🔍 گەڕان بەپێی ناوی کۆمپانیا، خاوەن کار، مۆبایل، ناونیشان..." />
        </div>
        <div class="form-col" style="flex: 0 0 auto;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; cursor: pointer; user-select: none; background: var(--bg-hover, #f1f5f9); padding: 8px 14px; border-radius: 6px;">
            <input type="checkbox" id="company-filter-indebted" style="width: 16px; height: 16px; accent-color: var(--primary);" />
            <span>📋 تەنها خاوەن قەرزەکان</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Companies Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>ناوی کۆمپانیا</th>
              <th>خاوەن / بەڕێوەبەر</th>
              <th>مۆبایل</th>
              <th>ژمارەی شۆفێر</th>
              <th>ژمارەی بارهەڵگر</th>
              <th>کۆی قەرز</th>
              <th>کردارەکان</th>
            </tr>
          </thead>
          <tbody id="companies-table-body">
            <tr><td colspan="8" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-add-company')?.addEventListener('click', () => openCompanyModal());
  document.getElementById('btn-refresh-companies')?.addEventListener('click', () => loadCompaniesTable());

  const searchInput = document.getElementById('company-search-input');
  let timeout = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => loadCompaniesTable(), 250);
  });

  document.getElementById('company-filter-indebted')?.addEventListener('change', () => {
    loadCompaniesTable();
  });

  await loadCompaniesTable();
}

export async function loadCompaniesTable() {
  const tbody = document.getElementById('companies-table-body');
  if (!tbody) return;

  const searchVal = document.getElementById('company-search-input')?.value.trim() || '';
  const onlyIndebted = document.getElementById('company-filter-indebted')?.checked;

  let url = `/companies?limit=100`;
  if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;
  if (onlyIndebted) url += `&only_indebted=1`;

  const res = await api.get(url);
  if (!res.success) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: #dc2626;">هەڵە لە بارکردنی زانیاری کۆمپانیاکان</td></tr>`;
    return;
  }

  const companies = Array.isArray(res.data) ? res.data : (res.data?.companies || res.companies || []);

  // Update stats
  const totalDebt = companies.reduce((acc, c) => acc + (Number(c.current_debt) || 0), 0);
  const indebtedCount = companies.filter((c) => Number(c.current_debt) > 0).length;
  const totalDrivers = companies.reduce((acc, c) => acc + (Number(c.driver_count) || 0), 0);

  const statTotal = document.getElementById('stat-total-companies');
  const statDebt = document.getElementById('stat-total-company-debt');
  const statIndebted = document.getElementById('stat-indebted-companies-count');
  const statDrivers = document.getElementById('stat-total-drivers-vehicles');

  if (statTotal) statTotal.textContent = String(res.total || companies.length);
  if (statDebt) statDebt.textContent = formatCurrency(totalDebt);
  if (statIndebted) statIndebted.textContent = `${indebtedCount} کۆمپانیا قەرزدارن`;
  if (statDrivers) statDrivers.textContent = `${totalDrivers} شۆفێر`;

  if (companies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ کۆمپانیایەک نەدۆزرایەوە</td></tr>`;
    return;
  }

  tbody.innerHTML = companies
    .map((c, idx) => {
      const debt = Number(c.current_debt) || 0;
      const isIndebted = debt > 0;
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <a href="javascript:void(0)" class="btn-view-company-profile" data-id="${c.id}" style="font-weight: 800; color: var(--primary, #1e40af); font-size: 15px; display: inline-flex; align-items: center; gap: 6px;">
            🏢 ${escapeHtml(c.name)}
          </a>
          ${c.notes ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(c.notes)}</div>` : ''}
        </td>
        <td>${escapeHtml(c.owner_name) || '—'}</td>
        <td>
          <span dir="ltr" style="font-family: monospace; font-weight: 700;">${escapeHtml(c.phone) || '—'}</span>
        </td>
        <td>
          <span class="badge badge-info" style="font-size: 12px; font-weight: 700;">
            ${Number(c.driver_count) || 0} شۆفێر
          </span>
        </td>
        <td>
          <span class="badge badge-secondary" style="font-size: 12px; font-weight: 700;">
            ${Number(c.vehicle_count) || 0} بارهەڵگر
          </span>
        </td>
        <td>
          <strong style="color: ${isIndebted ? '#dc2626' : '#16a34a'}; font-size: 15px; font-weight: 800;">
            ${formatCurrency(debt)}
          </strong>
        </td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${
              isIndebted
                ? `<button class="btn btn-sm btn-success btn-pay-company-debt" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-debt="${debt}" title="وەرگرتنەوەی پارەی قەرز">
                    💵 وەرگرتنی پارە
                   </button>`
                : ''
            }
            <button class="btn btn-sm btn-primary btn-view-company-profile" data-id="${c.id}" title="وردەکاری ئەژمێر و کەشف حیساب">
              📂 ئەژمێر
            </button>
            <button class="btn btn-sm btn-secondary btn-edit-company" data-id="${c.id}" title="دەستکاری">
              ✏️
            </button>
            <button class="btn btn-sm btn-outline btn-delete-company" data-id="${c.id}" data-name="${escapeHtml(c.name)}" style="color: #dc2626;" title="سڕینەوە">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  // Event handlers
  tbody.querySelectorAll('.btn-view-company-profile').forEach((el) => {
    el.addEventListener('click', () => openCompanyAccountModal(el.dataset.id));
  });

  tbody.querySelectorAll('.btn-pay-company-debt').forEach((btn) => {
    btn.addEventListener('click', () => {
      openPayCompanyDebtModal(btn.dataset.id, btn.dataset.name, Number(btn.dataset.debt), () => {
        loadCompaniesTable();
      });
    });
  });

  tbody.querySelectorAll('.btn-edit-company').forEach((btn) => {
    btn.addEventListener('click', () => openCompanyModal(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-delete-company').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      if (confirm(`دڵنیایت دەتەوێت کۆمپانیای (${name}) بسڕیتەوە؟`)) {
        const delRes = await api.delete(`/companies/${id}`);
        if (delRes.success) {
          showToast('کۆمپانیا بە سەرکەوتوویی سڕایەوە', 'success');
          loadCompaniesTable();
        } else {
          showToast(delRes.message || 'هەڵە لە سڕینەوەی کۆمپانیا', 'error');
        }
      }
    });
  });
}

/**
 * Add / Edit Company Modal
 */
export async function openCompanyModal(companyId = null) {
  let companyData = null;
  if (companyId) {
    const res = await api.get(`/companies/${companyId}`);
    if (res.success && res.data) {
      companyData = res.data;
    }
  }

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 540px;">
      <div class="modal-header">
        <h3 class="modal-title">${companyId ? 'دەستکاریکردنی زانیاری کۆمپانیا' : '➕ زیادکردنی کۆمپانیای نوێ'}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">ناوی کۆمپانیا *</label>
          <input type="text" id="cmp-name" class="form-control" placeholder="ناوی کۆمپانیا بنووسە..." value="${escapeHtml(companyData?.name || '')}" required />
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">ناوی خاوەن کار / بەڕێوەبەر</label>
          <input type="text" id="cmp-owner" class="form-control" placeholder="ناوی کەسی بەرپرس..." value="${escapeHtml(companyData?.owner_name || '')}" />
        </div>

        <div class="form-row" style="gap: 12px; margin-bottom: 14px;">
          <div class="form-col" style="flex: 1;">
            <label class="form-label" style="font-weight: 700;">ژمارەی مۆبایلی سەرەکی *</label>
            <input type="text" id="cmp-phone" class="form-control" placeholder="0750xxxxxxx" dir="ltr" value="${escapeHtml(companyData?.phone || '')}" />
          </div>
          <div class="form-col" style="flex: 1;">
            <label class="form-label" style="font-weight: 700;">ژمارەی دووەم (ئارەزوومەندانە)</label>
            <input type="text" id="cmp-phone2" class="form-control" placeholder="0780xxxxxxx" dir="ltr" value="${escapeHtml(companyData?.phone_2 || '')}" />
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">ناونیشان / بنکەی کۆمپانیا</label>
          <input type="text" id="cmp-address" class="form-control" placeholder="هەولێر، ناوچەی پیشەسازی..." value="${escapeHtml(companyData?.address || '')}" />
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">تێبینی</label>
          <textarea id="cmp-notes" class="form-control" rows="2" placeholder="تێبینی زیادە لەسەر کۆمپانیا...">${escapeHtml(companyData?.notes || '')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-cancel-btn">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="btn-save-company">تۆمارکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.modal-cancel-btn').addEventListener('click', closeModal);

  modal.querySelector('#btn-save-company').addEventListener('click', async () => {
    const name = modal.querySelector('#cmp-name').value.trim();
    const owner_name = modal.querySelector('#cmp-owner').value.trim();
    const phone = modal.querySelector('#cmp-phone').value.trim();
    const phone_2 = modal.querySelector('#cmp-phone2').value.trim();
    const address = modal.querySelector('#cmp-address').value.trim();
    const notes = modal.querySelector('#cmp-notes').value.trim();

    if (!name) {
      showToast('ناوی کۆمپانیا پێویستە', 'error');
      return;
    }

    const payload = { name, owner_name, phone, phone_2, address, notes };
    const btn = modal.querySelector('#btn-save-company');
    btn.disabled = true;

    const res = companyId ? await api.put(`/companies/${companyId}`, payload) : await api.post('/companies', payload);
    if (res.success) {
      showToast(companyId ? 'زانیاری کۆمپانیا نوێکرایەوە' : 'کۆمپانیا بە سەرکەوتوویی زیادکرا', 'success');
      closeModal();
      loadCompaniesTable();
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی کۆمپانیا', 'error');
      btn.disabled = false;
    }
  });
}

/**
 * Comprehensive Company Profile & Account Modal
 * Displays: Drivers, Vehicles, Invoices & Debts Breakdown, Payment History & A4 Statement Print
 */
export async function openCompanyAccountModal(companyId) {
  const res = await api.get(`/companies/${companyId}/account`);
  if (!res.success || !res.data) {
    showToast('هەڵە لە بارکردنی پەڕەی کۆمپانیا', 'error');
    return;
  }

  const { company, drivers, vehicles, debts, payments } = res.data;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 960px; width: 95vw; max-height: 90vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 16px 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 28px;">🏢</div>
          <div>
            <h3 class="modal-title" style="font-size: 18px; margin: 0; font-weight: 800;">
              ئەژمێری کۆمپانیای: ${escapeHtml(company.name)}
            </h3>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
              خاوەن: <strong>${escapeHtml(company.owner_name) || '—'}</strong> | 
              مۆبایل: <strong dir="ltr">${escapeHtml(company.phone) || '—'}</strong>
            </div>
          </div>
        </div>
        <button class="modal-close-btn">&times;</button>
      </div>

      <div class="modal-body" style="padding: 20px; overflow-y: auto; flex: 1;">
        <!-- Top Financial Summary Strip -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
            <div style="font-size: 12px; color: #64748b; font-weight: 700;">کۆی کڕینەکان</div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px;">${formatCurrency(company.total_purchases)}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px;">
            <div style="font-size: 12px; color: #166534; font-weight: 700;">کۆی دراو (نەقد)</div>
            <div style="font-size: 18px; font-weight: 900; color: #15803d; margin-top: 4px;">${formatCurrency(company.total_paid)}</div>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px;">
            <div style="font-size: 12px; color: #991b1b; font-weight: 700;">قەرزی ئێستای کۆمپانیا</div>
            <div style="font-size: 20px; font-weight: 900; color: #dc2626; margin-top: 4px;">${formatCurrency(company.current_debt)}</div>
          </div>
        </div>

        <!-- Quick Action Buttons -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;">
          ${
            Number(company.current_debt) > 0
              ? `<button class="btn btn-success" id="acc-btn-pay-debt" style="font-weight: 800;">
                  💵 وەرگرتنەوەی قەرز
                 </button>`
              : ''
          }
          <button class="btn btn-primary" id="acc-btn-add-driver">➕ شۆفێری نوێ</button>
          <button class="btn btn-primary" id="acc-btn-add-vehicle">➕ بارهەڵگری نوێ</button>
          <button class="btn btn-secondary" id="acc-btn-print-statement">📄 کەشف حیسابی فەرمی A4</button>
          <button class="btn btn-secondary" id="acc-btn-pdf-statement">📥 پاشەکەوتکردن بە PDF</button>
        </div>

        <!-- Tabs Navigation -->
        <div style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); margin-bottom: 16px;">
          <button class="btn btn-sm cmp-tab-btn active" data-tab="tab-debts" style="font-weight: 700; border-radius: 6px 6px 0 0;">
            📋 پسووڵە و قەرزەکان (${debts.length})
          </button>
          <button class="btn btn-sm cmp-tab-btn" data-tab="tab-drivers" style="font-weight: 700; border-radius: 6px 6px 0 0;">
            👨‍✈️ شۆفێرەکان (${drivers.length})
          </button>
          <button class="btn btn-sm cmp-tab-btn" data-tab="tab-vehicles" style="font-weight: 700; border-radius: 6px 6px 0 0;">
            🚛 بارهەڵگرەکان (${vehicles.length})
          </button>
          <button class="btn btn-sm cmp-tab-btn" data-tab="tab-payments" style="font-weight: 700; border-radius: 6px 6px 0 0;">
            💵 مێژووی پارەدان (${payments.length})
          </button>
        </div>

        <!-- Tab 1: Debts & Invoices -->
        <div id="tab-debts" class="cmp-tab-pane">
          <div class="table-responsive">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>ژمارەی وەسڵ</th>
                  <th>بەروار</th>
                  <th>شۆفێر</th>
                  <th>بارهەڵگر</th>
                  <th>بڕی پسووڵە</th>
                  <th>دراو</th>
                  <th>قەرزی ماوە</th>
                  <th>دۆخ</th>
                  <th>کردار</th>
                </tr>
              </thead>
              <tbody>
                ${
                  debts.length === 0
                    ? `<tr><td colspan="9" style="text-align: center; padding: 30px; color: #16a34a;">هیچ پسووڵەیەکی قەرزدار لەسەر ئەم کۆمپانیایە نییە ✓</td></tr>`
                    : debts
                        .map((d) => {
                          const isUnpaid = d.status === 'unpaid';
                          const isPartial = d.status === 'partial';
                          return `
                        <tr>
                          <td>
                            <strong dir="ltr" style="font-family: monospace; color: var(--primary);">${escapeHtml(d.receipt_number || '—')}</strong>
                          </td>
                          <td>${escapeHtml(d.sale_date || '')}</td>
                          <td>${escapeHtml(d.driver_name) || '—'}</td>
                          <td>
                            ${d.vehicle_plate ? `<strong>${escapeHtml(d.vehicle_plate)}</strong>` : '—'}
                            ${d.vehicle_truck_brand ? `<span style="font-size: 11px; color: var(--text-muted);">(${escapeHtml(d.vehicle_truck_brand)})</span>` : ''}
                          </td>
                          <td><strong>${formatCurrency(d.original_amount)}</strong></td>
                          <td style="color: #16a34a;">${formatCurrency(d.paid_amount)}</td>
                          <td style="color: #dc2626; font-weight: 800;">${formatCurrency(d.remaining_amount)}</td>
                          <td>
                            <span class="badge ${isUnpaid ? 'badge-danger' : isPartial ? 'badge-warning' : 'badge-success'}">
                              ${isUnpaid ? 'قەرزدارە' : isPartial ? 'بەشێکی دراوە' : 'تەواوکراوە'}
                            </span>
                          </td>
                          <td>
                            <button class="btn btn-sm btn-secondary btn-reprint-sale" data-sale-id="${d.sale_id}" title="چاپکردنی وەسڵ">
                              🖨️
                            </button>
                          </td>
                        </tr>
                      `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: Drivers -->
        <div id="tab-drivers" class="cmp-tab-pane" style="display: none;">
          <div class="table-responsive">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>ناوی شۆفێر</th>
                  <th>مۆبایل</th>
                  <th>بارهەڵگری دیاریکراو</th>
                  <th>قەرزی لەسەر ئەژمێر</th>
                  <th>کردار</th>
                </tr>
              </thead>
              <tbody>
                ${
                  drivers.length === 0
                    ? `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">هیچ شۆفێرێک تۆمار نەکراوە</td></tr>`
                    : drivers
                        .map((drv) => `
                        <tr>
                          <td><strong>👨‍✈️ ${escapeHtml(drv.full_name)}</strong></td>
                          <td><span dir="ltr" style="font-family: monospace;">${escapeHtml(drv.phone) || '—'}</span></td>
                          <td>${escapeHtml(drv.vehicle_plate || drv.vehicle_name || '—')}</td>
                          <td>
                            <strong style="color: ${Number(drv.total_driver_debt) > 0 ? '#dc2626' : '#16a34a'};">
                              ${formatCurrency(drv.total_driver_debt || 0)}
                            </strong>
                          </td>
                          <td>
                            <div style="display: flex; gap: 4px;">
                              <button class="btn btn-sm btn-secondary btn-print-driver-report" data-id="${drv.id}" title="چاپکردنی ڕاپۆرتی شۆفێر">
                                🖨️ ڕاپۆرت
                              </button>
                              <button class="btn btn-sm btn-secondary btn-edit-driver" data-id="${drv.id}" data-name="${escapeHtml(drv.full_name)}" data-phone="${escapeHtml(drv.phone || '')}" data-notes="${escapeHtml(drv.notes || '')}">
                                ✏️ دەستکاری
                              </button>
                            </div>
                          </td>
                        </tr>
                      `)
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 3: Vehicles -->
        <div id="tab-vehicles" class="cmp-tab-pane" style="display: none;">
          <div class="table-responsive">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>ژمارەی تابلۆ (ڕەقەم)</th>
                  <th>ژمارەی ناوخۆیی</th>
                  <th>جۆر و مۆدێل</th>
                  <th>شۆفێری دیاریکراو</th>
                  <th>قەرزی لەسەر ئەژمێر</th>
                  <th>کردار</th>
                </tr>
              </thead>
              <tbody>
                ${
                  vehicles.length === 0
                    ? `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">هیچ بارهەڵگرێک تۆمار نەکراوە</td></tr>`
                    : vehicles
                        .map((veh) => `
                        <tr>
                          <td><strong>🚛 ${escapeHtml(veh.plate_number || '—')}</strong></td>
                          <td>${escapeHtml(veh.vehicle_number || '—')}</td>
                          <td>${escapeHtml(veh.truck_brand || '')} ${escapeHtml(veh.truck_model || '')}</td>
                          <td>${escapeHtml(veh.driver_name || '—')}</td>
                          <td>
                            <strong style="color: ${Number(veh.total_vehicle_debt) > 0 ? '#dc2626' : '#16a34a'};">
                              ${formatCurrency(veh.total_vehicle_debt || 0)}
                            </strong>
                          </td>
                          <td>
                            <div style="display: flex; gap: 4px;">
                              <button class="btn btn-sm btn-secondary btn-print-vehicle-report" data-id="${veh.id}" title="چاپکردنی ڕاپۆرتی بارهەڵگر">
                                🖨️ ڕاپۆرت
                              </button>
                              <button class="btn btn-sm btn-secondary btn-edit-vehicle" data-id="${veh.id}" data-plate="${escapeHtml(veh.plate_number || '')}" data-num="${escapeHtml(veh.vehicle_number || '')}" data-brand="${escapeHtml(veh.truck_brand || '')}" data-model="${escapeHtml(veh.truck_model || '')}" data-driver="${veh.driver_id || ''}">
                                ✏️ دەستکاری
                              </button>
                            </div>
                          </td>
                        </tr>
                      `)
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 4: Payments -->
        <div id="tab-payments" class="cmp-tab-pane" style="display: none;">
          <div class="table-responsive">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>بەروار</th>
                  <th>بڕی پارەی دراو</th>
                  <th>شێوازی پارەدان</th>
                  <th>وەرگرت لەلایەن</th>
                  <th>تێبینی</th>
                </tr>
              </thead>
              <tbody>
                ${
                  payments.length === 0
                    ? `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">هیچ مێژوویەکی پارەدان تۆمار نەکراوە</td></tr>`
                    : payments
                        .map((p) => `
                        <tr>
                          <td>${escapeHtml(p.payment_date || '')}</td>
                          <td><strong style="color: #16a34a; font-size: 14px;">${formatCurrency(p.amount)}</strong></td>
                          <td>${p.payment_method === 'cash' ? 'نەقد' : escapeHtml(p.payment_method)}</td>
                          <td>${escapeHtml(p.user_name || 'کاشێر')}</td>
                          <td>${escapeHtml(p.notes || '—')}</td>
                        </tr>
                      `)
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid var(--border-color); background: var(--bg-card); display: flex; justify-content: space-between;">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">
          قەرزی کۆتایی: <span style="color: #dc2626; font-size: 16px;">${formatCurrency(company.current_debt)}</span>
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

  // Tabs switching
  modal.querySelectorAll('.cmp-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.cmp-tab-btn').forEach((b) => {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-secondary');

      const targetId = btn.dataset.tab;
      modal.querySelectorAll('.cmp-tab-pane').forEach((pane) => {
        pane.style.display = pane.id === targetId ? 'block' : 'none';
      });
    });
  });

  // Action: Pay Debt
  modal.querySelector('#acc-btn-pay-debt')?.addEventListener('click', () => {
    openPayCompanyDebtModal(company.id, company.name, Number(company.current_debt), () => {
      closeModal();
      openCompanyAccountModal(company.id);
      loadCompaniesTable();
    });
  });

  // Action: Add Driver
  modal.querySelector('#acc-btn-add-driver')?.addEventListener('click', () => {
    openDriverModal(company.id, null, () => {
      closeModal();
      openCompanyAccountModal(company.id);
    });
  });

  // Action: Add Vehicle
  modal.querySelector('#acc-btn-add-vehicle')?.addEventListener('click', () => {
    openVehicleModal(company.id, null, drivers, () => {
      closeModal();
      openCompanyAccountModal(company.id);
    });
  });

  // Edit Driver
  modal.querySelectorAll('.btn-edit-driver').forEach((btn) => {
    btn.addEventListener('click', () => {
      const drvId = btn.dataset.id;
      const drvName = btn.dataset.name;
      const drvPhone = btn.dataset.phone;
      const drvNotes = btn.dataset.notes;
      openDriverModal(company.id, { id: drvId, full_name: drvName, phone: drvPhone, notes: drvNotes }, () => {
        closeModal();
        openCompanyAccountModal(company.id);
      });
    });
  });

  // Edit Vehicle
  modal.querySelectorAll('.btn-edit-vehicle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const vehId = btn.dataset.id;
      const vehPlate = btn.dataset.plate;
      const vehNum = btn.dataset.num;
      const vehBrand = btn.dataset.brand;
      const vehModel = btn.dataset.model;
      const vehDriver = btn.dataset.driver;
      openVehicleModal(company.id, { id: vehId, plate_number: vehPlate, vehicle_number: vehNum, truck_brand: vehBrand, truck_model: vehModel, driver_id: vehDriver }, drivers, () => {
        closeModal();
        openCompanyAccountModal(company.id);
      });
    });
  });

  // Reprint sale
  modal.querySelectorAll('.btn-reprint-sale').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const saleId = btn.dataset.saleId;
      if (!saleId) return;
      const invRes = await api.get(`/sales/${saleId}/invoice`);
      if (invRes.success && invRes.data) {
        printSaleReceipt(invRes.data.sale, invRes.data.business, 'a4');
      }
    });
  });

  // Action: Print Statement of Account A4 & PDF
  modal.querySelector('#acc-btn-print-statement')?.addEventListener('click', () => {
    printCompanyAccountStatement(company, debts, payments, drivers, vehicles);
  });

  modal.querySelector('#acc-btn-pdf-statement')?.addEventListener('click', () => {
    printCompanyAccountStatement(company, debts, payments, drivers, vehicles);
  });

  // Action: Print Driver Report
  modal.querySelectorAll('.btn-print-driver-report').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const drvId = btn.dataset.id;
      const drv = drivers.find((d) => String(d.id) === String(drvId));
      if (!drv) return;

      const res = await api.get(`/companies/${company.id}/drivers/${drvId}/purchases`);
      let driverInvoices = [];
      let driverDebts = debts.filter((d) => String(d.driver_id) === String(drvId));

      if (res.success && res.data) {
        if (Array.isArray(res.data)) {
          driverInvoices = res.data;
        } else if (typeof res.data === 'object') {
          driverInvoices = res.data.invoices || [];
          if (Array.isArray(res.data.debts) && res.data.debts.length > 0) {
            driverDebts = res.data.debts;
          }
        }
      }

      printDriverReport({ ...drv, company_name: company.name }, driverInvoices, driverDebts);
    });
  });

  // Action: Print Vehicle Report
  modal.querySelectorAll('.btn-print-vehicle-report').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const vehId = btn.dataset.id;
      const veh = vehicles.find((v) => String(v.id) === String(vehId));
      if (!veh) return;

      const res = await api.get(`/companies/${company.id}/vehicles/${vehId}/purchases`);
      let vehicleInvoices = [];
      let vehicleDebts = debts.filter((d) => String(d.vehicle_id) === String(vehId));

      if (res.success && res.data) {
        if (Array.isArray(res.data)) {
          vehicleInvoices = res.data;
        } else if (typeof res.data === 'object') {
          vehicleInvoices = res.data.invoices || [];
          if (Array.isArray(res.data.debts) && res.data.debts.length > 0) {
            vehicleDebts = res.data.debts;
          }
        }
      }

      printVehicleReport({ ...veh, company_name: company.name }, vehicleInvoices, vehicleDebts);
    });
  });
}

/**
 * Add / Edit Driver Modal
 */
export function openDriverModal(companyId, driverData = null, onSuccess = null) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 460px;">
      <div class="modal-header">
        <h3 class="modal-title">${driverData ? 'دەستکاریکردنی شۆفێر' : '➕ زیادکردنی شۆفێری نوێ'}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">ناوی تەواوی شۆفێر *</label>
          <input type="text" id="drv-name" class="form-control" placeholder="ناوی شۆفێر..." value="${escapeHtml(driverData?.full_name || '')}" required />
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">ژمارەی مۆبایل</label>
          <input type="text" id="drv-phone" class="form-control" placeholder="0750xxxxxxx" dir="ltr" value="${escapeHtml(driverData?.phone || '')}" />
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">تێبینی</label>
          <textarea id="drv-notes" class="form-control" rows="2" placeholder="تێبینی دەربارەی شۆفێر...">${escapeHtml(driverData?.notes || '')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-cancel-btn">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="btn-save-driver">تۆمارکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.modal-cancel-btn').addEventListener('click', closeModal);

  modal.querySelector('#btn-save-driver').addEventListener('click', async () => {
    const full_name = modal.querySelector('#drv-name').value.trim();
    const phone = modal.querySelector('#drv-phone').value.trim();
    const notes = modal.querySelector('#drv-notes').value.trim();

    if (!full_name) {
      showToast('ناوی شۆفێر پێویستە', 'error');
      return;
    }

    const payload = { full_name, phone, notes };
    const res = driverData?.id
      ? await api.put(`/company-drivers/${driverData.id}`, payload)
      : await api.post(`/companies/${companyId}/drivers`, payload);

    if (res.success) {
      showToast(driverData ? 'زانیاری شۆفێر نوێکرایەوە' : 'شۆفێر زیادکرا', 'success');
      closeModal();
      if (onSuccess) onSuccess(res.data);
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی شۆفێر', 'error');
    }
  });
}

/**
 * Add / Edit Vehicle Modal
 */
export function openVehicleModal(companyId, vehicleData = null, driversList = [], onSuccess = null) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 480px;">
      <div class="modal-header">
        <h3 class="modal-title">${vehicleData ? 'دەستکاریکردنی بارهەڵگر' : '➕ زیادکردنی بارهەڵگری نوێ'}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">ژمارەی تابلۆ (ڕەقەم) *</label>
          <input type="text" id="veh-plate" class="form-control" placeholder="نموونە: هەولێر 12345 / عێراق..." value="${escapeHtml(vehicleData?.plate_number || '')}" required />
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">ژمارەی ناوخۆیی بارهەڵگر لە کۆمپانیا</label>
          <input type="text" id="veh-num" class="form-control" placeholder="نموونە: بارهەڵگری ژمارە 10..." value="${escapeHtml(vehicleData?.vehicle_number || '')}" />
        </div>
        <div class="form-row" style="gap: 12px; margin-bottom: 14px;">
          <div class="form-col" style="flex: 1;">
            <label class="form-label" style="font-weight: 700;">مارکەی بارهەڵگر</label>
            <input type="text" id="veh-brand" class="form-control" placeholder="Mercedes / Scania / Volvo..." value="${escapeHtml(vehicleData?.truck_brand || '')}" />
          </div>
          <div class="form-col" style="flex: 1;">
            <label class="form-label" style="font-weight: 700;">مۆدێل</label>
            <input type="text" id="veh-model" class="form-control" placeholder="Actros MP4 / R500..." value="${escapeHtml(vehicleData?.truck_model || '')}" />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">شۆفێری دیاریکراو (ئارەزوومەندانە)</label>
          <select id="veh-driver-id" class="form-control">
            <option value="">-- بەبێ شۆفێری تایبەت --</option>
            ${driversList
              .map((d) => `<option value="${d.id}" ${String(vehicleData?.driver_id) === String(d.id) ? 'selected' : ''}>${escapeHtml(d.full_name)}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-cancel-btn">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="btn-save-vehicle">تۆمارکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.modal-cancel-btn').addEventListener('click', closeModal);

  modal.querySelector('#btn-save-vehicle').addEventListener('click', async () => {
    const plate_number = modal.querySelector('#veh-plate').value.trim();
    const vehicle_number = modal.querySelector('#veh-num').value.trim();
    const truck_brand = modal.querySelector('#veh-brand').value.trim();
    const truck_model = modal.querySelector('#veh-model').value.trim();
    const driver_id = modal.querySelector('#veh-driver-id').value || null;

    if (!plate_number && !vehicle_number) {
      showToast('ژمارەی تابلۆ یان ژمارەی بارهەڵگر پێویستە', 'error');
      return;
    }

    const payload = { plate_number, vehicle_number, truck_brand, truck_model, driver_id };
    const res = vehicleData?.id
      ? await api.put(`/company-vehicles/${vehicleData.id}`, payload)
      : await api.post(`/companies/${companyId}/vehicles`, payload);

    if (res.success) {
      showToast(vehicleData ? 'زانیاری بارهەڵگر نوێکرایەوە' : 'بارهەڵگر زیادکرا', 'success');
      closeModal();
      if (onSuccess) onSuccess(res.data);
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی بارهەڵگر', 'error');
    }
  });
}

/**
 * Pay Company Debt Modal
 */
export async function openPayCompanyDebtModal(companyId, companyName, currentDebt, onComplete) {
  // Fetch unpaid debts for specific invoice selection
  const accRes = await api.get(`/companies/${companyId}/account`);
  const unpaidDebts = (accRes.data?.debts || []).filter((d) => Number(d.remaining_amount) > 0);

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 520px;">
      <div class="modal-header">
        <h3 class="modal-title">💵 وەرگرتنەوەی پارەی قەرزی کۆمپانیا</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
          <div style="font-weight: 800; font-size: 16px; color: var(--text-main);">کۆمپانیا: ${escapeHtml(companyName)}</div>
          <div style="font-size: 15px; color: #dc2626; font-weight: 800; margin-top: 4px;">
            کۆی قەرزی ئێستا: ${formatCurrency(currentDebt)}
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">شێوازی دانەوەی قەرز</label>
          <div style="display: flex; gap: 10px;">
            <label style="display: flex; align-items: center; gap: 6px; font-weight: 700; cursor: pointer;">
              <input type="radio" name="pay-method-choice" value="fifo" checked />
              <span>بەپێی کۆنترین قەرز (FIFO)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-weight: 700; cursor: pointer;">
              <input type="radio" name="pay-method-choice" value="specific" />
              <span>پسووڵەیەکی دیاریکراو</span>
            </label>
          </div>
        </div>

        <div id="row-specific-debt" class="form-group" style="margin-bottom: 14px; display: none;">
          <label class="form-label" style="font-weight: 700;">پسووڵەی دیاریکراو هەڵبژێرە *</label>
          <select id="pay-debt-id" class="form-control">
            <option value="">-- پسووڵە دیاریبکە --</option>
            ${unpaidDebts
              .map((d) => `<option value="${d.id}" data-remain="${d.remaining_amount}">پسووڵەی ${d.receipt_number} (${d.sale_date}) - ماوە: ${formatCurrency(d.remaining_amount)} ${d.driver_name ? `[شۆفێر: ${d.driver_name}]` : ''}</option>`)
              .join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">بڕی پارەی وەرگیراو (د.ع) *</label>
          <input type="number" id="pay-amount" class="form-control" style="font-size: 16px; font-weight: 800;" placeholder="بڕی پارە بە دینار بنووسە..." value="${currentDebt}" min="1" max="${currentDebt}" />
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">تێبینی وەرگرتن</label>
          <input type="text" id="pay-notes" class="form-control" placeholder="تێبینی پارەدان..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-cancel-btn">پاشگەزبوونەوە</button>
        <button class="btn btn-success" id="btn-submit-pay" style="font-weight: 800;">✓ وەرگرتنی پارە و تۆمارکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.modal-cancel-btn').addEventListener('click', closeModal);

  // Method choice change
  const radioFifo = modal.querySelector('input[value="fifo"]');
  const radioSpecific = modal.querySelector('input[value="specific"]');
  const specificRow = modal.querySelector('#row-specific-debt');
  const debtSelect = modal.querySelector('#pay-debt-id');
  const amountInput = modal.querySelector('#pay-amount');

  radioFifo.addEventListener('change', () => {
    specificRow.style.display = 'none';
    amountInput.value = currentDebt;
  });

  radioSpecific.addEventListener('change', () => {
    specificRow.style.display = 'block';
  });

  debtSelect.addEventListener('change', () => {
    const opt = debtSelect.options[debtSelect.selectedIndex];
    if (opt && opt.dataset.remain) {
      amountInput.value = opt.dataset.remain;
    }
  });

  modal.querySelector('#btn-submit-pay').addEventListener('click', async () => {
    const isSpecific = radioSpecific.checked;
    const debt_id = isSpecific ? debtSelect.value : null;
    const amount = Number(amountInput.value) || 0;
    const notes = modal.querySelector('#pay-notes').value.trim();

    if (amount <= 0) {
      showToast('تکایە بڕی پارەیەکی دروست بنووسە', 'error');
      return;
    }

    if (isSpecific && !debt_id) {
      showToast('تکایە پسووڵەیەک هەڵبژێرە', 'error');
      return;
    }

    const btn = modal.querySelector('#btn-submit-pay');
    btn.disabled = true;
    btn.textContent = 'خەریکی تۆمارکردنە...';

    const payload = {
      amount,
      debt_id: debt_id ? Number(debt_id) : null,
      notes,
    };

    const res = await api.post(`/companies/${companyId}/pay-debt`, payload);
    if (res.success) {
      showToast('پارەی قەرز بە سەرکەوتوویی وەرگیرا ✓', 'success');
      closeModal();
      if (onComplete) onComplete();
    } else {
      showToast(res.message || 'هەڵە لە وەرگرتنی پارەی قەرز', 'error');
      btn.disabled = false;
      btn.textContent = '✓ وەرگرتنی پارە و تۆمارکردن';
    }
  });
}

/**
 * Print Statement of Account (کەشف حیسابی فەرمی A4)
 */
export function printCompanyAccountStatement(company, debts, payments, drivers, vehicles) {
  const printArea = document.getElementById('printable-receipt-area');
  if (!printArea) return;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

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
            <div style="font-size: 16px; font-weight: 900; color: #0f172a;">کەشف حیسابی کۆمپانیا</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">STATEMENT OF ACCOUNT</div>
            <div style="font-size: 12px; font-weight: 700; margin-top: 4px;">بەروار: ${dateStr}</div>
          </div>
        </div>

        <!-- Company Details Box -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">🏢 ناوی کۆمپانیا: ${escapeHtml(company.name)}</div>
            <div style="font-size: 13px; color: #475569; margin-top: 4px;">خاوەن کار / بەڕێوەبەر: <strong>${escapeHtml(company.owner_name) || '—'}</strong></div>
            <div style="font-size: 13px; color: #475569; margin-top: 2px;">مۆبایل: <strong dir="ltr">${escapeHtml(company.phone) || '—'}</strong></div>
            ${company.address ? `<div style="font-size: 13px; color: #475569; margin-top: 2px;">ناونیشان: ${escapeHtml(company.address)}</div>` : ''}
          </div>
          <div style="border-right: 1px solid #cbd5e1; padding-right: 16px; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 12px; color: #64748b;">کۆی قەرزی کەڵەکەبوو:</div>
            <div style="font-size: 20px; font-weight: 900; color: #dc2626; margin-top: 4px;">${formatCurrency(company.current_debt)}</div>
          </div>
        </div>

        <!-- Unpaid Invoices Table -->
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 15px; font-weight: 800; margin-bottom: 8px; color: #0f172a;">📋 ڕەوش و وردەکاری وەسڵە قەرزدارەکان:</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 6px 8px; text-align: right;">#</th>
                <th style="padding: 6px 8px; text-align: right;">ژمارەی وەسڵ</th>
                <th style="padding: 6px 8px; text-align: center;">بەروار</th>
                <th style="padding: 6px 8px; text-align: right;">شۆفێری وەرگر</th>
                <th style="padding: 6px 8px; text-align: right;">بارهەڵگر</th>
                <th style="padding: 6px 8px; text-align: left;">بڕی پسووڵە</th>
                <th style="padding: 6px 8px; text-align: left;">دراو</th>
                <th style="padding: 6px 8px; text-align: left; color: #dc2626;">قەرزی ماوە</th>
              </tr>
            </thead>
            <tbody>
              ${
                debts.length === 0
                  ? `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #16a34a;">هیچ قەرزێک لەسەر ئەم کۆمپانیایە نییە</td></tr>`
                  : debts
                      .map(
                        (d, idx) => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 6px 8px;">${idx + 1}</td>
                      <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;" dir="ltr">${escapeHtml(d.receipt_number)}</td>
                      <td style="padding: 6px 8px; text-align: center;">${escapeHtml(d.sale_date)}</td>
                      <td style="padding: 6px 8px;">${escapeHtml(d.driver_name) || '—'}</td>
                      <td style="padding: 6px 8px;">${escapeHtml(d.vehicle_plate || d.vehicle_number || '—')}</td>
                      <td style="padding: 6px 8px; text-align: left;">${formatCurrency(d.original_amount)}</td>
                      <td style="padding: 6px 8px; text-align: left; color: #16a34a;">${formatCurrency(d.paid_amount)}</td>
                      <td style="padding: 6px 8px; text-align: left; font-weight: 800; color: #dc2626;">${formatCurrency(d.remaining_amount)}</td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>

        <!-- Breakdown by Driver & Vehicle -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px;">
            <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px;">👨‍✈️ قەرز بەپێی شۆفێر:</div>
            <div style="font-size: 12px;">
              ${drivers.map((drv) => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
                  <span>${escapeHtml(drv.full_name)}</span>
                  <strong style="color: ${Number(drv.total_driver_debt) > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(drv.total_driver_debt || 0)}</strong>
                </div>
              `).join('') || '<div style="color:#64748b;">هیچ شۆفێرێک نییە</div>'}
            </div>
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px;">
            <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px;">🚛 قەرز بەپێی بارهەڵگر:</div>
            <div style="font-size: 12px;">
              ${vehicles.map((veh) => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
                  <span>${escapeHtml(veh.plate_number || veh.vehicle_number || '—')}</span>
                  <strong style="color: ${Number(veh.total_vehicle_debt) > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(veh.total_vehicle_debt || 0)}</strong>
                </div>
              `).join('') || '<div style="color:#64748b;">هیچ بارهەڵگرێک نییە</div>'}
            </div>
          </div>
        </div>

        <!-- Totals & Signatures -->
        <div style="border-top: 2px solid #0f172a; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 13px; font-weight: 700;">واژۆ و مۆری کۆمپانیا:</div>
            <div style="height: 50px;"></div>
            <div style="font-size: 12px; color: #64748b;">................................................</div>
          </div>

          <div style="text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 24px; border-radius: 8px;">
            <div style="font-size: 13px; font-weight: 700; color: #475569;">کۆی گشتی قەرزی ماوە:</div>
            <div style="font-size: 22px; font-weight: 900; color: #dc2626; margin-top: 4px;">${formatCurrency(company.current_debt)}</div>
          </div>

          <div>
            <div style="font-size: 13px; font-weight: 700;">واژۆ و مۆری دوکان:</div>
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
