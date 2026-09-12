/**
 * Main Application Orchestrator & Router
 * سەنگەر زمارەیی و جێگر زمارەیی - POS System
 */
import { checkAuth, getUser, isAdmin, logout } from './auth.js';
import { api, showToast } from './api.js';

// Page modules
import { initPosPage } from './pages/pos.js';
import { initDashboardPage } from './pages/dashboard.js';
import { initProductsPage } from './pages/products.js';
import { initInventoryPage } from './pages/inventory.js';
import { initSalesPage } from './pages/sales.js';
import { initPurchasesPage } from './pages/purchases.js';
import { initCustomersPage } from './pages/customers.js';
import { initSuppliersPage } from './pages/suppliers.js';
import { initDebtsPage } from './pages/debts.js';
import { initExpensesPage } from './pages/expenses.js';
import { initReturnsPage } from './pages/returns.js';
import { initReportsPage } from './pages/reports.js';
import { initUsersPage } from './pages/users.js';
import { initSettingsPage } from './pages/settings.js';

const routes = {
  pos: { title: 'خاڵی فرۆشتنی خێرا (POS)', init: initPosPage },
  dashboard: { title: 'داشبۆردی سەرەکی', init: initDashboardPage },
  products: { title: 'بەڕێوەبردنی کاڵاکان', init: initProductsPage },
  inventory: { title: 'جووڵە و بەدواداچوونی کۆگا', init: initInventoryPage },
  sales: { title: 'مێژووی فرۆشتنەکان', init: initSalesPage },
  purchases: { title: 'وەسڵی کڕین (هێنانی کاڵا)', init: initPurchasesPage },
  customers: { title: 'کڕیاران و قەرزەکان', init: initCustomersPage },
  suppliers: { title: 'دابینکەران (کۆمپانیاکان)', init: initSuppliersPage },
  debts: { title: 'ناوەندی قەرزەکان', init: initDebtsPage },
  expenses: { title: 'تۆماری خەرجییەکان', init: initExpensesPage },
  returns: { title: 'گەڕانەوەی کاڵا', init: initReturnsPage },
  reports: { title: 'ڕاپۆرتە داراییەکان', init: initReportsPage, adminOnly: true },
  users: { title: 'بەکارهێنەران و دەسەڵاتەکان', init: initUsersPage, adminOnly: true },
  settings: { title: 'ڕێکخستنەکانی سیستەم', init: initSettingsPage, adminOnly: true },
};

async function initApp() {
  const user = await checkAuth();
  if (!user) return;

  renderUserBadge(user);
  renderNavPermissions(user);
  setupNavigationEvents();

  // Route according to hash or default to pos/dashboard
  const defaultRoute = user.role === 'admin' ? 'dashboard' : 'pos';
  const initialHash = window.location.hash.replace('#', '') || defaultRoute;
  navigateTo(initialHash);

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || defaultRoute;
    navigateTo(hash);
  });
}

function renderUserBadge(user) {
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  if (nameEl) nameEl.textContent = user.full_name || user.name || 'بەکارهێنەر';
  if (roleEl) {
    roleEl.textContent = (user.role === 'admin' || user.role_id === 1) ? 'بەڕێوەبەر (Admin)' : 'کاشێر (Cashier)';
  }
}

function openUserProfileModal() {
  const user = getUser();
  if (!user) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const roleName = (user.role === 'admin' || user.role_id === 1) ? '👑 بەڕێوەبەر (Admin)' : '💳 کاشێر (Cashier)';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 520px; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
        <h3 class="modal-title" style="margin: 0; font-size: 16px; font-weight: 800; color: #ffffff;">پڕۆفایلی بەکارهێنەر و پاراستن</h3>
        <button class="modal-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <!-- User Info Summary -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="font-weight: 800; font-size: 16px; color: #0f172a;">${user.full_name || user.name}</div>
            <span class="badge ${user.role === 'admin' || user.role_id === 1 ? 'badge-danger' : 'badge-info'}" style="padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">
              ${roleName}
            </span>
          </div>
          <div style="font-size: 13px; color: #64748b; direction: ltr; text-align: right; font-family: monospace;">
            ${user.email}
          </div>
        </div>

        <!-- Tab Controls -->
        <div style="display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px;">
          <button id="tab-btn-pass" class="btn btn-sm" style="background: #2563eb; color: #ffffff; border-radius: 6px 6px 0 0; font-weight: 700; padding: 8px 16px;">🔑 گۆڕینی وشەی نهێنی</button>
          <button id="tab-btn-email" class="btn btn-sm" style="background: transparent; color: #64748b; border-radius: 6px 6px 0 0; font-weight: 700; padding: 8px 16px;">✉️ گۆڕینی ئیمەیڵ</button>
        </div>

        <!-- Tab 1: Change Password -->
        <div id="tab-content-pass">
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">وشەی نهێنی ئێستا (Current Password) *</label>
            <input type="password" id="prof-curr-pass" class="form-control" placeholder="وشەی نهێنی ئێستات بنووسە..." style="direction: ltr; text-align: left;" />
          </div>
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">وشەی نهێنی نوێ (New Password) *</label>
            <input type="password" id="prof-new-pass" class="form-control" placeholder="لانی کەم ٤ پیت بنووسە..." style="direction: ltr; text-align: left;" />
          </div>
          <div class="form-group" style="margin-bottom: 18px;">
            <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">دووبارەکردنەوەی وشەی نهێنی نوێ *</label>
            <input type="password" id="prof-confirm-pass" class="form-control" placeholder="دووبارە وشە نهێنییە نوێیەکە بنووسەوە..." style="direction: ltr; text-align: left;" />
          </div>
          <button class="btn btn-primary" id="btn-save-pass" style="width: 100%; font-weight: 700; padding: 10px;">
            پاشەکەوتکردنی وشەی نهێنی نوێ
          </button>
        </div>

        <!-- Tab 2: Change Email -->
        <div id="tab-content-email" style="display: none;">
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">ئیمەیڵی نوێ (New Email) *</label>
            <input type="email" id="prof-new-email" class="form-control" placeholder="new-email@gmail.com" style="direction: ltr; text-align: left;" />
          </div>
          <div class="form-group" style="margin-bottom: 18px;">
            <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">وشەی نهێنی بۆ پشتڕاستکردنەوە (Password) *</label>
            <input type="password" id="prof-email-pass" class="form-control" placeholder="وشەی نهێنی بنووسە..." style="direction: ltr; text-align: left;" />
          </div>
          <button class="btn btn-primary" id="btn-save-email" style="width: 100%; font-weight: 700; padding: 10px; background: #059669; border-color: #059669;">
            پاشەکەوتکردنی ئیمەیڵی نوێ
          </button>
        </div>
      </div>
      <div class="modal-footer" style="padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
        <button class="btn btn-secondary mu-cancel" style="font-weight: 600;">داخستن</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.mu-cancel').addEventListener('click', closeModal);

  // Tabs switching
  const tabBtnPass = modal.querySelector('#tab-btn-pass');
  const tabBtnEmail = modal.querySelector('#tab-btn-email');
  const tabContentPass = modal.querySelector('#tab-content-pass');
  const tabContentEmail = modal.querySelector('#tab-content-email');

  tabBtnPass.addEventListener('click', () => {
    tabBtnPass.style.background = '#2563eb';
    tabBtnPass.style.color = '#ffffff';
    tabBtnEmail.style.background = 'transparent';
    tabBtnEmail.style.color = '#64748b';
    tabContentPass.style.display = 'block';
    tabContentEmail.style.display = 'none';
  });

  tabBtnEmail.addEventListener('click', () => {
    tabBtnEmail.style.background = '#059669';
    tabBtnEmail.style.color = '#ffffff';
    tabBtnPass.style.background = 'transparent';
    tabBtnPass.style.color = '#64748b';
    tabContentPass.style.display = 'none';
    tabContentEmail.style.display = 'block';
  });

  // Change password submit
  modal.querySelector('#btn-save-pass').addEventListener('click', async () => {
    const currPass = modal.querySelector('#prof-curr-pass').value;
    const newPass = modal.querySelector('#prof-new-pass').value;
    const confirmPass = modal.querySelector('#prof-confirm-pass').value;

    if (!currPass || !newPass) {
      showToast('تکایە هەموو خانەکان پڕبکەرەوە', 'error');
      return;
    }
    if (newPass.length < 4) {
      showToast('وشەی نهێنی دەبێت لانیکەم ٤ پیت بێت', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      showToast('وشەی نهێنی نوێ و دووبارەکردنەوەکەی وەک یەک نین', 'error');
      return;
    }

    const btn = modal.querySelector('#btn-save-pass');
    btn.disabled = true;
    btn.textContent = 'خەریکی پاشەکەوتکردنە...';

    const res = await api.put('/auth/change-password', {
      current_password: currPass,
      new_password: newPass,
      password: newPass,
    });

    if (res.success) {
      showToast(res.message || 'وشەی نهێنی بە سەرکەوتوویی گۆڕدرا', 'success');
      closeModal();
    } else {
      showToast(res.message || 'هەڵە لە گۆڕینی وشەی نهێنی', 'error');
      btn.disabled = false;
      btn.textContent = 'پاشەکەوتکردنی وشەی نهێنی نوێ';
    }
  });

  // Change email submit
  modal.querySelector('#btn-save-email').addEventListener('click', async () => {
    const newEmail = modal.querySelector('#prof-new-email').value.trim();
    const password = modal.querySelector('#prof-email-pass').value;

    if (!newEmail || !password) {
      showToast('تکایە ئیمەیڵی نوێ و وشەی نهێنی بنووسە', 'error');
      return;
    }
    if (!newEmail.includes('@')) {
      showToast('تکایە ئیمەیڵێکی دروست بنووسە', 'error');
      return;
    }

    const btn = modal.querySelector('#btn-save-email');
    btn.disabled = true;
    btn.textContent = 'خەریکی پاشەکەوتکردنە...';

    const res = await api.put('/auth/change-email', {
      new_email: newEmail,
      email: newEmail,
      password,
    });

    if (res.success) {
      showToast(res.message || 'ئیمەیڵ بە سەرکەوتوویی نوێکرایەوە', 'success');
      const currentUser = getUser();
      if (currentUser) {
        currentUser.email = newEmail;
        localStorage.setItem('szjz_user', JSON.stringify(currentUser));
      }
      closeModal();
    } else {
      showToast(res.message || 'هەڵە لە گۆڕینی ئیمەیڵ', 'error');
      btn.disabled = false;
      btn.textContent = 'پاشەکەوتکردنی ئیمەیڵی نوێ';
    }
  });
}

function renderNavPermissions(user) {
  const admin = user.role === 'admin';
  document.querySelectorAll('.admin-only-item').forEach((item) => {
    item.style.display = admin ? 'block' : 'none';
  });
}

function navigateTo(routeName) {
  if (routeName === 'cash-register') {
    window.location.hash = '#dashboard';
    return;
  }
  const route = routes[routeName] || routes.pos;
  const user = getUser();

  if (route.adminOnly && user?.role !== 'admin') {
    showToast('تۆ دەسەڵاتی بینینی ئەم پەڕەیەت نییە', 'error');
    navigateTo('pos');
    return;
  }

  // Update navbar title
  const titleEl = document.getElementById('page-navbar-title');
  if (titleEl) titleEl.textContent = route.title;

  // Update active sidebar menu item
  document.querySelectorAll('.menu-item').forEach((item) => {
    const link = item.querySelector('a');
    if (link && link.getAttribute('href') === `#${routeName}`) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Call page initializer
  route.init();
}

function setupNavigationEvents() {
  document.getElementById('btn-sidebar-logout')?.addEventListener('click', () => {
    if (confirm('دڵنیایت دەتەوێت بچیتە دەرەوە؟')) {
      logout();
    }
  });

  // Clicking user details opens the profile modal
  const userDetails = document.querySelector('.user-details');
  if (userDetails) {
    userDetails.style.cursor = 'pointer';
    userDetails.title = 'کلیک بکە بۆ گۆڕینی وشەی نهێنی یان ئیمەیڵ';
    userDetails.addEventListener('click', openUserProfileModal);
  }

  // Mobile sidebar toggle
  const sidebar = document.getElementById('app-sidebar');
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  toggleBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });

  // Close sidebar on link click on mobile
  document.querySelectorAll('.sidebar-menu a').forEach((link) => {
    link.addEventListener('click', () => {
      sidebar?.classList.remove('open');
    });
  });
}

// Boot application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
