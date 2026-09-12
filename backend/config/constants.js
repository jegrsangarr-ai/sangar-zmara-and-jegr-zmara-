/**
 * System Constants for سەنگەر زمارەیی و جێگر زمارەیی
 */
export const JWT_SECRET = process.env.JWT_SECRET || 'szjz_truck_parts_secret_jwt_key_erbil_2026';
export const JWT_EXPIRES_IN = '7d';

export const BUSINESS_INFO = {
  name: 'سەنگەر زمارەیی و جێگر زمارەیی',
  subtitle: 'بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و چاککردنەوە',
  city: 'هەولێر',
  country: 'عێراق - هەرێمی کوردستان',
  address: 'هەولێر - ناوچەی پیشەسازی باکوور - شەقامی سەرەکی',
  jegrPhone: '07503149696',
  sangarPhone1: '07504687412',
  sangarPhone2: '07804457301',
  currency: 'د.ع',
  googleMapsUrl: 'https://maps.google.com/?q=Erbil+Industrial+Zone+North',
};

export const ROLES = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
};
