/**
 * Returns (گەڕانەوەی کاڵا) Management Module
 */
import { api, formatCurrency, showToast } from '../api.js';

let returnLookupSale = null;

export async function initReturnsPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">گەڕانەوەی کاڵا (ئیسترجاع)</h2>
        <div class="section-subtitle">گەڕاندنەوەی کاڵای فرۆشراو بەپێی پسووڵە، گێڕانەوەی پارە و زیادکردنەوە بۆ مەخزەن</div>
      </div>
      <div>
        <button class="btn btn-warning" id="btn-open-return-modal">↩️ ئەنجامدانی گەڕانەوەی نوێ</button>
      </div>
    </div>

    <!-- Returns History Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>ژمارەی وەسڵی گەڕانەوە</th>
              <th>ژمارەی پسووڵەی فرۆشتن</th>
              <th>ناوی کڕیار</th>
              <th>بەرواری گەڕانەوە</th>
              <th>کۆی پارەی گەڕاوە</th>
              <th>هۆکار</th>
              <th>بەکارهێنەر</th>
            </tr>
          </thead>
          <tbody id="returns-table-body">
            <tr><td colspan="7" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-open-return-modal')?.addEventListener('click', () => openNewReturnModal());

  await loadReturnsTable();
}

async function loadReturnsTable() {
  const tbody = document.getElementById('returns-table-body');
  if (!tbody) return;

  const res = await api.get('/returns');
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #dc2626;">هەڵە لە وەرگرتنی گەڕانەوەکان</td></tr>`;
    return;
  }

  const returns = Array.isArray(res.data) ? res.data : (res.data?.returns || res.returns || []);

  if (returns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ گەڕانەوەیەک تۆمار نەکراوە</td></tr>`;
    return;
  }

  tbody.innerHTML = returns
    .map((r) => {
      return `
      <tr>
        <td><strong style="direction: ltr; font-family: monospace;">${r.return_number}</strong></td>
        <td><strong style="direction: ltr; font-family: monospace;">${r.sale_receipt_number || '-'}</strong></td>
        <td>${r.customer_name || 'کڕیاری دەستبەجێ'}</td>
        <td>${r.return_date}</td>
        <td><strong style="color: #dc2626;">${formatCurrency(r.total_refund)}</strong></td>
        <td>${r.reason || '-'}</td>
        <td>${r.user_name || 'کاشێر'}</td>
      </tr>
    `;
    })
    .join('');
}

function openNewReturnModal() {
  returnLookupSale = null;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 750px;">
      <div class="modal-header">
        <h3 class="modal-title">گەڕاندنەوەی کاڵای فرۆشراو (ئیسترجاع)</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background: #f8fafc; padding: 14px; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 600;">ژمارەی پسووڵەی فرۆشتن بنووسە:</label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="ret-receipt-input" class="form-control" placeholder="بۆ نموونە: SZJZ-2026-000008" style="font-family: monospace; font-weight: bold; font-size: 15px;" />
            <button type="button" class="btn btn-primary" id="btn-search-receipt" style="white-space: nowrap; padding: 8px 18px;">🔍 دۆزینەوە</button>
          </div>
        </div>

        <div id="ret-sale-details" style="display: none;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; background: #f1f5f9; padding: 12px; border-radius: 6px; margin-bottom: 14px; font-size: 13px;">
            <div><strong>ژمارەی پسووڵە:</strong> <span id="ret-receipt-num" style="font-family: monospace; font-weight: bold;">-</span></div>
            <div><strong>کڕیار:</strong> <span id="ret-cust-name">-</span></div>
            <div><strong>بەرواری فرۆشتن:</strong> <span id="ret-sale-date">-</span></div>
            <div><strong>شێوازی پارەدان:</strong> <span id="ret-payment-type">-</span></div>
          </div>

          <div style="font-weight: 700; margin-bottom: 8px; color: var(--text-color);">کاڵاکانی ناو پسووڵە (بڕی گەڕاندنەوە دیاری بکە):</div>
          <div class="table-responsive" style="margin-bottom: 16px; border: 1px solid var(--border-color); border-radius: 6px;">
            <table class="table" style="margin: 0;">
              <thead style="background: #f8fafc;">
                <tr>
                  <th>ناوی کاڵا</th>
                  <th>کۆدی پارچە</th>
                  <th>بڕی کڕدراو</th>
                  <th>نرخی تاک</th>
                  <th style="width: 140px; text-align: center;">بڕی گەڕاندنەوە</th>
                </tr>
              </thead>
              <tbody id="ret-items-tbody"></tbody>
            </table>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">هۆکاری گەڕانەوە</label>
              <select id="ret-reason-select" class="form-control">
                <option value="NOT_WORKING">کار نەکردن (NOT_WORKING)</option>
                <option value="DEFECTIVE">تیاچوون / شکانی کاڵا (DEFECTIVE)</option>
                <option value="WRONG_PART">پارچەی هەڵە / نەگونجاو (WRONG_PART)</option>
                <option value="CUSTOMER_EXCHANGE">گۆڕینەوەی کڕیار (CUSTOMER_EXCHANGE)</option>
                <option value="OTHER">هۆکاری تر (OTHER)</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">تێبینی زیاتر (ئارەزوومەندانە)</label>
              <input type="text" id="ret-notes" class="form-control" placeholder="تێبینی زیاتر دەربارەی هۆکارەکە..." />
            </div>
          </div>

          <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 700; color: #dc2626; display: block;">کۆی پارەی گەڕاوە / داشکاندنی قەرز:</span>
              <small style="color: #991b1b;">بەپێی نرخی کاتی فرۆشتن هەژمار دەکرێت</small>
            </div>
            <strong id="ret-calculated-refund" style="font-size: 20px; color: #dc2626; font-family: monospace;">0 د.ع</strong>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary ret-cancel">داخستن</button>
        <button class="btn btn-warning" id="ret-submit-btn" disabled>↩️ تەواوکردنی گەڕانەوە</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.ret-cancel').addEventListener('click', closeModal);

  const searchBtn = modal.querySelector('#btn-search-receipt');
  const receiptInput = modal.querySelector('#ret-receipt-input');
  const saleDetailsDiv = modal.querySelector('#ret-sale-details');
  const submitBtn = modal.querySelector('#ret-submit-btn');

  const executeSearch = async () => {
    const code = receiptInput.value.trim();
    if (!code) {
      showToast('ژمارەی پسووڵە بنووسە', 'error');
      return;
    }

    const res = await api.get(`/sales?search=${encodeURIComponent(code)}`);
    if (!res.success || !res.data || res.data.length === 0) {
      showToast('هیچ پسووڵەیەک بەم ژمارەیە نەدۆزرایەوە', 'error');
      return;
    }

    const saleSummary = res.data.find((s) => s.receipt_number === code) || res.data[0];
    const detRes = await api.get(`/sales/${saleSummary.id}`);
    if (!detRes.success || !detRes.data) {
      showToast('هەڵە لە وەرگرتنی پسووڵە', 'error');
      return;
    }

    returnLookupSale = detRes.data;

    modal.querySelector('#ret-receipt-num').textContent = returnLookupSale.receipt_number || '-';
    modal.querySelector('#ret-cust-name').textContent = returnLookupSale.customer_name || 'کڕیاری دەستبەجێ (نەناسراو)';
    modal.querySelector('#ret-sale-date').textContent = returnLookupSale.sale_date + (returnLookupSale.sale_time ? ' ' + returnLookupSale.sale_time : '');
    
    let pTypeText = 'نەقد';
    if (returnLookupSale.payment_type === 'debt') pTypeText = 'قەرز';
    else if (returnLookupSale.payment_type === 'partial') pTypeText = 'بەشێک نەقد + بەشێک قەرز';
    modal.querySelector('#ret-payment-type').textContent = pTypeText;

    const tbody = modal.querySelector('#ret-items-tbody');
    tbody.innerHTML = (returnLookupSale.items || [])
      .map((it) => {
        const returnedQty = it.returned_quantity || 0;
        const availableToReturn = Math.max(0, it.quantity - returnedQty);
        const netUnitPrice = it.quantity > 0 ? (it.total_price / it.quantity) : it.unit_price;
        const isFullyReturned = availableToReturn === 0;

        return `
          <tr style="${isFullyReturned ? 'background: #f8fafc; opacity: 0.7;' : ''}">
            <td>
              <strong style="color: var(--text-color);">${it.product_name}</strong>
              ${returnedQty > 0 ? `<div style="font-size: 11px; color: #b45309; margin-top: 2px;">(پێشتر ${returnedQty} دانەی گەڕێندراوەتەوە)</div>` : ''}
            </td>
            <td><code style="font-size: 12px;">${it.part_number || '-'}</code></td>
            <td>
              <span>${it.quantity} دانە</span>
              ${!isFullyReturned ? `<div style="font-size: 11px; color: #15803d;">ماوە: ${availableToReturn}</div>` : ''}
            </td>
            <td>${formatCurrency(netUnitPrice)}</td>
            <td style="text-align: center;">
              ${isFullyReturned 
                ? '<span style="font-size: 11px; padding: 4px 8px; background: #e2e8f0; color: #64748b; border-radius: 4px; font-weight: bold;">تەواو گەڕاوەتەوە</span>'
                : `<input type="number" class="form-control ret-item-qty" 
                    data-sale-item-id="${it.id}" 
                    data-prod-id="${it.product_id}" 
                    data-unit-price="${netUnitPrice}" 
                    data-max="${availableToReturn}" 
                    value="0" 
                    min="0" 
                    max="${availableToReturn}" 
                    style="width: 100px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 15px;" />`
              }
            </td>
          </tr>
        `;
      })
      .join('');

    saleDetailsDiv.style.display = 'block';
    submitBtn.disabled = false;

    tbody.querySelectorAll('.ret-item-qty').forEach((inp) => {
      inp.addEventListener('input', () => {
        let sum = 0;
        tbody.querySelectorAll('.ret-item-qty').forEach((i) => {
          let q = parseInt(i.value, 10) || 0;
          const maxQ = parseInt(i.dataset.max, 10) || 0;
          if (q < 0) {
            q = 0;
            i.value = 0;
          }
          if (q > maxQ) {
            q = maxQ;
            i.value = maxQ;
          }
          const p = Number(i.dataset.unitPrice) || 0;
          sum += q * p;
        });
        modal.querySelector('#ret-calculated-refund').textContent = formatCurrency(sum);
      });
    });
  };

  searchBtn.addEventListener('click', executeSearch);
  receiptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch();
    }
  });

  submitBtn.addEventListener('click', async () => {
    if (!returnLookupSale) return;

    const returnItems = [];
    modal.querySelectorAll('.ret-item-qty').forEach((inp) => {
      const q = parseInt(inp.value, 10) || 0;
      if (q > 0) {
        returnItems.push({
          sale_item_id: Number(inp.dataset.saleItemId),
          product_id: Number(inp.dataset.prodId),
          quantity: q,
        });
      }
    });

    if (returnItems.length === 0) {
      showToast('هیچ کاڵایەکت بۆ گەڕانەوە دیاری نەکردووە (بڕی گەڕاندنەوە بنووسە)', 'error');
      return;
    }

    const reasonSelect = modal.querySelector('#ret-reason-select');
    const reasonValue = reasonSelect ? reasonSelect.value : 'NOT_WORKING';
    const notes = modal.querySelector('#ret-notes')?.value.trim() || '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'خەریکی تۆمارکردنە...';

    const res = await api.post('/returns', {
      sale_id: returnLookupSale.id,
      items: returnItems,
      reason: reasonValue,
      notes: notes,
    });

    submitBtn.disabled = false;
    submitBtn.textContent = '↩️ تەواوکردنی گەڕانەوە';

    if (res.success) {
      showToast('گەڕاندنەوەی کاڵا بە سەرکەوتوویی تۆمارکرا ✓', 'success');
      closeModal();
      await loadReturnsTable();
    } else {
      showToast(res.message || 'هەڵە لە ئەنجامدانی گەڕانەوە', 'error');
    }
  });
}
