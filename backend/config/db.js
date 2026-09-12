/**
 * 100% Offline SQLite Database Engine
 * سەنگەر زمارەیی و جێگر زمارەیی - POS System
 * 
 * Primary Offline Database: ./data/shop.db
 * Configured with:
 * - PRAGMA journal_mode = WAL;
 * - PRAGMA foreign_keys = ON;
 * - PRAGMA busy_timeout = 5000;
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sqliteDbInstance = null;

/**
 * Initialize SQLite Database with complete POS schema and helper functions
 */
export function getSqliteDb() {
  if (sqliteDbInstance) {
    return sqliteDbInstance;
  }

  const dataDir = path.join(process.cwd(), 'data');
  const backupDir = path.join(process.cwd(), 'backups');
  const logsDir = path.join(process.cwd(), 'logs');

  [dataDir, backupDir, logsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const shopDbPath = path.join(dataDir, 'shop.db');

  sqliteDbInstance = new Database(shopDbPath);
  sqliteDbInstance.pragma('journal_mode = WAL');
  sqliteDbInstance.pragma('foreign_keys = ON');
  sqliteDbInstance.pragma('busy_timeout = 5000');

  // Register custom functions in SQLite
  sqliteDbInstance.function('NOW', () => new Date().toISOString());
  sqliteDbInstance.function('now', () => new Date().toISOString());
  sqliteDbInstance.function('GREATEST', { varargs: true }, (...args) => {
    const nums = args.map(Number).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  });
  sqliteDbInstance.function('greatest', { varargs: true }, (...args) => {
    const nums = args.map(Number).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  });
  sqliteDbInstance.function('LEAST', { varargs: true }, (...args) => {
    const nums = args.map(Number).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.min(...nums) : 0;
  });
  sqliteDbInstance.function('least', { varargs: true }, (...args) => {
    const nums = args.map(Number).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.min(...nums) : 0;
  });
  sqliteDbInstance.function('CONCAT', { varargs: true }, (...args) => args.join(''));
  sqliteDbInstance.function('concat', { varargs: true }, (...args) => args.join(''));
  sqliteDbInstance.function('SPLIT_PART', (str, delimiter, pos) => {
    if (!str) return '';
    const parts = String(str).split(delimiter);
    return parts[pos - 1] || '';
  });
  sqliteDbInstance.function('split_part', (str, delimiter, pos) => {
    if (!str) return '';
    const parts = String(str).split(delimiter);
    return parts[pos - 1] || '';
  });

  // Ensure baseline tables exist in SQLite
  sqliteDbInstance.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO roles (id, name, display_name, description) VALUES
    (1, 'admin', 'بەڕێوەبەر', 'دەسەڵاتی تەواو بەسەر هەموو بەشەکانی سیستەمدا'),
    (2, 'cashier', 'کاشێر', 'دەسەڵاتی فرۆشتن، پسووڵە، کڕیار و بینینی کات و مێژووی فرۆشتن');

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_user_id TEXT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'active',
      phone TEXT,
      last_login TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT,
      password TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      country TEXT,
      is_truck_brand INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      total_purchases INTEGER DEFAULT 0,
      total_paid INTEGER DEFAULT 0,
      balance_debt INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      total_spent INTEGER DEFAULT 0,
      total_paid INTEGER DEFAULT 0,
      current_debt INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT,
      sku TEXT,
      part_number TEXT,
      oem_number TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
      truck_brand TEXT,
      truck_model TEXT,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      purchase_price INTEGER NOT NULL DEFAULT 0,
      selling_price INTEGER NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_stock_level INTEGER NOT NULL DEFAULT 3,
      storage_location TEXT,
      description TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      total_cost INTEGER NOT NULL DEFAULT 0,
      gross_profit INTEGER NOT NULL DEFAULT 0,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      debt_amount INTEGER NOT NULL DEFAULT 0,
      change_amount INTEGER NOT NULL DEFAULT 0,
      payment_type TEXT NOT NULL DEFAULT 'cash',
      status TEXT NOT NULL DEFAULT 'completed',
      notes TEXT,
      sale_date TEXT NOT NULL,
      sale_time TEXT NOT NULL,
      customer_type TEXT DEFAULT 'individual',
      company_id INTEGER,
      company_driver_id INTEGER,
      company_vehicle_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      part_number TEXT,
      quantity INTEGER NOT NULL,
      returned_quantity INTEGER NOT NULL DEFAULT 0,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      unit_price INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL DEFAULT 0,
      total_cost INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      total_amount INTEGER NOT NULL DEFAULT 0,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      debt_amount INTEGER NOT NULL DEFAULT 0,
      purchase_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      item_name TEXT,
      part_number TEXT,
      quantity INTEGER NOT NULL,
      purchase_price INTEGER NOT NULL,
      selling_price INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity_change INTEGER NOT NULL,
      stock_after INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
      original_amount INTEGER NOT NULL,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      remaining_balance INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_debt_id INTEGER REFERENCES customer_debts(id) ON DELETE SET NULL,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      previous_balance INTEGER NOT NULL,
      new_balance INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
      amount INTEGER NOT NULL,
      previous_balance INTEGER NOT NULL,
      new_balance INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT NOT NULL UNIQUE,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      total_refund INTEGER NOT NULL DEFAULT 0,
      return_date TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL,
      refund_amount INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
      purchase_item_id INTEGER REFERENCES purchase_items(id) ON DELETE SET NULL,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      batch_type TEXT NOT NULL DEFAULT 'PURCHASE',
      batch_number TEXT,
      original_quantity INTEGER NOT NULL,
      remaining_quantity INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      purchase_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_item_cost_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_id INTEGER NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      total_cost INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_return_cost_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      return_item_id INTEGER NOT NULL REFERENCES return_items(id) ON DELETE CASCADE,
      sale_item_cost_allocation_id INTEGER REFERENCES sale_item_cost_allocations(id) ON DELETE SET NULL,
      batch_id INTEGER NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      total_cost INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key_name TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_name TEXT,
      phone TEXT,
      phone2 TEXT,
      address TEXT,
      notes TEXT,
      total_purchases INTEGER DEFAULT 0,
      total_paid INTEGER DEFAULT 0,
      current_debt INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      plate_number TEXT,
      vehicle_number TEXT,
      truck_brand TEXT,
      truck_model TEXT,
      driver_id INTEGER,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
      driver_id INTEGER REFERENCES company_drivers(id) ON DELETE SET NULL,
      vehicle_id INTEGER REFERENCES company_vehicles(id) ON DELETE SET NULL,
      original_amount INTEGER NOT NULL,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      remaining_balance INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_debt_id INTEGER REFERENCES company_debts(id) ON DELETE SET NULL,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      driver_id INTEGER REFERENCES company_drivers(id) ON DELETE SET NULL,
      vehicle_id INTEGER REFERENCES company_vehicles(id) ON DELETE SET NULL,
      amount INTEGER NOT NULL,
      previous_balance INTEGER NOT NULL,
      new_balance INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cash_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'قاسەی سەرەکی',
      opening_balance INTEGER NOT NULL DEFAULT 0,
      current_balance INTEGER NOT NULL DEFAULT 0,
      account_type TEXT NOT NULL DEFAULT 'drawer',
      currency TEXT NOT NULL DEFAULT 'IQD',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cash_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cash_account_id INTEGER NOT NULL DEFAULT 1 REFERENCES cash_accounts(id) ON DELETE RESTRICT,
      account_id INTEGER DEFAULT 1 REFERENCES cash_accounts(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      session_date TEXT,
      opening_balance INTEGER NOT NULL DEFAULT 0,
      closing_balance INTEGER,
      closing_balance_expected INTEGER,
      closing_balance_actual INTEGER,
      expected_balance INTEGER,
      difference INTEGER DEFAULT 0,
      difference_amount INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN',
      opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cash_account_id INTEGER NOT NULL DEFAULT 1 REFERENCES cash_accounts(id) ON DELETE RESTRICT,
      account_id INTEGER DEFAULT 1 REFERENCES cash_accounts(id) ON DELETE RESTRICT,
      cash_session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
      session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      transaction_type TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'IN',
      amount INTEGER NOT NULL CHECK (amount > 0),
      balance_before INTEGER DEFAULT 0,
      balance_after INTEGER NOT NULL DEFAULT 0,
      reference_type TEXT,
      reference_id INTEGER,
      description TEXT,
      notes TEXT,
      is_reversal INTEGER DEFAULT 0,
      reversal_of_id INTEGER REFERENCES cash_transactions(id) ON DELETE SET NULL,
      backfilled INTEGER DEFAULT 0,
      transaction_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Helper to add column safely to SQLite table
  const ensureColumn = (tbl, col, def) => {
    try {
      const cols = sqliteDbInstance.prepare(`PRAGMA table_info(${tbl})`).all().map((c) => c.name.toLowerCase());
      if (!cols.includes(col.toLowerCase())) {
        sqliteDbInstance.prepare(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`).run();
      }
    } catch (_) {}
  };

  // Ensure all necessary cash columns exist on legacy tables
  ensureColumn('cash_accounts', 'opening_balance', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('company_debts', 'remaining_amount', 'INTEGER DEFAULT 0');
  ensureColumn('company_debts', 'remaining_balance', 'INTEGER DEFAULT 0');
  try {
    sqliteDbInstance.prepare(`
      UPDATE company_debts 
      SET remaining_amount = COALESCE(remaining_balance, original_amount - paid_amount) 
      WHERE remaining_amount IS NULL OR remaining_amount = 0
    `).run();
  } catch (_) {}

  // Safely migrate legacy cash_sessions table if it has restrictive constraints
  try {
    const sessCols = sqliteDbInstance.prepare("PRAGMA table_info(cash_sessions)").all();
    const accountIdCol = sessCols.find((c) => c.name.toLowerCase() === 'account_id');
    if (accountIdCol && accountIdCol.notnull === 1) {
      sqliteDbInstance.exec(`
        CREATE TABLE IF NOT EXISTS _new_cash_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cash_account_id INTEGER NOT NULL DEFAULT 1 REFERENCES cash_accounts(id) ON DELETE RESTRICT,
          account_id INTEGER DEFAULT 1 REFERENCES cash_accounts(id) ON DELETE RESTRICT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          session_date TEXT,
          opening_balance INTEGER NOT NULL DEFAULT 0,
          closing_balance INTEGER,
          closing_balance_expected INTEGER,
          closing_balance_actual INTEGER,
          expected_balance INTEGER,
          difference INTEGER DEFAULT 0,
          difference_amount INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'OPEN',
          opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
          closed_at TEXT,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO _new_cash_sessions (
          id, cash_account_id, account_id, user_id, session_date, opening_balance,
          closing_balance, closing_balance_expected, closing_balance_actual, expected_balance,
          difference, difference_amount, status, opened_at, closed_at, notes, created_at
        )
        SELECT
          id, COALESCE(cash_account_id, account_id, 1), COALESCE(account_id, cash_account_id, 1),
          user_id, session_date, COALESCE(opening_balance, 0), closing_balance,
          closing_balance_expected, closing_balance_actual, expected_balance,
          COALESCE(difference, 0), COALESCE(difference_amount, 0), COALESCE(status, 'OPEN'),
          opened_at, closed_at, notes, COALESCE(created_at, opened_at)
        FROM cash_sessions;
        DROP TABLE cash_sessions;
        ALTER TABLE _new_cash_sessions RENAME TO cash_sessions;
      `);
    }
  } catch (_) {}

  // Safely migrate legacy cash_transactions table if it has restrictive constraints
  try {
    const txCols = sqliteDbInstance.prepare("PRAGMA table_info(cash_transactions)").all();
    const accountIdCol = txCols.find((c) => c.name.toLowerCase() === 'account_id');
    if (accountIdCol && accountIdCol.notnull === 1) {
      sqliteDbInstance.exec(`
        CREATE TABLE IF NOT EXISTS _new_cash_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cash_account_id INTEGER NOT NULL DEFAULT 1 REFERENCES cash_accounts(id) ON DELETE RESTRICT,
          account_id INTEGER DEFAULT 1 REFERENCES cash_accounts(id) ON DELETE RESTRICT,
          cash_session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
          session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
          transaction_type TEXT NOT NULL,
          direction TEXT NOT NULL DEFAULT 'IN',
          amount INTEGER NOT NULL CHECK (amount > 0),
          balance_before INTEGER DEFAULT 0,
          balance_after INTEGER NOT NULL DEFAULT 0,
          reference_type TEXT,
          reference_id INTEGER,
          description TEXT,
          notes TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          is_reversal INTEGER DEFAULT 0,
          reversal_of_id INTEGER REFERENCES cash_transactions(id) ON DELETE SET NULL,
          backfilled INTEGER DEFAULT 0,
          transaction_date TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO _new_cash_transactions (
          id, cash_account_id, account_id, cash_session_id, session_id,
          transaction_type, direction, amount, balance_before, balance_after,
          reference_type, reference_id, description, notes, user_id,
          is_reversal, reversal_of_id, backfilled, transaction_date, created_at
        )
        SELECT 
          id, COALESCE(cash_account_id, account_id, 1), COALESCE(account_id, cash_account_id, 1),
          cash_session_id, session_id, transaction_type, COALESCE(direction, 'IN'), amount,
          COALESCE(balance_before, 0), COALESCE(balance_after, 0), reference_type, reference_id,
          description, notes, user_id, COALESCE(is_reversal, 0), reversal_of_id, COALESCE(backfilled, 0),
          transaction_date, created_at
        FROM cash_transactions;
        DROP TABLE cash_transactions;
        ALTER TABLE _new_cash_transactions RENAME TO cash_transactions;
      `);
    }
  } catch (_) {}

  ensureColumn('cash_sessions', 'cash_account_id', 'INTEGER DEFAULT 1');
  ensureColumn('cash_sessions', 'account_id', 'INTEGER DEFAULT 1');
  ensureColumn('cash_sessions', 'closing_balance_expected', 'INTEGER');
  ensureColumn('cash_sessions', 'closing_balance_actual', 'INTEGER');
  ensureColumn('cash_sessions', 'difference', 'INTEGER DEFAULT 0');
  ensureColumn('cash_sessions', 'difference_amount', 'INTEGER DEFAULT 0');
  ensureColumn('cash_sessions', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');

  ensureColumn('cash_transactions', 'cash_account_id', 'INTEGER DEFAULT 1');
  ensureColumn('cash_transactions', 'account_id', 'INTEGER DEFAULT 1');
  ensureColumn('cash_transactions', 'cash_session_id', 'INTEGER');
  ensureColumn('cash_transactions', 'session_id', 'INTEGER');
  ensureColumn('cash_transactions', 'direction', "TEXT NOT NULL DEFAULT 'IN'");
  ensureColumn('cash_transactions', 'description', 'TEXT');
  ensureColumn('cash_transactions', 'notes', 'TEXT');
  ensureColumn('cash_transactions', 'is_reversal', 'INTEGER DEFAULT 0');
  ensureColumn('cash_transactions', 'reversal_of_id', 'INTEGER');
  ensureColumn('cash_transactions', 'backfilled', 'INTEGER DEFAULT 0');

  // Ensure company_debt_payments columns exist
  ensureColumn('company_debt_payments', 'received_by', 'INTEGER REFERENCES users(id)');
  ensureColumn('company_debt_payments', 'cash_account_id', 'INTEGER DEFAULT 1');
  ensureColumn('company_debt_payments', 'user_id', 'INTEGER REFERENCES users(id)');

  // Ensure customer snapshots and driver/vehicle link columns exist
  ensureColumn('sales', 'customer_display_name', 'TEXT');
  ensureColumn('sales', 'customer_phone_snapshot', 'TEXT');
  ensureColumn('company_drivers', 'vehicle_id', 'INTEGER REFERENCES company_vehicles(id)');
  ensureColumn('company_vehicles', 'driver_id', 'INTEGER REFERENCES company_drivers(id)');

  // Sync dual column names if one is populated and the other is null
  try {
    sqliteDbInstance.prepare("UPDATE cash_transactions SET cash_account_id = COALESCE(cash_account_id, account_id, 1), account_id = COALESCE(account_id, cash_account_id, 1)").run();
    sqliteDbInstance.prepare("UPDATE cash_transactions SET cash_session_id = COALESCE(cash_session_id, session_id), session_id = COALESCE(session_id, cash_session_id)").run();
    sqliteDbInstance.prepare("UPDATE cash_transactions SET description = COALESCE(description, notes), notes = COALESCE(notes, description)").run();
    sqliteDbInstance.prepare("UPDATE cash_sessions SET cash_account_id = COALESCE(cash_account_id, account_id, 1), account_id = COALESCE(account_id, cash_account_id, 1)").run();
    sqliteDbInstance.prepare("UPDATE company_debt_payments SET received_by = COALESCE(received_by, user_id), user_id = COALESCE(user_id, received_by)").run();
  } catch (_) {}

  // Create SQLite indexes
  sqliteDbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_part_num ON products(part_number);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_truck_brand ON products(truck_brand);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
    CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
    CREATE INDEX IF NOT EXISTS idx_sales_cust_snapshot ON sales(customer_display_name);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_invoice ON purchases(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_batches_product_remaining ON inventory_batches(product_id, remaining_quantity);
    CREATE INDEX IF NOT EXISTS idx_company_debts_company ON company_debts(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_debts_driver ON company_debts(driver_id);
    CREATE INDEX IF NOT EXISTS idx_company_debts_vehicle ON company_debts(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_cash_tx_created ON cash_transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_cash_tx_account_dir ON cash_transactions(cash_account_id, direction, created_at);
    CREATE INDEX IF NOT EXISTS idx_cash_tx_session ON cash_transactions(cash_session_id);
    CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status, opened_at);
    CREATE INDEX IF NOT EXISTS idx_cust_search_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_cust_search_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_comp_search_name ON companies(name);
    CREATE INDEX IF NOT EXISTS idx_comp_search_owner ON companies(owner_name);
    CREATE INDEX IF NOT EXISTS idx_drv_search_name ON company_drivers(full_name);
    CREATE INDEX IF NOT EXISTS idx_drv_search_phone ON company_drivers(phone);
    CREATE INDEX IF NOT EXISTS idx_veh_search_plate ON company_vehicles(plate_number);
    CREATE INDEX IF NOT EXISTS idx_veh_search_number ON company_vehicles(vehicle_number);
  `);

  // Ensure purchase_items columns for decoupled purchase receipts exist
  try {
    sqliteDbInstance.prepare("ALTER TABLE purchase_items ADD COLUMN item_name TEXT").run();
  } catch (_) {}
  try {
    sqliteDbInstance.prepare("ALTER TABLE purchase_items ADD COLUMN part_number TEXT").run();
  } catch (_) {}

  // Ensure default Main Cash Drawer exists
  try {
    const existingDrawer = sqliteDbInstance.prepare('SELECT id FROM cash_accounts WHERE id = 1').get();
    if (!existingDrawer) {
      sqliteDbInstance.prepare(`
        INSERT INTO cash_accounts (id, name, account_type, currency, current_balance, opening_balance, is_active)
        VALUES (1, 'قاسەی سەرەکی دووکان', 'drawer', 'IQD', 0, 0, 1)
      `).run();
    }
  } catch (e) {}

  // Ensure initial admin user only if users table is empty
  try {
    const userCount = sqliteDbInstance.prepare('SELECT count(*) as c FROM users').get().c;
    if (userCount === 0) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      sqliteDbInstance.prepare(`
        INSERT INTO users (id, role_id, name, email, username, password, phone, is_active)
        VALUES (1, 1, 'سەنگەر و جێگر (بەڕێوەبەر)', 'jegrsangarr@gmail.com', 'admin', ?, '07503149696', 1)
      `).run(adminHash);

      sqliteDbInstance.prepare(`
        INSERT INTO user_profiles (id, full_name, email, role_id, status, phone)
        VALUES (1, 'سەنگەر و جێگر (بەڕێوەبەر)', 'jegrsangarr@gmail.com', 1, 'active', '07503149696')
      `).run();
      console.log('✅ Initial local Admin account initialized.');
    }
  } catch (e) {
    console.warn('⚠️ User init notice:', e.message);
  }

  return sqliteDbInstance;
}

/**
 * Translate parameterized SQL to SQLite syntax
 */
function translateSqlToSqlite(text, params = []) {
  let cleaned = text
    .replace(/\bNOW\(\)/gi, "datetime('now', 'localtime')")
    .replace(/\s+FOR\s+UPDATE/gi, '')
    .replace(/\s+AT\s+TIME\s+ZONE\s+('[^']+'|"[^"]+"|[A-Za-z0-9_/-]+)/gi, '')
    .replace(/::(int|bigint|uuid|text|date|numeric|json|jsonb|boolean|varchar)/gi, '')
    .replace(/ILIKE/gi, 'LIKE')
    .replace(/\bSTRING_AGG\b/gi, 'GROUP_CONCAT')
    .replace(/(BIGINT|INT)\s+GENERATED\s+BY\s+DEFAULT\s+AS\s+IDENTITY\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/TIMESTAMPTZ/gi, 'TEXT')
    .replace(/TIMESTAMP\s+WITH\s+TIME\s+ZONE/gi, 'TEXT')
    .replace(/UUID/gi, 'TEXT')
    .replace(/VARCHAR\([0-9]+\)/gi, 'TEXT');

  // Handle $1, $2, ... mappings for SQLite
  let sqliteParams = [];
  if (/\$[0-9]+/.test(cleaned)) {
    cleaned = cleaned.replace(/\$([0-9]+)/g, (match, p1) => {
      const idx = parseInt(p1, 10) - 1;
      sqliteParams.push(params[idx]);
      return '?';
    });
  } else {
    sqliteParams = [...params];
  }

  return { sql: cleaned, params: sqliteParams };
}

/**
 * Execute query via 100% Offline SQLite Engine
 */
export async function query(text, params = []) {
  const db = getSqliteDb();
  const trimmed = text.trim();

  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(trimmed)) {
    try {
      db.exec(trimmed);
    } catch (e) {}
    return { rows: [], rowCount: 0 };
  }

  const { sql, params: cleanParams } = translateSqlToSqlite(text, params);

  // Handle ALTER TABLE ADD COLUMN (with optional IF NOT EXISTS) safely for SQLite
  const alterMatch = sql.trim().match(/^\s*ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+(.+)/i);
  if (alterMatch) {
    try {
      const tbl = alterMatch[1];
      const col = alterMatch[2];
      let def = alterMatch[3];
      // Strip foreign key clauses which SQLite does not allow in ALTER TABLE ADD COLUMN
      def = def.replace(/REFERENCES\s+[a-zA-Z0-9_]+\([^)]+\)(\s+ON\s+DELETE\s+[a-zA-Z0-9_]+)?/gi, '');
      const tableCols = db.prepare(`PRAGMA table_info(${tbl})`).all().map((c) => c.name.toLowerCase());
      if (!tableCols.includes(col.toLowerCase())) {
        db.prepare(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`).run();
      }
      return { rows: [], rowCount: 0 };
    } catch (e) {
      if (/duplicate column name/i.test(e.message)) {
        return { rows: [], rowCount: 0 };
      }
      throw e;
    }
  }

  const isSelectOrReturning = /^(SELECT|WITH)|RETURNING/i.test(sql.trim());

  try {
    const stmt = db.prepare(sql);
    if (isSelectOrReturning) {
      const rows = stmt.all(...cleanParams);
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(...cleanParams);
      return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  } catch (err) {
    if (/CREATE\s+INDEX/i.test(sql) && /already exists/i.test(err.message)) {
      return { rows: [], rowCount: 0 };
    }
    throw err;
  }
}

/**
 * Client for Multi-Step Transactions
 */
export async function getClient() {
  return {
    query: async (text, params = []) => query(text, params),
    release: () => {},
  };
}

/**
 * Safe database connection tester
 */
export async function testConnection() {
  try {
    const res = await query("SELECT datetime('now', 'localtime') as server_time, 1 as status");
    return {
      connected: true,
      engine: 'SQLite',
      server_time: res.rows[0]?.server_time,
      message: 'بنکەی زانیاری خۆجێیی بە سەرکەوتوویی کار دەکات',
    };
  } catch (err) {
    return {
      connected: false,
      engine: 'SQLite',
      message: 'پەیوەندی بە بنکەی زانیاری سەرکەوتوو نەبوو',
      error: err.message,
    };
  }
}

/**
 * Safe Online SQLite Backup using better-sqlite3 backup API
 */
export async function createSafeBackup(customDestPath = null) {
  const db = getSqliteDb();
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const targetPath = customDestPath || path.join(backupDir, `shop-${now.toISOString().split('T')[0]}-${dateStr.slice(8)}.db`);

  await db.backup(targetPath);

  // Validate integrity of created backup
  const testDb = new Database(targetPath, { readonly: true });
  const check = testDb.pragma('integrity_check');
  testDb.close();

  if (!check || check[0]?.integrity_check !== 'ok') {
    throw new Error('Backup verification failed: ' + JSON.stringify(check));
  }

  return {
    success: true,
    path: targetPath,
    filename: path.basename(targetPath),
    size: fs.statSync(targetPath).size,
    created_at: now.toISOString(),
  };
}

/**
 * Safe Restore function:
 * Closes current SQLite instance, checks source integrity, copies file, reopens SQLite instance
 */
export async function safeRestoreBackup(sourceFilePath) {
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error('Backup file does not exist: ' + sourceFilePath);
  }

  // 1. Verify backup file integrity before touching active database
  const testDb = new Database(sourceFilePath, { readonly: true });
  const check = testDb.pragma('integrity_check');
  testDb.close();

  if (!check || check[0]?.integrity_check !== 'ok') {
    throw new Error('Cannot restore corrupted backup file: ' + JSON.stringify(check));
  }

  // 2. Create safety copy of current shop.db
  const shopDbPath = path.join(process.cwd(), 'data', 'shop.db');
  if (fs.existsSync(shopDbPath)) {
    await createSafeBackup(path.join(process.cwd(), 'backups', `pre-restore-safety-${Date.now()}.db`));
  }

  // 3. Close current active SQLite connection
  if (sqliteDbInstance) {
    try {
      sqliteDbInstance.close();
    } catch (e) {}
    sqliteDbInstance = null;
  }

  // 4. Copy verified backup to shop.db and remove WAL/SHM
  fs.copyFileSync(sourceFilePath, shopDbPath);
  const walPath = path.join(process.cwd(), 'data', 'shop.db-wal');
  const shmPath = path.join(process.cwd(), 'data', 'shop.db-shm');
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  // 5. Reopen and verify restored database
  const newDb = getSqliteDb();
  const integrity = newDb.pragma('integrity_check');

  return {
    success: true,
    integrity: integrity[0]?.integrity_check === 'ok',
    message: 'بنکەی زانیاری بە سەرکەوتوویی گەڕێنرایەوە',
  };
}

export const pool = {
  query: (text, params) => query(text, params),
  connect: () => getClient(),
};

export default {
  pool,
  getSqliteDb,
  initSqliteDb: getSqliteDb,
  query,
  getClient,
  testConnection,
  createSafeBackup,
  safeRestoreBackup,
};
