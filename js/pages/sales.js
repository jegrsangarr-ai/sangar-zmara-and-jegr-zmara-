/**
 * Sales History Page Module
 */
import { api, formatCurrency, showToast } from '../api.js';
import { printSaleReceipt, downloadSaleInvoicePdf } from '../receipt.js';
import { isAdmin } from '../auth.js';

let currentPage = 1;
let systemSettings = {};

export async function initSalesPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const setRes = await api.get('/settings/public');
  if (setRes.success && setRes.data) systemSettings = setRes.data;

  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">مێژووی فرۆشتنەکان</h2>
        <div class="section-subtitle">بینینی پسووڵەکان، گەڕان و دووبارە چاپکردنەوە</div>
      </div>
      <div>
        <button class="btn btn-primary" id="btn-goto-pos">🛒 فرۆشتنی نوێ</button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="card" style="padding: 16px; margin-bottom: 16px;">
      <div class="form-row" style="align-items: center;">
        <div class="form-col" style="flex: 2;">
          <input type="text" id="sales-search-input" class="form-control" placeholder="🔍 گەڕان بەپێی ژمارەی پسووڵە یان ناوی کڕیار..." />
        </div>
        <div class="form-col">
          <input type="date" id="sales-from-date" class="form-control" value="${today}" />
        </div>
        <div class="form-col">
          <input type="date" id="sales-to-date" class="form-control" value="${today}" />
        </div>
        <div class="form-col">
          <select id="sales-filter-pay" class="form-control">
            <option value="">-- هەموو شێوازەکانی پارەدان --</option>
            <option value="cash">نەقد</option>
            <option value="debt">قەرز</option>
            <option value="partial">نەقد + قەرز</option>
          </select>
        </div>
        <div class="form-col" style="flex: 0 0 auto;">
          <button class="btn btn-secondary" id="btn-sales-filter">فلتەرکردن</button>
        </div>
      </div>
    </div>

    <!-- Sales Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>ژمارەی پسووڵە</th>
              <th>بەروار و کات</th>
              <th>ناوی کڕیار</th>
              <th>کاشێر</th>
              <th>کۆی کاڵاکان</th>
              <th>داشکاندن</th>
              <th>کۆی گشتی</th>
              <th>شێوازی پارەدان</th>
              <th>پارەی دراو</th>
              <th>قەرز</th>
              <th>کردارەکان</th>
            </tr>
          </thead>
          <tbody id="sales-table-body">
            <tr><td colspan="11" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="sales-pagination" style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-top: 1px solid var(--border-color);">
        <span id="sales-count-info" style="font-size: 13px; color: var(--text-muted);">...</span>
        <div style="display: flex; gap: 6px;" id="sales-page-btns"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-goto-pos')?.addEventListener('click', () => {
    window.location.hash = '#pos';
  });

  document.getElementById('btn-sales-filter')?.addEventListener('click', () => {
    currentPage = 1;
    loadSalesTable();
  });

  document.getElementById('sales-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      currentPage = 1;
      loadSalesTable();
    }
  });

  await loadSalesTable();
}

async function loadSalesTable() {
  const tbody = document.getElementById('sales-table-body');
  if (!tbody) return;

  const search = document.getElementById('sales-search-input')?.value.trim() || '';
  const fromDate = document.getElementById('sales-from-date')?.value || '';
  const toDate = document.getElementById('sales-to-date')?.value || '';
  const payType = document.getElementById('sales-filter-pay')?.value || '';

  let url = `/sales?page=${currentPage}&limit=25`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (fromDate) url += `&from_date=${fromDate}`;
  if (toDate) url += `&to_date=${toDate}`;
  if (payType) url += `&payment_type=${payType}`;

  const res = await api.get(url);
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color: #dc2626;">هەڵە لە وەرگرتنی فرۆشتنەکان</td></tr>`;
    return;
  }

  const sales = Array.isArray(res.data) ? res.data : (res.data?.sales || res.sales || []);

  if (sales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ فرۆشتنێک نەدۆزرایەوە</td></tr>`;
    return;
  }

  const payLabels = {
    cash: '<span class="badge badge-success">💵 نەقد</span>',
    debt: '<span class="badge badge-danger">📋 قەرز</span>',
    partial: '<span class="badge badge-warning">⚖️ نەقد + قەرز</span>',
  };

  tbody.innerHTML = sales
    .map((s) => {
      let custDisplay = 'کڕیاری دەستبەجێ';
      if (s.customer_type === 'company' || s.company_name) {
        custDisplay = `<span style="font-weight: 800; color: #0284c7;">🏢 ${s.company_name || 'کۆمپانیا'}</span>`;
        if (s.driver_name) {
          custDisplay += `<div style="font-size: 11px; color: #475569;">👨‍✈️ ${s.driver_name}</div>`;
        }
        if (s.vehicle_plate || s.vehicle_number) {
          custDisplay += `<div style="font-size: 11px; color: #64748b;">🚛 ${s.vehicle_plate || s.vehicle_number}</div>`;
        }
      } else if (s.customer_name) {
        custDisplay = `<strong>${s.customer_name}</strong>`;
      }

      return `
      <tr>
        <td><strong style="direction: ltr; font-family: monospace;">${s.receipt_number}</strong></td>
        <td>${s.sale_date} <span style="font-size: 11px; color: #64748b;">${s.sale_time || ''}</span></td>
        <td>${custDisplay}</td>
        <td>${s.cashier_name || 'کاشێر'}</td>
        <td>${formatCurrency(s.total_amount + (s.discount_amount || 0))}</td>
        <td>${s.discount_amount > 0 ? `-${formatCurrency(s.discount_amount)}` : '-'}</td>
        <td><strong style="color: var(--primary); font-size: 15px;">${formatCurrency(s.total_amount)}</strong></td>
        <td>${payLabels[s.payment_type] || s.payment_type}</td>
        <td>${formatCurrency(s.paid_amount)}</td>
        <td>${s.debt_amount > 0 ? `<strong style="color: #dc2626;">${formatCurrency(s.debt_amount)}</strong>` : '-'}</td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <button class="btn btn-sm btn-secondary btn-view-sale" data-id="${s.id}" title="بینینی تەواوی وردەکاری">👁️ بینین</button>
            <button class="btn btn-sm btn-primary btn-print-a4-direct" data-id="${s.id}" title="چاپی وەسڵی A4">📄 A4</button>
            <button class="btn btn-sm btn-outline btn-print-80-direct" data-id="${s.id}" title="چاپی پسووڵەی 80mm">🖨️ 80mm</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  // Pagination
  const countInfo = document.getElementById('sales-count-info');
  const paginationDiv = document.getElementById('sales-page-btns');
  if (res.pagination) {
    if (countInfo) {
      countInfo.textContent = `کۆی گشتی: ${res.pagination.total} فرۆشتن | پەڕەی ${res.pagination.page} لە ${res.pagination.totalPages || 1}`;
    }
    if (paginationDiv) {
      let btns = '';
      if (res.pagination.page > 1) {
        btns += `<button class="btn btn-sm btn-secondary btn-sp-prev">« پێشوو</button>`;
      }
      if (res.pagination.page < res.pagination.totalPages) {
        btns += `<button class="btn btn-sm btn-secondary btn-sp-next">دواتر »</button>`;
      }
      paginationDiv.innerHTML = btns;

      paginationDiv.querySelector('.btn-sp-prev')?.addEventListener('click', () => {
        currentPage--;
        loadSalesTable();
      });
      paginationDiv.querySelector('.btn-sp-next')?.addEventListener('click', () => {
        currentPage++;
        loadSalesTable();
      });
    }
  }

  // Row events
  tbody.querySelectorAll('.btn-view-sale').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sId = btn.dataset.id;
      const detRes = await api.get(`/sales/${sId}/invoice`);
      if (detRes.success && detRes.data) {
        showSaleDetailModal(detRes.data);
      } else {
        // Fallback to regular detail if invoice endpoint fails
        const regRes = await api.get(`/sales/${sId}`);
        if (regRes.success && regRes.data) {
          showSaleDetailModal(regRes.data);
        }
      }
    });
  });

  tbody.querySelectorAll('.btn-print-a4-direct').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sId = btn.dataset.id;
      const detRes = await api.get(`/sales/${sId}/invoice`);
      if (detRes.success && detRes.data) {
        const d = detRes.data;
        const normalized = {
          ...d.sale,
          receiptNumber: d.sale.receipt_number,
          saleDate: d.sale.sale_date,
          saleTime: d.sale.sale_time,
          customer_type: d.sale.customer_type,
          customerName: d.customer?.name || (d.company ? d.company.name : 'کڕیاری دەستبەجێ (نەقد)'),
          customerPhone: d.customer?.phone || d.company?.phone || '',
          customerAddress: d.customer?.address || d.company?.address || '',
          company_name: d.company?.name || d.sale.company_name,
          company: d.company,
          driver_name: d.driver?.full_name || d.sale.driver_name,
          driver: d.driver,
          vehicle_plate: d.vehicle?.plate_number || d.sale.vehicle_plate,
          vehicle_number: d.vehicle?.vehicle_number || d.sale.vehicle_number,
          vehicle_truck_brand: d.vehicle?.truck_brand || d.sale.vehicle_truck_brand,
          cashierName: d.cashier?.name || 'کاشێر',
          items: d.items,
          subtotal: d.sale.subtotal,
          discount_amount: d.sale.discount_amount,
          totalDiscount: d.sale.discount_amount,
          totalAmount: d.sale.total_amount,
          paidAmount: d.sale.paid_amount,
          debtAmount: d.sale.debt_amount,
          changeAmount: d.sale.change_amount,
          paymentType: d.sale.payment_type,
          business: d.business,
        };
        printSaleReceipt(normalized, d.business || systemSettings, 'a4');
      }
    });
  });

  tbody.querySelectorAll('.btn-print-80-direct').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sId = btn.dataset.id;
      const detRes = await api.get(`/sales/${sId}/invoice`);
      if (detRes.success && detRes.data) {
        const d = detRes.data;
        const normalized = {
          ...d.sale,
          receiptNumber: d.sale.receipt_number,
          saleDate: d.sale.sale_date,
          saleTime: d.sale.sale_time,
          customer_type: d.sale.customer_type,
          customerName: d.customer?.name || (d.company ? d.company.name : 'کڕیاری دەستبەجێ (نەقد)'),
          customerPhone: d.customer?.phone || d.company?.phone || '',
          customerAddress: d.customer?.address || d.company?.address || '',
          company_name: d.company?.name || d.sale.company_name,
          company: d.company,
          driver_name: d.driver?.full_name || d.sale.driver_name,
          driver: d.driver,
          vehicle_plate: d.vehicle?.plate_number || d.sale.vehicle_plate,
          vehicle_number: d.vehicle?.vehicle_number || d.sale.vehicle_number,
          vehicle_truck_brand: d.vehicle?.truck_brand || d.sale.vehicle_truck_brand,
          cashierName: d.cashier?.name || 'کاشێر',
          items: d.items,
          subtotal: d.sale.subtotal,
          discount_amount: d.sale.discount_amount,
          totalDiscount: d.sale.discount_amount,
          totalAmount: d.sale.total_amount,
          paidAmount: d.sale.paid_amount,
          debtAmount: d.sale.debt_amount,
          changeAmount: d.sale.change_amount,
          paymentType: d.sale.payment_type,
          business: d.business,
        };
        printSaleReceipt(normalized, d.business || systemSettings, '80mm');
      }
    });
  });
}

function showSaleDetailModal(invoiceData) {
  // Support both raw sale object or enriched invoice payload
  const isEnriched = !!invoiceData.sale;
  const sale = isEnriched ? invoiceData.sale : invoiceData;
  const company = isEnriched ? invoiceData.company : null;
  const driver = isEnriched ? invoiceData.driver : null;
  const vehicle = isEnriched ? invoiceData.vehicle : null;
  const customer = isEnriched ? invoiceData.customer : { name: sale.customer_name, phone: sale.customer_phone, address: sale.customer_address };
  const cashier = isEnriched ? invoiceData.cashier : { name: sale.cashier_name };
  const items = isEnriched ? invoiceData.items : (sale.items || []);
  const business = isEnriched ? invoiceData.business : systemSettings;

  const isCompany = sale.customer_type === 'company' || !!company || !!sale.company_name;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const itemsRows = items
    .map(
      (it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${it.product_name || it.name}</strong> ${it.part_number ? `<span style="direction: ltr; display: inline-block; font-size: 11px; color: #64748b;">(${it.part_number})</span>` : ''}</td>
      <td>${it.quantity}</td>
      <td>${formatCurrency(it.unit_price)}</td>
      <td>${(it.discount_amount || it.discount || 0) > 0 ? formatCurrency(it.discount_amount || it.discount) : '-'}</td>
      <td><strong>${formatCurrency(it.total_price || (it.quantity * it.unit_price - (it.discount || 0)))}</strong></td>
    </tr>
  `
    )
    .join('');

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 700px; width: 95vw;">
      <div class="modal-header">
        <h3 class="modal-title">📄 وەسڵی فرۆشتن: #${sale.receipt_number}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px;">
          <div>بەروار: <strong>${sale.sale_date}</strong> ${sale.sale_time ? `<span style="font-size: 11px; color: #64748b;">${sale.sale_time}</span>` : ''}</div>
          <div>کاشێر: <strong>${cashier.name || 'کاشێر'}</strong></div>
          <div>${isCompany ? '🏢 کۆمپانیا:' : 'کڕیار:'} <strong>${isCompany ? (company?.name || sale.company_name || 'کۆمپانیا') : (customer?.name || 'کڕیاری دەستبەجێ')}</strong></div>
          ${isCompany && (driver?.full_name || sale.driver_name) ? `<div>👨‍✈️ شۆفێر: <strong>${driver?.full_name || sale.driver_name}</strong></div>` : ''}
          ${isCompany && (vehicle?.plate_number || sale.vehicle_plate || sale.vehicle_number) ? `<div>🚛 بارهەڵگر: <strong>${vehicle?.plate_number || sale.vehicle_plate || sale.vehicle_number} ${vehicle?.truck_brand ? `(${vehicle.truck_brand})` : ''}</strong></div>` : ''}
          <div>مۆبایل: <strong style="direction: ltr; display: inline-block;">${customer?.phone || company?.phone || '-'}</strong></div>
          <div>شێوازی پارەدان: <strong>${sale.payment_type === 'cash' ? 'نەقد' : sale.payment_type === 'debt' ? 'قەرز' : 'نەقد + قەرز'}</strong></div>
        </div>

        <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
          <table class="table" style="font-size: 13px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th>#</th>
                <th>ناوی کاڵا</th>
                <th>ژمارە</th>
                <th>نرخی تاک</th>
                <th>داشکاندن</th>
                <th>کۆ</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; font-size: 13px;">
          <div>کۆی کاڵاکان: <strong>${formatCurrency((sale.subtotal || sale.total_amount) + (sale.discount_amount || 0))}</strong></div>
          <div>داشکاندن: <strong>-${formatCurrency(sale.discount_amount || 0)}</strong></div>
          <div>کۆی گشتی: <strong style="font-size: 16px; color: var(--primary);">${formatCurrency(sale.total_amount)}</strong></div>
          <div>پارەی دراو: <strong style="color: #16a34a;">${formatCurrency(sale.paid_amount)}</strong></div>
          ${sale.debt_amount > 0 ? `<div>قەرز: <strong style="color: #dc2626;">${formatCurrency(sale.debt_amount)}</strong></div>` : ''}
        </div>

        ${
          isAdmin()
            ? `
          <div style="margin-top: 14px;">
            <details style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; font-size: 12px; border: 1px solid #cbd5e1;">
              <summary style="font-weight: 700; cursor: pointer; color: #334155;">📊 وردەکاری تێچووی وەجبەکان بەپێی FIFO (بۆ بەڕێوەبەر)</summary>
              <div id="fifo-allocations-container" style="margin-top: 10px;">
                <div style="text-align: center; color: #64748b;">خەریکی هێنانی زانیاری وەجبەکانە...</div>
              </div>
            </details>
          </div>
        `
            : ''
        }
      </div>
      <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-modal-print-a4">
            📄 چاپی وەسڵی A4
          </button>
          <button class="btn btn-outline" id="btn-modal-download-pdf">
            📥 پاشەکەوتکردن بە PDF
          </button>
          <button class="btn btn-secondary" id="btn-modal-print-80">
            🖨️ پسووڵەی 80mm
          </button>
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

  const normalizedData = {
    ...sale,
    receiptNumber: sale.receipt_number,
    saleDate: sale.sale_date,
    saleTime: sale.sale_time,
    cashierName: cashier?.name || 'کاشێر',
    customer_type: sale.customer_type,
    customerName: isCompany ? (company?.name || sale.company_name || 'کۆمپانیا') : (customer?.name || 'کڕیاری دەستبەجێ'),
    customerPhone: customer?.phone || company?.phone || '',
    customerAddress: customer?.address || company?.address || '',
    company_name: company?.name || sale.company_name,
    company: company,
    driver_name: driver?.full_name || sale.driver_name,
    driver: driver,
    vehicle_plate: vehicle?.plate_number || sale.vehicle_plate || sale.vehicle_number,
    vehicle_truck_brand: vehicle?.truck_brand || sale.vehicle_truck_brand,
    vehicle: vehicle,
    items: items,
    subtotal: (sale.subtotal || sale.total_amount) + (sale.discount_amount || 0),
    totalDiscount: sale.discount_amount,
    totalAmount: sale.total_amount,
    paidAmount: sale.paid_amount,
    debtAmount: sale.debt_amount,
    changeAmount: sale.change_amount || 0,
    paymentType: sale.payment_type,
    business: business,
  };

  modal.querySelector('#btn-modal-print-a4').addEventListener('click', () => {
    printSaleReceipt(normalizedData, business || systemSettings, 'a4');
  });

  modal.querySelector('#btn-modal-download-pdf').addEventListener('click', () => {
    downloadSaleInvoicePdf(normalizedData, business || systemSettings);
  });

  modal.querySelector('#btn-modal-print-80').addEventListener('click', () => {
    printSaleReceipt(normalizedData, business || systemSettings, '80mm');
  });

  const fifoBox = modal.querySelector('#fifo-allocations-container');
  if (fifoBox && sale.id) {
    api.get(`/sales/${sale.id}/cost-allocations`).then((allocRes) => {
      if (!allocRes.success || !allocRes.data || allocRes.data.length === 0) {
        fifoBox.innerHTML = `<div style="color: #64748b; font-style: italic;">هیچ تخصیصێکی وەجبە بۆ ئەم پسووڵەیە تۆمار نەکراوە (کۆنە یان پێش سیستەمی وەجبە).</div>`;
        return;
      }

      fifoBox.innerHTML = `
        <table class="table" style="font-size: 11px; margin: 0;">
          <thead>
            <tr style="background: #e2e8f0;">
              <th>کاڵا</th>
              <th>کۆدی وەجبە</th>
              <th>جۆری وەجبە</th>
              <th>ژمارەی دەرچوو</th>
              <th>تێچووی دانە</th>
              <th>کۆی تێچوو</th>
              <th>بەرواری کڕین</th>
            </tr>
          </thead>
          <tbody>
            ${allocRes.data
              .map(
                (a) => `
              <tr>
                <td><strong>${a.product_name}</strong></td>
                <td><code>${a.batch_number}</code></td>
                <td><span class="badge badge-secondary">${a.batch_type}</span></td>
                <td><strong>${a.quantity}</strong></td>
                <td>${formatCurrency(a.unit_cost)}</td>
                <td><strong>${formatCurrency(a.total_cost)}</strong></td>
                <td>${a.purchase_date || '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    });
  }
}
