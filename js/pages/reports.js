/**
 * Reports & Analytics Module (Financial, Daily Cash Box, Inventory, Profit, Company, Driver & Vehicle Reports)
 * Business: سەنگەر زمارەیی و جێگر زمارەیی
 */
import { api, formatCurrency, getErbilToday, getErbilTimeString, showToast, escapeHtml } from '../api.js';
import { printDriverReport, printVehicleReport, printSupplierStatement } from '../receipt.js';

let currentDailyReportData = null;
let currentProfitReportData = null;
let currentCompaniesReportData = null;
let currentDriversReportData = null;
let currentVehiclesReportData = null;
let currentSuppliersReportData = null;
let currentActiveTab = 'daily';

export async function initReportsPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const today = getErbilToday();
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  container.innerHTML = `
    <div class="section-header" id="reports-section-header">
      <div>
        <h2 class="section-title">ڕاپۆرتە دارایی و بازرگانییەکان</h2>
        <div class="section-subtitle">ڕاپۆرتی ڕۆژانەی فرۆشتن، قازانج و مەخزەن، ڕاپۆرتی مانگانەی کۆمپانیا، شۆفێر و بارهەڵگرەکان</div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" id="btn-export-csv" title="دەرهێنانی داتاکان بۆ شێوازی Excel">📥 دەرهێنانی زانیاری (CSV / Excel)</button>
        <button class="btn btn-primary" id="btn-print-report" title="چاپی فەرمی ڕاپۆرت">🖨️ چاپی ڕاپۆرت</button>
      </div>
    </div>

    <!-- Report Type Tabs -->
    <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
      <button class="btn btn-primary rep-tab active" id="tab-btn-daily" data-rep="daily">📅 ڕاپۆرتی ڕۆژانەی فرۆشتن</button>
      <button class="btn btn-secondary rep-tab" id="tab-btn-profit" data-rep="profit">📈 ڕاپۆرتی قازانج و مەخزەن</button>
      <button class="btn btn-secondary rep-tab" id="tab-btn-companies" data-rep="companies">🏢 ڕاپۆرتی مانگانەی کۆمپانیاکان</button>
      <button class="btn btn-secondary rep-tab" id="tab-btn-drivers" data-rep="drivers">👤 ڕاپۆرتی مانگانەی شۆفێرەکان</button>
      <button class="btn btn-secondary rep-tab" id="tab-btn-vehicles" data-rep="vehicles">🚛 ڕاپۆرتی مانگانەی بارهەڵگرەکان</button>
      <button class="btn btn-secondary rep-tab" id="tab-btn-suppliers" data-rep="suppliers">🏭 ڕاپۆرتی قەرزی دابینکەران</button>
    </div>

    <!-- Daily Report Section -->
    <div id="section-daily-rep" class="report-section">
      <div class="card" style="padding: 16px; margin-bottom: 20px;">
        <div class="form-row" style="align-items: center;">
          <div class="form-col" style="flex: 0 0 250px;">
            <label class="form-label">دیاریکردنی بەروار:</label>
            <input type="date" id="daily-rep-date" class="form-control" value="${today}" />
          </div>
          <div class="form-col" style="flex: 0 0 auto; align-self: flex-end;">
            <button class="btn btn-primary" id="btn-load-daily-rep">پیشاندان</button>
          </div>
        </div>
      </div>

      <!-- Daily Summary Stat Grid -->
      <div class="stat-grid" id="daily-summary-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
          <div class="stat-icon blue">💰</div>
          <div class="stat-content">
            <div class="stat-label">کۆی فرۆشتنی ڕۆژ</div>
            <div class="stat-value" id="dr-sales">0 د.ع</div>
            <div class="stat-sub" id="dr-tx-count">0 پسووڵەی فرۆشتن</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon green">📈</div>
          <div class="stat-content">
            <div class="stat-label">قازانجی خاوێن (Net Profit)</div>
            <div class="stat-value" id="dr-net-profit">0 د.ع</div>
            <div class="stat-sub" id="dr-gross-profit">قازانجی سەرەتایی: 0 د.ع</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon red">💸</div>
          <div class="stat-content">
            <div class="stat-label">کۆی خەرجییەکان</div>
            <div class="stat-value" id="dr-expenses">0 د.ع</div>
            <div class="stat-sub" id="dr-cogs-sub">تێچووی کاڵا: 0 د.ع</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon purple">💵</div>
          <div class="stat-content">
            <div class="stat-label">کۆی پارەی نەقدی وەرگیراو</div>
            <div class="stat-value" id="dr-cash-collected">0 د.ع</div>
            <div class="stat-sub" id="dr-cash-breakdown">نەقد: 0 د.ع | قەرز: 0 د.ع</div>
          </div>
        </div>
      </div>

      <!-- Secondary Breakdown Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div class="card" style="padding: 12px 16px; background: #f8fafc; border-right: 4px solid #0284c7;">
          <div style="font-size: 12px; color: var(--text-muted);">تێچووی سەرەتایی کاڵا (COGS)</div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a;" id="dr-cogs-value">0 د.ع</div>
        </div>
        <div class="card" style="padding: 12px 16px; background: #f8fafc; border-right: 4px solid #16a34a;">
          <div style="font-size: 12px; color: var(--text-muted);">قازانجی سەرەتایی کاڵا (Gross Profit)</div>
          <div style="font-size: 16px; font-weight: 700; color: #16a34a;" id="dr-gross-profit-value">0 د.ع</div>
        </div>
        <div class="card" style="padding: 12px 16px; background: #f8fafc; border-right: 4px solid #dc2626;">
          <div style="font-size: 12px; color: var(--text-muted);">قەرزی نوێی دراو بە کڕیاران</div>
          <div style="font-size: 16px; font-weight: 700; color: #dc2626;" id="dr-new-debt-value">0 د.ع</div>
        </div>
        <div class="card" style="padding: 12px 16px; background: #f8fafc; border-right: 4px solid #9333ea;">
          <div style="font-size: 12px; color: var(--text-muted);">دانەوەی قەرزی کۆن لەم ڕۆژەدا</div>
          <div style="font-size: 16px; font-weight: 700; color: #9333ea;" id="dr-debt-received-value">0 د.ع</div>
        </div>
      </div>

      <!-- Daily Transactions Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🛒 فرۆشتنەکانی ئەم بەروارە</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>پسووڵە</th>
                <th>کات</th>
                <th>کڕیار</th>
                <th>کاشێر</th>
                <th>شێوازی پارەدان</th>
                <th>کۆی گشتی</th>
                <th>پارەی دراو</th>
                <th>قەرز</th>
                <th>قازانج</th>
              </tr>
            </thead>
            <tbody id="dr-sales-tbody">
              <tr><td colspan="9" style="text-align:center; padding: 20px;">خەریکی بارکردنە...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Profit & Inventory Report Section -->
    <div id="section-profit-rep" class="report-section" style="display: none;">
      <div class="card" style="padding: 16px; margin-bottom: 20px;">
        <div class="form-row" style="align-items: center;">
          <div class="form-col">
            <label class="form-label">لە بەرواری:</label>
            <input type="date" id="profit-from-date" class="form-control" value="${firstOfMonth}" />
          </div>
          <div class="form-col">
            <label class="form-label">تا بەرواری:</label>
            <input type="date" id="profit-to-date" class="form-control" value="${today}" />
          </div>
          <div class="form-col" style="flex: 0 0 auto; align-self: flex-end;">
            <button class="btn btn-primary" id="btn-load-profit-rep">دروستکردنی ڕاپۆرت</button>
          </div>
        </div>
      </div>

      <!-- Live Inventory Valuation Cards -->
      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; font-size: 15px; color: var(--text-muted);">📦 زانیاری و بەهای مەخزەنی ئێستا (FIFO Valuation):</h4>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-icon slate">🏷️</div>
            <div class="stat-content">
              <div class="stat-label">بەهای مەخزەن بە FIFO (تێچووی وەجبەکان)</div>
              <div class="stat-value" id="pr-inv-fifo">0 د.ع</div>
              <div class="stat-sub" id="pr-inv-cost-sub">تێچووی ڕاستەقینەی وەجبە بەردەستەکان</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue">🏪</div>
            <div class="stat-content">
              <div class="stat-label">بەهای مەخزەن بە نرخی فرۆشتن</div>
              <div class="stat-value" id="pr-inv-selling">0 د.ع</div>
              <div class="stat-sub" id="pr-inv-margin">قازانجی گریمانەیی: 0 د.ع</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">📦</div>
            <div class="stat-content">
              <div class="stat-label">کۆی پارچە لە مەخزەن</div>
              <div class="stat-value" id="pr-inv-stock">0 دانە</div>
              <div class="stat-sub" id="pr-inv-cost">بەهای بەپێی نرخی کڕینی ئێستا: 0 د.ع</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red">⚠️</div>
            <div class="stat-content">
              <div class="stat-label">ئاگاداری مەخزەن</div>
              <div class="stat-value" id="pr-inv-low">0 کەمبوو</div>
              <div class="stat-sub" id="pr-inv-out">0 تەواوبوو لە مەخزەن</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Period Sales & Profit Stats -->
      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; font-size: 15px; color: var(--text-muted);">💰 قازانج و داهاتی ماوەی دیاریکراو:</h4>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-icon blue">📊</div>
            <div class="stat-content">
              <div class="stat-label">کۆی داهاتی فرۆشتن</div>
              <div class="stat-value" id="pr-total-revenue">0 د.ع</div>
              <div class="stat-sub" id="pr-sales-count">0 پسووڵە</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon slate">🧾</div>
            <div class="stat-content">
              <div class="stat-label">تێچووی کاڵای فرۆشراو (COGS)</div>
              <div class="stat-value" id="pr-total-cost">0 د.ع</div>
              <div class="stat-sub">تێچووی کڕینی کاڵاکان</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon green">📈</div>
            <div class="stat-content">
              <div class="stat-label">قازانجی سەرەتایی (Gross)</div>
              <div class="stat-value" id="pr-gross-profit">0 د.ع</div>
              <div class="stat-sub">داهات - تێچووی کاڵا</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon purple">💎</div>
            <div class="stat-content">
              <div class="stat-label">قازانجی خاوێن (Net Profit)</div>
              <div class="stat-value" id="pr-net-profit">0 د.ع</div>
              <div class="stat-sub" id="pr-margin">ڕێژەی قازانج: 0%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Profit Items -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">💎 ئەو کاڵایانەی زۆرترین قازانجیان هێناوە لەم ماوەیەدا</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>ناوی کاڵا</th>
                <th>کۆدی پارچە</th>
                <th>ژمارەی فرۆشراو</th>
                <th>کۆی داهات</th>
                <th>کۆی تێچوو</th>
                <th>قازانجی بەدەستهاتوو</th>
              </tr>
            </thead>
            <tbody id="pr-top-products-tbody">
              <tr><td colspan="6" style="text-align:center; padding: 20px;">خەریکی بارکردنە...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Company Monthly Report Section -->
    <div id="section-companies-rep" class="report-section" style="display: none;">
      <div class="card" style="padding: 16px; margin-bottom: 20px;">
        <div class="form-row" style="align-items: center; gap: 12px; flex-wrap: wrap;">
          <div class="form-col" style="flex: 1; min-width: 150px;">
            <label class="form-label">لە بەرواری:</label>
            <input type="date" id="rep-comp-from-date" class="form-control" value="${firstOfMonth}" />
          </div>
          <div class="form-col" style="flex: 1; min-width: 150px;">
            <label class="form-label">تا بەرواری:</label>
            <input type="date" id="rep-comp-to-date" class="form-control" value="${today}" />
          </div>
          <div class="form-col" style="flex: 2; min-width: 200px;">
            <label class="form-label">🔍 گەڕان بەپێی ناوی کۆمپانیا یان مۆبایل:</label>
            <input type="text" id="rep-comp-search" class="form-control" placeholder="ناوی کۆمپانیا، خاوەن کار، تەلەفۆن..." />
          </div>
          <div class="form-col" style="flex: 0 0 auto; align-self: flex-end;">
            <button class="btn btn-primary" id="btn-load-comp-rep">دروستکردنی ڕاپۆرت</button>
          </div>
        </div>
      </div>

      <!-- Company Report Stats -->
      <div class="stat-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
          <div class="stat-icon blue">🏢</div>
          <div class="stat-content">
            <div class="stat-label">کۆی فرۆشتنی کۆمپانیاکان لە ماوەدا</div>
            <div class="stat-value" id="cr-total-sales">0 د.ع</div>
            <div class="stat-sub" id="cr-total-invoices">0 پسووڵە</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">💵</div>
          <div class="stat-content">
            <div class="stat-label">کۆی پارەی نەقد/دراو</div>
            <div class="stat-value" id="cr-total-paid">0 د.ع</div>
            <div class="stat-sub" id="cr-debt-received">پارەی قەرزی وەرگیراوە: 0 د.ع</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">💳</div>
          <div class="stat-content">
            <div class="stat-label">قەرزی نوێی دروستبوو لە ماوەدا</div>
            <div class="stat-value" id="cr-total-new-debt">0 د.ع</div>
            <div class="stat-sub" id="cr-outstanding-debt">کۆی گشتی قەرزی ئێستا: 0 د.ع</div>
          </div>
        </div>
      </div>

      <!-- Company Report Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🏢 خشتەی فرۆشتن و قەرزی کۆمپانیاکان لە ماوەی دیاریکراودا</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>ناوی کۆمپانیا</th>
                <th>خاوەن کار / مۆبایل</th>
                <th>شۆفێر / بارهەڵگر</th>
                <th>کۆی پسووڵەکان</th>
                <th>کۆی فرۆشتن (د.ع)</th>
                <th>پارەی دراو (د.ع)</th>
                <th>قەرزی ماوەی نوێ (د.ع)</th>
                <th>کۆی قەرزی ئێستا</th>
              </tr>
            </thead>
            <tbody id="cr-companies-tbody">
              <tr><td colspan="9" style="text-align:center; padding: 20px;">خەریکی بارکردنە...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Driver Monthly Report Section -->
    <div id="section-drivers-rep" class="report-section" style="display: none;">
      <div class="card" style="padding: 16px; margin-bottom: 20px;">
        <div class="form-row" style="align-items: center; gap: 12px; flex-wrap: wrap;">
          <div class="form-col" style="flex: 1; min-width: 150px;">
            <label class="form-label">لە بەرواری:</label>
            <input type="date" id="rep-drv-from-date" class="form-control" value="${firstOfMonth}" />
          </div>
          <div class="form-col" style="flex: 1; min-width: 150px;">
            <label class="form-label">تا بەرواری:</label>
            <input type="date" id="rep-drv-to-date" class="form-control" value="${today}" />
          </div>
          <div class="form-col" style="flex: 2; min-width: 200px;">
            <label class="form-label">🔍 گەڕان بەپێی ناوی شۆفێر، مۆبایل، کۆمپانیا:</label>
            <input type="text" id="rep-drv-search" class="form-control" placeholder="ناوی شۆفێر، کۆمپانیا..." />
          </div>
          <div class="form-col" style="flex: 0 0 auto; align-self: flex-end;">
            <button class="btn btn-primary" id="btn-load-drv-rep">دروستکردنی ڕاپۆرت</button>
          </div>
        </div>
      </div>

      <!-- Driver Report Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">👤 خشتەی کڕینی شۆفێرەکان لە ماوەی دیاریکراودا</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>ناوی شۆفێر</th>
                <th>کۆمپانیا</th>
                <th>مۆبایل</th>
                <th>تابلۆی ئۆتۆمبێل</th>
                <th>پسووڵە</th>
                <th>کۆی کڕین (د.ع)</th>
                <th>دراو (د.ع)</th>
                <th>قەرزی ماوە (د.ع)</th>
                <th>کردار</th>
              </tr>
            </thead>
            <tbody id="dr-drivers-tbody">
              <tr><td colspan="10" style="text-align:center; padding: 20px;">خەریکی بارکردنە...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Vehicle Monthly Report Section -->
    <div id="section-vehicles-rep" class="report-section" style="display: none;">
      <div class="card" style="padding: 16px; margin-bottom: 20px;">
        <div class="form-row" style="align-items: center; gap: 12px; flex-wrap: wrap;">
          <div class="form-col" style="flex: 1; min-width: 150px;">
            <label class="form-label">لە بەرواری:</label>
            <input type="date" id="rep-veh-from-date" class="form-control" value="${firstOfMonth}" />
          </div>
          <div class="form-col" style="flex: 1; min-width: 150px;">
            <label class="form-label">تا بەرواری:</label>
            <input type="date" id="rep-veh-to-date" class="form-control" value="${today}" />
          </div>
          <div class="form-col" style="flex: 2; min-width: 200px;">
            <label class="form-label">🔍 گەڕان بەپێی تابلۆ، ژمارە، جۆری بارهەڵگر، کۆمپانیا:</label>
            <input type="text" id="rep-veh-search" class="form-control" placeholder="تابلۆ، جۆری ئۆتۆمبێل، کۆمپانیا..." />
          </div>
          <div class="form-col" style="flex: 0 0 auto; align-self: flex-end;">
            <button class="btn btn-primary" id="btn-load-veh-rep">دروستکردنی ڕاپۆرت</button>
          </div>
        </div>
      </div>

      <!-- Vehicle Report Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🚛 خشتەی کڕین و چاککردنەوەی بارهەڵگرەکان لە ماوەی دیاریکراودا</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>تابلۆی بارهەڵگر</th>
                <th>ژمارەی ناوخۆیی</th>
                <th>جۆر و مۆدێل</th>
                <th>کۆمپانیا</th>
                <th>شۆفێری بەستراو</th>
                <th>پسووڵە</th>
                <th>کۆی کڕین (د.ع)</th>
                <th>دراو (د.ع)</th>
                <th>قەرز (د.ع)</th>
                <th>کردار</th>
              </tr>
            </thead>
            <tbody id="vr-vehicles-tbody">
              <tr><td colspan="11" style="text-align:center; padding: 20px;">خەریکی بارکردنە...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Suppliers Debt Report Section -->
    <div id="section-suppliers-rep" class="report-section" style="display: none;">
      <div class="card" style="padding: 16px; margin-bottom: 20px;">
        <div class="form-row" style="align-items: center; gap: 12px; flex-wrap: wrap;">
          <div class="form-col" style="flex: 1; min-width: 150px;">
            <label class="form-label">لە بەرواری:</label>
            <input type="date" id="rep-supp-from-date" class="form-control" value="${firstOfMonth}" />
          </div>
          <div class="form-col" style="flex: 1; min-width: 150px;">
            <label class="form-label">تا بەرواری:</label>
            <input type="date" id="rep-supp-to-date" class="form-control" value="${today}" />
          </div>
          <div class="form-col" style="flex: 2; min-width: 200px;">
            <label class="form-label">🔍 گەڕان بەپێی ناوی دابینکەر یان کۆمپانیا:</label>
            <input type="text" id="rep-supp-search" class="form-control" placeholder="ناوی دابینکەر، مۆبایل، ناونیشان..." />
          </div>
          <div class="form-col" style="flex: 0 0 auto; align-self: flex-end;">
            <button class="btn btn-primary" id="btn-load-supp-rep">دروستکردنی ڕاپۆرت</button>
          </div>
        </div>
      </div>

      <!-- Suppliers Report Stats -->
      <div class="stat-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
          <div class="stat-icon red">🏭</div>
          <div class="stat-content">
            <div class="stat-label">کۆی قەرزی ئێستای دابینکەران (Debt Balance)</div>
            <div class="stat-value" id="sr-total-debt">0 د.ع</div>
            <div class="stat-sub" id="sr-active-count">0 دابینکەری قەرزدار</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">📦</div>
          <div class="stat-content">
            <div class="stat-label">کۆی کڕینی نوێ لە ماوەدا</div>
            <div class="stat-value" id="sr-period-purchases">0 د.ع</div>
            <div class="stat-sub" id="sr-period-invoices">0 وەسڵ</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">💵</div>
          <div class="stat-content">
            <div class="stat-label">کۆی پارەی دراو لە ماوەدا</div>
            <div class="stat-value" id="sr-period-paid">0 د.ع</div>
            <div class="stat-sub" id="sr-period-debt">قەرزی نوێ لە وەسڵەکان: 0 د.ع</div>
          </div>
        </div>
      </div>

      <!-- Suppliers Report Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🏭 خشتەی دابینکەران و قەرزەکانی کڕین (بێ پەیوەندی بە ژماردنی مەخزەن)</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>ناوی دابینکەر / کۆمپانیا</th>
                <th>مۆبایل</th>
                <th>وەسڵەکان</th>
                <th>کۆی کڕین (د.ع)</th>
                <th>پارەی دراو (د.ع)</th>
                <th>قەرزی وەسڵەکان (د.ع)</th>
                <th>کۆی گشتی قەرز (د.ع)</th>
                <th>کردار</th>
              </tr>
            </thead>
            <tbody id="sr-suppliers-tbody">
              <tr><td colspan="9" style="text-align:center; padding: 20px;">خەریکی بارکردنە...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Tab switcher
  document.querySelectorAll('.rep-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rep-tab').forEach((t) => {
        t.classList.remove('btn-primary', 'active');
        t.classList.add('btn-secondary');
      });
      tab.classList.remove('btn-secondary');
      tab.classList.add('btn-primary', 'active');

      const rep = tab.dataset.rep;
      currentActiveTab = rep;

      document.querySelectorAll('.report-section').forEach((sec) => {
        sec.style.display = 'none';
      });

      const targetSec = document.getElementById(`section-${rep}-rep`);
      if (targetSec) targetSec.style.display = 'block';

      if (rep === 'profit') {
        loadProfitReport();
      } else if (rep === 'companies') {
        loadCompaniesReport();
      } else if (rep === 'drivers') {
        loadDriversReport();
      } else if (rep === 'vehicles') {
        loadVehiclesReport();
      } else if (rep === 'suppliers') {
        loadSuppliersReport();
      } else {
        loadDailyReport();
      }
    });
  });

  // Daily handlers
  document.getElementById('btn-load-daily-rep')?.addEventListener('click', () => loadDailyReport());

  // Profit handlers
  document.getElementById('btn-load-profit-rep')?.addEventListener('click', () => loadProfitReport());

  // Companies handlers
  document.getElementById('btn-load-comp-rep')?.addEventListener('click', () => loadCompaniesReport());
  document.getElementById('rep-comp-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadCompaniesReport();
  });

  // Drivers handlers
  document.getElementById('btn-load-drv-rep')?.addEventListener('click', () => loadDriversReport());
  document.getElementById('rep-drv-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadDriversReport();
  });

  // Vehicles handlers
  document.getElementById('btn-load-veh-rep')?.addEventListener('click', () => loadVehiclesReport());
  document.getElementById('rep-veh-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadVehiclesReport();
  });

  // Suppliers handlers
  document.getElementById('btn-load-supp-rep')?.addEventListener('click', () => loadSuppliersReport());
  document.getElementById('rep-supp-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadSuppliersReport();
  });

  // Export & Print
  document.getElementById('btn-print-report')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    exportReportToCsv();
  });

  // Initial load
  await loadDailyReport();
}

/**
 * Load Daily Report (Asia/Baghdad date)
 */
async function loadDailyReport() {
  const dateInput = document.getElementById('daily-rep-date');
  const date = dateInput?.value || getErbilToday();
  const btn = document.getElementById('btn-load-daily-rep');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'خەریکی بارکردنە...';
  }

  try {
    const res = await api.get(`/reports/daily?date=${date}`);
    if (!res.success || !res.data) {
      showToast('ڕاپۆرتەکە بارنەبوو، تکایە دووبارە هەوڵبدەرەوە', 'error');
      const tbody = document.getElementById('dr-sales-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: #dc2626;">ڕاپۆرتەکە بارنەبوو، تکایە دووبارە هەوڵبدەرەوە</td></tr>`;
      }
      return;
    }

    currentDailyReportData = res.data;
    const { summary, salesList } = res.data;

    const totalSales = Number(summary?.totalSales || summary?.total_sales || 0);
    const txCount = Number(summary?.transactionsCount || summary?.sales_count || 0);
    const grossProfit = Number(summary?.grossProfit || summary?.gross_profit || 0);
    const cogs = Number(summary?.costOfGoodsSold || summary?.cogs || summary?.total_cogs || 0);
    const expenses = Number(summary?.expenses || summary?.total_expenses || 0);
    const netProfit = Number(summary?.netProfit || summary?.net_profit || 0);
    const cashCollected = Number(summary?.cashCollected || summary?.cash_collected || 0);
    const directCash = Number(summary?.directCash || (totalSales - (Number(summary?.newCustomerDebt || 0))));
    const debtReceived = Number(summary?.debtReceived || summary?.debt_received || 0);
    const newDebt = Number(summary?.newCustomerDebt || summary?.new_customer_debt || 0);

    // Update main UI cards
    const elDrSales = document.getElementById('dr-sales');
    if (elDrSales) elDrSales.textContent = formatCurrency(totalSales);

    const elDrTxCount = document.getElementById('dr-tx-count');
    if (elDrTxCount) elDrTxCount.textContent = `${txCount} پسووڵەی فرۆشتن`;

    const elDrNetProfit = document.getElementById('dr-net-profit');
    if (elDrNetProfit) elDrNetProfit.textContent = formatCurrency(netProfit);

    const elDrGrossProfit = document.getElementById('dr-gross-profit');
    if (elDrGrossProfit) elDrGrossProfit.textContent = `قازانجی سەرەتایی: ${formatCurrency(grossProfit)}`;

    const elDrExpenses = document.getElementById('dr-expenses');
    if (elDrExpenses) elDrExpenses.textContent = formatCurrency(expenses);

    const elDrCogsSub = document.getElementById('dr-cogs-sub');
    if (elDrCogsSub) elDrCogsSub.textContent = `تێچووی کاڵا: ${formatCurrency(cogs)}`;

    const elDrCash = document.getElementById('dr-cash-collected');
    if (elDrCash) elDrCash.textContent = formatCurrency(cashCollected);

    const elDrCashBreakdown = document.getElementById('dr-cash-breakdown');
    if (elDrCashBreakdown) elDrCashBreakdown.textContent = `نەقد: ${formatCurrency(directCash)} | قەرز: ${formatCurrency(debtReceived)}`;

    // Secondary breakdown
    const elCogsVal = document.getElementById('dr-cogs-value');
    if (elCogsVal) elCogsVal.textContent = formatCurrency(cogs);

    const elGrossVal = document.getElementById('dr-gross-profit-value');
    if (elGrossVal) elGrossVal.textContent = formatCurrency(grossProfit);

    const elNewDebtVal = document.getElementById('dr-new-debt-value');
    if (elNewDebtVal) elNewDebtVal.textContent = formatCurrency(newDebt);

    const elDebtRecVal = document.getElementById('dr-debt-received-value');
    if (elDebtRecVal) elDebtRecVal.textContent = formatCurrency(debtReceived);

    // Table rows
    const tbody = document.getElementById('dr-sales-tbody');
    if (tbody) {
      const list = salesList || [];
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px; color: var(--text-muted);">هیچ فرۆشتنێک لەم بەروارەدا (${date}) تۆمار نەکراوە</td></tr>`;
      } else {
        tbody.innerHTML = list
          .map((s) => {
            const payTypeText = s.payment_type === 'debt' ? 'قەرز' : s.payment_type === 'partial' ? 'بەشێک قەرز' : 'نەقد';
            const profit = Number(s.gross_profit || (Number(s.total_amount) - Number(s.total_cost || 0)));
            return `
              <tr>
                <td><strong style="direction: ltr; display: inline-block;">${escapeHtml(s.receipt_number)}</strong></td>
                <td style="font-size: 12px; color: var(--text-muted);">${escapeHtml(s.sale_time || '-')}</td>
                <td>${escapeHtml(s.customer_name || 'کڕیاری دەستبەجێ')}</td>
                <td>${escapeHtml(s.cashier_name || s.user_name || 'کاشێر')}</td>
                <td><span class="badge ${s.payment_type === 'debt' ? 'badge-danger' : s.payment_type === 'partial' ? 'badge-warning' : 'badge-success'}">${payTypeText}</span></td>
                <td><strong style="color: var(--primary); font-size: 14px;">${formatCurrency(s.total_amount)}</strong></td>
                <td>${formatCurrency(s.paid_amount)}</td>
                <td>${Number(s.debt_amount) > 0 ? `<span style="color: #dc2626; font-weight: bold;">${formatCurrency(s.debt_amount)}</span>` : '-'}</td>
                <td><span style="color: #16a34a; font-weight: bold;">${formatCurrency(profit)}</span></td>
              </tr>
            `;
          })
          .join('');
      }
    }
  } catch (err) {
    console.error('Error loading daily report:', err);
    showToast('ڕاپۆرتەکە بارنەبوو، تکایە دووبارە هەوڵبدەرەوە', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'پیشاندان';
    }
  }
}

/**
 * Load Profit & Inventory Report
 */
async function loadProfitReport() {
  const fromInput = document.getElementById('profit-from-date');
  const toInput = document.getElementById('profit-to-date');
  const from = fromInput?.value || `${getErbilToday().slice(0, 7)}-01`;
  const to = toInput?.value || getErbilToday();
  const btn = document.getElementById('btn-load-profit-rep');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'خەریکی دروستکردنە...';
  }

  try {
    const res = await api.get(`/reports/inventory-profit?from_date=${from}&to_date=${to}`);
    if (!res.success || !res.data) {
      showToast('هەڵە لە دروستکردنی ڕاپۆرتی قازانج و مەخزەن', 'error');
      return;
    }

    currentProfitReportData = res.data;
    const d = res.data;

    // Inventory metrics
    const fifoVal = d.fifoInventoryValue || d.fifo_inventory_value || d.inventoryValueCost || d.inventory_value_cost || 0;
    const invFifoEl = document.getElementById('pr-inv-fifo');
    if (invFifoEl) invFifoEl.textContent = formatCurrency(fifoVal);

    const invCostEl = document.getElementById('pr-inv-cost');
    if (invCostEl) invCostEl.textContent = `بەهای بەپێی نرخی کڕین: ${formatCurrency(d.inventoryValueCost || d.inventory_value_cost || 0)}`;

    const invSellingEl = document.getElementById('pr-inv-selling');
    if (invSellingEl) invSellingEl.textContent = formatCurrency(d.inventoryValueSelling || d.inventory_value_selling || 0);

    const invMarginEl = document.getElementById('pr-inv-margin');
    if (invMarginEl) invMarginEl.textContent = `قازانجی گریمانەیی: ${formatCurrency(d.potentialGrossMargin || d.potential_gross_margin || 0)}`;

    const invStockEl = document.getElementById('pr-inv-stock');
    if (invStockEl) invStockEl.textContent = `${d.totalStockQuantity || d.total_stock_quantity || 0} دانە`;

    const invLowEl = document.getElementById('pr-inv-low');
    if (invLowEl) invLowEl.textContent = `${d.lowStockCount || d.low_stock_count || 0} کەمبوو`;

    const invOutEl = document.getElementById('pr-inv-out');
    if (invOutEl) invOutEl.textContent = `${d.outOfStockCount || d.out_of_stock_count || 0} تەواوبوو لە مەخزەن`;

    // Period sales metrics
    const revEl = document.getElementById('pr-total-revenue');
    if (revEl) revEl.textContent = formatCurrency(d.totalSales || d.total_sales || d.total_revenue || 0);

    const salesCountEl = document.getElementById('pr-sales-count');
    if (salesCountEl) salesCountEl.textContent = `${d.salesCount || d.total_sales_count || 0} پسووڵە`;

    const costEl = document.getElementById('pr-total-cost');
    if (costEl) costEl.textContent = formatCurrency(d.totalCost || d.total_cost || 0);

    const grossEl = document.getElementById('pr-gross-profit');
    if (grossEl) grossEl.textContent = formatCurrency(d.grossProfit || d.gross_profit || 0);

    const netEl = document.getElementById('pr-net-profit');
    if (netEl) netEl.textContent = formatCurrency(d.netProfit || d.net_profit || 0);

    const marginEl = document.getElementById('pr-margin');
    if (marginEl) marginEl.textContent = `ڕێژەی قازانج: ${d.profitMargin || d.profit_margin || 0}%`;

    // Top products table
    const tbody = document.getElementById('pr-top-products-tbody');
    if (tbody) {
      const topItems = d.topProfitProducts || d.top_profit_products || [];
      if (topItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">هیچ فرۆشتنێک لەم ماوەیەدا نەدۆزرایەوە</td></tr>`;
      } else {
        tbody.innerHTML = topItems
          .map((p) => `
            <tr>
              <td><strong>${escapeHtml(p.product_name)}</strong></td>
              <td><span dir="ltr" style="font-family: monospace;">${escapeHtml(p.part_number || '—')}</span></td>
              <td>${p.total_quantity || 0} دانە</td>
              <td>${formatCurrency(p.total_revenue || 0)}</td>
              <td>${formatCurrency(p.total_cost || 0)}</td>
              <td><strong style="color: #16a34a;">${formatCurrency(p.profit || 0)}</strong></td>
            </tr>
          `)
          .join('');
      }
    }
  } catch (err) {
    console.error('Error loading profit report:', err);
    showToast('هەڵە لە دروستکردنی ڕاپۆرتی قازانج و مەخزەن', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'دروستکردنی ڕاپۆرت';
    }
  }
}

/**
 * Load Company Monthly Report
 */
async function loadCompaniesReport() {
  const from = document.getElementById('rep-comp-from-date')?.value || `${getErbilToday().slice(0, 7)}-01`;
  const to = document.getElementById('rep-comp-to-date')?.value || getErbilToday();
  const search = document.getElementById('rep-comp-search')?.value.trim() || '';
  const btn = document.getElementById('btn-load-comp-rep');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'خەریکی بارکردنە...';
  }

  try {
    let url = `/reports/companies?from_date=${from}&to_date=${to}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await api.get(url);
    if (!res.success || !res.data) {
      showToast('هەڵە لە بارکردنی ڕاپۆرتی کۆمپانیاکان', 'error');
      return;
    }

    currentCompaniesReportData = res.data;
    const { companies, summary } = res.data;

    const elSales = document.getElementById('cr-total-sales');
    if (elSales) elSales.textContent = formatCurrency(summary.total_sales || 0);

    const elInvoices = document.getElementById('cr-total-invoices');
    if (elInvoices) elInvoices.textContent = `${summary.total_invoices || 0} پسووڵەی کڕین`;

    const elPaid = document.getElementById('cr-total-paid');
    if (elPaid) elPaid.textContent = formatCurrency(summary.total_paid || 0);

    const elDebtRec = document.getElementById('cr-debt-received');
    if (elDebtRec) elDebtRec.textContent = `پارەی قەرزی وەرگیراوە: ${formatCurrency(summary.total_debt_payments_received || 0)}`;

    const elNewDebt = document.getElementById('cr-total-new-debt');
    if (elNewDebt) elNewDebt.textContent = formatCurrency(summary.total_new_debt || 0);

    const elOutDebt = document.getElementById('cr-outstanding-debt');
    if (elOutDebt) elOutDebt.textContent = `کۆی قەرزی ئێستای کۆمپانیاکان: ${formatCurrency(summary.current_outstanding_debt || 0)}`;

    const tbody = document.getElementById('cr-companies-tbody');
    if (tbody) {
      if (!companies || companies.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: var(--text-muted);">هیچ زانیارییەک نەدۆزرایەوە</td></tr>`;
      } else {
        tbody.innerHTML = companies
          .map((c, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>🏢 ${escapeHtml(c.name)}</strong></td>
              <td>${escapeHtml(c.owner_name || '—')} / <span dir="ltr">${escapeHtml(c.phone || '—')}</span></td>
              <td><span class="badge badge-info">${c.driver_count || 0} شۆفێر</span> | <span class="badge badge-secondary">${c.vehicle_count || 0} بارهەڵگر</span></td>
              <td style="text-align: center;"><strong>${c.period_invoice_count || 0}</strong></td>
              <td><strong style="color: var(--primary);">${formatCurrency(c.period_total_sales || 0)}</strong></td>
              <td style="color: #16a34a;">${formatCurrency(c.period_paid_amount || 0)}</td>
              <td style="color: ${Number(c.period_new_debt) > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(c.period_new_debt || 0)}</td>
              <td><strong style="color: ${Number(c.current_debt) > 0 ? '#dc2626' : '#16a34a'}; font-size: 14px;">${formatCurrency(c.current_debt || 0)}</strong></td>
            </tr>
          `)
          .join('');
      }
    }
  } catch (err) {
    console.error('Error loading company report:', err);
    showToast('هەڵە لە بارکردنی ڕاپۆرتی کۆمپانیاکان', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'دروستکردنی ڕاپۆرت';
    }
  }
}

/**
 * Load Drivers Monthly Report
 */
async function loadDriversReport() {
  const from = document.getElementById('rep-drv-from-date')?.value || `${getErbilToday().slice(0, 7)}-01`;
  const to = document.getElementById('rep-drv-to-date')?.value || getErbilToday();
  const search = document.getElementById('rep-drv-search')?.value.trim() || '';
  const btn = document.getElementById('btn-load-drv-rep');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'خەریکی بارکردنە...';
  }

  try {
    let url = `/reports/drivers?from_date=${from}&to_date=${to}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await api.get(url);
    if (!res.success || !res.data) {
      showToast('هەڵە لە بارکردنی ڕاپۆرتی شۆفێرەکان', 'error');
      return;
    }

    currentDriversReportData = res.data;
    const { drivers } = res.data;

    const tbody = document.getElementById('dr-drivers-tbody');
    if (tbody) {
      if (!drivers || drivers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 20px; color: var(--text-muted);">هیچ شۆفێرێک نەدۆزرایەوە</td></tr>`;
      } else {
        tbody.innerHTML = drivers
          .map((d, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>👤 ${escapeHtml(d.full_name)}</strong></td>
              <td>🏢 ${escapeHtml(d.company_name)}</td>
              <td><span dir="ltr">${escapeHtml(d.phone || '—')}</span></td>
              <td>${escapeHtml(d.vehicle_plate || d.vehicle_number || '—')}</td>
              <td style="text-align: center;"><strong>${d.period_invoice_count || 0}</strong></td>
              <td><strong style="color: var(--primary);">${formatCurrency(d.period_total_purchases || 0)}</strong></td>
              <td style="color: #16a34a;">${formatCurrency(d.period_paid_amount || 0)}</td>
              <td style="color: ${Number(d.period_debt_amount) > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(d.period_debt_amount || 0)}</td>
              <td>
                <button class="btn btn-sm btn-outline btn-print-single-drv" data-id="${d.id}" data-comp-id="${d.company_id}" data-name="${escapeHtml(d.full_name)}" data-comp-name="${escapeHtml(d.company_name)}" data-phone="${escapeHtml(d.phone || '')}">
                  🖨️ چاپ
                </button>
              </td>
            </tr>
          `)
          .join('');

        tbody.querySelectorAll('.btn-print-single-drv').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const drvId = btn.dataset.id;
            const compId = btn.dataset.compId;
            const drvName = btn.dataset.name;
            const compName = btn.dataset.compName;
            const drvPhone = btn.dataset.phone;

            const purRes = await api.get(`/companies/${compId}/drivers/${drvId}/purchases`);
            let invoices = [];
            let debts = [];
            if (purRes.success && purRes.data) {
              invoices = Array.isArray(purRes.data) ? purRes.data : (purRes.data.invoices || []);
              debts = purRes.data.debts || [];
            }
            printDriverReport({ id: drvId, full_name: drvName, company_name: compName, phone: drvPhone }, invoices, debts);
          });
        });
      }
    }
  } catch (err) {
    console.error('Error loading drivers report:', err);
    showToast('هەڵە لە بارکردنی ڕاپۆرتی شۆفێرەکان', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'دروستکردنی ڕاپۆرت';
    }
  }
}

/**
 * Load Vehicles Monthly Report
 */
async function loadVehiclesReport() {
  const from = document.getElementById('rep-veh-from-date')?.value || `${getErbilToday().slice(0, 7)}-01`;
  const to = document.getElementById('rep-veh-to-date')?.value || getErbilToday();
  const search = document.getElementById('rep-veh-search')?.value.trim() || '';
  const btn = document.getElementById('btn-load-veh-rep');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'خەریکی بارکردنە...';
  }

  try {
    let url = `/reports/vehicles?from_date=${from}&to_date=${to}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await api.get(url);
    if (!res.success || !res.data) {
      showToast('هەڵە لە بارکردنی ڕاپۆرتی بارهەڵگرەکان', 'error');
      return;
    }

    currentVehiclesReportData = res.data;
    const { vehicles } = res.data;

    const tbody = document.getElementById('vr-vehicles-tbody');
    if (tbody) {
      if (!vehicles || vehicles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 20px; color: var(--text-muted);">هیچ بارهەڵگرێک نەدۆزرایەوە</td></tr>`;
      } else {
        tbody.innerHTML = vehicles
          .map((v, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>🚛 ${escapeHtml(v.plate_number || '—')}</strong></td>
              <td>${escapeHtml(v.vehicle_number || '—')}</td>
              <td>${escapeHtml(v.truck_brand || '')} ${escapeHtml(v.truck_model || '')}</td>
              <td>🏢 ${escapeHtml(v.company_name)}</td>
              <td>${escapeHtml(v.driver_name || '—')}</td>
              <td style="text-align: center;"><strong>${v.period_invoice_count || 0}</strong></td>
              <td><strong style="color: var(--primary);">${formatCurrency(v.period_total_purchases || 0)}</strong></td>
              <td style="color: #16a34a;">${formatCurrency(v.period_paid_amount || 0)}</td>
              <td style="color: ${Number(v.period_debt_amount) > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(v.period_debt_amount || 0)}</td>
              <td>
                <button class="btn btn-sm btn-outline btn-print-single-veh" data-id="${v.id}" data-comp-id="${v.company_id}" data-plate="${escapeHtml(v.plate_number || '')}" data-veh-num="${escapeHtml(v.vehicle_number || '')}" data-comp-name="${escapeHtml(v.company_name)}" data-brand="${escapeHtml(v.truck_brand || '')}">
                  🖨️ چاپ
                </button>
              </td>
            </tr>
          `)
          .join('');

        tbody.querySelectorAll('.btn-print-single-veh').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const vehId = btn.dataset.id;
            const compId = btn.dataset.compId;
            const plateNumber = btn.dataset.plate;
            const vehicleNumber = btn.dataset.vehNum;
            const compName = btn.dataset.compName;
            const truckBrand = btn.dataset.brand;

            const purRes = await api.get(`/companies/${compId}/vehicles/${vehId}/purchases`);
            let invoices = [];
            let debts = [];
            if (purRes.success && purRes.data) {
              invoices = Array.isArray(purRes.data) ? purRes.data : (purRes.data.invoices || []);
              debts = purRes.data.debts || [];
            }
            printVehicleReport({ id: vehId, plate_number: plateNumber, vehicle_number: vehicleNumber, company_name: compName, truck_brand: truckBrand }, invoices, debts);
          });
        });
      }
    }
  } catch (err) {
    console.error('Error loading vehicles report:', err);
    showToast('هەڵە لە بارکردنی ڕاپۆرتی بارهەڵگرەکان', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'دروستکردنی ڕاپۆرت';
    }
  }
}

/**
 * Load Suppliers Debt Report
 */
async function loadSuppliersReport() {
  const from = document.getElementById('rep-supp-from-date')?.value || '';
  const to = document.getElementById('rep-supp-to-date')?.value || '';
  const search = document.getElementById('rep-supp-search')?.value.trim().toLowerCase() || '';

  const tbody = document.getElementById('sr-suppliers-tbody');
  const btn = document.getElementById('btn-load-supp-rep');

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">خەریکی هێنانی زانیارییەکانە...</td></tr>`;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'خەریکی بارکردنە...';
  }

  try {
    const res = await api.get('/suppliers/debt-overview');
    if (!res.success || !res.data) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: var(--danger-color);">هەڵە لە وەرگرتنی ڕاپۆرتی دابینکەران</td></tr>`;
      return;
    }

    const { summary, suppliers } = res.data;
    currentSuppliersReportData = { summary, suppliers };

    // Update KPI stat cards
    const elTotalDebt = document.getElementById('sr-total-debt');
    const elActiveCount = document.getElementById('sr-active-count');
    const elPeriodPurchases = document.getElementById('sr-period-purchases');
    const elPeriodInvoices = document.getElementById('sr-period-invoices');
    const elPeriodPaid = document.getElementById('sr-period-paid');
    const elPeriodDebt = document.getElementById('sr-period-debt');

    if (elTotalDebt) elTotalDebt.textContent = `${formatCurrency(summary.total_debt_balance || 0)} د.ع`;
    if (elActiveCount) elActiveCount.textContent = `${summary.debtor_suppliers_count || 0} دابینکەری قەرزدار لە کۆی ${summary.total_suppliers || 0}`;
    if (elPeriodPurchases) elPeriodPurchases.textContent = `${formatCurrency(summary.total_purchases_sum || 0)} د.ع`;
    if (elPeriodInvoices) elPeriodInvoices.textContent = `${summary.total_invoices_sum || 0} وەسڵ`;
    if (elPeriodPaid) elPeriodPaid.textContent = `${formatCurrency(summary.total_paid_sum || 0)} د.ع`;
    if (elPeriodDebt) elPeriodDebt.textContent = `قەرزی نوێ: ${formatCurrency((summary.total_purchases_sum || 0) - (summary.total_paid_sum || 0))} د.ع`;

    // Filter suppliers if search term present
    let filtered = suppliers || [];
    if (search) {
      filtered = filtered.filter((s) =>
        (s.name || '').toLowerCase().includes(search) ||
        (s.phone || '').toLowerCase().includes(search) ||
        (s.address || '').toLowerCase().includes(search)
      );
    }

    if (tbody) {
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">هیچ دابینکەرێک نەدۆزرایەوە</td></tr>`;
      } else {
        tbody.innerHTML = filtered.map((s, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-weight: 700;">${escapeHtml(s.name)}</td>
            <td style="direction: ltr; text-align: right;">${s.phone || '-'}</td>
            <td><span class="badge badge-info">${s.invoice_count || 0}</span></td>
            <td style="font-weight: 600;">${formatCurrency(s.total_purchases || 0)}</td>
            <td style="color: var(--success-color); font-weight: 600;">${formatCurrency(s.total_paid || 0)}</td>
            <td style="color: var(--warning-color); font-weight: 600;">${formatCurrency(s.purchases_debt || 0)}</td>
            <td style="font-weight: 800; color: ${Number(s.balance_debt) > 0 ? 'var(--danger-color)' : 'var(--success-color)'};">
              ${formatCurrency(s.balance_debt || 0)} د.ع
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary btn-print-supp-statement" data-id="${s.id}" title="چاپی کشف حسابی A4">
                📄 کشف حساب
              </button>
            </td>
          </tr>
        `).join('');

        tbody.querySelectorAll('.btn-print-supp-statement').forEach((btnEl) => {
          btnEl.addEventListener('click', async () => {
            const suppId = btnEl.dataset.id;
            try {
              btnEl.textContent = 'خەریکی ئامادەکردنە...';
              btnEl.disabled = true;
              const stmtRes = await api.get(`/suppliers/${suppId}/statement`);
              if (stmtRes.success && stmtRes.data) {
                printSupplierStatement(stmtRes.data.supplier, stmtRes.data.purchases, stmtRes.data.payments, stmtRes.data.summary);
              } else {
                showToast('هەڵە لە وەرگرتنی کشف حسابی دابینکەر', 'error');
              }
            } catch (err) {
              console.error('Error generating statement:', err);
              showToast('هەڵە لە دروستکردنی کشف حساب', 'error');
            } finally {
              btnEl.textContent = '📄 کشف حساب';
              btnEl.disabled = false;
            }
          });
        });
      }
    }
  } catch (err) {
    console.error('Error loading suppliers report:', err);
    showToast('هەڵە لە بارکردنی ڕاپۆرتی دابینکەران', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'دروستکردنی ڕاپۆرت';
    }
  }
}

/**
 * Export active report to CSV
 */
async function exportReportToCsv() {
  const today = getErbilToday();

  try {
    if (currentActiveTab === 'daily') {
      const date = document.getElementById('daily-rep-date')?.value || today;
      let data = currentDailyReportData;
      if (!data) {
        const res = await api.get(`/reports/daily?date=${date}`);
        if (res.success && res.data) data = res.data;
      }

      const list = data?.salesList || [];
      const csvRows = [
        ['"ڕاپۆرتی ڕۆژانەی سندووق - سەنگەر زمارەیی و جێگر زمارەیی"'],
        [`"بەروار: ${date}"`],
        [],
        [
          '"ژمارەی پسووڵە"',
          '"بەروار"',
          '"کات"',
          '"ناوی کڕیار"',
          '"ناوی کاشێر"',
          '"شێوازی پارەدان"',
          '"کۆی پسووڵە (د.ع)"',
          '"پارەی دراو (د.ع)"',
          '"بڕی قەرز (د.ع)"',
          '"تێچووی کاڵا (د.ع)"',
          '"قازانجی سەرەتایی (د.ع)"',
        ],
        ...list.map((s) => [
          `"${s.receipt_number || ''}"`,
          `"${s.sale_date || date}"`,
          `"${s.sale_time || ''}"`,
          `"${(s.customer_name || 'کڕیاری دەستبەجێ').replace(/"/g, '""')}"`,
          `"${(s.cashier_name || s.user_name || 'کاشێر').replace(/"/g, '""')}"`,
          `"${s.payment_type === 'debt' ? 'قەرز' : s.payment_type === 'partial' ? 'بەشێک قەرز' : 'نەقد'}"`,
          `"${s.total_amount || 0}"`,
          `"${s.paid_amount || 0}"`,
          `"${s.debt_amount || 0}"`,
          `"${s.total_cost || 0}"`,
          `"${s.gross_profit || (Number(s.total_amount || 0) - Number(s.total_cost || 0))}"`,
        ]),
      ];

      downloadCsvFile(csvRows, `SZJZ_Daily_Report_${date}.csv`);
    } else if (currentActiveTab === 'companies') {
      const from = document.getElementById('rep-comp-from-date')?.value || `${today.slice(0, 7)}-01`;
      const to = document.getElementById('rep-comp-to-date')?.value || today;
      const companies = currentCompaniesReportData?.companies || [];

      const csvRows = [
        ['"ڕاپۆرتی مانگانەی کۆمپانیاکان - سەنگەر زمارەیی و جێگر زمارەیی"'],
        [`"لە بەرواری: ${from}"`, `"تا بەرواری: ${to}"`],
        [],
        ['"کۆمپانیا"', '"خاوەن کار"', '"مۆبایل"', '"ژمارەی پسووڵە"', '"کۆی فرۆشتن (د.ع)"', '"پارەی دراو (د.ع)"', '"قەرزی ماوەی نوێ (د.ع)"', '"کۆی قەرزی ئێستا (د.ع)"'],
        ...companies.map((c) => [
          `"${(c.name || '').replace(/"/g, '""')}"`,
          `"${(c.owner_name || '').replace(/"/g, '""')}"`,
          `"${c.phone || ''}"`,
          `"${c.period_invoice_count || 0}"`,
          `"${c.period_total_sales || 0}"`,
          `"${c.period_paid_amount || 0}"`,
          `"${c.period_new_debt || 0}"`,
          `"${c.current_debt || 0}"`,
        ]),
      ];

      downloadCsvFile(csvRows, `SZJZ_Companies_Report_${from}_to_${to}.csv`);
    } else if (currentActiveTab === 'drivers') {
      const from = document.getElementById('rep-drv-from-date')?.value || `${today.slice(0, 7)}-01`;
      const to = document.getElementById('rep-drv-to-date')?.value || today;
      const drivers = currentDriversReportData?.drivers || [];

      const csvRows = [
        ['"ڕاپۆرتی مانگانەی شۆفێرەکان - سەنگەر زمارەیی و جێگر زمارەیی"'],
        [`"لە بەرواری: ${from}"`, `"تا بەرواری: ${to}"`],
        [],
        ['"ناوی شۆفێر"', '"کۆمپانیا"', '"مۆبایل"', '"تابلۆی بارهەڵگر"', '"ژمارەی پسووڵە"', '"کۆی کڕین (د.ع)"', '"پارەی دراو (د.ع)"', '"قەرزی ماوە (د.ع)"'],
        ...drivers.map((d) => [
          `"${(d.full_name || '').replace(/"/g, '""')}"`,
          `"${(d.company_name || '').replace(/"/g, '""')}"`,
          `"${d.phone || ''}"`,
          `"${d.vehicle_plate || d.vehicle_number || ''}"`,
          `"${d.period_invoice_count || 0}"`,
          `"${d.period_total_purchases || 0}"`,
          `"${d.period_paid_amount || 0}"`,
          `"${d.period_debt_amount || 0}"`,
        ]),
      ];

      downloadCsvFile(csvRows, `SZJZ_Drivers_Report_${from}_to_${to}.csv`);
    } else if (currentActiveTab === 'vehicles') {
      const from = document.getElementById('rep-veh-from-date')?.value || `${today.slice(0, 7)}-01`;
      const to = document.getElementById('rep-veh-to-date')?.value || today;
      const vehicles = currentVehiclesReportData?.vehicles || [];

      const csvRows = [
        ['"ڕاپۆرتی مانگانەی بارهەڵگرەکان - سەنگەر زمارەیی و جێگر زمارەیی"'],
        [`"لە بەرواری: ${from}"`, `"تا بەرواری: ${to}"`],
        [],
        ['"تابلۆی بارهەڵگر"', '"ژمارەی ناوخۆیی"', '"جۆری بارهەڵگر"', '"کۆمپانیا"', '"شۆفێر"', '"ژمارەی پسووڵە"', '"کۆی کڕین (د.ع)"', '"پارەی دراو (د.ع)"', '"قەرزی ماوە (د.ع)"'],
        ...vehicles.map((v) => [
          `"${v.plate_number || ''}"`,
          `"${v.vehicle_number || ''}"`,
          `"${(v.truck_brand || '') + ' ' + (v.truck_model || '')}"`,
          `"${(v.company_name || '').replace(/"/g, '""')}"`,
          `"${(v.driver_name || '').replace(/"/g, '""')}"`,
          `"${v.period_invoice_count || 0}"`,
          `"${v.period_total_purchases || 0}"`,
          `"${v.period_paid_amount || 0}"`,
          `"${v.period_debt_amount || 0}"`,
        ]),
      ];

      downloadCsvFile(csvRows, `SZJZ_Vehicles_Report_${from}_to_${to}.csv`);
    } else if (currentActiveTab === 'suppliers') {
      const suppliers = currentSuppliersReportData?.suppliers || [];
      const summary = currentSuppliersReportData?.summary || {};

      const csvRows = [
        ['"ڕاپۆرتی قەرزی دابینکەران - سەنگەر زمارەیی و جێگر زمارەیی"'],
        [`"کۆی قەرزی گشتی ئێستای دابینکەران"`, `"${summary.total_debt_balance || 0} د.ع"`],
        [],
        ['"ناوی دابینکەر"', '"مۆبایل"', '"ناونیشان"', '"ژمارەی وەسڵ"', '"کۆی کڕین (د.ع)"', '"پارەی دراو (د.ع)"', '"قەرزی وەسڵەکان (د.ع)"', '"کۆی قەرزی ئێستا (د.ع)"'],
        ...suppliers.map((s) => [
          `"${(s.name || '').replace(/"/g, '""')}"`,
          `"${s.phone || ''}"`,
          `"${(s.address || '').replace(/"/g, '""')}"`,
          `"${s.invoice_count || 0}"`,
          `"${s.total_purchases || 0}"`,
          `"${s.total_paid || 0}"`,
          `"${s.purchases_debt || 0}"`,
          `"${s.balance_debt || 0}"`,
        ]),
      ];

      downloadCsvFile(csvRows, `SZJZ_Suppliers_Debt_Report_${today}.csv`);
    } else {
      // Export Profit & Inventory Report
      const from = document.getElementById('profit-from-date')?.value || `${today.slice(0, 7)}-01`;
      const to = document.getElementById('profit-to-date')?.value || today;
      let data = currentProfitReportData;
      if (!data) {
        const res = await api.get(`/reports/inventory-profit?from_date=${from}&to_date=${to}`);
        if (res.success && res.data) data = res.data;
      }

      const topItems = data?.topProfitProducts || data?.top_profit_products || [];
      const csvRows = [
        ['"ڕاپۆرتی قازانجی خاوێن و بەهای مەخزەن - سەنگەر زمارەیی و جێگر زمارەیی"'],
        [`"لە بەرواری"`, `"${from}"`, `"تا بەرواری"`, `"${to}"`],
        [`"بەهای مەخزەن بە نرخی کڕین"`, `"${data?.inventoryValueCost || 0}"`],
        [`"بەهای مەخزەن بە نرخی فرۆشتن"`, `"${data?.inventoryValueSelling || 0}"`],
        [`"کۆی داهاتی فرۆشتن"`, `"${data?.totalSales || 0}"`],
        [`"تێچووی کاڵا (COGS)"`, `"${data?.totalCost || 0}"`],
        [`"قازانجی سەرەتایی (Gross)"`, `"${data?.grossProfit || 0}"`],
        [`"کۆی خەرجییەکان"`, `"${data?.totalExpenses || 0}"`],
        [`"قازانجی خاوێن (Net Profit)"`, `"${data?.netProfit || 0}"`],
        [`"ڕێژەی قازانج (%)"`, `"${data?.profitMargin || 0}"`],
        [],
        ['"ناوی کاڵا"', '"کۆدی پارچە"', '"ژمارەی فرۆشراو"', '"کۆی داهات (د.ع)"', '"کۆی تێچوو (د.ع)"', '"قازانج (د.ع)"'],
        ...topItems.map((p) => [
          `"${(p.product_name || '').replace(/"/g, '""')}"`,
          `"${(p.part_number || '').replace(/"/g, '""')}"`,
          `"${p.total_quantity || 0}"`,
          `"${p.total_revenue || 0}"`,
          `"${p.total_cost || 0}"`,
          `"${p.profit || 0}"`,
        ]),
      ];

      downloadCsvFile(csvRows, `SZJZ_Profit_Inventory_Report_${from}_to_${to}.csv`);
    }
  } catch (err) {
    console.error('Error exporting CSV:', err);
    showToast('هەڵە لە دەرهێنانی فایلی CSV', 'error');
  }
}

/**
 * Helper to download CSV with UTF-8 BOM
 */
function downloadCsvFile(rows, filename) {
  const csvContent = '\uFEFF' + rows.map((e) => e.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('فایلی CSV بە سەرکەوتوویی دابەزێندرا ✓', 'success');
}
