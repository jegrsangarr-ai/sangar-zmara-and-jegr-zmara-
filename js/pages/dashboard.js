/**
 * Dashboard Page Module
 */
import { api, formatCurrency, showToast } from '../api.js';
import { isAdmin, getUser } from '../auth.js';

export async function initDashboardPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const user = getUser();
  const admin = isAdmin();

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">داشبۆردی سەرەکی</h2>
        <div class="section-subtitle">بەخێربێیت ${user ? user.name : ''} - سەنگەر زمارەیی و جێگر زمارەیی</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary" id="btn-quick-pos">🛒 دەستپێکردنی فرۆشتن</button>
        <button class="btn btn-secondary" id="btn-refresh-dashboard">🔄 نوێکردنەوە</button>
      </div>
    </div>

    <!-- Stat Cards Grid -->
    <div class="stat-grid" id="dashboard-stats-grid">
      <!-- 1. فرۆشتنی ئەمڕۆ -->
      <div class="stat-card">
        <div class="stat-icon blue">💰</div>
        <div class="stat-content">
          <div class="stat-label">فرۆشتنی ئەمڕۆ</div>
          <div class="stat-value" id="dash-today-sales">...</div>
          <div class="stat-sub" id="dash-today-tx">0 مامەڵە</div>
        </div>
      </div>

      <!-- 2. فرۆشتنی ئەم مانگە -->
      <div class="stat-card">
        <div class="stat-icon purple">📊</div>
        <div class="stat-content">
          <div class="stat-label">فرۆشتنی ئەم مانگە</div>
          <div class="stat-value" id="dash-month-sales">...</div>
          <div class="stat-sub">کۆی فرۆشتنی مانگ</div>
        </div>
      </div>

      <!-- 3. کۆی قەرزی کڕیاران -->
      <div class="stat-card">
        <div class="stat-icon amber">👥</div>
        <div class="stat-content">
          <div class="stat-label">کۆی قەرزی کڕیاران</div>
          <div class="stat-value" id="dash-cust-debt">...</div>
          <div class="stat-sub">قەرزی لای کڕیارانی ئاسایی</div>
        </div>
      </div>

      <!-- 4. کۆی قەرزی کۆمپانیاکان -->
      <div class="stat-card">
        <div class="stat-icon indigo" style="background: rgba(99, 102, 241, 0.1); color: #6366f1;">🏢</div>
        <div class="stat-content">
          <div class="stat-label">کۆی قەرزی کۆمپانیاکان</div>
          <div class="stat-value" id="dash-company-debt">...</div>
          <div class="stat-sub">قەرزی کۆمپانیا و شۆفێرەکان</div>
        </div>
      </div>

      <!-- 5. کۆی قەرزی دابینکەران -->
      ${
        admin
          ? `
      <div class="stat-card">
        <div class="stat-icon slate">🚚</div>
        <div class="stat-content">
          <div class="stat-label">کۆی قەرزی دابینکەران</div>
          <div class="stat-value" id="dash-supp-debt">...</div>
          <div class="stat-sub">قەرز بۆ دابینکەر و کۆمپانیاکان</div>
        </div>
      </div>
      `
          : ''
      }

      <!-- 6. خەرجی ئەمڕۆ -->
      <div class="stat-card">
        <div class="stat-icon red">💸</div>
        <div class="stat-content">
          <div class="stat-label">خەرجی ئەمڕۆ</div>
          <div class="stat-value" id="dash-today-expenses">...</div>
          <div class="stat-sub">خەرجی تۆمارکراوی ئەمڕۆ</div>
        </div>
      </div>

      <!-- 7. قازانجی ئەمڕۆ -->
      ${
        admin
          ? `
      <div class="stat-card">
        <div class="stat-icon green">📈</div>
        <div class="stat-content">
          <div class="stat-label">قازانجی ئەمڕۆ</div>
          <div class="stat-value" id="dash-today-profit">...</div>
          <div class="stat-sub">قازانجی خاوێن (داهات - تێچوو - خەرجی)</div>
        </div>
      </div>
      `
          : ''
      }

      <!-- 8. قازانجی ئەم مانگە -->
      ${
        admin
          ? `
      <div class="stat-card">
        <div class="stat-icon emerald" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">🏆</div>
        <div class="stat-content">
          <div class="stat-label">قازانجی ئەم مانگە</div>
          <div class="stat-value" id="dash-month-profit">...</div>
          <div class="stat-sub">قازانجی خاوێنی گشتی مانگ</div>
        </div>
      </div>
      `
          : ''
      }

      <!-- 9. کاڵای کەمماوە لە کۆگا -->
      <div class="stat-card">
        <div class="stat-icon red">⚠️</div>
        <div class="stat-content">
          <div class="stat-label">کاڵای کەمماوە لە کۆگا</div>
          <div class="stat-value" id="dash-low-stock">0</div>
          <div class="stat-sub" id="dash-out-stock">0 کاڵا تەواوبووە</div>
        </div>
      </div>
    </div>

    <!-- 2 Column Section: Chart & Top Selling -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 24px;">
      <!-- 7 Days Sales Trend -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📊 هێڵی فرۆشتنی ٧ ڕۆژی ڕابردوو</h3>
        </div>
        <div id="chart-container" style="padding: 10px 0;">
          <div style="text-align: center; color: var(--text-muted); padding: 40px;">خەریکی کێشانی هێڵکارە...</div>
        </div>
      </div>

      <!-- Top Selling Products -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🔥 پڕفرۆشترین پارچە و کاڵاکان</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>کاڵا</th>
                <th>کۆد / Part #</th>
                <th>ژمارەی فرۆشراو</th>
                <th>کۆی داهات</th>
              </tr>
            </thead>
            <tbody id="top-products-body">
              <tr><td colspan="4" style="text-align:center;">هیچ زانیارییەک نییە</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Low Stock Alert Table -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title" style="color: #dc2626;">⚠️ کاڵاکانی پێویستیان بە کڕینەوە هەیە (کەمماوە لە کۆگا)</h3>
        <button class="btn btn-sm btn-outline" id="btn-view-all-inventory">بینینی هەموو کۆگا</button>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>ناوی کاڵا</th>
              <th>مارکەی بارهەڵگر</th>
              <th>کۆدی پارچە</th>
              <th>بڕی ماوە</th>
              <th>کەمترین ئاست</th>
              <th>نرخی فرۆشتن</th>
              <th>کردار</th>
            </tr>
          </thead>
          <tbody id="low-stock-body">
            <tr><td colspan="7" style="text-align:center;">هیچ ئاگادارییەک نییە</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-quick-pos')?.addEventListener('click', () => {
    window.location.hash = '#pos';
  });

  document.getElementById('btn-refresh-dashboard')?.addEventListener('click', () => {
    loadDashboardData();
  });

  document.getElementById('btn-view-all-inventory')?.addEventListener('click', () => {
    window.location.hash = '#inventory';
  });

  await loadDashboardData();
}

async function loadDashboardData() {
  const elTodaySales = document.getElementById('dash-today-sales');
  const elTodayProfit = document.getElementById('dash-today-profit');
  const elMonthProfit = document.getElementById('dash-month-profit');
  const elTodayExp = document.getElementById('dash-today-expenses');
  const elMonthSales = document.getElementById('dash-month-sales');
  const elCustDebt = document.getElementById('dash-cust-debt');
  const elCompanyDebt = document.getElementById('dash-company-debt');
  const elSuppDebt = document.getElementById('dash-supp-debt');
  const elLowStock = document.getElementById('dash-low-stock');
  const elOutStock = document.getElementById('dash-out-stock');
  const elTodayTx = document.getElementById('dash-today-tx');

  // Try /dashboard/summary first, fallback to /reports/dashboard
  let res = await api.get('/dashboard/summary');
  if (!res.success || !res.data) {
    res = await api.get('/reports/dashboard');
  }

  if (!res.success || !res.data) {
    showToast('زانیارییەکانی داشبۆرد بارنەبوون، تکایە دووبارە هەوڵبدەرەوە', 'error');
    return;
  }

  const d = res.data;

  const todaySales = Number(d.todaySales ?? d.today_sales ?? d.today?.sales ?? 0);
  const todayProfit = Number(d.todayNetProfit ?? d.today_net_profit ?? d.today_profit ?? d.todayProfit ?? d.today?.net_profit ?? d.today?.profit ?? 0);
  const monthProfit = Number(d.monthNetProfit ?? d.month_net_profit ?? d.month_profit ?? d.monthProfit ?? d.month?.net_profit ?? d.month?.profit ?? 0);
  const todayExp = Number(d.todayExpenses ?? d.today_expenses ?? d.today?.expenses ?? 0);
  const monthSales = Number(d.monthSales ?? d.monthly_sales ?? d.month?.sales ?? 0);
  const custDebt = Number(d.customerDebt ?? d.customer_debt ?? d.total_customer_debt ?? d.totalCustomerDebt ?? d.debts?.customer_debts ?? 0);
  const companyDebt = Number(d.companyDebt ?? d.company_debt ?? d.total_company_debt ?? d.totalCompanyDebt ?? d.debts?.company_debts ?? 0);
  const suppDebt = Number(d.supplierDebt ?? d.supplier_debt ?? d.total_supplier_debt ?? d.totalSupplierDebt ?? d.debts?.supplier_debts ?? 0);
  const lowStock = Number(d.lowStockCount ?? d.low_stock_count ?? d.inventory?.low_stock_count ?? 0);
  const outStock = Number(d.outOfStockCount ?? d.out_of_stock_count ?? d.inventory?.out_of_stock ?? 0);
  const todayTx = Number(d.todayTransactions ?? d.today_transactions ?? d.today_sales_count ?? d.todaySalesCount ?? d.today?.sales_count ?? 0);

  if (elTodaySales) elTodaySales.textContent = formatCurrency(todaySales);
  if (elTodayProfit) elTodayProfit.textContent = formatCurrency(todayProfit);
  if (elMonthProfit) elMonthProfit.textContent = formatCurrency(monthProfit);
  if (elTodayExp) elTodayExp.textContent = formatCurrency(todayExp);
  if (elMonthSales) elMonthSales.textContent = formatCurrency(monthSales);
  if (elCustDebt) elCustDebt.textContent = formatCurrency(custDebt);
  if (elCompanyDebt) elCompanyDebt.textContent = formatCurrency(companyDebt);
  if (elSuppDebt) elSuppDebt.textContent = formatCurrency(suppDebt);
  if (elLowStock) elLowStock.textContent = `${lowStock} کاڵا`;
  if (elOutStock) elOutStock.textContent = `${outStock} کاڵا لە کۆگا نەماوە`;
  if (elTodayTx) elTodayTx.textContent = `${todayTx} پسووڵەی فرۆشتن`;

  // Render 7-day visual bar chart
  renderSimpleChart(d.chartData || d.chart_data || d.sales_trend || []);

  // Render Top Products
  renderTopProducts(d.topProducts || d.top_products || []);

  // Render Low Stock Items
  renderLowStockItems(d.lowStockItems || d.low_stock_items || []);
}

function renderSimpleChart(chartData) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  if (!Array.isArray(chartData) || chartData.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px;">
        هیچ زانیارییەکی فرۆشتن لەم ماوەیەدا نییە
      </div>
    `;
    return;
  }

  const values = chartData.map((d) => Number(d.sales ?? d.total ?? 0));
  const maxVal = Math.max(...values, 100000);

  const barsHtml = chartData
    .map((item) => {
      const salesVal = Number(item.sales ?? item.total ?? 0);
      const heightPercent = salesVal > 0 ? Math.max(12, Math.min(100, Math.round((salesVal / maxVal) * 100))) : 4;
      const dateLabel = item.date ? String(item.date).slice(5) : '-';

      return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div style="font-size: 11px; font-weight: 700; color: #1e40af; white-space: nowrap;">
          ${salesVal > 0 ? (salesVal >= 1000000 ? (salesVal / 1000000).toFixed(1) + ' ملیۆن' : (salesVal / 1000).toFixed(0) + ' هەزار') : '0'}
        </div>
        <div style="width: 100%; max-width: 44px; height: 160px; background: #f1f5f9; border-radius: 6px; display: flex; align-items: flex-end; overflow: hidden;" title="${item.date}: ${formatCurrency(salesVal)}">
          <div style="width: 100%; height: ${heightPercent}%; background: ${salesVal > 0 ? 'linear-gradient(to top, #1e40af, #3b82f6)' : '#cbd5e1'}; border-radius: 6px 6px 0 0; transition: height 0.4s ease;"></div>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); direction: ltr; font-weight: 600;">
          ${dateLabel}
        </div>
      </div>
    `;
    })
    .join('');

  container.innerHTML = `
    <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; height: 210px; padding: 10px 16px;">
      ${barsHtml}
    </div>
  `;
}

function renderTopProducts(products) {
  const tbody = document.getElementById('top-products-body');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">هیچ فرۆشتنێک نییە</td></tr>`;
    return;
  }

  tbody.innerHTML = products
    .map(
      (p) => `
    <tr>
      <td><strong>${p.product_name}</strong></td>
      <td><code>${p.part_number || '-'}</code></td>
      <td><span class="badge badge-success">${p.total_qty} دانە</span></td>
      <td><strong>${formatCurrency(p.total_revenue)}</strong></td>
    </tr>
  `
    )
    .join('');
}

function renderLowStockItems(items) {
  const tbody = document.getElementById('low-stock-body');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #16a34a;">هەموو کاڵاکان بەشی پێویست لە کۆگادا هەن ✓</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((p) => {
      const isOut = p.quantity <= 0;
      return `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge badge-info">🚛 ${p.truck_brand || 'گشتی'}</span></td>
        <td><code>${p.part_number || '-'}</code></td>
        <td>
          <span class="badge ${isOut ? 'badge-danger' : 'badge-warning'}">
            ${isOut ? 'نەماوە (0)' : `${p.quantity} دانە`}
          </span>
        </td>
        <td>${p.min_stock_level} دانە</td>
        <td>${formatCurrency(p.selling_price)}</td>
        <td>
          <button class="btn btn-sm btn-primary btn-quick-purchase" data-id="${p.id}" data-name="${p.name}">
            + داواکردن
          </button>
        </td>
      </tr>
    `;
    })
    .join('');

  tbody.querySelectorAll('.btn-quick-purchase').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.hash = '#purchases';
    });
  });
}
