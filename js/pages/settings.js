/**
 * System Settings & Business Profile Module
 */
import { api, showToast } from '../api.js';

export async function initSettingsPage() {
  const container = document.getElementById('page-container');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">ڕێکخستنەکانی سیستەم و زانیاری فرۆشگا</h2>
        <div class="section-subtitle">دەستکاریکردنی ناوی دووکان، ژمارەی مۆبایلەکان، ناونیشان، چاپکردنی پسووڵە و باکەپی داتابەیس</div>
      </div>
      <div>
        <button class="btn btn-primary" id="btn-save-all-settings">💾 پاشەکەوتکردنی هەموو ڕێکخستنەکان</button>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px;">
      <!-- Shop Details Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🏪 زانیاری و پرۆفایلی فرۆشگا</h3>
        </div>

        <div class="form-group">
          <label class="form-label">ناوی فرۆشگا (سەر پسووڵە) *</label>
          <input type="text" id="set-shop-name" class="form-control" placeholder="سەنگەر زمارەیی و جێگر زمارەیی" />
        </div>

        <div class="form-group">
          <label class="form-label">وەسف و کار / ژێرناوی فرۆشگا</label>
          <input type="text" id="set-shop-sub" class="form-control" placeholder="بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و چاککردنەوە" />
        </div>

        <div class="form-group">
          <label class="form-label">ژمارەی مۆبایلی جێگر *</label>
          <input type="text" id="set-phone-jegr" class="form-control" placeholder="07503149696" />
        </div>

        <div class="form-row">
          <div class="form-col">
            <label class="form-label">ژمارەی مۆبایلی سەنگەر (١) *</label>
            <input type="text" id="set-phone-sangar1" class="form-control" placeholder="07504687412" />
          </div>
          <div class="form-col">
            <label class="form-label">ژمارەی مۆبایلی سەنگەر (٢)</label>
            <input type="text" id="set-phone-sangar2" class="form-control" placeholder="07804457301" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">ناونیشانی تەواو</label>
          <input type="text" id="set-address" class="form-control" placeholder="هەولێر - ناوچەی پیشەسازی باکوور - شەقامی سەرەکی" />
        </div>

        <div class="form-group">
          <label class="form-label">بەستەری نەخشەی گووگڵ (Google Maps URL)</label>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="set-maps-url" class="form-control" placeholder="https://maps.google.com/..." />
            <a href="#" target="_blank" id="btn-test-maps" class="btn btn-secondary" title="کردنەوە لە نەخشە">📍 بینین</a>
          </div>
        </div>
      </div>

      <!-- POS & System Configuration Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">⚙️ ڕێکخستنەکانی سندووق و مەخزەن</h3>
        </div>

        <div class="form-group">
          <label class="form-label">دروشمی ژێرەوەی پسووڵە (Footer Text)</label>
          <input type="text" id="set-receipt-footer" class="form-control" placeholder="سوپاس بۆ مامەڵەکردنتان لەگەڵمان" />
        </div>

        <div class="form-group">
          <label class="form-label">قەبارەی بنەڕەتی چاپی پسووڵە</label>
          <select id="set-printer-size" class="form-control">
            <option value="80mm">چاپی گەرمی بچووک (80mm Thermal Receipt)</option>
            <option value="a4">وەسڵی گەورەی کاغەز (A4 Invoice)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">کەمترین ئاستی ئاگادارکردنەوەی کۆگا (بنەڕەت)</label>
          <input type="number" id="set-low-threshold" class="form-control" value="3" min="1" />
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer;">
            <input type="checkbox" id="set-allow-neg" />
            <span>ڕێگەدان بە فرۆشتنی کاڵایەک کاتێک بڕەکەی لە مەخزەن سفرە (Allow Negative Stock)</span>
          </label>
        </div>

        <!-- Database Backup Section -->
        <div style="margin-top: 24px; border-top: 1px dashed var(--border-color); padding-top: 18px;">
          <h4 style="font-size: 15px; margin-bottom: 8px;">💾 پاراستن و باکئەپی داتابەیس (Local shop.db Backup)</h4>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
            دەتوانیت هەر کاتێک بتەوێت کۆپییەکی پارێزراوی تەواوی بنکەی زانیاری (data/shop.db) دروست بکەیت و لەسەر فلاش یان کۆمپیوتەر بیپارێزیت.
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
            <button class="btn btn-primary" id="btn-create-local-backup">
              💾 دروستکردنی باکئەپی نوێ (Create .db Backup)
            </button>
            <button class="btn btn-outline" id="btn-download-backup">
              📥 دابەزاندنی باکئەپی JSON
            </button>
          </div>
          <div id="backup-list-container" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px;">
            <div style="font-weight: 700; margin-bottom: 6px; color: #334155;">📁 دوایین باکئەپەکان لە فۆڵدەری backups/:</div>
            <div id="backup-list-items" style="color: #64748b;">خەریکی پشکنینی باکئەپەکانە...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save-all-settings')?.addEventListener('click', () => saveSettings());
  document.getElementById('btn-create-local-backup')?.addEventListener('click', () => createLocalBackup());
  document.getElementById('btn-download-backup')?.addEventListener('click', () => downloadBackup());

  await loadSettingsValues();
  await loadBackupList();
}

async function loadSettingsValues() {
  const res = await api.get('/settings');
  if (!res.success || !res.data) {
    showToast('هەڵە لە وەرگرتنی ڕێکخستنەکان', 'error');
    return;
  }

  const s = res.data;

  const setValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setValue('set-shop-name', s.shop_name || 'سەنگەر زمارەیی و جێگر زمارەیی');
  setValue('set-shop-sub', s.shop_subtitle || 'بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و چاککردنەوە');
  setValue('set-phone-jegr', s.phone_jegr || '07503149696');
  setValue('set-phone-sangar1', s.phone_sangar_1 || '07504687412');
  setValue('set-phone-sangar2', s.phone_sangar_2 || '07804457301');
  setValue('set-address', s.address || 'هەولێر - ناوچەی پیشەسازی باکوور - شەقامی سەرەکی');
  setValue('set-maps-url', s.google_maps_url || 'https://maps.google.com/?q=Erbil+Industrial+Zone+North');
  setValue('set-receipt-footer', s.receipt_footer || 'سوپاس بۆ مامەڵەکردنتان لەگەڵمان - سەنگەر زمارەیی و جێگر زمارەیی');
  setValue('set-printer-size', s.default_printer_size || '80mm');
  setValue('set-low-threshold', s.low_stock_threshold || '3');

  const negCheck = document.getElementById('set-allow-neg');
  if (negCheck) negCheck.checked = s.allow_negative_stock === '1';

  const mapsBtn = document.getElementById('btn-test-maps');
  if (mapsBtn && s.google_maps_url) {
    mapsBtn.href = s.google_maps_url;
  }
}

async function saveSettings() {
  const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

  const payload = {
    shop_name: getValue('set-shop-name'),
    shop_subtitle: getValue('set-shop-sub'),
    phone_jegr: getValue('set-phone-jegr'),
    phone_sangar_1: getValue('set-phone-sangar1'),
    phone_sangar_2: getValue('set-phone-sangar2'),
    address: getValue('set-address'),
    google_maps_url: getValue('set-maps-url'),
    receipt_footer: getValue('set-receipt-footer'),
    default_printer_size: getValue('set-printer-size'),
    low_stock_threshold: getValue('set-low-threshold'),
    allow_negative_stock: document.getElementById('set-allow-neg')?.checked ? '1' : '0',
  };

  const res = await api.put('/settings', payload);
  if (res.success) {
    showToast('ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوت کران ✓', 'success');
  } else {
    showToast(res.message || 'هەڵە لە پاشەکەوتکردنی ڕێکخستنەکان', 'error');
  }
}

async function loadBackupList() {
  const container = document.getElementById('backup-list-items');
  if (!container) return;

  const res = await api.get('/backup/list');
  if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
    container.innerHTML = '<span style="color: #94a3b8;">هیچ باکئەپێک لە فۆڵدەری backups/ نەدۆزرایەوە. دەتوانیت لەسەرەوە باکئەپی نوێ دروستبکەیت.</span>';
    return;
  }

  container.innerHTML = res.data.slice(0, 6).map(b => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
      <div>
        <strong style="color: #0f172a; direction: ltr; display: inline-block;">${b.filename}</strong>
        <span style="font-size: 11px; color: #64748b; margin-right: 8px;">(${b.size_formatted} - ${new Date(b.created_at).toLocaleDateString('ku')})</span>
      </div>
      <div style="display: flex; gap: 6px;">
        <a href="/api/backup/download/${b.filename}?token=${localStorage.getItem('szjz_token')}" download class="btn btn-sm btn-secondary" style="font-size: 11px; padding: 3px 8px;">📥 دابەزاندن</a>
      </div>
    </div>
  `).join('');
}

async function createLocalBackup() {
  showToast('خەریکی دروستکردنی باکئەپی نوێیە...', 'info');
  const res = await api.post('/backup/create', {});
  if (res.success) {
    showToast(res.message || 'باکئەپ بە سەرکەوتوویی دروستکرا ✓', 'success');
    await loadBackupList();
  } else {
    showToast(res.message || 'هەڵە لە دروستکردنی باکئەپ', 'error');
  }
}

async function downloadBackup() {
  showToast('خەریکی ئامادەکردنی باکەپە...', 'info');
  window.open('/api/backup/export?token=' + localStorage.getItem('szjz_token'), '_blank');
}
