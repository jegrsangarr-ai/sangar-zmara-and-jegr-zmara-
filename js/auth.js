/**
 * Authentication Module
 * سەنگەر زمارەیی و جێگر زمارەیی - Local SQLite Auth Integration
 */
import { api, showToast } from './api.js';

export function getToken() {
  return localStorage.getItem('szjz_token');
}

export function getUser() {
  const userStr = localStorage.getItem('szjz_user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

export function setUser(user) {
  if (user) {
    localStorage.setItem('szjz_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('szjz_user');
  }
}

export function isAdmin() {
  const user = getUser();
  return user && (user.role === 'admin' || user.role_id === 1);
}

export function isCashier() {
  const user = getUser();
  return user && (user.role === 'cashier' || user.role_id === 2);
}

export async function checkAuth() {
  const token = getToken();
  if (!token) {
    if (!window.location.pathname.includes('login')) {
      window.location.href = '/login.html';
    }
    return false;
  }

  try {
    const res = await api.get('/auth/me');
    const user = res.data || res.user;
    if (res.success && user) {
      if (user.status === 'inactive' || user.is_active === false) {
        showToast('هەژمارەکەت ناچالاککراوە. پەیوەندی بە بەڕێوەبەرەوە بکە.', 'error');
        logout();
        return false;
      }
      setUser(user);
      return user;
    } else {
      localStorage.removeItem('szjz_token');
      localStorage.removeItem('szjz_user');
      if (!window.location.pathname.includes('login')) {
        window.location.href = '/login.html';
      }
      return false;
    }
  } catch (err) {
    console.error('Check auth error:', err);
    // If offline or network glitch, fall back to cached user temporarily
    const cached = getUser();
    if (cached) return cached;
    return false;
  }
}

export async function changeUserPassword(currentPassword, newPassword) {
  const res = await api.put('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
    password: newPassword,
  });
  return res;
}

export async function changeUserEmail(newEmail, password) {
  const res = await api.put('/auth/change-email', {
    new_email: newEmail,
    email: newEmail,
    password,
  });
  return res;
}

export function logout() {
  localStorage.removeItem('szjz_token');
  localStorage.removeItem('szjz_user');
  showToast('بە سەرکەوتوویی چوویتە دەرەوە', 'success');
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 400);
}

