<?php
/**
 * Master API Router and Front Controller (PHP)
 * Serves all /api/* requests for Sangar & Jegr POS
 */

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../backend/config/db.php';
require_once __DIR__ . '/../backend/auth.php';
require_once __DIR__ . '/../backend/helpers.php';
require_once __DIR__ . '/../backend/controllers/AuthController.php';
require_once __DIR__ . '/../backend/controllers/ProductController.php';
require_once __DIR__ . '/../backend/controllers/CustomerController.php';
require_once __DIR__ . '/../backend/controllers/CompanyController.php';
require_once __DIR__ . '/../backend/controllers/SupplierController.php';
require_once __DIR__ . '/../backend/controllers/SaleController.php';
require_once __DIR__ . '/../backend/controllers/ReturnController.php';
require_once __DIR__ . '/../backend/controllers/PurchaseController.php';
require_once __DIR__ . '/../backend/controllers/InventoryController.php';
require_once __DIR__ . '/../backend/controllers/ExpenseController.php';
require_once __DIR__ . '/../backend/controllers/CashRegisterController.php';
require_once __DIR__ . '/../backend/controllers/ReportController.php';
require_once __DIR__ . '/../backend/controllers/UserController.php';
require_once __DIR__ . '/../backend/controllers/SettingController.php';
require_once __DIR__ . '/../backend/controllers/BackupController.php';

$method = $_SERVER['REQUEST_METHOD'];
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strip prefix /api or api
$path = preg_replace('#^/api/?#', '/', $requestUri);
$path = '/' . ltrim($path, '/');

// Helper to authenticate user on demand
$currentUser = null;
$getUser = function() use (&$currentUser): array {
    if ($currentUser === null) {
        $currentUser = authenticateUser();
    }
    return $currentUser;
};

// Route matching
try {
    // 1. Health & System Info
    if ($method === 'GET' && $path === '/health') {
        SettingController::getHealth();
    }
    if ($method === 'GET' && $path === '/settings/public') {
        SettingController::getPublic();
    }
    if ($method === 'GET' && $path === '/system/info') {
        SettingController::getSystemInfo($getUser());
    }

    // 2. Auth routes
    if ($method === 'POST' && $path === '/auth/login') {
        AuthController::login();
    }
    if ($method === 'GET' && $path === '/auth/me') {
        AuthController::me($getUser());
    }
    if ($method === 'PUT' && $path === '/auth/change-email') {
        AuthController::changeEmail($getUser());
    }
    if (($method === 'PUT' || $method === 'POST') && $path === '/auth/change-password') {
        AuthController::changePassword($getUser());
    }

    // 3. Products
    if ($method === 'GET' && $path === '/products/search') {
        $getUser();
        ProductController::search();
    }
    if ($method === 'GET' && preg_match('#^/products/barcode/(?<barcode>[^/]+)$#', $path, $m)) {
        $getUser();
        ProductController::getByBarcode(urldecode($m['barcode']));
    }
    if ($method === 'GET' && preg_match('#^/products/(?<id>\d+)/batches$#', $path, $m)) {
        $getUser();
        ProductController::getBatches((int)$m['id']);
    }
    if ($method === 'GET' && preg_match('#^/products/(?<id>\d+)$#', $path, $m)) {
        $getUser();
        ProductController::get((int)$m['id']);
    }
    if ($method === 'PUT' && preg_match('#^/products/(?<id>\d+)$#', $path, $m)) {
        ProductController::update((int)$m['id'], $getUser());
    }
    if ($method === 'DELETE' && preg_match('#^/products/(?<id>\d+)$#', $path, $m)) {
        ProductController::delete((int)$m['id'], $getUser());
    }
    if ($method === 'GET' && $path === '/products') {
        $getUser();
        ProductController::list();
    }
    if ($method === 'POST' && $path === '/products') {
        ProductController::create($getUser());
    }

    // Categories & Brands
    if ($method === 'GET' && $path === '/categories') {
        $getUser();
        ProductController::listCategories();
    }
    if ($method === 'POST' && $path === '/categories') {
        ProductController::createCategory($getUser());
    }
    if ($method === 'PUT' && preg_match('#^/categories/(?<id>\d+)$#', $path, $m)) {
        ProductController::updateCategory((int)$m['id'], $getUser());
    }
    if ($method === 'DELETE' && preg_match('#^/categories/(?<id>\d+)$#', $path, $m)) {
        ProductController::deleteCategory((int)$m['id'], $getUser());
    }

    if ($method === 'GET' && $path === '/brands') {
        $getUser();
        ProductController::listBrands();
    }
    if ($method === 'POST' && $path === '/brands') {
        ProductController::createBrand($getUser());
    }
    if ($method === 'PUT' && preg_match('#^/brands/(?<id>\d+)$#', $path, $m)) {
        ProductController::updateBrand((int)$m['id'], $getUser());
    }
    if ($method === 'DELETE' && preg_match('#^/brands/(?<id>\d+)$#', $path, $m)) {
        ProductController::deleteBrand((int)$m['id'], $getUser());
    }

    // 4. Customers & Debts
    if ($method === 'GET' && $path === '/customers/search') {
        $getUser();
        CustomerController::search();
    }
    if ($method === 'GET' && preg_match('#^/customers/(?<id>\d+)/debt-details$#', $path, $m)) {
        $getUser();
        CustomerController::getDebtDetails((int)$m['id']);
    }
    if ($method === 'GET' && preg_match('#^/customers/(?<id>\d+)/account$#', $path, $m)) {
        $getUser();
        CustomerController::getAccount((int)$m['id']);
    }
    if ($method === 'GET' && preg_match('#^/customers/(?<id>\d+)$#', $path, $m)) {
        $getUser();
        CustomerController::get((int)$m['id']);
    }
    if ($method === 'PUT' && preg_match('#^/customers/(?<id>\d+)$#', $path, $m)) {
        CustomerController::update((int)$m['id'], $getUser());
    }
    if ($method === 'GET' && $path === '/customers') {
        $getUser();
        CustomerController::list();
    }
    if ($method === 'POST' && $path === '/customers') {
        CustomerController::create($getUser());
    }
    if ($method === 'POST' && ($path === '/customers/pay-debt' || $path === '/customer-debts/payments')) {
        CustomerController::payDebt($getUser());
    }
    if ($method === 'GET' && ($path === '/debts/unified' || $path === '/debts/overview')) {
        $getUser();
        CustomerController::unifiedDebts();
    }

    // 5. Companies, Drivers, Vehicles
    if ($method === 'GET' && $path === '/companies/search') {
        $getUser();
        CompanyController::search();
    }
    if ($method === 'GET' && $path === '/drivers/search') {
        $getUser();
        CompanyController::searchDrivers();
    }
    if ($method === 'GET' && $path === '/vehicles/search') {
        $getUser();
        CompanyController::searchVehicles();
    }
    if ($method === 'GET' && preg_match('#^/companies/(?<id>\d+)/account$#', $path, $m)) {
        $getUser();
        CompanyController::getAccount((int)$m['id']);
    }
    if ($method === 'POST' && preg_match('#^/companies/(?<id>\d+)/pay-debt$#', $path, $m)) {
        CompanyController::payDebt((int)$m['id'], $getUser());
    }
    if ($method === 'GET' && preg_match('#^/companies/(?<id>\d+)/drivers/(?<did>\d+)/purchases$#', $path, $m)) {
        $getUser();
        CompanyController::getDriverPurchases((int)$m['id'], (int)$m['did']);
    }
    if ($method === 'PUT' && preg_match('#^/companies/(?<id>\d+)/drivers/(?<did>\d+)$#', $path, $m)) {
        CompanyController::updateDriver((int)$m['did'], $getUser());
    }
    if ($method === 'DELETE' && preg_match('#^/companies/(?<id>\d+)/drivers/(?<did>\d+)$#', $path, $m)) {
        CompanyController::deleteDriver((int)$m['did'], $getUser());
    }
    if ($method === 'GET' && preg_match('#^/companies/(?<id>\d+)/drivers$#', $path, $m)) {
        $getUser();
        CompanyController::listDrivers((int)$m['id']);
    }
    if ($method === 'POST' && preg_match('#^/companies/(?<id>\d+)/drivers$#', $path, $m)) {
        CompanyController::createDriver((int)$m['id'], $getUser());
    }
    if ($method === 'PUT' && preg_match('#^/company-drivers/(?<id>\d+)$#', $path, $m)) {
        CompanyController::updateDriver((int)$m['id'], $getUser());
    }

    if ($method === 'GET' && preg_match('#^/companies/(?<id>\d+)/vehicles/(?<vid>\d+)/purchases$#', $path, $m)) {
        $getUser();
        CompanyController::getVehiclePurchases((int)$m['id'], (int)$m['vid']);
    }
    if ($method === 'PUT' && preg_match('#^/companies/(?<id>\d+)/vehicles/(?<vid>\d+)$#', $path, $m)) {
        CompanyController::updateVehicle((int)$m['vid'], $getUser());
    }
    if ($method === 'DELETE' && preg_match('#^/companies/(?<id>\d+)/vehicles/(?<vid>\d+)$#', $path, $m)) {
        CompanyController::deleteVehicle((int)$m['vid'], $getUser());
    }
    if ($method === 'GET' && preg_match('#^/companies/(?<id>\d+)/vehicles$#', $path, $m)) {
        $getUser();
        CompanyController::listVehicles((int)$m['id']);
    }
    if ($method === 'POST' && preg_match('#^/companies/(?<id>\d+)/vehicles$#', $path, $m)) {
        CompanyController::createVehicle((int)$m['id'], $getUser());
    }
    if ($method === 'PUT' && preg_match('#^/company-vehicles/(?<id>\d+)$#', $path, $m)) {
        CompanyController::updateVehicle((int)$m['id'], $getUser());
    }

    if ($method === 'GET' && preg_match('#^/companies/(?<id>\d+)$#', $path, $m)) {
        $getUser();
        CompanyController::get((int)$m['id']);
    }
    if ($method === 'PUT' && preg_match('#^/companies/(?<id>\d+)$#', $path, $m)) {
        CompanyController::update((int)$m['id'], $getUser());
    }
    if ($method === 'DELETE' && preg_match('#^/companies/(?<id>\d+)$#', $path, $m)) {
        CompanyController::delete((int)$m['id'], $getUser());
    }
    if ($method === 'GET' && $path === '/companies') {
        $getUser();
        CompanyController::list();
    }
    if ($method === 'POST' && $path === '/companies') {
        CompanyController::create($getUser());
    }

    // 6. Suppliers & Supplier Debt
    if ($method === 'GET' && $path === '/suppliers/search') {
        $getUser();
        SupplierController::search();
    }
    if ($method === 'GET' && $path === '/suppliers/debt-overview') {
        $getUser();
        SupplierController::debtOverview();
    }
    if ($method === 'POST' && ($path === '/suppliers/pay' || $path === '/supplier-payments')) {
        SupplierController::pay($getUser());
    }
    if ($method === 'GET' && preg_match('#^/suppliers/(?<id>\d+)/payments$#', $path, $m)) {
        $getUser();
        SupplierController::getPayments((int)$m['id']);
    }
    if ($method === 'GET' && preg_match('#^/suppliers/(?<id>\d+)/statement$#', $path, $m)) {
        $getUser();
        SupplierController::getStatement((int)$m['id']);
    }
    if ($method === 'GET' && preg_match('#^/suppliers/(?<id>\d+)$#', $path, $m)) {
        $getUser();
        SupplierController::get((int)$m['id']);
    }
    if ($method === 'PUT' && preg_match('#^/suppliers/(?<id>\d+)$#', $path, $m)) {
        SupplierController::update((int)$m['id'], $getUser());
    }
    if ($method === 'GET' && $path === '/suppliers') {
        $getUser();
        SupplierController::list();
    }
    if ($method === 'POST' && $path === '/suppliers') {
        SupplierController::create($getUser());
    }

    // 7. Sales & Invoices
    if ($method === 'POST' && $path === '/sales') {
        SaleController::create($getUser());
    }
    if ($method === 'GET' && preg_match('#^/sales/(?<id>\d+)/cost-allocations$#', $path, $m)) {
        $getUser();
        SaleController::getCostAllocations((int)$m['id']);
    }
    if ($method === 'GET' && preg_match('#^/sales/(?<id>\d+)/invoice$#', $path, $m)) {
        $getUser();
        SaleController::getInvoice((int)$m['id']);
    }
    if ($method === 'GET' && preg_match('#^/sales/(?<id>\d+)$#', $path, $m)) {
        $getUser();
        SaleController::get((int)$m['id']);
    }
    if ($method === 'GET' && $path === '/sales') {
        $getUser();
        SaleController::list();
    }

    // 8. Returns
    if ($method === 'POST' && $path === '/returns') {
        ReturnController::create($getUser());
    }
    if ($method === 'GET' && preg_match('#^/returns/(?<id>\d+)$#', $path, $m)) {
        $getUser();
        ReturnController::get((int)$m['id']);
    }
    if ($method === 'GET' && $path === '/returns') {
        $getUser();
        ReturnController::list();
    }

    // 9. Purchases
    if ($method === 'POST' && preg_match('#^/purchases/(?<id>\d+)/return$#', $path, $m)) {
        PurchaseController::returnPurchase((int)$m['id'], $getUser());
    }
    if ($method === 'GET' && preg_match('#^/purchases/(?<id>\d+)$#', $path, $m)) {
        $getUser();
        PurchaseController::get((int)$m['id']);
    }
    if ($method === 'GET' && $path === '/purchases') {
        $getUser();
        PurchaseController::list();
    }
    if ($method === 'POST' && $path === '/purchases') {
        PurchaseController::create($getUser());
    }

    // 10. Inventory
    if ($method === 'GET' && $path === '/inventory/movements') {
        $getUser();
        InventoryController::listMovements();
    }
    if ($method === 'POST' && $path === '/inventory/adjust') {
        InventoryController::adjustStock($getUser());
    }
    if ($method === 'GET' && $path === '/inventory/batches') {
        $getUser();
        InventoryController::listBatches();
    }

    // 11. Expenses
    if ($method === 'GET' && $path === '/expense-categories') {
        $getUser();
        ExpenseController::listCategories();
    }
    if ($method === 'POST' && $path === '/expense-categories') {
        ExpenseController::createCategory($getUser());
    }
    if ($method === 'DELETE' && preg_match('#^/expenses/(?<id>\d+)$#', $path, $m)) {
        ExpenseController::delete((int)$m['id'], $getUser());
    }
    if ($method === 'GET' && $path === '/expenses') {
        $getUser();
        ExpenseController::list();
    }
    if ($method === 'POST' && $path === '/expenses') {
        ExpenseController::create($getUser());
    }

    // 12. Cash Register
    if ($method === 'GET' && $path === '/cash-register/summary') {
        $u = $getUser();
        requireAdmin($u);
        CashRegisterController::getSummary();
    }
    if ($method === 'GET' && $path === '/cash-register/transactions') {
        $u = $getUser();
        requireAdmin($u);
        CashRegisterController::listTransactions();
    }
    if ($method === 'POST' && $path === '/cash-register/deposit') {
        CashRegisterController::deposit($getUser());
    }
    if ($method === 'POST' && $path === '/cash-register/withdraw') {
        CashRegisterController::withdraw($getUser());
    }
    if ($method === 'POST' && $path === '/cash-register/set-opening-balance') {
        CashRegisterController::setOpeningBalance($getUser());
    }
    if ($method === 'GET' && $path === '/cash-register/sessions/current') {
        $u = $getUser();
        requireAdmin($u);
        CashRegisterController::getCurrentSession();
    }
    if ($method === 'POST' && $path === '/cash-register/sessions/open') {
        CashRegisterController::openSession($getUser());
    }
    if ($method === 'POST' && preg_match('#^/cash-register/sessions/(?<id>\d+)/close$#', $path, $m)) {
        CashRegisterController::closeSession((int)$m['id'], $getUser());
    }
    if ($method === 'POST' && $path === '/cash-register/sessions/close') {
        CashRegisterController::closeSession(null, $getUser());
    }
    if ($method === 'GET' && $path === '/cash-register/sessions') {
        $u = $getUser();
        requireAdmin($u);
        CashRegisterController::listSessions();
    }
    if ($method === 'POST' && $path === '/cash-register/backfill') {
        CashRegisterController::backfill($getUser());
    }
    if ($method === 'GET' && $path === '/cash-register/reports/daily') {
        $u = $getUser();
        requireAdmin($u);
        CashRegisterController::dailyReport();
    }

    // 13. Reports & Dashboard
    if ($method === 'GET' && ($path === '/dashboard/summary' || $path === '/dashboard/stats' || $path === '/reports/dashboard')) {
        $u = $getUser();
        requireAdmin($u);
        ReportController::getDashboardSummary();
    }
    if ($method === 'GET' && $path === '/reports/daily') {
        $u = $getUser();
        requireAdmin($u);
        ReportController::getDailyReport();
    }
    if ($method === 'GET' && $path === '/reports/sales') {
        $u = $getUser();
        requireAdmin($u);
        ReportController::getSalesReport();
    }
    if ($method === 'GET' && ($path === '/reports/profit' || $path === '/reports/inventory-profit' || $path === '/reports/profit-loss')) {
        $u = $getUser();
        requireAdmin($u);
        ReportController::getProfitLossReport();
    }
    if ($method === 'GET' && $path === '/reports/supplier-debts') {
        $u = $getUser();
        requireAdmin($u);
        PurchaseController::supplierDebtsReport();
    }
    if ($method === 'GET' && $path === '/reports/companies') {
        $u = $getUser();
        requireAdmin($u);
        ReportController::getCompaniesReport();
    }
    if ($method === 'GET' && $path === '/reports/drivers') {
        $u = $getUser();
        requireAdmin($u);
        ReportController::getDriversReport();
    }
    if ($method === 'GET' && $path === '/reports/vehicles') {
        $u = $getUser();
        requireAdmin($u);
        ReportController::getVehiclesReport();
    }

    // 14. Users & Roles
    if ($method === 'GET' && $path === '/roles') {
        $getUser();
        UserController::listRoles();
    }
    if ($method === 'PUT' && preg_match('#^/(users|admin/users)/(?<id>\d+)/role$#', $path, $m)) {
        UserController::updateRole((int)$m['id'], $getUser());
    }
    if ($method === 'PUT' && preg_match('#^/(users|admin/users)/(?<id>\d+)/status$#', $path, $m)) {
        UserController::updateStatus((int)$m['id'], $getUser());
    }
    if ($method === 'PUT' && preg_match('#^/(users|admin/users)/(?<id>\d+)/password$#', $path, $m)) {
        UserController::resetPassword((int)$m['id'], $getUser());
    }
    if ($method === 'PUT' && preg_match('#^/(users|admin/users)/(?<id>\d+)$#', $path, $m)) {
        UserController::update((int)$m['id'], $getUser());
    }
    if ($method === 'DELETE' && preg_match('#^/(users|admin/users)/(?<id>\d+)$#', $path, $m)) {
        UserController::delete((int)$m['id'], $getUser());
    }
    if ($method === 'GET' && ($path === '/users' || $path === '/admin/users')) {
        UserController::list($getUser());
    }
    if ($method === 'POST' && ($path === '/users' || $path === '/admin/users')) {
        UserController::create($getUser());
    }

    // 15. Settings & Audit
    if ($method === 'GET' && $path === '/settings') {
        SettingController::getSettings($getUser());
    }
    if (($method === 'POST' || $method === 'PUT') && $path === '/settings') {
        SettingController::updateSettings($getUser());
    }
    if ($method === 'GET' && $path === '/audit-logs') {
        SettingController::getAuditLogs($getUser());
    }

    // 16. Backups
    if ($method === 'GET' && $path === '/backup/list') {
        BackupController::list($getUser());
    }
    if ($method === 'POST' && $path === '/backup/create') {
        BackupController::create($getUser());
    }
    if ($method === 'GET' && preg_match('#^/backup/download/(?<filename>[^/]+)$#', $path, $m)) {
        BackupController::download($m['filename'], $getUser());
    }
    if ($method === 'POST' && $path === '/backup/restore') {
        BackupController::restore($getUser());
    }
    if ($method === 'GET' && $path === '/backup/export') {
        BackupController::export($getUser());
    }

    // 404 Not Found for unmatched API routes
    jsonError("ڕێڕەوی داواکراو نەدۆزرایەوە: {$method} {$path}", 404);

} catch (Exception $e) {
    error_log("Unhandled API Error: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
    jsonError('هەڵەیەکی چاوەڕواننەکراو لە سێرڤەر ڕوویدا: ' . $e->getMessage(), 500);
}
