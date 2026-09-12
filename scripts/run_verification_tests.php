<?php
/**
 * Sangar & Jegr POS - Automated Verification Test Suite
 * Tests all 13 critical requirements specified in the audit.
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/db.php';
require_once __DIR__ . '/../backend/auth.php';

$config = require __DIR__ . '/../backend/config/config.php';
$baseUrl = 'http://127.0.0.1:3000';

// Colors for CLI output
$GREEN = "\033[32m";
$RED = "\033[31m";
$YELLOW = "\033[33m";
$CYAN = "\033[36m";
$RESET = "\033[0m";

echo "{$CYAN}======================================================\n";
echo "SANGAR & JEGR POS - SYSTEM VERIFICATION SUITE\n";
echo "======================================================{$RESET}\n\n";

// Helper: HTTP request
function apiRequest(string $method, string $path, array $data = [], ?string $token = null): array {
    global $baseUrl;
    $url = $baseUrl . $path;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    $headers = ['Content-Type: application/json'];
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if (!empty($data)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode((string)$response, true);
    return [
        'code' => $httpCode,
        'body' => $json,
        'raw' => $response,
    ];
}

// Generate Admin and Cashier tokens
$admin = dbFetchOne("SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = 1");
$adminToken = jwtEncode([
    'id' => $admin['id'],
    'email' => $admin['email'],
    'role' => $admin['role'],
    'name' => $admin['name'],
], $config['jwt']['secret']);

$cashier = dbFetchOne("SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = 2");
$cashierToken = jwtEncode([
    'id' => $cashier['id'],
    'email' => $cashier['email'],
    'role' => $cashier['role'],
    'name' => $cashier['name'],
], $config['jwt']['secret']);

$testsPassed = 0;
$testsFailed = 0;

function reportResult(string $testName, bool $pass, string $details = ''): void {
    global $GREEN, $RED, $RESET, $testsPassed, $testsFailed;
    if ($pass) {
        $testsPassed++;
        echo "{$GREEN}[PASS]{$RESET} {$testName}\n";
    } else {
        $testsFailed++;
        echo "{$RED}[FAIL]{$RESET} {$testName}\n";
    }
    if ($details) {
        echo "       Details: {$details}\n";
    }
}

// ----------------------------------------------------
// TEST 1 to 5: PURCHASE RECEIPT SEPARATION & DECOUPLING
// ----------------------------------------------------
echo "\n{$YELLOW}--- SECTION 1: PURCHASE RECEIPT SEPARATION & DECOUPLING ---{$RESET}\n";

// Setup a dedicated test product
$testProd = dbFetchOne("SELECT * FROM products WHERE name LIKE 'کاڵای تاقیکردنەوە %' LIMIT 1");
if (!$testProd) {
    $prodId = dbInsert('products', [
        'name' => 'کاڵای تاقیکردنەوە کڕین',
        'barcode' => 'TEST-' . time(),
        'part_number' => 'PN-TEST-' . time(),
        'purchase_price' => 15000,
        'selling_price' => 22000,
        'quantity' => 10,
        'min_stock_level' => 3,
    ]);
    $testProd = dbFetchOne("SELECT * FROM products WHERE id = :id", ['id' => $prodId]);
} else {
    dbQuery("UPDATE products SET quantity = 10, purchase_price = 15000 WHERE id = :id", ['id' => $testProd['id']]);
    $testProd = dbFetchOne("SELECT * FROM products WHERE id = :id", ['id' => $testProd['id']]);
}

$supplier = dbFetchOne("SELECT * FROM suppliers LIMIT 1");
$supplierId = (int)$supplier['id'];
$initialSupplierDebt = (int)$supplier['current_debt'];

$initialStock = (int)$testProd['quantity']; // 10
$initialPurchasePrice = (int)$testProd['purchase_price']; // 15000

// Record initial batch count and movements count
$initialBatches = dbFetchOne("SELECT COUNT(*) as c FROM inventory_batches WHERE product_id = :id", ['id' => $testProd['id']]);
$initialBatchCount = (int)$initialBatches['c'];

$initialMovements = dbFetchOne("SELECT COUNT(*) as c FROM inventory_movements WHERE product_id = :id", ['id' => $testProd['id']]);
$initialMovementCount = (int)$initialMovements['c'];

// Perform Purchase Receipt via API: Qty = 20, Unit Cost = 30000, Total = 600000, Paid = 100000, Debt = 500000
$purchaseRes = apiRequest('POST', '/api/purchases', [
    'supplier_id' => $supplierId,
    'invoice_number' => 'INV-TEST-' . time(),
    'purchase_date' => date('Y-m-d'),
    'items' => [
        [
            'product_id' => $testProd['id'],
            'quantity' => 20,
            'unit_cost' => 30000,
        ]
    ],
    'paid_amount' => 100000,
    'notes' => 'تاقیکردنەوەی جیابوونەوەی کڕین لە مەخزەن',
], $adminToken);

$purchaseSuccess = ($purchaseRes['code'] === 200 && ($purchaseRes['body']['success'] ?? false));
reportResult('1. Purchase Receipt API Creation', $purchaseSuccess, "HTTP Code: {$purchaseRes['code']}");

// Verify Product Stock remains exactly 10
$afterProd = dbFetchOne("SELECT * FROM products WHERE id = :id", ['id' => $testProd['id']]);
$afterStock = (int)$afterProd['quantity'];
$stockUnchanged = ($afterStock === $initialStock);
reportResult('2. Product Stock Unchanged (Before=10, Purchase=20, After=10)', $stockUnchanged, "Expected: {$initialStock}, Got: {$afterStock}");

// Verify Product Purchase Price unchanged (remains 15000, not updated to 30000)
$afterPurchasePrice = (int)$afterProd['purchase_price'];
$priceUnchanged = ($afterPurchasePrice === $initialPurchasePrice);
reportResult('3. Product Purchase Price Unchanged (15000)', $priceUnchanged, "Expected: {$initialPurchasePrice}, Got: {$afterPurchasePrice}");

// Verify FIFO Batches unchanged (no batch added for purchase)
$afterBatches = dbFetchOne("SELECT COUNT(*) as c FROM inventory_batches WHERE product_id = :id", ['id' => $testProd['id']]);
$afterBatchCount = (int)$afterBatches['c'];
$batchesUnchanged = ($afterBatchCount === $initialBatchCount);
reportResult('4. FIFO Inventory Batches Unchanged', $batchesUnchanged, "Before: {$initialBatchCount}, After: {$afterBatchCount}");

// Verify Inventory Movements unchanged (no movement added for purchase)
$afterMovements = dbFetchOne("SELECT COUNT(*) as c FROM inventory_movements WHERE product_id = :id", ['id' => $testProd['id']]);
$afterMovementCount = (int)$afterMovements['c'];
$movementsUnchanged = ($afterMovementCount === $initialMovementCount);
reportResult('5. Inventory Movements Unchanged', $movementsUnchanged, "Before: {$initialMovementCount}, After: {$afterMovementCount}");

// Verify Supplier Debt accurately updated
$afterSupplier = dbFetchOne("SELECT * FROM suppliers WHERE id = :id", ['id' => $supplierId]);
$afterSupplierDebt = (int)$afterSupplier['current_debt'];
$expectedDebt = $initialSupplierDebt + 500000;
$debtCorrect = ($afterSupplierDebt === $expectedDebt);
reportResult('6. Supplier Debt Updated Correctly (+500,000 IQD)', $debtCorrect, "Expected: {$expectedDebt}, Got: {$afterSupplierDebt}");


// ----------------------------------------------------
// TEST 6 to 7: FINANCIAL REPORT API ACCESS & ROLE PERMISSIONS
// ----------------------------------------------------
echo "\n{$YELLOW}--- SECTION 2: FINANCIAL REPORT ACCESS CONTROL ---{$RESET}\n";

$reportEndpoints = [
    '/api/reports/daily',
    '/api/reports/sales',
    '/api/reports/profit',
    '/api/reports/dashboard',
];

$allAdminAllowed = true;
$allCashierForbidden = true;

foreach ($reportEndpoints as $ep) {
    $resAdmin = apiRequest('GET', $ep, [], $adminToken);
    $resCashier = apiRequest('GET', $ep, [], $cashierToken);
    
    if ($resAdmin['code'] !== 200) {
        $allAdminAllowed = false;
        echo "   Admin failed on {$ep} (HTTP {$resAdmin['code']})\n";
    }
    if ($resCashier['code'] !== 403) {
        $allCashierForbidden = false;
        echo "   Cashier NOT 403 on {$ep} (HTTP {$resCashier['code']})\n";
    }
}

reportResult('7. Admin Token Allowed Access to Financial Reports (HTTP 200)', $allAdminAllowed);
reportResult('8. Cashier Token Blocked with 403 Forbidden from Financial Reports', $allCashierForbidden);


// ----------------------------------------------------
// TEST 8 to 12: NORMAL WORKFLOW WITHOUT CASH REGISTER / SESSION
// ----------------------------------------------------
echo "\n{$YELLOW}--- SECTION 3: NORMAL WORKFLOW WITHOUT CASH SESSIONS ---{$RESET}\n";

// Ensure all cash sessions are CLOSED so that no active session exists
dbQuery("UPDATE cash_sessions SET status = 'CLOSED', closed_at = NOW() WHERE status = 'OPEN'");
$openSessions = dbFetchOne("SELECT COUNT(*) as c FROM cash_sessions WHERE status = 'OPEN'");
$hasNoOpenSession = ((int)$openSessions['c'] === 0);
echo "   Active cash sessions count in DB: " . (int)$openSessions['c'] . " (Verified None Open)\n";

// A. Cash Sale Without Active Cash Session
$saleRes = apiRequest('POST', '/api/sales', [
    'customer_id' => null,
    'customer_type' => 'regular',
    'payment_type' => 'cash',
    'paid_amount' => 22000,
    'discount_amount' => 0,
    'items' => [
        [
            'product_id' => $testProd['id'],
            'quantity' => 1,
            'unit_price' => 22000,
        ]
    ],
    'notes' => 'فرۆشتن بەبێ پێویستی بە دانیشتنی قاسە',
], $cashierToken);

$saleSuccess = ($saleRes['code'] === 200 && ($saleRes['body']['success'] ?? false));
reportResult('9. Sale Completed Successfully Without Active Cash Session', $saleSuccess, "HTTP {$saleRes['code']}");

// B. Customer Debt Payment Without Active Cash Session
$cust = dbFetchOne("SELECT * FROM customers WHERE current_debt > 0 LIMIT 1");
if (!$cust) {
    dbQuery("UPDATE customers SET current_debt = 50000 WHERE id = 1");
    $cust = dbFetchOne("SELECT * FROM customers WHERE id = 1");
}
$custInitialDebt = (int)$cust['current_debt'];
$custPayRes = apiRequest('POST', "/api/customers/pay-debt", [
    'customer_id' => $cust['id'],
    'amount' => 10000,
    'notes' => 'دانەوەی قەرز بەبێ قاسە',
], $cashierToken);

$custAfter = dbFetchOne("SELECT * FROM customers WHERE id = :id", ['id' => $cust['id']]);
$custDebtUpdated = ((int)$custAfter['current_debt'] === ($custInitialDebt - 10000));
reportResult('10. Customer Debt Payment Succeeded Without Cash Session', ($custPayRes['code'] === 200 && $custDebtUpdated), "HTTP {$custPayRes['code']}");

// C. Company Debt Payment Without Active Cash Session
$comp = dbFetchOne("SELECT * FROM companies WHERE current_debt > 0 LIMIT 1");
if (!$comp) {
    dbQuery("UPDATE companies SET current_debt = 50000 WHERE id = 1");
    $comp = dbFetchOne("SELECT * FROM companies WHERE id = 1");
}
$compInitialDebt = (int)$comp['current_debt'];
$compPayRes = apiRequest('POST', "/api/companies/{$comp['id']}/pay-debt", [
    'amount' => 10000,
    'notes' => 'دانەوەی قەرزی کۆمپانیا بەبێ قاسە',
], $adminToken);

$compAfter = dbFetchOne("SELECT * FROM companies WHERE id = :id", ['id' => $comp['id']]);
$compDebtUpdated = ((int)$compAfter['current_debt'] === ($compInitialDebt - 10000));
reportResult('11. Company Debt Payment Succeeded Without Cash Session', ($compPayRes['code'] === 200 && $compDebtUpdated), "HTTP {$compPayRes['code']}");

// D. Supplier Payment Without Active Cash Session
$suppInitialDebt = (int)$afterSupplier['current_debt'];
$suppPayRes = apiRequest('POST', "/api/suppliers/pay", [
    'supplier_id' => $supplierId,
    'amount' => 50000,
    'notes' => 'دانەوەی قەرزی دابینکەر بەبێ قاسە',
], $adminToken);

$suppAfterPay = dbFetchOne("SELECT * FROM suppliers WHERE id = :id", ['id' => $supplierId]);
$suppDebtUpdated = ((int)$suppAfterPay['current_debt'] === ($suppInitialDebt - 50000));
reportResult('12. Supplier Payment Succeeded Without Cash Session', ($suppPayRes['code'] === 200 && $suppDebtUpdated), "HTTP {$suppPayRes['code']}");

// E. Expense Creation Without Cash Session & NO Cash Register Deduction
$cashAccBefore = dbFetchOne("SELECT * FROM cash_accounts WHERE id = 1");
$cashBalBefore = (int)($cashAccBefore['current_balance'] ?? 0);
$cashTxBefore = dbFetchOne("SELECT COUNT(*) as c FROM cash_transactions");
$cashTxCountBefore = (int)$cashTxBefore['c'];

$expRes = apiRequest('POST', '/api/expenses', [
    'category_id' => 1,
    'title' => 'خەرجی چای و ئاو تاقیکردنەوە',
    'description' => 'خەرجی چای و ئاو تاقیکردنەوە',
    'amount' => 15000,
    'date' => date('Y-m-d'),
    'notes' => 'تەنها تۆماری خەرجی بەبێ کەمکردنەوە لە قاسە',
], $adminToken);

$cashAccAfter = dbFetchOne("SELECT * FROM cash_accounts WHERE id = 1");
$cashBalAfter = (int)($cashAccAfter['current_balance'] ?? 0);
$cashTxAfter = dbFetchOne("SELECT COUNT(*) as c FROM cash_transactions");
$cashTxCountAfter = (int)$cashTxAfter['c'];

$expCreated = ($expRes['code'] === 200 && ($expRes['body']['success'] ?? false));
$cashAccountUntouched = ($cashBalBefore === $cashBalAfter);
$noCashTransaction = ($cashTxCountBefore === $cashTxCountAfter);

reportResult('13. Expense Creation Saves Data and Does NOT Deduct From Cash Register', ($expCreated && $cashAccountUntouched && $noCashTransaction), "Expense HTTP: {$expRes['code']}, Cash Balance: {$cashBalBefore} -> {$cashBalAfter}, Cash Tx Count: {$cashTxCountBefore} -> {$cashTxCountAfter}");

// UI Navigation Check
$indexHtml = file_get_contents(__DIR__ . '/../index.html');
$hasCashRegisterInMenu = strpos($indexHtml, 'href="#cash-register"') !== false || strpos($indexHtml, 'قاسە') !== false;
reportResult('14. Cash Register Removed From Primary UI Navigation Menu', !$hasCashRegisterInMenu);

echo "\n======================================================\n";
echo "SUMMARY: Total: " . ($testsPassed + $testsFailed) . " | Passed: {$testsPassed} | Failed: {$testsFailed}\n";
echo "======================================================\n";

exit($testsFailed > 0 ? 1 : 0);
