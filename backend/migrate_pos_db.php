<?php
/**
 * Comprehensive SQLite to MySQL / MariaDB Importer
 * Loads all real product, customer, supplier, sales, category, brand, and expense records
 */

declare(strict_types=1);

require_once __DIR__ . '/config/db.php';

$sqliteFile = __DIR__ . '/../data/pos.db';
if (!file_exists($sqliteFile)) {
    echo "pos.db not found.\n";
    exit;
}

$sqlite = new SQLite3($sqliteFile, SQLITE3_OPEN_READONLY);
$pdo = getDbConnection();

echo "Starting migration from {$sqliteFile} to MariaDB...\n";

// 1. Roles
$rolesRes = $sqlite->query("SELECT * FROM roles");
while ($r = $rolesRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO roles (id, name, display_name, description)
        VALUES (:id, :name, :dname, :desc)
        ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description)");
    $stmt->execute([
        'id' => $r['id'],
        'name' => $r['name'],
        'dname' => $r['display_name'] ?? $r['name'],
        'desc' => $r['description'] ?? null,
    ]);
}
echo "Migrated roles.\n";

// 2. Categories
$catRes = $sqlite->query("SELECT * FROM categories");
while ($r = $catRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO categories (id, name, description, is_active)
        VALUES (:id, :name, :desc, :act)
        ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)");
    $stmt->execute([
        'id' => $r['id'],
        'name' => $r['name'],
        'desc' => $r['description'] ?? null,
        'act' => $r['is_active'] ?? 1,
    ]);
}
echo "Migrated categories.\n";

// 3. Brands
$brandRes = $sqlite->query("SELECT * FROM brands");
while ($r = $brandRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO brands (id, name, country, is_active)
        VALUES (:id, :name, :country, :act)
        ON DUPLICATE KEY UPDATE name = VALUES(name), country = VALUES(country)");
    $stmt->execute([
        'id' => $r['id'],
        'name' => $r['name'],
        'country' => $r['country_of_origin'] ?? $r['country'] ?? null,
        'act' => $r['is_active'] ?? 1,
    ]);
}
echo "Migrated brands.\n";

// 4. Suppliers
$suppRes = $sqlite->query("SELECT * FROM suppliers");
while ($r = $suppRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO suppliers (id, name, phone, contact_person, current_debt, balance_debt, is_active)
        VALUES (:id, :name, :ph, :cp, :debt, :bdebt, :act)
        ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), current_debt = VALUES(current_debt), balance_debt = VALUES(balance_debt)");
    $debt = (int)($r['current_debt'] ?? $r['balance_debt'] ?? 0);
    $stmt->execute([
        'id' => $r['id'],
        'name' => $r['name'],
        'ph' => $r['phone'] ?? null,
        'cp' => $r['contact_person'] ?? null,
        'debt' => $debt,
        'bdebt' => $debt,
        'act' => $r['is_active'] ?? 1,
    ]);
}
echo "Migrated suppliers.\n";

// 5. Customers
$custRes = $sqlite->query("SELECT * FROM customers");
while ($r = $custRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO customers (id, name, phone, address, notes, current_debt, is_active)
        VALUES (:id, :name, :ph, :addr, :notes, :debt, :act)
        ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), current_debt = VALUES(current_debt)");
    $stmt->execute([
        'id' => $r['id'],
        'name' => $r['name'],
        'ph' => $r['phone'] ?? null,
        'addr' => $r['address'] ?? null,
        'notes' => $r['notes'] ?? null,
        'debt' => $r['current_debt'] ?? 0,
        'act' => $r['is_active'] ?? 1,
    ]);
}
echo "Migrated customers.\n";

// 6. Users
$usersRes = $sqlite->query("SELECT * FROM users");
while ($r = $usersRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO users (id, name, email, username, password, role_id, phone, is_active)
        VALUES (:id, :name, :email, :username, :password, :role_id, :phone, :is_active)
        ON DUPLICATE KEY UPDATE name = VALUES(name), role_id = VALUES(role_id)");
    $stmt->execute([
        'id' => $r['id'],
        'name' => $r['name'],
        'email' => $r['email'],
        'username' => $r['username'] ?? explode('@', $r['email'])[0],
        'password' => $r['password'],
        'role_id' => $r['role_id'] ?? 2,
        'phone' => $r['phone'] ?? null,
        'is_active' => $r['is_active'] ?? 1,
    ]);
}
echo "Migrated users.\n";

// 7. Products
$prodRes = $sqlite->query("SELECT * FROM products");
while ($r = $prodRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO products 
        (id, name, part_number, barcode, category_id, brand_id, purchase_price, selling_price, quantity, min_stock_level, is_active)
        VALUES (:id, :name, :part, :bc, :cid, :bid, :cost, :sell, :qty, :min, :act)
        ON DUPLICATE KEY UPDATE name = VALUES(name), part_number = VALUES(part_number), selling_price = VALUES(selling_price), quantity = VALUES(quantity)");
    $stmt->execute([
        'id' => $r['id'],
        'name' => $r['name'],
        'part' => $r['part_number'] ?? null,
        'bc' => $r['barcode'] ?? null,
        'cid' => $r['category_id'] ?? null,
        'bid' => $r['brand_id'] ?? null,
        'cost' => $r['purchase_price'] ?? 0,
        'sell' => $r['selling_price'] ?? 0,
        'qty' => $r['quantity'] ?? 0,
        'min' => $r['min_stock_level'] ?? 5,
        'act' => $r['is_active'] ?? 1,
    ]);

    // Ensure inventory batch exists
    $batchCheck = $pdo->prepare("SELECT id FROM inventory_batches WHERE product_id = :pid");
    $batchCheck->execute(['pid' => $r['id']]);
    if (!$batchCheck->fetch()) {
        $bStmt = $pdo->prepare("INSERT INTO inventory_batches (product_id, batch_type, batch_number, original_quantity, remaining_quantity, unit_cost, purchase_date, notes)
            VALUES (:pid, 'OPENING', :bnum, :oq, :rq, :cost, CURDATE(), 'سەرەتای سیستم')");
        $bStmt->execute([
            'pid' => $r['id'],
            'bnum' => 'BAT-INIT-' . $r['id'],
            'oq' => $r['quantity'] ?? 0,
            'rq' => $r['quantity'] ?? 0,
            'cost' => $r['purchase_price'] ?? 0,
        ]);
    }
}
echo "Migrated products.\n";

// 8. Expense Categories & Expenses
$expCatRes = $sqlite->query("SELECT * FROM expense_categories");
while ($r = $expCatRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO expense_categories (id, name, description, is_active)
        VALUES (:id, :name, :desc, :act)
        ON DUPLICATE KEY UPDATE name = VALUES(name)");
    $stmt->execute([
        'id' => $r['id'],
        'name' => $r['name'],
        'desc' => $r['description'] ?? null,
        'act' => $r['is_active'] ?? 1,
    ]);
}

$expRes = $sqlite->query("SELECT * FROM expenses");
while ($r = $expRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO expenses (id, title, description, category_id, amount, expense_date, notes)
        VALUES (:id, :title, :desc, :cid, :amt, :dt, :notes)
        ON DUPLICATE KEY UPDATE title = VALUES(title), amount = VALUES(amount)");
    $title = $r['title'] ?? $r['description'] ?? 'خەرجی';
    $stmt->execute([
        'id' => $r['id'],
        'title' => $title,
        'desc' => $r['description'] ?? $title,
        'cid' => $r['category_id'] ?? null,
        'amt' => $r['amount'] ?? 0,
        'dt' => $r['expense_date'] ?? date('Y-m-d'),
        'notes' => $r['notes'] ?? null,
    ]);
}
echo "Migrated expenses.\n";

// 9. Sales & Sale Items
$salesRes = $sqlite->query("SELECT * FROM sales");
while ($r = $salesRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO sales 
        (id, receipt_number, user_id, customer_id, customer_display_name, total_amount, discount_amount, paid_amount, debt_amount, payment_type, sale_date, sale_time, notes)
        VALUES (:id, :rn, :uid, :cid, :cdn, :ta, :da, :pa, :debt, :pt, :sd, :st, :notes)
        ON DUPLICATE KEY UPDATE receipt_number = VALUES(receipt_number)");
    $stmt->execute([
        'id' => $r['id'],
        'rn' => $r['receipt_number'],
        'uid' => $r['user_id'] ?? 1,
        'cid' => $r['customer_id'] ?? null,
        'cdn' => $r['customer_name'] ?? $r['customer_display_name'] ?? 'مشتەری گشتی',
        'ta' => $r['total_amount'] ?? 0,
        'da' => $r['discount_amount'] ?? 0,
        'pa' => $r['paid_amount'] ?? 0,
        'debt' => $r['debt_amount'] ?? 0,
        'pt' => $r['payment_type'] ?? 'cash',
        'sd' => $r['sale_date'] ?? date('Y-m-d'),
        'st' => $r['sale_time'] ?? date('H:i:s'),
        'notes' => $r['notes'] ?? null,
    ]);
}

$itemsRes = $sqlite->query("SELECT * FROM sale_items");
while ($r = $itemsRes->fetchArray(SQLITE3_ASSOC)) {
    $stmt = $pdo->prepare("INSERT INTO sale_items 
        (id, sale_id, product_id, product_name, part_number, quantity, unit_price, unit_cost, total_price, total_cost)
        VALUES (:id, :sid, :pid, :pname, :part, :qty, :up, :uc, :tp, :tc)
        ON DUPLICATE KEY UPDATE product_name = VALUES(product_name)");
    $up = (int)($r['unit_price'] ?? 0);
    $qty = (int)($r['quantity'] ?? 1);
    $tp = (int)($r['total_price'] ?? ($up * $qty));
    $uc = (int)($r['unit_cost'] ?? 0);
    $tc = (int)($r['total_cost'] ?? ($uc * $qty));

    $stmt->execute([
        'id' => $r['id'],
        'sid' => $r['sale_id'],
        'pid' => $r['product_id'],
        'pname' => $r['product_name'],
        'part' => $r['part_number'] ?? null,
        'qty' => $qty,
        'up' => $up,
        'uc' => $uc,
        'tp' => $tp,
        'tc' => $tc,
    ]);
}
echo "Migrated sales and sale_items.\n";

// 10. Update Cash Register
$totSalesCash = $pdo->query("SELECT COALESCE(SUM(paid_amount), 0) as s FROM sales")->fetch()['s'];
$totExp = $pdo->query("SELECT COALESCE(SUM(amount), 0) as e FROM expenses")->fetch()['e'];
$netCash = (int)$totSalesCash - (int)$totExp;
$pdo->prepare("UPDATE cash_accounts SET current_balance = :bal, updated_at = NOW() WHERE id = 1")->execute(['bal' => max(0, $netCash)]);
echo "Updated cash balance to {$netCash}.\n";

echo "Migration from pos.db completed successfully!\n";
