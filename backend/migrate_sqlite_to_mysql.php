<?php
/**
 * Safe SQLite to MySQL/MariaDB Data Migration Script
 * Preserves SQLite data completely without modifying or deleting SQLite files.
 */

declare(strict_types=1);

require_once __DIR__ . '/config/db.php';

echo "=== Starting Safe SQLite to MySQL/MariaDB Migration ===\n";

$sqlitePath = $argv[1] ?? (__DIR__ . '/../data/pos.db');
if (!file_exists($sqlitePath)) {
    $sqlitePath = __DIR__ . '/../data/shop.db';
}

if (!file_exists($sqlitePath)) {
    echo "Notice: No SQLite database found at data/shop.db or data/pos.db. Migration skipped.\n";
    exit(0);
}

echo "Source SQLite Database: " . realpath($sqlitePath) . "\n";

try {
    $sqlitePdo = new PDO("sqlite:" . $sqlitePath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    echo "Error opening SQLite database: " . $e->getMessage() . "\n";
    exit(1);
}

$mysqlPdo = getDbConnection();

// Disable foreign key checks during migration
$mysqlPdo->exec("SET FOREIGN_KEY_CHECKS = 0;");

$tables = [
    'roles',
    'users',
    'user_profiles',
    'categories',
    'brands',
    'suppliers',
    'customers',
    'companies',
    'company_vehicles',
    'company_drivers',
    'products',
    'purchases',
    'purchase_items',
    'inventory_batches',
    'inventory_movements',
    'sales',
    'sale_items',
    'payments',
    'customer_debts',
    'customer_debt_payments',
    'company_debts',
    'company_debt_payments',
    'supplier_payments',
    'expense_categories',
    'expenses',
    'returns',
    'return_items',
    'sale_item_cost_allocations',
    'sale_return_cost_allocations',
    'settings',
    'audit_logs',
    'cash_accounts',
    'cash_sessions',
    'cash_transactions',
];

$totalMigratedRows = 0;

foreach ($tables as $table) {
    // Check if table exists in SQLite
    $checkSql = $sqlitePdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = :name");
    $checkSql->execute([':name' => $table]);
    if (!$checkSql->fetch()) {
        continue;
    }

    // Get SQLite rows
    $stmt = $sqlitePdo->query("SELECT * FROM `{$table}`");
    $rows = $stmt->fetchAll();
    if (empty($rows)) {
        continue;
    }

    // Get MySQL table columns to only insert valid columns
    $colStmt = $mysqlPdo->query("DESCRIBE `{$table}`");
    $colMeta = $colStmt->fetchAll();
    $mysqlColumns = array_column($colMeta, 'Field');
    $dateTimeCols = [];
    foreach ($colMeta as $cm) {
        $type = strtolower((string)$cm['Type']);
        if (str_contains($type, 'datetime') || str_contains($type, 'timestamp')) {
            $dateTimeCols[] = $cm['Field'];
        }
    }

    $rowCount = 0;
    foreach ($rows as $row) {
        $dataToInsert = [];
        foreach ($row as $col => $val) {
            if (in_array($col, $mysqlColumns, true)) {
                if (in_array($col, $dateTimeCols, true) && is_string($val) && $val !== '') {
                    if (preg_match('/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/', $val, $dm)) {
                        $val = $dm[1] . ' ' . $dm[2];
                    } else {
                        $val = date('Y-m-d H:i:s');
                    }
                }
                $dataToInsert[$col] = $val;
            }
        }

        if (empty($dataToInsert)) {
            continue;
        }

        $colNames = array_keys($dataToInsert);
        $escapedCols = array_map(fn($c) => "`{$c}`", $colNames);
        $placeholders = array_map(fn($c) => ":{$c}", $colNames);

        $sql = "INSERT INTO `{$table}` (" . implode(', ', $escapedCols) . ") 
                VALUES (" . implode(', ', $placeholders) . ")
                ON DUPLICATE KEY UPDATE ";
        $updates = [];
        foreach ($colNames as $col) {
            $updates[] = "`{$col}` = VALUES(`{$col}`)";
        }
        $sql .= implode(', ', $updates);

        $insertStmt = $mysqlPdo->prepare($sql);
        $insertStmt->execute($dataToInsert);
        $rowCount++;
    }

    echo "Migrated table '{$table}': {$rowCount} rows.\n";
    $totalMigratedRows += $rowCount;
}

$mysqlPdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

echo "=== Migration Complete: Total {$totalMigratedRows} rows migrated safely ===\n";
