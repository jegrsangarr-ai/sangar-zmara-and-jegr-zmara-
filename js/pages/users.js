/**
 * Users Management Module (Admin only)
 * بەڕێوەبردنی بەکارهێنەران و دەسەڵاتەکان (Local SQLite Auth Architecture)
 */
import { api, showToast } from '../api.js';
import { getUser } from '../auth.js';

export async function initUsersPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
      <div>
        <h2 class="section-title" style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 6px;">بەڕێوەبردنی بەکارهێنەران و دەسەڵاتەکان</h2>
        <div class="section-subtitle" style="font-size: 13px; color: #64748b;">دروستکردنی بەکارهێنەری نوێ، گۆڕینی ڕۆڵ (Admin/Cashier)، نوێکردنەوەی وشەی نهێنی و دۆخی هەژمار</div>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <button class="btn btn-secondary" id="btn-refresh-users" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
          <span>🔄</span>
          <span>نوێکردنەوە</span>
        </button>
        <button class="btn btn-primary" id="btn-add-user" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700;">
          <span>+</span>
          <span>بەکارهێنەری نوێ</span>
        </button>
      </div>
    </div>

    <!-- Info Banner -->
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #1e40af;">
        <span style="font-size: 20px;">🛡️</span>
        <div>
          <strong>سیستەمی پاراستنی هەژمار و تێپەڕەوشە (Bcrypt Hash):</strong> وشەی نهێنی بە شێوەی پارێزراو لە داتابەیسی لۆکاڵ شاردراوەتەوە و لە هیچ شوێنێک بە دەقی ئاسایی پیشان نادرێت. دەتوانیت ڕۆڵی بەکارهێنەران لەم پانێڵە بە ئاسانی بگۆڕیت.
        </div>
      </div>
    </div>

    <!-- Users Table Card -->
    <div class="card" style="padding: 0; overflow: hidden; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div class="table-responsive">
        <table class="table" style="width: 100%; border-collapse: collapse; text-align: right;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 14px 16px; font-weight: 700; color: #475569; font-size: 13px;">#</th>
              <th style="padding: 14px 16px; font-weight: 700; color: #475569; font-size: 13px;">ناوی تەواو</th>
              <th style="padding: 14px 16px; font-weight: 700; color: #475569; font-size: 13px;">ئیمەیڵ (Email)</th>
              <th style="padding: 14px 16px; font-weight: 700; color: #475569; font-size: 13px;">دەسەڵات / ڕۆڵ</th>
              <th style="padding: 14px 16px; font-weight: 700; color: #475569; font-size: 13px;">مۆبایل</th>
              <th style="padding: 14px 16px; font-weight: 700; color: #475569; font-size: 13px;">دۆخی هەژمار</th>
              <th style="padding: 14px 16px; font-weight: 700; color: #475569; font-size: 13px;">دواین چوونەژوورەوە</th>
              <th style="padding: 14px 16px; font-weight: 700; color: #475569; font-size: 13px; text-align: center;">کردارەکان</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="8" style="text-align:center; padding: 36px; color: #64748b;">خەریکی بارکردنە...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-add-user')?.addEventListener('click', () => openCreateUserModal());
  document.getElementById('btn-refresh-users')?.addEventListener('click', () => loadUsersTable());

  await loadUsersTable();
}

async function loadUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: #64748b;">خەریکی هێنانی زانیارییەکانە...</td></tr>`;

  const res = await api.get('/admin/users');
  if (!res.success || !res.data) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: #dc2626;">هەڵە لە وەرگرتنی لیستی بەکارهێنەران</td></tr>`;
    return;
  }

  const users = res.data;
  const currentUser = getUser();

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: #64748b;">هیچ بەکارهێنەرێک نەدۆزرایەوە</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((u, idx) => {
      const isAdminRole = u.role === 'admin' || u.role_id === 1;
      const isCurrentLoggedIn = currentUser && (currentUser.id === u.id || currentUser.email === u.email);
      const isActive = u.status === 'active' || u.is_active === true || u.is_active === 1;
      const lastLoginFormatted = u.last_login 
        ? new Date(u.last_login).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
        : 'تۆمار نەکراوە';

      return `
      <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
        <td style="padding: 14px 16px; color: #64748b; font-size: 13px;">${idx + 1}</td>
        <td style="padding: 14px 16px;">
          <div style="font-weight: 700; color: #0f172a;">${u.full_name || u.name}</div>
          ${isCurrentLoggedIn ? '<span style="display: inline-block; font-size: 11px; color: #2563eb; font-weight: 700; margin-top: 2px;">(هەژماری تۆ)</span>' : ''}
        </td>
        <td style="padding: 14px 16px; direction: ltr; text-align: right; font-family: monospace; font-size: 13px; color: #334155;">
          ${u.email}
        </td>
        <td style="padding: 14px 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${isAdminRole ? 'badge-danger' : 'badge-info'}" style="padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
              ${isAdminRole ? '👑 بەڕێوەبەر (Admin)' : '💳 کاشێر (Cashier)'}
            </span>
            ${
              !isCurrentLoggedIn
                ? `
              <button class="btn-change-role-quick" data-id="${u.id}" data-role-id="${u.role_id || (isAdminRole ? 1 : 2)}" title="گۆڕینی خێرای ڕۆڵ" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: pointer; color: #475569; font-weight: 600;">
                گۆڕین ⇄
              </button>
            `
                : ''
            }
          </div>
        </td>
        <td style="padding: 14px 16px; direction: ltr; text-align: right; color: #475569; font-size: 13px;">${u.phone || '-'}</td>
        <td style="padding: 14px 16px;">
          <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}" style="padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700;">
            ${isActive ? '● چالاک' : '○ ناچالاک'}
          </span>
        </td>
        <td style="padding: 14px 16px; font-size: 12px; color: #64748b; direction: ltr; text-align: right;">${lastLoginFormatted}</td>
        <td style="padding: 14px 16px; text-align: center;">
          <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-sm btn-secondary btn-edit-user" data-id="${u.id}" title="دەستکاریکردنی زانیاری">
              ✏️ دەستکاری
            </button>
            <button class="btn btn-sm btn-outline-warning btn-password-user" data-id="${u.id}" title="گۆڕینی وشەی نهێنی" style="border: 1px solid #f59e0b; color: #d97706; background: #fffbeb; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
              🔑 وشەی نهێنی
            </button>
            ${
              !isCurrentLoggedIn
                ? `
            <button class="btn btn-sm ${isActive ? 'btn-outline-danger' : 'btn-outline-success'} btn-toggle-user" data-id="${u.id}" data-active="${isActive ? 'true' : 'false'}" title="${isActive ? 'ناچالاککردن' : 'چالاککردن'}" style="border: 1px solid ${isActive ? '#fca5a5' : '#86efac'}; color: ${isActive ? '#dc2626' : '#16a34a'}; background: ${isActive ? '#fef2f2' : '#f0fdf4'}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
              ${isActive ? '⛔ ناچالاککردن' : '✅ چالاککردن'}
            </button>
            `
                : ''
            }
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  // Event Listeners for actions
  tbody.querySelectorAll('.btn-edit-user').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uId = Number(btn.dataset.id);
      const user = users.find((u) => u.id === uId);
      if (user) openEditUserModal(user);
    });
  });

  tbody.querySelectorAll('.btn-change-role-quick').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uId = Number(btn.dataset.id);
      const currentRoleId = Number(btn.dataset.roleId);
      const targetRoleId = currentRoleId === 1 ? 2 : 1;
      const targetRoleName = targetRoleId === 1 ? 'بەڕێوەبەر (Admin)' : 'کاشێر (Cashier)';

      if (confirm(`دڵنیایت دەتەوێت دەسەڵاتی ئەم بەکارهێنەرە بگۆڕیت بۆ (${targetRoleName})؟`)) {
        const res = await api.put(`/admin/users/${uId}/role`, { role_id: targetRoleId });
        if (res.success) {
          showToast(res.message || 'ڕۆڵی بەکارهێنەر بە سەرکەوتوویی گۆڕدرا', 'success');
          loadUsersTable();
        } else {
          showToast(res.message || 'هەڵە لە گۆڕینی ڕۆڵ', 'error');
        }
      }
    });
  });

  tbody.querySelectorAll('.btn-password-user').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uId = Number(btn.dataset.id);
      const user = users.find((u) => u.id === uId);
      if (user) openPasswordModal(user);
    });
  });

  tbody.querySelectorAll('.btn-toggle-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uId = Number(btn.dataset.id);
      const currentActive = btn.dataset.active === 'true';
      const newStatus = currentActive ? 'inactive' : 'active';
      const promptText = currentActive 
        ? 'دڵنیایت دەتەوێت ئەم هەژمارە ناچالاک بکەیت؟ بەکارهێنەر ناتوانێت بچێتە ژوورەوە.'
        : 'دڵنیایت دەتەوێت ئەم هەژمارە چالاک بکەیتەوە؟';

      if (confirm(promptText)) {
        const res = await api.put(`/admin/users/${uId}/status`, { status: newStatus });
        if (res.success) {
          showToast(res.message || 'دۆخی هەژمار گۆڕدرا', 'success');
          loadUsersTable();
        } else {
          showToast(res.message || 'هەڵە لە گۆڕینی دۆخی بەکارهێنەر', 'error');
        }
      }
    });
  });
}

function openCreateUserModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 500px; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
        <h3 class="modal-title" style="margin: 0; font-size: 16px; font-weight: 800; color: #ffffff;">زیادکردنی بەکارهێنەری نوێ</h3>
        <button class="modal-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">ناوی تەواو *</label>
          <input type="text" id="cu-name" class="form-control" placeholder="بۆ نموونە: ئارام محەمەد" required />
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">ئیمەیڵ (Email) *</label>
          <input type="email" id="cu-email" class="form-control" placeholder="example@gmail.com" required style="direction: ltr; text-align: left;" />
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">وشەی نهێنی (Password) *</label>
          <div style="position: relative; display: flex; align-items: center;">
            <input type="password" id="cu-password" class="form-control" placeholder="لانی کەم ٤ پیت..." required style="direction: ltr; text-align: left; padding-left: 40px;" />
            <button type="button" id="cu-toggle-pass" style="position: absolute; left: 8px; background: none; border: none; cursor: pointer; color: #64748b; font-size: 16px;">👁️</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">دەسەڵات / ڕۆڵ *</label>
          <select id="cu-role" class="form-control" style="font-weight: 600;">
            <option value="2">💳 کاشێر (Cashier - تەنها فرۆشتن، کڕین و پسووڵە)</option>
            <option value="1">👑 بەڕێوەبەر (Admin - دەسەڵاتی تەواوی سیستەم و ڕاپۆرتەکان)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">ژمارەی مۆبایل</label>
          <input type="text" id="cu-phone" class="form-control" placeholder="0750xxxxxxx" style="direction: ltr; text-align: left;" />
        </div>

        <div class="form-group" style="margin-bottom: 8px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">دۆخی دەستپێک</label>
          <select id="cu-status" class="form-control" style="font-weight: 600;">
            <option value="active">● چالاک (ڕێگەپێدراو بۆ چوونەژوورەوە)</option>
            <option value="inactive">○ ناچالاک (ڕاگیراو)</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn btn-secondary mu-cancel" style="font-weight: 600;">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="cu-save-btn" style="font-weight: 700;">تۆمارکردنی بەکارهێنەر</button>
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

  const passInput = modal.querySelector('#cu-password');
  const toggleBtn = modal.querySelector('#cu-toggle-pass');
  toggleBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
      passInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });

  modal.querySelector('#cu-save-btn').addEventListener('click', async () => {
    const full_name = modal.querySelector('#cu-name').value.trim();
    const email = modal.querySelector('#cu-email').value.trim();
    const password = passInput.value;
    const role_id = Number(modal.querySelector('#cu-role').value);
    const phone = modal.querySelector('#cu-phone').value.trim();
    const status = modal.querySelector('#cu-status').value;

    if (!full_name || !email || !password) {
      showToast('تکایە سەرجەم خانە پێویستەکان پڕبکەرەوە', 'error');
      return;
    }

    if (!email.includes('@')) {
      showToast('تکایە ئیمەیڵێکی دروست بنووسە', 'error');
      return;
    }

    if (password.length < 4) {
      showToast('وشەی نهێنی دەبێت لانیکەم ٤ پیت بێت', 'error');
      return;
    }

    const saveBtn = modal.querySelector('#cu-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'خەریکی تۆمارکردنە...';

    const res = await api.post('/admin/users', {
      full_name,
      name: full_name,
      email,
      password,
      role_id,
      phone: phone || null,
      status,
    });

    if (res.success) {
      showToast(res.message || 'بەکارهێنەر بە سەرکەوتوویی زیادکرا', 'success');
      closeModal();
      loadUsersTable();
    } else {
      showToast(res.message || 'هەڵە لە دروستکردنی بەکارهێنەر', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'تۆمارکردنی بەکارهێنەر';
    }
  });
}

function openEditUserModal(user) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  const currentRoleId = user.role_id || (user.role === 'admin' ? 1 : 2);
  const isActive = user.status === 'active' || user.is_active === true || user.is_active === 1;

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 500px; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
        <h3 class="modal-title" style="margin: 0; font-size: 16px; font-weight: 800; color: #ffffff;">دەستکاریکردنی بەکارهێنەر</h3>
        <button class="modal-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">ناوی تەواو *</label>
          <input type="text" id="eu-name" class="form-control" value="${user.full_name || user.name || ''}" required />
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">ئیمەیڵ (Email) *</label>
          <input type="email" id="eu-email" class="form-control" value="${user.email || ''}" required style="direction: ltr; text-align: left;" />
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">دەسەڵات / ڕۆڵ *</label>
          <select id="eu-role" class="form-control" style="font-weight: 600;">
            <option value="2" ${currentRoleId === 2 ? 'selected' : ''}>💳 کاشێر (Cashier - تەنها فرۆشتن، کڕین و پسووڵە)</option>
            <option value="1" ${currentRoleId === 1 ? 'selected' : ''}>👑 بەڕێوەبەر (Admin - دەسەڵاتی تەواوی سیستەم و ڕاپۆرتەکان)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">ژمارەی مۆبایل</label>
          <input type="text" id="eu-phone" class="form-control" value="${user.phone || ''}" placeholder="0750xxxxxxx" style="direction: ltr; text-align: left;" />
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">دۆخی هەژمار</label>
          <select id="eu-status" class="form-control" style="font-weight: 600;">
            <option value="active" ${isActive ? 'selected' : ''}>● چالاک (Active)</option>
            <option value="inactive" ${!isActive ? 'selected' : ''}>○ ناچالاک (Inactive)</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn btn-secondary mu-cancel" style="font-weight: 600;">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="eu-save-btn" style="font-weight: 700;">پاشەکەوتکردنی گۆڕانکارییەکان</button>
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

  modal.querySelector('#eu-save-btn').addEventListener('click', async () => {
    const full_name = modal.querySelector('#eu-name').value.trim();
    const email = modal.querySelector('#eu-email').value.trim();
    const role_id = Number(modal.querySelector('#eu-role').value);
    const phone = modal.querySelector('#eu-phone').value.trim();
    const status = modal.querySelector('#eu-status').value;

    if (!full_name || !email) {
      showToast('تکایە سەرجەم خانە پێویستەکان پڕبکەرەوە', 'error');
      return;
    }

    if (!email.includes('@')) {
      showToast('تکایە ئیمەیڵێکی دروست بنووسە', 'error');
      return;
    }

    const saveBtn = modal.querySelector('#eu-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'خەریکی پاشەکەوتکردنە...';

    const res = await api.put(`/admin/users/${user.id}`, {
      full_name,
      name: full_name,
      email,
      role_id,
      phone: phone || null,
      status,
      is_active: status === 'active' ? 1 : 0,
    });

    if (res.success) {
      showToast(res.message || 'زانیاری بەکارهێنەر نوێکرایەوە', 'success');
      closeModal();
      loadUsersTable();
    } else {
      showToast(res.message || 'هەڵە لە نوێکردنەوەی بەکارهێنەر', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'پاشەکەوتکردنی گۆڕانکارییەکان';
    }
  });
}

function openPasswordModal(user) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop show';

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 440px; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
      <div class="modal-header" style="background: #0f172a; color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
        <h3 class="modal-title" style="margin: 0; font-size: 16px; font-weight: 800; color: #ffffff;">گۆڕینی وشەی نهێنی (${user.full_name || user.name})</h3>
        <button class="modal-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="font-size: 13px; color: #64748b; margin-bottom: 16px;">
          ئیمەیڵ: <strong style="direction: ltr; display: inline-block; color: #0f172a;">${user.email}</strong>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: block;">وشەی نهێنی نوێ *</label>
          <div style="position: relative; display: flex; align-items: center;">
            <input type="password" id="pu-password" class="form-control" placeholder="لانی کەم ٤ پیت بنووسە..." required style="direction: ltr; text-align: left; padding-left: 40px;" />
            <button type="button" id="pu-toggle-pass" style="position: absolute; left: 8px; background: none; border: none; cursor: pointer; color: #64748b; font-size: 16px;">👁️</button>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn btn-secondary mu-cancel" style="font-weight: 600;">پاشگەزبوونەوە</button>
        <button class="btn btn-primary" id="pu-save-btn" style="font-weight: 700; background: #d97706; border-color: #d97706;">گۆڕینی وشەی نهێنی</button>
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

  const passInput = modal.querySelector('#pu-password');
  const toggleBtn = modal.querySelector('#pu-toggle-pass');
  toggleBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
      passInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });

  modal.querySelector('#pu-save-btn').addEventListener('click', async () => {
    const password = passInput.value;
    if (!password || password.length < 4) {
      showToast('وشەی نهێنی دەبێت لانیکەم ٤ پیت بێت', 'error');
      return;
    }

    const saveBtn = modal.querySelector('#pu-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'خەریکی گۆڕینە...';

    const res = await api.put(`/admin/users/${user.id}/password`, { password });
    if (res.success) {
      showToast(res.message || 'وشەی نهێنی بە سەرکەوتوویی گۆڕدرا', 'success');
      closeModal();
    } else {
      showToast(res.message || 'هەڵە لە گۆڕینی وشەی نهێنی', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'گۆڕینی وشەی نهێنی';
    }
  });
}

