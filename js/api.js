/**
 * API Client Module for سەنگەر زمارەیی و جێگر زمارەیی
 */

const API_BASE = '/api';

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `${Math.round(num).toLocaleString('en-US')} د.ع`;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getErbilToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch (e) {
    const d = new Date();
    const local = new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60000);
    return local.toISOString().split('T')[0];
  }
}

export function getErbilTimeString() {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Baghdad',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch (e) {
    const d = new Date();
    const local = new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60000);
    return local.toTimeString().split(' ')[0];
  }
}

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('szjz_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/settings/public')) {
        localStorage.removeItem('szjz_token');
        localStorage.removeItem('szjz_user');
        window.location.href = '/login.html';
        return { success: false, status: 401, message: 'تکایە سەرەتا بچۆ ژوورەوە' };
      }
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = { success: res.ok };
    }

    if (res.status === 403) {
      return { success: false, status: 403, message: data?.message || 'تەنها بەڕێوەبەر دەسەڵاتی ئەم بەشەی هەیە' };
    }

    return data;
  } catch (err) {
    console.error('API Request error:', err);
    return { success: false, message: 'هەڵە لە پەیوەندیکردن بە سێرڤەرەوە' };
  }
}

export const api = {
  get: (url) => request(url, { method: 'GET' }),
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => request(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => request(url, { method: 'DELETE' }),
};
