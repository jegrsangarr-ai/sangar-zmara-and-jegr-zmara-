/**
 * POS / Cashier Screen Module
 */
import { api, formatCurrency, showToast } from '../api.js';
import { printSaleReceipt, downloadSaleInvoicePdf } from '../receipt.js';

let cart = [];
let productsCache = [];
let categoriesCache = [];
let customersCache = [];
let companiesCache = [];
let currentCompanyDrivers = [];
let currentCompanyVehicles = [];
let selectedCustomerType = 'one_time'; // 'one_time', 'individual', 'company'
let selectedCustomer = null; // { id, name, phone, current_debt }
let selectedCompany = null; // { id, name, owner_name, current_debt, phone }
let selectedCategoryId = null;
let selectedTruckBrand = null;
let selectedPaymentType = 'cash'; // 'cash', 'debt', 'partial'
let systemSettings = {};

export async function initPosPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  // Load system settings
  const setRes = await api.get('/settings/public');
  if (setRes.success && setRes.data) {
    systemSettings = setRes.data;
  }

  container.innerHTML = `
    <div class="pos-container">
      <!-- Left Panel: Products & Categories -->
      <div class="pos-products-panel">
        <div class="pos-search-bar">
          <input
            type="text"
            id="pos-barcode-input"
            class="form-control pos-search-input"
            placeholder="🔍 بارکۆد سکان بکە یان ناوی کاڵا / ژمارەی پارچە / مارکەی بارهەڵگر بنووسە..."
            autofocus
          />
          <button class="btn btn-secondary" id="pos-clear-search-btn" title="سڕینەوەی گەڕان">پاککردنەوە</button>
        </div>

        <div class="pos-category-pills" id="pos-category-pills">
          <button class="cat-pill active" data-cat="all">هەموو بەشەکان</button>
          <!-- Dynamic categories -->
        </div>

        <div class="pos-products-grid" id="pos-products-grid">
          <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
            خەریکی بارکردنی کاڵاکانە...
          </div>
        </div>
      </div>

      <!-- Right Panel: Cart & Checkout -->
      <div class="pos-cart-panel">
        <div class="cart-header">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="font-size: 16px; display: flex; align-items: center; gap: 6px;">
              🛒 سەبەتەی فرۆشتن
              <span class="badge badge-info" id="cart-item-count">0 کاڵا</span>
            </strong>
            <button class="btn btn-sm btn-secondary" id="btn-clear-cart" style="color: #dc2626;">سڕینەوەی سەبەتە</button>
          </div>

          <!-- Customer Type Tabs (3 modes) -->
          <div class="pos-cust-tabs" style="display: flex; gap: 4px; background: #e2e8f0; padding: 3px; border-radius: 8px; margin-bottom: 8px;">
            <button type="button" class="btn btn-sm pos-cust-type-btn active" data-type="one_time" style="flex: 1; font-weight: 700; border-radius: 6px; padding: 6px 4px; font-size: 12px; background: #ffffff; color: #0f172a; border: none; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              ⚡ کڕیاری یەکجارە
            </button>
            <button type="button" class="btn btn-sm pos-cust-type-btn" data-type="individual" style="flex: 1; font-weight: 700; border-radius: 6px; padding: 6px 4px; font-size: 12px; background: transparent; color: #475569; border: none;">
              👤 کڕیاری تۆمارکراو
            </button>
            <button type="button" class="btn btn-sm pos-cust-type-btn" data-type="company" style="flex: 1; font-weight: 700; border-radius: 6px; padding: 6px 4px; font-size: 12px; background: transparent; color: #475569; border: none;">
              🏢 کۆمپانیا / سایق
            </button>
          </div>

          <!-- Mode 1: Walk-in / One-time customer -->
          <div id="pos-onetime-cust-wrap" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px;">
            <div style="display: flex; gap: 6px;">
              <input type="text" id="pos-onetime-name" class="form-control" style="font-size: 13px; font-weight: 600;" placeholder="ناوی کڕیاری دەستبەجێ..." value="کڕیاری دەستبەجێ" />
              <input type="text" id="pos-onetime-phone" class="form-control" style="font-size: 13px; width: 130px;" placeholder="مۆبایل (ئارەزوومەندانە)" dir="ltr" />
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 5px 8px; border-radius: 6px; border: 1px dashed #cbd5e1; font-size: 12px;">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #334155; margin: 0;">
                <input type="checkbox" id="pos-save-as-permanent" style="width: 15px; height: 15px; cursor: pointer;" />
                <span style="font-weight: 600;">پاشەکەوتکردن وەک کڕیاری بەردەوام</span>
              </label>
              <span style="color: #64748b; font-size: 11px;">(بۆ فرۆشتنی قەرز پێویستە)</span>
            </div>
            <input type="text" id="pos-onetime-notes" class="form-control" style="font-size: 12px;" placeholder="تێبینی کڕیار / پسووڵە (ئارەزوومەندانە)..." />
          </div>

          <!-- Mode 2: Existing Individual Customer (Autocomplete & Balance) -->
          <div id="pos-individual-cust-wrap" style="display: none; flex-direction: column; gap: 6px; margin-bottom: 6px;">
            <!-- Selected customer card -->
            <div id="pos-selected-customer-card" style="display: none; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 10px; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 800; font-size: 13px; color: #166534;" id="pos-sel-cust-name">ناوی کڕیار</div>
                <div style="font-size: 11px; color: #4b5563;" id="pos-sel-cust-phone">0750xxxxxxx</div>
              </div>
              <div style="text-align: left; display: flex; align-items: center; gap: 8px;">
                <div style="font-size: 12px; font-weight: 700;" id="pos-sel-cust-debt-badge">
                  قەرزی پێشوو: <span id="pos-sel-cust-debt">0 د.ع</span>
                </div>
                <button type="button" class="btn btn-sm btn-secondary" id="btn-clear-selected-customer" style="padding: 2px 8px; font-size: 11px; color: #dc2626;" title="گۆڕین / لابردن">✕ لابردن</button>
              </div>
            </div>

            <!-- Customer Search Input & Add button -->
            <div id="pos-customer-search-box" style="position: relative;">
              <div style="display: flex; gap: 6px;">
                <div style="position: relative; flex: 1;">
                  <input type="text" id="pos-customer-search-input" class="form-control" style="font-size: 13px; padding-left: 28px;" placeholder="🔍 گەڕانی کڕیار بەپێی ناو یان مۆبایل..." autocomplete="off" />
                  <button type="button" id="btn-clear-cust-search" style="display: none; position: absolute; left: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 14px; color: #94a3b8; cursor: pointer;">✕</button>
                </div>
                <button type="button" class="btn btn-sm btn-outline" id="btn-pos-add-customer" title="کڕیاری نوێ" style="font-weight: 800; font-size: 13px; padding: 4px 10px;">+ نوێ</button>
              </div>

              <!-- Filter options -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px; color: #64748b;">
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; margin: 0;">
                  <input type="checkbox" id="pos-cust-debtors-only" style="width: 13px; height: 13px; cursor: pointer;" />
                  <span>تەنها ئەوانەی قەرزیان لایە</span>
                </label>
                <span id="pos-cust-search-status" style="font-size: 10px;"></span>
              </div>

              <!-- Autocomplete dropdown list -->
              <div id="pos-customer-dropdown-results" style="display: none; position: absolute; top: 100%; right: 0; left: 0; z-index: 100; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 220px; overflow-y: auto; margin-top: 2px;">
              </div>
            </div>
          </div>

          <!-- Mode 3: Company / Driver / Vehicle (Unified Search) -->
          <div id="pos-company-cust-wrap" style="display: none; flex-direction: column; gap: 6px; margin-bottom: 6px;">
            <!-- Selected company card -->
            <div id="pos-selected-company-card" style="display: none; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 16px;">🏢</span>
                  <strong style="font-size: 13px; color: #0f172a;" id="pos-sel-cmp-name">ناوی کۆمپانیا</strong>
                  <span id="pos-sel-cmp-owner" style="font-size: 11px; color: #64748b;"></span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span id="pos-company-debt-badge" style="font-size: 12px; font-weight: 700; color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecaca;">
                    قەرز: <span id="pos-company-debt-val">0 د.ع</span>
                  </span>
                  <button type="button" class="btn btn-sm btn-secondary" id="btn-clear-selected-company" style="padding: 2px 8px; font-size: 11px; color: #dc2626;" title="گۆڕین / لابردن">✕ لابردن</button>
                </div>
              </div>
              <div id="pos-company-active-summary" style="margin-top: 4px; font-size: 11px; color: #475569; display: flex; gap: 12px;">
                <span id="pos-summary-driver" style="display: none;">👨‍✈️ سایق: <strong></strong></span>
                <span id="pos-summary-vehicle" style="display: none;">🚛 تابلۆ: <strong></strong></span>
              </div>
            </div>

            <!-- Unified Search Box for Company / Driver / Vehicle -->
            <div id="pos-company-search-box" style="position: relative;">
              <div style="display: flex; gap: 6px;">
                <div style="position: relative; flex: 1;">
                  <input type="text" id="pos-company-search-input" class="form-control" style="font-size: 13px; padding-left: 28px;" placeholder="🔍 گەڕانی کۆمپانیا، سایق، یان ژمارەی ئۆتۆمبێل..." autocomplete="off" />
                  <button type="button" id="btn-clear-company-search" style="display: none; position: absolute; left: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 14px; color: #94a3b8; cursor: pointer;">✕</button>
                </div>
                <button type="button" class="btn btn-sm btn-outline" id="btn-pos-add-company" title="کۆمپانیای نوێ" style="font-weight: 800; font-size: 13px; padding: 4px 10px;">+ نوێ</button>
              </div>

              <!-- Autocomplete dropdown list for companies -->
              <div id="pos-company-dropdown-results" style="display: none; position: absolute; top: 100%; right: 0; left: 0; z-index: 100; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 240px; overflow-y: auto; margin-top: 2px;">
              </div>
            </div>

            <!-- Driver & Vehicle selectors for chosen company -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <div style="display: flex; gap: 3px;">
                <select id="pos-driver-select" class="form-control" style="font-size: 12px;" disabled>
                  <option value="">-- هەڵبژاردنی سایق --</option>
                </select>
                <button class="btn btn-sm btn-outline" id="btn-pos-add-driver" style="padding: 2px 6px;" title="سایقی نوێ">+</button>
              </div>

              <div style="display: flex; gap: 3px;">
                <select id="pos-vehicle-select" class="form-control" style="font-size: 12px;" disabled>
                  <option value="">-- هەڵبژاردنی ئۆتۆمبێل --</option>
                </select>
                <button class="btn btn-sm btn-outline" id="btn-pos-add-vehicle" style="padding: 2px 6px;" title="ئۆتۆمبێلی نوێ">+</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Cart Items List -->
        <div class="cart-items-scroll" id="cart-items-list">
          <div style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">🛒</div>
            <div>هیچ کاڵایەک زیاد نەکراوە</div>
            <div style="font-size: 12px; margin-top: 4px;">بارکۆد سکان بکە یان لە لیستەکە کاڵا هەڵبژێرە</div>
          </div>
        </div>

        <!-- Checkout Summary -->
        <div class="cart-summary">
          <div class="summary-row">
            <span>کۆی کاڵاکان:</span>
            <span id="pos-subtotal" style="font-weight: 700;">0 د.ع</span>
          </div>

          <div class="summary-row">
            <span>داشکاندنی گشتی:</span>
            <div style="width: 120px;">
              <input type="number" id="pos-overall-discount" class="form-control" style="padding: 4px 8px; font-size: 13px; text-align: left;" value="0" min="0" />
            </div>
          </div>

          <div class="summary-row total-grand">
            <span>کۆی گشتی:</span>
            <span id="pos-grand-total">0 د.ع</span>
          </div>

          <!-- Payment Type Selector -->
          <div class="payment-type-selector">
            <button type="button" class="pay-type-btn active" data-pay="cash">💵 نەقد</button>
            <button type="button" class="pay-type-btn" data-pay="debt">📋 قەرز</button>
            <button type="button" class="pay-type-btn" data-pay="partial">⚖️ نەقد + قەرز</button>
          </div>

          <!-- Cash payment inputs -->
          <div id="cash-payment-details">
            <div class="summary-row">
              <span id="label-paid-amount">پارەی وەرگیراو:</span>
              <div style="width: 140px;">
                <input type="number" id="pos-paid-amount" class="form-control" style="padding: 6px 8px; font-size: 14px; font-weight: bold; text-align: left;" placeholder="بڕی پارە" />
              </div>
            </div>

            <div class="summary-row" id="row-change-amount" style="color: #16a34a; font-weight: 700; margin-top: 4px;">
              <span>پارەی گەڕاوە:</span>
              <span id="pos-change-amount">0 د.ع</span>
            </div>

            <div class="summary-row" id="row-debt-amount" style="color: #dc2626; font-weight: 700; display: none; margin-top: 4px;">
              <span>ماوەی قەرز:</span>
              <span id="pos-remaining-debt">0 د.ع</span>
            </div>
          </div>

          <button class="btn-checkout" id="btn-complete-sale" style="margin-top: 10px;">
            <span>✓ تەواوکردنی فرۆشتن</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  setupPosEvents();
  setupCustomerSearch();
  setupCompanySearch();
  await loadCategories();
  await loadCustomers();
  await loadCompanies();
  await loadProducts();
}

async function loadCategories() {
  const res = await api.get('/categories');
  if (res.success && res.data) {
    categoriesCache = res.data;
    const pillsContainer = document.getElementById('pos-category-pills');
    if (!pillsContainer) return;

    pillsContainer.innerHTML = `
      <button class="cat-pill active" data-cat="all">هەموو بەشەکان</button>
      ${categoriesCache
        .map((cat) => `<button class="cat-pill" data-cat="${cat.id}">${cat.name}</button>`)
        .join('')}
    `;

    pillsContainer.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        pillsContainer.querySelectorAll('.cat-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const catId = btn.dataset.cat;
        selectedCategoryId = catId === 'all' ? null : catId;
        renderProductsGrid();
      });
    });
  }
}

function switchToCustomerTab(type) {
  selectedCustomerType = type;
  document.querySelectorAll('.pos-cust-type-btn').forEach((b) => {
    const isActive = b.dataset.type === type;
    b.classList.toggle('active', isActive);
    b.style.background = isActive ? '#ffffff' : 'transparent';
    b.style.color = isActive ? '#0f172a' : '#475569';
    b.style.boxShadow = isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none';
  });

  const onetimeWrap = document.getElementById('pos-onetime-cust-wrap');
  const indivWrap = document.getElementById('pos-individual-cust-wrap');
  const compWrap = document.getElementById('pos-company-cust-wrap');

  if (onetimeWrap) onetimeWrap.style.display = type === 'one_time' ? 'flex' : 'none';
  if (indivWrap) indivWrap.style.display = type === 'individual' ? 'flex' : 'none';
  if (compWrap) compWrap.style.display = type === 'company' ? 'flex' : 'none';

  // If debt/partial was active and user switches to one_time, inform about debt policy
  if (type === 'one_time' && (selectedPaymentType === 'debt' || selectedPaymentType === 'partial')) {
    const saveCheck = document.getElementById('pos-save-as-permanent');
    if (saveCheck && !saveCheck.checked) {
      showToast('فرۆشتن بە قەرز تەنها بۆ کڕیاری تۆمارکراو یان کۆمپانیا دەبێت', 'warning');
    }
  }
}

let customerSearchTimeout = null;

function setupCustomerSearch() {
  const searchInput = document.getElementById('pos-customer-search-input');
  const clearBtn = document.getElementById('btn-clear-cust-search');
  const dropdown = document.getElementById('pos-customer-dropdown-results');
  const debtorsOnlyCheck = document.getElementById('pos-cust-debtors-only');
  const statusEl = document.getElementById('pos-cust-search-status');

  const doSearch = async () => {
    const q = searchInput ? searchInput.value.trim() : '';
    const debtorsOnly = debtorsOnlyCheck ? debtorsOnlyCheck.checked : false;

    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    try {
      if (statusEl) statusEl.textContent = 'گەڕان...';
      const res = await api.get(`/customers/search?q=${encodeURIComponent(q)}&debtors_only=${debtorsOnly ? 'true' : 'false'}`);
      if (statusEl) statusEl.textContent = '';

      if (res.success && res.data) {
        const list = res.data;
        if (list.length === 0) {
          dropdown.innerHTML = `
            <div style="padding: 12px; text-align: center; color: #64748b; font-size: 12px;">
              هیچ کڕیارێک نەدۆزرایەوە
            </div>
          `;
          dropdown.style.display = 'block';
          return;
        }

        dropdown.innerHTML = list
          .map((c) => {
            const debt = Number(c.current_debt) || 0;
            const debtBadge =
              debt > 0
                ? `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 11px;">قەرز: ${formatCurrency(debt)}</span>`
                : `<span style="color: #16a34a; font-size: 11px; background: #f0fdf4; padding: 2px 6px; border-radius: 4px;">بێ قەرز ✓</span>`;

            return `
              <div class="pos-cust-search-item" data-id="${c.id}" style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease;">
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${c.name}</div>
                  <div style="font-size: 11px; color: #64748b;" dir="ltr">${c.phone || 'بێ مۆبایل'}</div>
                </div>
                <div style="text-align: left;">
                  ${debtBadge}
                </div>
              </div>
            `;
          })
          .join('');

        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.pos-cust-search-item').forEach((item) => {
          item.addEventListener('click', () => {
            const id = Number(item.dataset.id);
            const found = list.find((x) => x.id === id);
            if (found) {
              selectIndividualCustomer(found);
            }
            dropdown.style.display = 'none';
          });
          item.addEventListener('mouseenter', () => {
            item.style.background = '#f8fafc';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
          });
        });
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = '';
      console.error('Customer search error:', err);
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(customerSearchTimeout);
      customerSearchTimeout = setTimeout(doSearch, 300);
    });

    searchInput.addEventListener('focus', () => {
      if (!selectedCustomer) doSearch();
    });
  }

  if (debtorsOnlyCheck) {
    debtorsOnlyCheck.addEventListener('change', () => {
      doSearch();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearBtn.style.display = 'none';
      doSearch();
    });
  }

  // Clear selected customer button
  document.getElementById('btn-clear-selected-customer')?.addEventListener('click', () => {
    clearSelectedCustomer();
  });

  // Hide dropdown on click outside
  document.addEventListener('click', (e) => {
    if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput && e.target !== debtorsOnlyCheck) {
      dropdown.style.display = 'none';
    }
  });
}

function selectIndividualCustomer(cust) {
  selectedCustomer = cust;
  const card = document.getElementById('pos-selected-customer-card');
  const searchBox = document.getElementById('pos-customer-search-box');
  const nameEl = document.getElementById('pos-sel-cust-name');
  const phoneEl = document.getElementById('pos-sel-cust-phone');
  const debtEl = document.getElementById('pos-sel-cust-debt');
  const badge = document.getElementById('pos-sel-cust-debt-badge');

  if (nameEl) nameEl.textContent = cust.name;
  if (phoneEl) phoneEl.textContent = cust.phone ? `مۆبایل: ${cust.phone}` : 'بێ مۆبایل';

  const debt = Number(cust.current_debt) || 0;
  if (debtEl) debtEl.textContent = formatCurrency(debt);
  if (badge) {
    if (debt > 0) {
      badge.style.color = '#dc2626';
    } else {
      badge.style.color = '#16a34a';
    }
  }

  if (card) card.style.display = 'flex';
  if (searchBox) searchBox.style.display = 'none';
}

function clearSelectedCustomer() {
  selectedCustomer = null;
  const card = document.getElementById('pos-selected-customer-card');
  const searchBox = document.getElementById('pos-customer-search-box');
  const searchInput = document.getElementById('pos-customer-search-input');
  if (card) card.style.display = 'none';
  if (searchBox) searchBox.style.display = 'block';
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
}

let companySearchTimeout = null;

function setupCompanySearch() {
  const searchInput = document.getElementById('pos-company-search-input');
  const clearBtn = document.getElementById('btn-clear-company-search');
  const dropdown = document.getElementById('pos-company-dropdown-results');

  const doSearch = async () => {
    const q = searchInput ? searchInput.value.trim() : '';
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    try {
      const res = await api.get(`/companies/search?q=${encodeURIComponent(q)}`);
      if (res.success && res.data) {
        const list = res.data;
        if (list.length === 0) {
          dropdown.innerHTML = `
            <div style="padding: 12px; text-align: center; color: #64748b; font-size: 12px;">
              هیچ کۆمپانیا یان سایق یان بارهەڵگرێک نەدۆزرایەوە
            </div>
          `;
          dropdown.style.display = 'block';
          return;
        }

        dropdown.innerHTML = list
          .map((item) => {
            const debt = Number(item.company_debt) || 0;
            const debtBadge =
              debt > 0
                ? `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 11px;">قەرز: ${formatCurrency(debt)}</span>`
                : `<span style="color: #16a34a; font-size: 11px; background: #f0fdf4; padding: 2px 6px; border-radius: 4px;">بێ قەرز ✓</span>`;

            let matchDetail = '';
            if (item.matched_entity_type === 'driver' && item.matched_driver_name) {
              matchDetail = `<div style="font-size: 11px; color: #2563eb; font-weight: 600;">👨‍✈️ سایق: ${item.matched_driver_name} ${item.matched_driver_phone ? `(${item.matched_driver_phone})` : ''}</div>`;
            } else if (item.matched_entity_type === 'vehicle' && item.matched_vehicle_plate) {
              matchDetail = `<div style="font-size: 11px; color: #7c3aed; font-weight: 600;">🚛 بارهەڵگر: ${item.matched_vehicle_plate}</div>`;
            }

            return `
              <div class="pos-company-search-item" data-id="${item.company_id}" data-driver-id="${item.matched_driver_id || ''}" data-vehicle-id="${item.matched_vehicle_id || ''}" style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease;">
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: #0f172a;">🏢 ${item.company_name}</div>
                  ${item.company_owner ? `<div style="font-size: 11px; color: #64748b;">خاوەن کار: ${item.company_owner}</div>` : ''}
                  ${matchDetail}
                </div>
                <div style="text-align: left;">
                  ${debtBadge}
                </div>
              </div>
            `;
          })
          .join('');

        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.pos-company-search-item').forEach((row) => {
          row.addEventListener('click', async () => {
            const cId = Number(row.dataset.id);
            const drvId = row.dataset.driverId ? Number(row.dataset.driverId) : null;
            const vehId = row.dataset.vehicleId ? Number(row.dataset.vehicleId) : null;
            const found = list.find((x) => x.company_id === cId);
            dropdown.style.display = 'none';
            if (found) {
              await selectCompanyEntity(found, drvId, vehId);
            }
          });
          row.addEventListener('mouseenter', () => {
            row.style.background = '#f8fafc';
          });
          row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
          });
        });
      }
    } catch (err) {
      console.error('Company search error:', err);
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(companySearchTimeout);
      companySearchTimeout = setTimeout(doSearch, 300);
    });

    searchInput.addEventListener('focus', () => {
      if (!selectedCompany) doSearch();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearBtn.style.display = 'none';
      doSearch();
    });
  }

  // Clear selected company button
  document.getElementById('btn-clear-selected-company')?.addEventListener('click', () => {
    clearSelectedCompany();
  });

  // Hide dropdown on outside click
  document.addEventListener('click', (e) => {
    if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
      dropdown.style.display = 'none';
    }
  });

  // Attach change listener to driver and vehicle selects
  document.getElementById('pos-driver-select')?.addEventListener('change', () => {
    updateCompanySelectionSummary();
  });
  document.getElementById('pos-vehicle-select')?.addEventListener('change', () => {
    updateCompanySelectionSummary();
  });
}

async function selectCompanyEntity(companyData, preselectDriverId = null, preselectVehicleId = null) {
  selectedCompany = {
    id: companyData.company_id,
    name: companyData.company_name,
    owner_name: companyData.company_owner || '',
    current_debt: companyData.company_debt || 0,
    phone: companyData.company_phone || '',
  };

  const card = document.getElementById('pos-selected-company-card');
  const searchBox = document.getElementById('pos-company-search-box');
  const nameEl = document.getElementById('pos-sel-cmp-name');
  const ownerEl = document.getElementById('pos-sel-cmp-owner');
  const debtVal = document.getElementById('pos-company-debt-val');

  if (nameEl) nameEl.textContent = selectedCompany.name;
  if (ownerEl) ownerEl.textContent = selectedCompany.owner_name ? `(${selectedCompany.owner_name})` : '';
  if (debtVal) debtVal.textContent = formatCurrency(selectedCompany.current_debt);

  if (card) card.style.display = 'block';
  if (searchBox) searchBox.style.display = 'none';

  await handleCompanySelection(selectedCompany.id, preselectDriverId, preselectVehicleId);
}

function clearSelectedCompany() {
  selectedCompany = null;
  const card = document.getElementById('pos-selected-company-card');
  const searchBox = document.getElementById('pos-company-search-box');
  const searchInput = document.getElementById('pos-company-search-input');
  if (card) card.style.display = 'none';
  if (searchBox) searchBox.style.display = 'block';
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  handleCompanySelection(null);
}

function updateCompanySelectionSummary() {
  const driverSel = document.getElementById('pos-driver-select');
  const vehicleSel = document.getElementById('pos-vehicle-select');
  const summaryDriver = document.getElementById('pos-summary-driver');
  const summaryVehicle = document.getElementById('pos-summary-vehicle');

  if (summaryDriver && driverSel) {
    const drvText = driverSel.selectedOptions?.[0]?.text;
    if (driverSel.value && drvText && !drvText.includes('--')) {
      summaryDriver.innerHTML = `👨‍✈️ سایق: <strong>${drvText.replace('👨‍✈️ ', '')}</strong>`;
      summaryDriver.style.display = 'inline-block';
    } else {
      summaryDriver.style.display = 'none';
    }
  }

  if (summaryVehicle && vehicleSel) {
    const vehText = vehicleSel.selectedOptions?.[0]?.text;
    if (vehicleSel.value && vehText && !vehText.includes('--')) {
      summaryVehicle.innerHTML = `🚛 ئۆتۆمبێل: <strong>${vehText.replace('🚛 ', '')}</strong>`;
      summaryVehicle.style.display = 'inline-block';
    } else {
      summaryVehicle.style.display = 'none';
    }
  }
}

async function loadCustomers() {
  const res = await api.get('/customers');
  if (res.success && res.data) {
    customersCache = res.data;
  }
}

async function loadCompanies() {
  const res = await api.get('/companies?limit=150');
  if (res.success && res.data) {
    companiesCache = res.data;
  }
}

async function handleCompanySelection(companyId, preselectDriverId = null, preselectVehicleId = null) {
  const driverSel = document.getElementById('pos-driver-select');
  const vehicleSel = document.getElementById('pos-vehicle-select');
  const debtVal = document.getElementById('pos-company-debt-val');
  const summaryDriver = document.getElementById('pos-summary-driver');
  const summaryVehicle = document.getElementById('pos-summary-vehicle');

  if (!companyId) {
    if (driverSel) {
      driverSel.innerHTML = '<option value="">-- هەڵبژاردنی سایق --</option>';
      driverSel.disabled = true;
    }
    if (vehicleSel) {
      vehicleSel.innerHTML = '<option value="">-- هەڵبژاردنی ئۆتۆمبێل --</option>';
      vehicleSel.disabled = true;
    }
    if (summaryDriver) summaryDriver.style.display = 'none';
    if (summaryVehicle) summaryVehicle.style.display = 'none';
    currentCompanyDrivers = [];
    currentCompanyVehicles = [];
    return;
  }

  const res = await api.get(`/companies/${companyId}/account`);
  if (res.success && res.data) {
    const { company, drivers, vehicles } = res.data;
    currentCompanyDrivers = drivers || [];
    currentCompanyVehicles = vehicles || [];

    // Show company debt info
    const debt = Number(company.current_debt) || 0;
    if (debtVal) debtVal.textContent = formatCurrency(debt);

    // Populate drivers
    if (driverSel) {
      driverSel.disabled = false;
      driverSel.innerHTML = `
        <option value="">-- هەڵبژاردنی سایق --</option>
        ${currentCompanyDrivers
          .map((d) => `<option value="${d.id}" ${preselectDriverId && Number(preselectDriverId) === d.id ? 'selected' : ''}>👨‍✈️ ${d.full_name} ${d.phone ? `(${d.phone})` : ''}</option>`)
          .join('')}
      `;
    }

    // Populate vehicles
    if (vehicleSel) {
      vehicleSel.disabled = false;
      vehicleSel.innerHTML = `
        <option value="">-- هەڵبژاردنی ئۆتۆمبێل --</option>
        ${currentCompanyVehicles
          .map((v) => `<option value="${v.id}" ${preselectVehicleId && Number(preselectVehicleId) === v.id ? 'selected' : ''}>🚛 ${v.plate_number || v.vehicle_number || '—'} ${v.truck_brand ? `(${v.truck_brand})` : ''}</option>`)
          .join('')}
      `;
    }

    updateCompanySelectionSummary();
  }
}

async function loadProducts(search = '') {
  let url = '/products?limit=100';
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  const res = await api.get(url);
  if (res.success && res.data) {
    productsCache = res.data;
    renderProductsGrid();
  }
}

function renderProductsGrid() {
  const grid = document.getElementById('pos-products-grid');
  if (!grid) return;

  let filtered = Array.isArray(productsCache) ? productsCache : [];
  if (selectedCategoryId) {
    filtered = filtered.filter((p) => String(p.category_id) === String(selectedCategoryId));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        هیچ کاڵایەک نەدۆزرایەوە
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((prod) => {
      const isLow = prod.quantity <= prod.min_stock_level && prod.quantity > 0;
      const isOut = prod.quantity <= 0;
      return `
      <div class="product-pos-card" data-id="${prod.id}">
        <div>
          <div class="pos-card-name">${prod.name}</div>
          <div class="pos-card-meta">
            ${prod.truck_brand ? `<span>🚛 ${prod.truck_brand}</span>` : ''}
            ${prod.part_number ? `<span> | کۆد: ${prod.part_number}</span>` : ''}
          </div>
        </div>
        <div class="pos-card-bottom">
          <span class="pos-card-price">${formatCurrency(prod.selling_price)}</span>
          <span class="pos-card-stock ${isOut ? 'out' : isLow ? 'low' : ''}">
            ${isOut ? 'تەواوبووە' : `${prod.quantity} دانە`}
          </span>
        </div>
      </div>
    `;
    })
    .join('');

  // Add click to add to cart
  grid.querySelectorAll('.product-pos-card').forEach((card) => {
    card.addEventListener('click', () => {
      const prodId = Number(card.dataset.id);
      const prod = productsCache.find((p) => p.id === prodId);
      if (prod) {
        addToCart(prod);
      }
    });
  });
}

function addToCart(product) {
  const existing = cart.find((item) => item.product_id === product.id);

  if (existing) {
    const allowNeg = systemSettings.allow_negative_stock === '1';
    if (!allowNeg && existing.quantity >= product.quantity) {
      showToast(`تەنها ${product.quantity} دانە لە کۆگا بەردەستە`, 'warning');
      return;
    }
    existing.quantity += 1;
  } else {
    const allowNeg = systemSettings.allow_negative_stock === '1';
    if (!allowNeg && product.quantity <= 0) {
      showToast(`ئەم کاڵایە لە کۆگا تەواوبووە`, 'error');
      return;
    }
    cart.push({
      product_id: product.id,
      name: product.name,
      part_number: product.part_number,
      unit_price: product.selling_price,
      quantity: 1,
      max_stock: product.quantity,
      discount: 0,
    });
  }

  updateCartUI();
}

function updateCartUI() {
  const list = document.getElementById('cart-items-list');
  const countBadge = document.getElementById('cart-item-count');
  const subtotalEl = document.getElementById('pos-subtotal');
  const grandTotalEl = document.getElementById('pos-grand-total');
  const paidInput = document.getElementById('pos-paid-amount');

  if (!list) return;

  const totalItems = cart.reduce((sum, it) => sum + it.quantity, 0);
  if (countBadge) countBadge.textContent = `${totalItems} کاڵا`;

  if (cart.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
        <div style="font-size: 32px; margin-bottom: 8px;">🛒</div>
        <div>هیچ کاڵایەک زیاد نەکراوە</div>
        <div style="font-size: 12px; margin-top: 4px;">بارکۆد سکان بکە یان لە لیستەکە کاڵا هەڵبژێرە</div>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = '0 د.ع';
    if (grandTotalEl) grandTotalEl.textContent = '0 د.ع';
    if (paidInput) paidInput.value = '';
    updatePaymentCalculations();
    return;
  }

  list.innerHTML = cart
    .map(
      (item, idx) => `
    <div class="cart-item-row" data-index="${idx}">
      <div class="cart-item-info">
        <div class="cart-item-title" title="${item.name}">${item.name}</div>
        <div class="cart-item-price">${formatCurrency(item.unit_price)}</div>
      </div>
      <div class="cart-item-controls">
        <button class="btn-qty btn-minus" data-idx="${idx}">-</button>
        <input type="number" class="cart-qty-input" data-idx="${idx}" value="${item.quantity}" min="1" />
        <button class="btn-qty btn-plus" data-idx="${idx}">+</button>
      </div>
      <div class="cart-item-total">
        ${formatCurrency(item.unit_price * item.quantity - item.discount)}
      </div>
      <button class="btn-cart-del" data-idx="${idx}" title="سڕینەوە">✕</button>
    </div>
  `
    )
    .join('');

  // Attach cart row events
  list.querySelectorAll('.btn-plus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const item = cart[idx];
      const allowNeg = systemSettings.allow_negative_stock === '1';
      if (!allowNeg && item.quantity >= item.max_stock) {
        showToast(`تەنها ${item.max_stock} دانە لە کۆگا ماوە`, 'warning');
        return;
      }
      item.quantity += 1;
      updateCartUI();
    });
  });

  list.querySelectorAll('.btn-minus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (cart[idx].quantity > 1) {
        cart[idx].quantity -= 1;
      } else {
        cart.splice(idx, 1);
      }
      updateCartUI();
    });
  });

  list.querySelectorAll('.cart-qty-input').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = Number(input.dataset.idx);
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val <= 0) {
        cart.splice(idx, 1);
      } else {
        const allowNeg = systemSettings.allow_negative_stock === '1';
        if (!allowNeg && val > cart[idx].max_stock) {
          showToast(`تەنها ${cart[idx].max_stock} دانە لە کۆگا ماوە`, 'warning');
          cart[idx].quantity = cart[idx].max_stock;
        } else {
          cart[idx].quantity = val;
        }
      }
      updateCartUI();
    });
  });

  list.querySelectorAll('.btn-cart-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      cart.splice(idx, 1);
      updateCartUI();
    });
  });

  // Calculate totals
  const subtotal = cart.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const itemDiscounts = cart.reduce((sum, it) => sum + it.discount, 0);
  const overallDiscountInput = document.getElementById('pos-overall-discount');
  const overallDiscount = Math.max(0, Number(overallDiscountInput ? overallDiscountInput.value : 0));
  const grandTotal = Math.max(0, subtotal - itemDiscounts - overallDiscount);

  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (grandTotalEl) grandTotalEl.textContent = formatCurrency(grandTotal);

  if (selectedPaymentType === 'cash') {
    if (paidInput && (!paidInput.value || Number(paidInput.value) === 0)) {
      paidInput.value = grandTotal;
    }
  }

  updatePaymentCalculations();
}

function updatePaymentCalculations() {
  const grandTotalEl = document.getElementById('pos-grand-total');
  const grandTotal = parseInt((grandTotalEl?.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;
  const paidInput = document.getElementById('pos-paid-amount');
  const paidAmount = Number(paidInput?.value || 0);

  const changeRow = document.getElementById('row-change-amount');
  const debtRow = document.getElementById('row-debt-amount');
  const changeEl = document.getElementById('pos-change-amount');
  const debtEl = document.getElementById('pos-remaining-debt');
  const paidLabel = document.getElementById('label-paid-amount');

  if (selectedPaymentType === 'cash') {
    if (paidLabel) paidLabel.textContent = 'پارەی وەرگیراو:';
    if (changeRow) changeRow.style.display = 'flex';
    if (debtRow) debtRow.style.display = 'none';

    const change = Math.max(0, paidAmount - grandTotal);
    if (changeEl) changeEl.textContent = formatCurrency(change);
  } else if (selectedPaymentType === 'debt') {
    if (changeRow) changeRow.style.display = 'none';
    if (debtRow) debtRow.style.display = 'flex';
    if (debtEl) debtEl.textContent = formatCurrency(grandTotal);
    if (paidInput) paidInput.value = 0;
  } else if (selectedPaymentType === 'partial') {
    if (paidLabel) paidLabel.textContent = 'بڕی نەقد (دراو):';
    if (changeRow) changeRow.style.display = 'none';
    if (debtRow) debtRow.style.display = 'flex';

    const remainingDebt = Math.max(0, grandTotal - paidAmount);
    if (debtEl) debtEl.textContent = formatCurrency(remainingDebt);
  }
}

function setupPosEvents() {
  // Barcode / Search Input listener
  const searchInput = document.getElementById('pos-barcode-input');
  let searchTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = searchInput.value.trim();
        if (!code) return;

        // Try exact barcode lookup
        const res = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
        if (res.success && res.data) {
          addToCart(res.data);
          searchInput.value = '';
          showToast(`"${res.data.name}" زیادکرا بۆ سەبەتە`, 'success');
        } else {
          // If not exact barcode, filter list
          loadProducts(code);
        }
      }
    });

    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadProducts(e.target.value.trim());
      }, 300);
    });
  }

  const clearSearchBtn = document.getElementById('pos-clear-search-btn');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      loadProducts('');
    });
  }

  // Clear Cart Button
  const clearCartBtn = document.getElementById('btn-clear-cart');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      if (cart.length === 0) return;
      if (confirm('دڵنیایت دەتەوێت هەموو کاڵاکانی ناو سەبەتە بسڕیتەوە؟')) {
        cart = [];
        updateCartUI();
      }
    });
  }

  // Overall discount change
  const discountInput = document.getElementById('pos-overall-discount');
  if (discountInput) {
    discountInput.addEventListener('input', () => {
      updateCartUI();
    });
  }

  // Customer Type Switcher (3 modes)
  document.querySelectorAll('.pos-cust-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchToCustomerTab(btn.dataset.type);
    });
  });

  // Company Select Change
  const companySelect = document.getElementById('pos-company-select');
  if (companySelect) {
    companySelect.addEventListener('change', (e) => {
      handleCompanySelection(e.target.value);
    });
  }

  // Payment type toggle buttons
  document.querySelectorAll('.pay-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPaymentType = btn.dataset.pay;

      const grandTotalEl = document.getElementById('pos-grand-total');
      const grandTotal = parseInt((grandTotalEl?.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;
      const paidInput = document.getElementById('pos-paid-amount');

      if (selectedPaymentType === 'cash') {
        if (paidInput) {
          paidInput.value = grandTotal;
          paidInput.disabled = false;
        }
      } else if (selectedPaymentType === 'debt') {
        if (paidInput) {
          paidInput.value = 0;
          paidInput.disabled = true;
        }
        if (selectedCustomerType === 'one_time') {
          const savePerm = document.getElementById('pos-save-as-permanent');
          if (!savePerm || !savePerm.checked) {
            showToast('فرۆشتن بە قەرز تەنها بۆ کڕیاری تۆمارکراو یان کۆمپانیا دەبێت', 'warning');
          }
        }
      } else if (selectedPaymentType === 'partial') {
        if (paidInput) {
          paidInput.value = Math.round(grandTotal / 2);
          paidInput.disabled = false;
        }
        if (selectedCustomerType === 'one_time') {
          const savePerm = document.getElementById('pos-save-as-permanent');
          if (!savePerm || !savePerm.checked) {
            showToast('فرۆشتن بە قەرز تەنها بۆ کڕیاری تۆمارکراو یان کۆمپانیا دەبێت', 'warning');
          }
        }
      }

      updatePaymentCalculations();
    });
  });

  // Paid amount input
  const paidInput = document.getElementById('pos-paid-amount');
  if (paidInput) {
    paidInput.addEventListener('input', () => {
      updatePaymentCalculations();
    });
  }

  // Quick Add Individual Customer button
  document.getElementById('btn-pos-add-customer')?.addEventListener('click', () => {
    showQuickAddCustomerModal();
  });

  // Quick Add Company button
  document.getElementById('btn-pos-add-company')?.addEventListener('click', () => {
    showQuickAddCompanyModal();
  });

  // Quick Add Driver button
  document.getElementById('btn-pos-add-driver')?.addEventListener('click', () => {
    const compId = selectedCompany?.id || document.getElementById('pos-company-select')?.value;
    if (!compId) {
      showToast('تکایە سەرەتا کۆمپانیا هەڵبژێرە', 'warning');
      return;
    }
    showQuickAddDriverModal(compId);
  });

  // Quick Add Vehicle button
  document.getElementById('btn-pos-add-vehicle')?.addEventListener('click', () => {
    const compId = selectedCompany?.id || document.getElementById('pos-company-select')?.value;
    if (!compId) {
      showToast('تکایە سەرەتا کۆمپانیا هەڵبژێرە', 'warning');
      return;
    }
    showQuickAddVehicleModal(compId);
  });

  // Complete Sale Button
  const checkoutBtn = document.getElementById('btn-complete-sale');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      handleCompleteSale();
    });
  }
}

async function handleCompleteSale() {
  if (cart.length === 0) {
    showToast('سەبەتە بەتاڵە! تکایە سەرەتا کاڵا زیادبکە', 'warning');
    return;
  }

  const overallDiscountInput = document.getElementById('pos-overall-discount');
  const overallDiscount = Number(overallDiscountInput?.value || 0);

  const grandTotalEl = document.getElementById('pos-grand-total');
  const grandTotal = parseInt((grandTotalEl?.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;

  const paidInput = document.getElementById('pos-paid-amount');
  const paidAmount = Number(paidInput?.value || 0);

  // Validate cash payment sufficient
  if (selectedPaymentType === 'cash' && paidAmount < grandTotal) {
    showToast('بڕی پارەی دراو کەمترە لە کۆی گشتی فرۆشتن', 'error');
    paidInput?.focus();
    return;
  }

  const debtAmount = grandTotal - (selectedPaymentType === 'debt' ? 0 : paidAmount);
  const isDebtSale = selectedPaymentType === 'debt' || (selectedPaymentType === 'partial' && debtAmount > 0);

  let salePayload = {
    customer_type: selectedCustomerType,
    items: cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      name: item.name,
    })),
    overall_discount: overallDiscount,
    payment_type: selectedPaymentType,
    paid_amount: selectedPaymentType === 'debt' ? 0 : paidAmount,
    notes: document.getElementById('pos-onetime-notes')?.value || '',
  };

  if (selectedCustomerType === 'one_time') {
    const rawName = document.getElementById('pos-onetime-name')?.value?.trim();
    const phone = document.getElementById('pos-onetime-phone')?.value?.trim();
    const savePermanent = document.getElementById('pos-save-as-permanent')?.checked;

    if (isDebtSale && !savePermanent) {
      showToast('فرۆشتن بە قەرز تەنها بۆ کڕیاری تۆمارکراو یان کۆمپانیا دەبێت', 'error');
      return;
    }

    salePayload.customer_display_name = rawName || 'کڕیاری دەستبەجێ (نەقد)';
    salePayload.customer_phone_snapshot = phone || '';
    salePayload.save_as_permanent_customer = !!savePermanent;
  } else if (selectedCustomerType === 'individual') {
    if (!selectedCustomer?.id) {
      if (isDebtSale) {
        showToast('فرۆشتن بە قەرز پێویستی بە دیاریکردنی کڕیارە!', 'error');
        document.getElementById('pos-customer-search-input')?.focus();
        return;
      }
      // If cash without selecting a customer, fallback to one-time cash
      salePayload.customer_type = 'one_time';
      salePayload.customer_display_name = 'کڕیاری دەستبەجێ (نەقد)';
    } else {
      salePayload.customer_id = selectedCustomer.id;
      salePayload.customer_display_name = selectedCustomer.name;
      salePayload.customer_phone_snapshot = selectedCustomer.phone || '';
    }
  } else if (selectedCustomerType === 'company') {
    const companyId = selectedCompany?.id || document.getElementById('pos-company-select')?.value;

    if (!companyId) {
      showToast('تکایە سەرەتا کۆمپانیا دیاریبکە', 'error');
      document.getElementById('pos-company-search-input')?.focus();
      return;
    }

    const driverSelect = document.getElementById('pos-driver-select');
    const vehicleSelect = document.getElementById('pos-vehicle-select');

    salePayload.company_id = Number(companyId);
    salePayload.company_driver_id = driverSelect?.value ? Number(driverSelect.value) : null;
    salePayload.company_vehicle_id = vehicleSelect?.value ? Number(vehicleSelect.value) : null;
    salePayload.customer_display_name = selectedCompany?.name || '';
  }

  const btn = document.getElementById('btn-complete-sale');
  if (btn) btn.disabled = true;

  try {
    const res = await api.post('/sales', salePayload);
    if (res.success && res.data) {
      showToast('فرۆشتن بە سەرکەوتوویی تۆمارکرا ✓', 'success');

      const saleResult = res.data;

      // Clear cart
      cart = [];
      updateCartUI();

      // Reset one-time customer fields
      const onetimeName = document.getElementById('pos-onetime-name');
      const onetimePhone = document.getElementById('pos-onetime-phone');
      const onetimeNotes = document.getElementById('pos-onetime-notes');
      const savePerm = document.getElementById('pos-save-as-permanent');
      if (onetimeName) onetimeName.value = 'کڕیاری دەستبەجێ';
      if (onetimePhone) onetimePhone.value = '';
      if (onetimeNotes) onetimeNotes.value = '';
      if (savePerm) savePerm.checked = false;

      // Reload caches to update stocks & debt
      loadProducts();
      loadCustomers();
      loadCompanies();

      // Refresh debt indicators if individual or company was selected
      if (selectedCustomerType === 'company' && selectedCompany?.id) {
        handleCompanySelection(selectedCompany.id);
      }
      if (selectedCustomerType === 'individual' && selectedCustomer?.id) {
        api.get(`/customers/${selectedCustomer.id}`).then((cRes) => {
          if (cRes.success && cRes.data) selectIndividualCustomer(cRes.data);
        });
      }

      // Show receipt modal with direct print option
      showReceiptModal(saleResult);
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی فرۆشتن', 'error');
    }
  } catch (err) {
    showToast('هەڵە لە پەیوەندیکردن', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function showReceiptModal(saleData) {
  const receiptNum = saleData.receipt_number || saleData.receiptNumber || '';
  const total = saleData.total_amount ?? saleData.totalAmount ?? saleData.total ?? 0;
  const cashier = saleData.cashier_name || saleData.cashierName || 'کاشێر';
  
  let customerDisplay = saleData.customer_display_name || saleData.customer_name || saleData.customerName || 'کڕیاری دەستبەجێ (نەقد)';
  if (saleData.customer_phone_snapshot || saleData.customer_phone) {
    const ph = saleData.customer_phone_snapshot || saleData.customer_phone;
    customerDisplay += ` (${ph})`;
  }
  if (saleData.customer_type === 'company' || saleData.company_name) {
    const cName = saleData.company_name || saleData.customer_display_name || 'کۆمپانیا';
    const dName = saleData.driver_name;
    const vPlate = saleData.vehicle_plate || saleData.vehicle_number;
    customerDisplay = `🏢 ${cName}`;
    if (dName) customerDisplay += ` | 👨‍✈️ شۆفێر: ${dName}`;
    if (vPlate) customerDisplay += ` | 🚛 بارهەڵگر: ${vPlate}`;
  }

  const sDate = saleData.sale_date || saleData.saleDate || '';
  const sTime = saleData.sale_time || saleData.saleTime || '';

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 520px;">
      <div class="modal-header">
        <h3 class="modal-title">✓ فرۆشتن بە سەرکەوتوویی ئەنجامدرا</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body" style="text-align: center;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #dcfce7; color: #16a34a; font-size: 32px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; font-weight: bold;">
          ✓
        </div>
        <div style="font-size: 18px; font-weight: 800; color: var(--text-main);">
          پسووڵەی ژمارە: <span style="direction: ltr; display: inline-block; font-family: monospace; font-weight: 900; color: var(--primary);">${receiptNum}</span>
        </div>
        <div style="font-size: 22px; font-weight: 900; color: var(--text-main); margin: 10px 0;">
          کۆی گشتی: <span style="color: #16a34a;">${formatCurrency(total)}</span>
        </div>
        <div style="font-size: 13px; color: var(--text-muted); background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin: 12px 0; text-align: right;">
          <div>کڕیار / ئەژمێر: <strong>${customerDisplay}</strong></div>
          <div style="margin-top: 2px;">کاشێر: <strong>${cashier}</strong> ${sDate ? `| بەروار: <strong>${sDate}</strong>` : ''} ${sTime ? `| کات: <strong>${sTime}</strong>` : ''}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px;">
          <button class="btn btn-primary" id="btn-print-a4" style="font-size: 14px; padding: 10px 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px;">
            📄 چاپی وەسڵی A4
          </button>
          <button class="btn btn-outline" id="btn-download-pdf" style="font-size: 14px; padding: 10px 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px;">
            📥 پاشەکەوتکردن بە PDF
          </button>
          <button class="btn btn-secondary" id="btn-print-80mm" style="font-size: 13px; padding: 9px 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
            🖨️ چاپی پسووڵەی 80mm
          </button>
          <button class="btn btn-secondary modal-close-btn-bottom" id="btn-new-sale-action" style="font-size: 13px; padding: 9px 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ➕ فرۆشتنی نوێ
          </button>
        </div>
      </div>
      <div class="modal-footer" style="justify-content: center;">
        <span style="font-size: 12px; color: var(--text-muted);">دەتوانیت هەر کاتێک بتەوێت لە بەشی مێژووی فرۆشتنەکان دووبارە چاپی بکەیتەوە</span>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
    // Focus search input
    document.getElementById('pos-barcode-input')?.focus();
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('#btn-new-sale-action').addEventListener('click', closeModal);

  // Helper to fetch full invoice data from server
  const getFullInvoiceData = async () => {
    if (saleData.id) {
      try {
        const invRes = await api.get(`/sales/${saleData.id}/invoice`);
        if (invRes.success && invRes.data) {
          const d = invRes.data;
          return {
            ...d.sale,
            receipt_number: d.sale.receipt_number,
            receiptNumber: d.sale.receipt_number,
            sale_date: d.sale.sale_date,
            saleDate: d.sale.sale_date,
            sale_time: d.sale.sale_time,
            saleTime: d.sale.sale_time,
            customer_type: d.sale.customer_type,
            customer_name: d.sale.customer_display_name || d.customer?.name || (d.company ? d.company.name : 'کڕیاری دەستبەجێ (نەقد)'),
            customerName: d.sale.customer_display_name || d.customer?.name || (d.company ? d.company.name : 'کڕیاری دەستبەجێ (نەقد)'),
            customer_phone: d.sale.customer_phone_snapshot || d.customer?.phone || d.company?.phone || '',
            customerPhone: d.sale.customer_phone_snapshot || d.customer?.phone || d.company?.phone || '',
            customer_address: d.customer?.address || d.company?.address || '',
            customerAddress: d.customer?.address || d.company?.address || '',
            company_name: d.company?.name || d.sale.company_name,
            company: d.company,
            driver_name: d.driver?.full_name || d.sale.driver_name,
            driver: d.driver,
            vehicle_plate: d.vehicle?.plate_number || d.sale.vehicle_plate,
            vehicle_number: d.vehicle?.vehicle_number || d.sale.vehicle_number,
            vehicle_truck_brand: d.vehicle?.truck_brand || d.sale.vehicle_truck_brand,
            vehicle_truck_model: d.vehicle?.truck_model || d.sale.vehicle_truck_model,
            vehicle: d.vehicle,
            cashier_name: d.cashier?.name || 'کاشێر',
            cashierName: d.cashier?.name || 'کاشێر',
            items: d.items,
            subtotal: d.sale.subtotal,
            discount_amount: d.sale.discount_amount,
            totalDiscount: d.sale.discount_amount,
            total_amount: d.sale.total_amount,
            totalAmount: d.sale.total_amount,
            paid_amount: d.sale.paid_amount,
            paidAmount: d.sale.paid_amount,
            debt_amount: d.sale.debt_amount,
            debtAmount: d.sale.debt_amount,
            change_amount: d.sale.change_amount,
            changeAmount: d.sale.change_amount,
            payment_type: d.sale.payment_type,
            paymentType: d.sale.payment_type,
            business: d.business,
          };
        }
      } catch (e) {
        console.error('Invoice fetch error:', e);
      }
    }
    return saleData;
  };

  modal.querySelector('#btn-print-a4').addEventListener('click', async () => {
    const fullData = await getFullInvoiceData();
    printSaleReceipt(fullData, fullData.business || systemSettings, 'a4');
  });

  modal.querySelector('#btn-download-pdf').addEventListener('click', async () => {
    const fullData = await getFullInvoiceData();
    downloadSaleInvoicePdf(fullData, fullData.business || systemSettings);
  });

  modal.querySelector('#btn-print-80mm').addEventListener('click', async () => {
    const fullData = await getFullInvoiceData();
    printSaleReceipt(fullData, fullData.business || systemSettings, '80mm');
  });
}

function showQuickAddCustomerModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 450px;">
      <div class="modal-header">
        <h3 class="modal-title">زیادکردنی کڕیاری نوێ</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">ناوی کڕیار *</label>
          <input type="text" id="m-cust-name" class="form-control" placeholder="ناوی تەواوی کڕیار بنووسە..." required />
        </div>
        <div class="form-group">
          <label class="form-label">ژمارەی مۆبایل</label>
          <input type="text" id="m-cust-phone" class="form-control" placeholder="0750xxxxxxx" />
        </div>
        <div class="form-group">
          <label class="form-label">ناونیشان</label>
          <input type="text" id="m-cust-address" class="form-control" placeholder="شار / پیشەسازی..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary m-cancel-btn">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="m-save-cust-btn">تۆمارکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.m-cancel-btn').addEventListener('click', closeModal);

  modal.querySelector('#m-save-cust-btn').addEventListener('click', async () => {
    const name = modal.querySelector('#m-cust-name').value.trim();
    const phone = modal.querySelector('#m-cust-phone').value.trim();
    const address = modal.querySelector('#m-cust-address').value.trim();

    if (!name) {
      showToast('ناوی کڕیار پێویستە', 'error');
      return;
    }

    const res = await api.post('/customers', { name, phone, address });
    const newCustId = res.customerId || res.data?.id;
    if (res.success && newCustId) {
      showToast('کڕیار بە سەرکەوتوویی زیادکرا', 'success');
      closeModal();
      await loadCustomers();
      selectIndividualCustomer({
        id: newCustId,
        name,
        phone,
        address,
        current_debt: 0,
      });
      switchToCustomerTab('individual');
    } else {
      showToast(res.message || 'هەڵە لە دروستکردنی کڕیار', 'error');
    }
  });
}

function showQuickAddCompanyModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 480px;">
      <div class="modal-header">
        <h3 class="modal-title">➕ زیادکردنی کۆمپانیای نوێ</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 700;">ناوی کۆمپانیا *</label>
          <input type="text" id="m-cmp-name" class="form-control" placeholder="ناوی کۆمپانیا..." required />
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 700;">خاوەن کار / بەڕێوەبەر</label>
          <input type="text" id="m-cmp-owner" class="form-control" placeholder="ناوی کەسی بەرپرس..." />
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 700;">ژمارەی مۆبایل</label>
          <input type="text" id="m-cmp-phone" class="form-control" placeholder="0750xxxxxxx" dir="ltr" />
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 700;">ناونیشان</label>
          <input type="text" id="m-cmp-address" class="form-control" placeholder="شار / پیشەسازی..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary m-cancel-btn">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="m-save-cmp-btn">تۆمارکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.m-cancel-btn').addEventListener('click', closeModal);

  modal.querySelector('#m-save-cmp-btn').addEventListener('click', async () => {
    const name = modal.querySelector('#m-cmp-name').value.trim();
    const owner_name = modal.querySelector('#m-cmp-owner').value.trim();
    const phone = modal.querySelector('#m-cmp-phone').value.trim();
    const address = modal.querySelector('#m-cmp-address').value.trim();

    if (!name) {
      showToast('ناوی کۆمپانیا پێویستە', 'error');
      return;
    }

    const res = await api.post('/companies', { name, owner_name, phone, address });
    if (res.success && res.data?.id) {
      showToast('کۆمپانیا زیادکرا', 'success');
      closeModal();
      await loadCompanies();
      await selectCompanyEntity({
        company_id: res.data.id,
        company_name: name,
        company_owner: owner_name,
        company_phone: phone,
        company_debt: 0,
      });
      switchToCustomerTab('company');
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی کۆمپانیا', 'error');
    }
  });
}

function showQuickAddDriverModal(companyId) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 420px;">
      <div class="modal-header">
        <h3 class="modal-title">➕ زیادکردنی شۆفێری نوێ بۆ کۆمپانیا</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 700;">ناوی تەواوی شۆفێر *</label>
          <input type="text" id="m-drv-name" class="form-control" placeholder="ناوی شۆفێر..." required />
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 700;">ژمارەی مۆبایل</label>
          <input type="text" id="m-drv-phone" class="form-control" placeholder="0750xxxxxxx" dir="ltr" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary m-cancel-btn">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="m-save-drv-btn">تۆمارکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.m-cancel-btn').addEventListener('click', closeModal);

  modal.querySelector('#m-save-drv-btn').addEventListener('click', async () => {
    const full_name = modal.querySelector('#m-drv-name').value.trim();
    const phone = modal.querySelector('#m-drv-phone').value.trim();

    if (!full_name) {
      showToast('ناوی شۆفێر پێویستە', 'error');
      return;
    }

    const res = await api.post(`/companies/${companyId}/drivers`, { full_name, phone });
    if (res.success && res.data?.id) {
      showToast('شۆفێر زیادکرا', 'success');
      closeModal();
      await handleCompanySelection(companyId, res.data.id);
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی شۆفێر', 'error');
    }
  });
}

function showQuickAddVehicleModal(companyId) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 440px;">
      <div class="modal-header">
        <h3 class="modal-title">➕ زیادکردنی بارهەڵگری نوێ</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 700;">ژمارەی تابلۆ (ڕەقەم) *</label>
          <input type="text" id="m-veh-plate" class="form-control" placeholder="نموونە: هەولێر 12345..." required />
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 700;">مارکە و جۆر</label>
          <input type="text" id="m-veh-brand" class="form-control" placeholder="Mercedes / Scania / Volvo..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary m-cancel-btn">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="m-save-veh-btn">تۆمارکردن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.m-cancel-btn').addEventListener('click', closeModal);

  modal.querySelector('#m-save-veh-btn').addEventListener('click', async () => {
    const plate_number = modal.querySelector('#m-veh-plate').value.trim();
    const truck_brand = modal.querySelector('#m-veh-brand').value.trim();

    if (!plate_number) {
      showToast('ژمارەی تابلۆی بارهەڵگر بنووسە', 'error');
      return;
    }

    const res = await api.post(`/companies/${companyId}/vehicles`, { plate_number, truck_brand });
    if (res.success && res.data?.id) {
      showToast('بارهەڵگر زیادکرا', 'success');
      closeModal();
      await handleCompanySelection(companyId, null, res.data.id);
    } else {
      showToast(res.message || 'هەڵە لە تۆمارکردنی بارهەڵگر', 'error');
    }
  });
}
