/**
 * Products Management Page Module
 */
import { api, formatCurrency, showToast } from '../api.js';
import { isAdmin } from '../auth.js';

let currentPage = 1;
let categoriesList = [];
let brandsList = [];

export async function initProductsPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const admin = isAdmin();

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">بەڕێوەبردنی کاڵا و پارچە یەدەگەکان</h2>
        <div class="section-subtitle">زیادکردن، دەستکاریکردن، گەڕان و بەدواداچوونی مەخزەن</div>
      </div>
      <div style="display: flex; gap: 8px;">
        ${admin ? `<button class="btn btn-primary" id="btn-add-product">+ کاڵای نوێ</button>` : ''}
        <button class="btn btn-secondary" id="btn-refresh-products">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Filters and Search Bar -->
    <div class="card" style="padding: 16px; margin-bottom: 16px;">
      <div class="form-row" style="align-items: center;">
        <div class="form-col" style="flex: 2;">
          <input type="text" id="prod-search-input" class="form-control" placeholder="🔍 گەڕان بەپێی ناوی کاڵا، بارکۆد، کۆدی پارچە، OEM یان مارکەی بارهەڵگر..." />
        </div>
        <div class="form-col">
          <select id="prod-filter-cat" class="form-control">
            <option value="">-- هەموو بەشەکان --</option>
          </select>
        </div>
        <div class="form-col">
          <select id="prod-filter-brand" class="form-control">
            <option value="">-- هەموو بارهەڵگرەکان --</option>
            <option value="Mercedes-Benz / ئەکتەرۆس">Mercedes-Benz / ئەکتەرۆس</option>
            <option value="Scania / سکانیا">Scania / سکانیا</option>
            <option value="Volvo / ڤۆلڤۆ">Volvo / ڤۆلڤۆ</option>
            <option value="MAN / مان">MAN / مان</option>
            <option value="DAF / داف">DAF / داف</option>
            <option value="Renault / ڕینۆ">Renault / ڕینۆ</option>
            <option value="Iveco / ئیڤیکۆ">Iveco / ئیڤیکۆ</option>
            <option value="Isuzu / ئیسوزو">Isuzu / ئیسوزو</option>
            <option value="گشتی / Universal">گشتی / Universal</option>
          </select>
        </div>
        <div class="form-col" style="flex: 0 0 auto;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; cursor: pointer;">
            <input type="checkbox" id="prod-filter-low" />
            <span>⚠️ تەنها کەمماوەکان</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Products Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>ناوی کاڵا</th>
              <th>مارکەی بارهەڵگر</th>
              <th>کۆدی پارچە (Part #)</th>
              <th>بارکۆد</th>
              <th>بەش</th>
              ${admin ? `<th>نرخی کڕین</th>` : ''}
              <th>نرخی فرۆشتن</th>
              <th>بڕ لە کۆگا</th>
              <th>کردارەکان</th>
            </tr>
          </thead>
          <tbody id="products-table-body">
            <tr><td colspan="10" style="text-align:center; padding: 30px;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="products-pagination" style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-top: 1px solid var(--border-color);">
        <span id="products-count-info" style="font-size: 13px; color: var(--text-muted);">...</span>
        <div style="display: flex; gap: 6px;" id="products-page-btns"></div>
      </div>
    </div>
  `;

  await loadCategoriesOptions();
  await loadProductsTable();

  // Events
  document.getElementById('btn-refresh-products')?.addEventListener('click', () => loadProductsTable());
  document.getElementById('btn-add-product')?.addEventListener('click', () => openProductModal());

  const searchInput = document.getElementById('prod-search-input');
  let searchTimeout = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      loadProductsTable();
    }, 300);
  });

  document.getElementById('prod-filter-cat')?.addEventListener('change', () => {
    currentPage = 1;
    loadProductsTable();
  });

  document.getElementById('prod-filter-brand')?.addEventListener('change', () => {
    currentPage = 1;
    loadProductsTable();
  });

  document.getElementById('prod-filter-low')?.addEventListener('change', () => {
    currentPage = 1;
    loadProductsTable();
  });
}

async function loadCategoriesOptions() {
  const res = await api.get('/categories');
  if (res.success && res.data) {
    categoriesList = res.data;
    const sel = document.getElementById('prod-filter-cat');
    if (sel) {
      sel.innerHTML = `
        <option value="">-- هەموو بەشەکان --</option>
        ${categoriesList.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
      `;
    }
  }
}

async function loadProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  const search = document.getElementById('prod-search-input')?.value.trim() || '';
  const catId = document.getElementById('prod-filter-cat')?.value || '';
  const brand = document.getElementById('prod-filter-brand')?.value || '';
  const lowStock = document.getElementById('prod-filter-low')?.checked ? '1' : '';

  let url = `/products?page=${currentPage}&limit=25`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (catId) url += `&category_id=${catId}`;
  if (brand) url += `&truck_brand=${encodeURIComponent(brand)}`;
  if (lowStock) url += `&low_stock=1`;

  const res = await api.get(url);
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: #dc2626;">هەڵە لە وەرگرتنی کاڵاکان</td></tr>`;
    return;
  }

  const products = Array.isArray(res.data) ? res.data : (res.data?.products || res.products || []);
  const admin = isAdmin();

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px; color: var(--text-muted);">هیچ کاڵایەک نەدۆزرایەوە</td></tr>`;
    return;
  }

  tbody.innerHTML = products
    .map((p, idx) => {
      const isLow = p.quantity <= p.min_stock_level && p.quantity > 0;
      const isOut = p.quantity <= 0;
      return `
      <tr>
        <td>${(currentPage - 1) * 25 + idx + 1}</td>
        <td>
          <div style="font-weight: 700;">${p.name}</div>
          ${p.description ? `<div style="font-size: 11px; color: #64748b;">${p.description}</div>` : ''}
        </td>
        <td><span class="badge badge-info">🚛 ${p.truck_brand || 'گشتی'}</span></td>
        <td><code>${p.part_number || '-'}</code></td>
        <td><span style="font-family: monospace; font-size: 12px;">${p.barcode || '-'}</span></td>
        <td>${p.category_name || '-'}</td>
        ${admin ? `<td>${formatCurrency(p.purchase_price)}</td>` : ''}
        <td><strong style="color: var(--primary);">${formatCurrency(p.selling_price)}</strong></td>
        <td>
          <span class="badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}">
            ${isOut ? 'نەماوە (0)' : `${p.quantity} ${p.unit || 'دانە'}`}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-sm btn-secondary btn-view-batches" data-id="${p.id}" title="وەجبەکان و تێچووی FIFO">📦 وەجبە</button>
            ${
              admin
                ? `
              <button class="btn btn-sm btn-secondary btn-edit-prod" data-id="${p.id}" title="دەستکاریکردن">✏️</button>
              <button class="btn btn-sm btn-secondary btn-delete-prod" data-id="${p.id}" data-name="${p.name}" style="color: #dc2626;" title="سڕینەوە">🗑️</button>
            `
                : ''
            }
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  // Update pagination info
  const countInfo = document.getElementById('products-count-info');
  const paginationDiv = document.getElementById('products-page-btns');
  if (res.pagination) {
    if (countInfo) {
      countInfo.textContent = `کۆی گشتی: ${res.pagination.total} کاڵا | پەڕەی ${res.pagination.page} لە ${res.pagination.totalPages || 1}`;
    }
    if (paginationDiv) {
      let btns = '';
      if (res.pagination.page > 1) {
        btns += `<button class="btn btn-sm btn-secondary btn-p-prev">« پێشوو</button>`;
      }
      if (res.pagination.page < res.pagination.totalPages) {
        btns += `<button class="btn btn-sm btn-secondary btn-p-next">دواتر »</button>`;
      }
      paginationDiv.innerHTML = btns;

      paginationDiv.querySelector('.btn-p-prev')?.addEventListener('click', () => {
        currentPage--;
        loadProductsTable();
      });
      paginationDiv.querySelector('.btn-p-next')?.addEventListener('click', () => {
        currentPage++;
        loadProductsTable();
      });
    }
  }

  // Row action events
  tbody.querySelectorAll('.btn-view-batches').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pId = btn.dataset.id;
      const product = products.find((p) => String(p.id) === String(pId));
      if (product) openBatchesModal(product);
    });
  });

  tbody.querySelectorAll('.btn-edit-prod').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pId = btn.dataset.id;
      const product = products.find((p) => String(p.id) === String(pId));
      if (product) openProductModal(product);
    });
  });

  tbody.querySelectorAll('.btn-delete-prod').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pId = btn.dataset.id;
      const pName = btn.dataset.name;
      if (confirm(`دڵنیایت دەتەوێت کاڵای "${pName}" بسڕیتەوە؟`)) {
        const delRes = await api.delete(`/products/${pId}`);
        if (delRes.success) {
          showToast('کاڵاکە بە سەرکەوتوویی سڕایەوە', 'success');
          loadProductsTable();
        } else {
          showToast(delRes.message || 'هەڵە لە سڕینەوەی کاڵا', 'error');
        }
      }
    });
  });
}

function openProductModal(product = null) {
  const isEdit = !!product;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 680px;">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'دەستکاریکردنی کاڵا' : 'زیادکردنی کاڵای نوێ'}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-col" style="flex: 2;">
            <div class="form-group">
              <label class="form-label">ناوی کاڵا / پارچە *</label>
              <input type="text" id="mp-name" class="form-control" value="${product?.name || ''}" placeholder="بۆ نموونە: فلتەری زەیتی ئەکتەرۆس" required />
            </div>
          </div>
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">بارکۆد</label>
              <div style="display: flex; gap: 4px;">
                <input type="text" id="mp-barcode" class="form-control" value="${product?.barcode || ''}" placeholder="سکان یان بنووسە..." />
                <button type="button" class="btn btn-secondary btn-sm" id="btn-gen-barcode" title="دروستکردنی بارکۆدی خۆکار">⚡</button>
              </div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">مارکەی بارهەڵگر</label>
              <select id="mp-truck-brand" class="form-control">
                <option value="">-- هەڵبژێرە --</option>
                <option value="Mercedes-Benz / ئەکتەرۆس" ${product?.truck_brand?.includes('Mercedes') ? 'selected' : ''}>Mercedes-Benz / ئەکتەرۆس</option>
                <option value="Scania / سکانیا" ${product?.truck_brand?.includes('Scania') ? 'selected' : ''}>Scania / سکانیا</option>
                <option value="Volvo / ڤۆلڤۆ" ${product?.truck_brand?.includes('Volvo') ? 'selected' : ''}>Volvo / ڤۆلڤۆ</option>
                <option value="MAN / مان" ${product?.truck_brand?.includes('MAN') ? 'selected' : ''}>MAN / مان</option>
                <option value="DAF / داف" ${product?.truck_brand?.includes('DAF') ? 'selected' : ''}>DAF / داف</option>
                <option value="Renault / ڕینۆ" ${product?.truck_brand?.includes('Renault') ? 'selected' : ''}>Renault / ڕینۆ</option>
                <option value="Iveco / ئیڤیکۆ" ${product?.truck_brand?.includes('Iveco') ? 'selected' : ''}>Iveco / ئیڤیکۆ</option>
                <option value="Isuzu / ئیسوزو" ${product?.truck_brand?.includes('Isuzu') ? 'selected' : ''}>Isuzu / ئیسوزو</option>
                <option value="گشتی / Universal" ${product?.truck_brand?.includes('گشتی') ? 'selected' : ''}>گشتی / Universal</option>
              </select>
            </div>
          </div>
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">بەش / پۆلێن</label>
              <select id="mp-category" class="form-control">
                <option value="">-- هەڵبژێرە --</option>
                ${categoriesList.map((c) => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">کۆدی پارچە (Part Number)</label>
              <input type="text" id="mp-part-no" class="form-control" value="${product?.part_number || ''}" placeholder="بۆ نموونە: A 000 421 43 10" />
            </div>
          </div>
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">ژمارەی OEM</label>
              <input type="text" id="mp-oem-no" class="form-control" value="${product?.oem_number || ''}" placeholder="OEM Number" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">نرخی کڕین (تێچوو) *</label>
              <input type="number" id="mp-cost-price" class="form-control" value="${product?.purchase_price ?? 0}" min="0" required />
            </div>
          </div>
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">نرخی فرۆشتن *</label>
              <input type="number" id="mp-sell-price" class="form-control" value="${product?.selling_price ?? 0}" min="0" required />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">بڕ لە کۆگا (ژمارە) *</label>
              <input type="number" id="mp-quantity" class="form-control" value="${product?.quantity ?? 0}" min="0" required ${isEdit ? '' : ''} />
            </div>
          </div>
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">کەمترین ئاستی ئاگادارکردنەوە</label>
              <input type="number" id="mp-min-stock" class="form-control" value="${product?.min_stock_level ?? 3}" min="0" />
            </div>
          </div>
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">یەکەی پێوانە</label>
              <select id="mp-unit" class="form-control">
                <option value="دانە" ${product?.unit === 'دانە' ? 'selected' : ''}>دانە</option>
                <option value="سێت" ${product?.unit === 'سێت' ? 'selected' : ''}>سێت</option>
                <option value="پاکەت" ${product?.unit === 'پاکەت' ? 'selected' : ''}>پاکەت</option>
                <option value="لیتر" ${product?.unit === 'لیتر' ? 'selected' : ''}>لیتر</option>
                <option value="مەتر" ${product?.unit === 'مەتر' ? 'selected' : ''}>مەتر</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">شوێنی دانان لە کۆگا (ڕەفە / ڕیز)</label>
              <input type="text" id="mp-location" class="form-control" value="${product?.location || ''}" placeholder="بۆ نموونە: ڕەفەی A-12" />
            </div>
          </div>
          <div class="form-col">
            <div class="form-group">
              <label class="form-label">تێبینی زیاتر</label>
              <input type="text" id="mp-notes" class="form-control" value="${product?.description || ''}" placeholder="تێبینی..." />
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary mp-cancel">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="mp-save-btn">${isEdit ? 'پاشەکەوتکردنی گۆڕانکارییەکان' : 'زیادکردنی کاڵا'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.mp-cancel').addEventListener('click', closeModal);

  modal.querySelector('#btn-gen-barcode')?.addEventListener('click', () => {
    const randomCode = 'SZ' + Math.floor(100000000 + Math.random() * 900000000);
    modal.querySelector('#mp-barcode').value = randomCode;
  });

  modal.querySelector('#mp-save-btn').addEventListener('click', async () => {
    const name = modal.querySelector('#mp-name').value.trim();
    const barcode = modal.querySelector('#mp-barcode').value.trim();
    const truck_brand = modal.querySelector('#mp-truck-brand').value;
    const category_id = modal.querySelector('#mp-category').value;
    const part_number = modal.querySelector('#mp-part-no').value.trim();
    const oem_number = modal.querySelector('#mp-oem-no').value.trim();
    const purchase_price = Number(modal.querySelector('#mp-cost-price').value);
    const selling_price = Number(modal.querySelector('#mp-sell-price').value);
    const quantity = Number(modal.querySelector('#mp-quantity').value);
    const min_stock_level = Number(modal.querySelector('#mp-min-stock').value);
    const unit = modal.querySelector('#mp-unit').value;
    const location = modal.querySelector('#mp-location').value.trim();
    const description = modal.querySelector('#mp-notes').value.trim();

    if (!name) {
      showToast('ناوی کاڵا پێویستە', 'error');
      return;
    }
    if (isNaN(selling_price) || selling_price < 0) {
      showToast('نرخی فرۆشتن نادروستە', 'error');
      return;
    }

    const payload = {
      name,
      barcode: barcode || null,
      truck_brand: truck_brand || null,
      category_id: category_id ? Number(category_id) : null,
      part_number: part_number || null,
      oem_number: oem_number || null,
      purchase_price: purchase_price || 0,
      selling_price: selling_price || 0,
      quantity: quantity || 0,
      min_stock_level: min_stock_level || 3,
      unit: unit || 'دانە',
      location: location || null,
      description: description || null,
    };

    let res;
    if (isEdit) {
      res = await api.put(`/products/${product.id}`, payload);
    } else {
      res = await api.post('/products', payload);
    }

    if (res.success) {
      showToast(res.message || 'کردارەکە بە سەرکەوتوویی ئەنجامدرا', 'success');
      closeModal();
      loadProductsTable();
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی کاڵا', 'error');
    }
  });
}

async function openBatchesModal(product) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 800px;">
      <div class="modal-header">
        <h3 class="modal-title">📦 وەجبەکانی کاڵا (FIFO Cost Batches) - ${product.name}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; border: 1px solid var(--border-color);">
          <div>
            <div style="font-size: 11px; color: var(--text-muted);">کۆی گشتی لە مەخزەن:</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--primary);">${product.quantity} دانە</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted);">کۆدی پارچە:</div>
            <div style="font-size: 14px; font-weight: 700;">${product.part_number || '-'}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted);">مارکەی بارهەڵگر:</div>
            <div style="font-size: 14px; font-weight: 700;">${product.truck_brand || 'گشتی'}</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>کۆدی وەجبە</th>
                <th>جۆری وەجبە</th>
                <th>بەروار</th>
                <th>تێچووی دانە (IQD)</th>
                <th>بڕی سەرەتا</th>
                <th>بڕی ماوە</th>
                <th>دابینکەر / پسووڵە</th>
                <th>بارودۆخ</th>
              </tr>
            </thead>
            <tbody id="product-batches-body">
              <tr><td colspan="9" style="text-align: center; padding: 24px;">خەریکی هێنانی وەجبەکانە...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary mp-close">داخستن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.mp-close').addEventListener('click', closeModal);

  const tbody = modal.querySelector('#product-batches-body');
  const res = await api.get(`/products/${product.id}/batches`);

  if (!res.success || !res.data || res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">هیچ وەجبەیەکی تۆمارکراو نییە</td></tr>`;
    return;
  }

  tbody.innerHTML = res.data
    .map((b, idx) => {
      const isDepleted = Number(b.remaining_quantity) <= 0;
      const typeLabel =
        b.batch_type === 'PURCHASE'
          ? 'کڕین'
          : b.batch_type === 'OPENING_BALANCE'
          ? 'سەرەتایی'
          : b.batch_type === 'RETURN'
          ? 'گەڕاندنەوە'
          : 'دەستکاری';

      return `
      <tr style="${isDepleted ? 'opacity: 0.5; background: #f8fafc;' : 'font-weight: 600;'}">
        <td>${idx + 1}</td>
        <td><code>${b.batch_number}</code></td>
        <td><span class="badge ${b.batch_type === 'PURCHASE' ? 'badge-primary' : 'badge-secondary'}">${typeLabel}</span></td>
        <td>${b.purchase_date || '-'}</td>
        <td style="color: var(--primary);">${formatCurrency(b.unit_cost)}</td>
        <td>${b.original_quantity}</td>
        <td><strong style="color: ${isDepleted ? '#64748b' : '#059669'};">${b.remaining_quantity}</strong></td>
        <td>${b.supplier_name || b.invoice_number || '-'}</td>
        <td>
          <span class="badge ${isDepleted ? 'badge-danger' : 'badge-success'}">
            ${isDepleted ? 'تەواوبووە' : 'بەردەستە'}
          </span>
        </td>
      </tr>
    `;
    })
    .join('');
}
