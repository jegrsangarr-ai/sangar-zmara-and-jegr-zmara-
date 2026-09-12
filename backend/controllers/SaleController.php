<?php
/**
 * Sale & POS Controller (PHP)
 * Full atomic transaction, FIFO inventory batch allocation, debt management, cash register sync
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class SaleController {
    public static function create(array $currentUser): void {
        $b = getJsonInput();
        $items = $b['items'] ?? [];
        if (empty($items) || !is_array($items)) {
            jsonError('سەبەتەی کڕین بەتاڵە', 400);
        }

        $pdo = getDbConnection();
        $pdo->beginTransaction();

        try {
            // Check allow negative stock setting
            $settingRow = dbFetchOne("SELECT value FROM settings WHERE key_name = 'allow_negative_stock'");
            $allowNegative = $settingRow && ($settingRow['value'] === '1' || $settingRow['value'] === 'true');

            $subtotal = 0;
            $totalCost = 0;
            $verifiedItems = [];

            foreach ($items as $it) {
                $q = max(0, (int)($it['quantity'] ?? 0));
                if ($q <= 0) {
                    $pdo->rollBack();
                    jsonError('بڕی کاڵا دەبێت لە 0 زیاتر بێت', 400);
                }

                $productId = (int)($it['product_id'] ?? 0);
                $prodStmt = $pdo->prepare("SELECT * FROM products WHERE id = :id FOR UPDATE");
                $prodStmt->execute(['id' => $productId]);
                $prod = $prodStmt->fetch();

                if (!$prod) {
                    $pdo->rollBack();
                    jsonError("کاڵای ژمارە {$productId} نەدۆزرایەوە", 400);
                }

                if ((int)$prod['is_active'] !== 1) {
                    $pdo->rollBack();
                    jsonError("کاڵای ({$prod['name']}) ناچالاککراوە", 400);
                }

                if (!$allowNegative && (int)$prod['quantity'] < $q) {
                    $pdo->rollBack();
                    jsonError("مەخزەنی ({$prod['name']}) بەشی ناکات! تەنها {$prod['quantity']} دانە ماوە", 400);
                }

                $unitPrice = isset($it['unit_price']) ? (int)$it['unit_price'] : (int)$prod['selling_price'];
                $discount = isset($it['discount']) ? max(0, (int)$it['discount']) : 0;
                $totalPrice = max(0, ($unitPrice * $q) - $discount);

                // FIFO Batch allocation
                $fifoAlloc = allocateFifoStock($pdo, (int)$prod['id'], $q, (int)$prod['purchase_price']);
                $itemCost = $fifoAlloc['total_cost'];
                $unitCost = $fifoAlloc['average_unit_cost'];

                $subtotal += $totalPrice;
                $totalCost += $itemCost;

                $verifiedItems[] = [
                    'product_id' => (int)$prod['id'],
                    'product_name' => $prod['name'],
                    'part_number' => $prod['part_number'] ?? '',
                    'quantity' => $q,
                    'unit_cost' => $unitCost,
                    'unit_price' => $unitPrice,
                    'discount' => $discount,
                    'total_price' => $totalPrice,
                    'total_cost' => $itemCost,
                    'stock_before' => (int)$prod['quantity'],
                    'allocations' => $fifoAlloc['allocations'],
                ];
            }

            $discountAmount = min($subtotal, max(0, (int)($b['discount_amount'] ?? 0)));
            $totalAmount = $subtotal - $discountAmount;
            $grossProfit = $totalAmount - $totalCost;

            // Customer identification
            $customerType = (string)($b['customer_type'] ?? 'one_time');
            if ($customerType === 'company' || (!empty($b['company_id']) && empty($b['customer_id']))) {
                $customerType = 'company';
            } elseif (!empty($b['customer_id'])) {
                $customerType = 'individual';
            } else {
                $customerType = 'one_time';
            }

            $isCompany = $customerType === 'company';
            $companyId = $isCompany && !empty($b['company_id']) ? (int)$b['company_id'] : null;
            $companyDriverId = $isCompany && (!empty($b['company_driver_id']) || !empty($b['driver_id'])) ? (int)($b['company_driver_id'] ?? $b['driver_id']) : null;
            $companyVehicleId = $isCompany && (!empty($b['company_vehicle_id']) || !empty($b['vehicle_id'])) ? (int)($b['company_vehicle_id'] ?? $b['vehicle_id']) : null;

            $customerId = !$isCompany && !empty($b['customer_id']) ? (int)$b['customer_id'] : null;
            $customerDisplayName = trim((string)($b['customer_display_name'] ?? $b['one_time_customer_name'] ?? $b['customer_name'] ?? ''));
            $customerPhoneSnapshot = trim((string)($b['customer_phone_snapshot'] ?? $b['one_time_customer_phone'] ?? $b['customer_phone'] ?? ''));

            // Save as permanent customer if requested
            if (!$isCompany && !$customerId && $customerDisplayName !== '' && !empty($b['save_as_permanent_customer'])) {
                $existingCust = null;
                if ($customerPhoneSnapshot !== '') {
                    $existingCust = dbFetchOne("SELECT id, name, phone FROM customers WHERE phone = :p LIMIT 1", ['p' => $customerPhoneSnapshot]);
                }
                if (!$existingCust) {
                    $existingCust = dbFetchOne("SELECT id, name, phone FROM customers WHERE name = :n LIMIT 1", ['n' => $customerDisplayName]);
                }

                if ($existingCust) {
                    $customerId = (int)$existingCust['id'];
                } else {
                    $customerId = dbInsert('customers', [
                        'name' => $customerDisplayName,
                        'phone' => $customerPhoneSnapshot ?: null,
                        'address' => null,
                        'notes' => (string)($b['notes'] ?? 'کڕیار لە کاتی فرۆشتن پاشەکەوت کرا'),
                        'current_debt' => 0,
                        'total_spent' => 0,
                        'total_paid' => 0,
                        'is_active' => 1,
                    ]);
                }
                $customerType = 'individual';
            }

            // Fill snapshots
            if ($isCompany && $companyId) {
                $cmp = dbFetchOne("SELECT name, phone FROM companies WHERE id = :id", ['id' => $companyId]);
                if ($cmp) {
                    if ($customerDisplayName === '') $customerDisplayName = $cmp['name'];
                    if ($customerPhoneSnapshot === '') $customerPhoneSnapshot = $cmp['phone'] ?? '';
                }
            } elseif ($customerId) {
                $c = dbFetchOne("SELECT name, phone FROM customers WHERE id = :id", ['id' => $customerId]);
                if ($c) {
                    if ($customerDisplayName === '') $customerDisplayName = $c['name'];
                    if ($customerPhoneSnapshot === '') $customerPhoneSnapshot = $c['phone'] ?? '';
                }
            } elseif ($customerDisplayName === '') {
                $customerDisplayName = 'کڕیاری دەستبەجێ (نەقد)';
            }

            // Payments calculation
            $paymentType = (string)($b['payment_type'] ?? 'cash');
            $paidAmount = 0;
            $debtAmount = 0;
            $changeAmount = 0;

            if ($paymentType === 'cash') {
                $rawPaid = isset($b['paid_amount']) && $b['paid_amount'] !== '' ? (int)$b['paid_amount'] : $totalAmount;
                if ($rawPaid < $totalAmount) {
                    $pdo->rollBack();
                    jsonError('بڕی پارەی دراو لە کۆی گشتی کەمترە', 400);
                }
                $paidAmount = $totalAmount;
                $changeAmount = $rawPaid - $totalAmount;
            } elseif ($paymentType === 'debt') {
                if ($isCompany && !$companyId) {
                    $pdo->rollBack();
                    jsonError('بۆ فرۆشتن بە قەرز بە کۆمپانیا دەبێت کۆمپانیا دیاری بکرێت', 400);
                } elseif (!$isCompany && !$customerId) {
                    $pdo->rollBack();
                    jsonError('فرۆشتن بە قەرز بۆ کڕیاری یەکجارە ڕێگەپێدراو نییە! دەبێت کڕیاری تۆمارکراو یان کۆمپانیا هەڵبژێریت', 400);
                }
                $debtAmount = $totalAmount;
            } elseif ($paymentType === 'partial') {
                $paidAmount = min($totalAmount, max(0, (int)($b['paid_amount'] ?? 0)));
                $debtAmount = $totalAmount - $paidAmount;
                if ($debtAmount > 0) {
                    if ($isCompany && !$companyId) {
                        $pdo->rollBack();
                        jsonError('بۆ فرۆشتنی قەرزداری کۆمپانیا دەبێت کۆمپانیا دیاری بکرێت', 400);
                    } elseif (!$isCompany && !$customerId) {
                        $pdo->rollBack();
                        jsonError('فرۆشتن بە نەقد + قەرز بۆ کڕیاری یەکجارە ڕێگەپێدراو نییە! دەبێت کڕیار یان کۆمپانیا دیاری بکرێت', 400);
                    }
                }
            }

            // Generate receipt number
            $year = date('Y');
            $maxIdRow = dbFetchOne("SELECT COALESCE(MAX(id), 0) as max_id FROM sales");
            $nextId = (int)($maxIdRow['max_id'] ?? 0) + 1;
            $receiptNumber = sprintf('SZJZ-%s-%06d', $year, $nextId);

            $saleDate = getErbilDate();
            $saleTime = getErbilTime();

            // Insert into sales
            $saleId = dbInsert('sales', [
                'receipt_number' => $receiptNumber,
                'customer_type' => $customerType,
                'customer_id' => $customerId,
                'company_id' => $companyId,
                'company_driver_id' => $companyDriverId,
                'company_vehicle_id' => $companyVehicleId,
                'user_id' => $currentUser['id'],
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'total_amount' => $totalAmount,
                'total_cost' => $totalCost,
                'gross_profit' => $grossProfit,
                'paid_amount' => $paidAmount,
                'debt_amount' => $debtAmount,
                'change_amount' => $changeAmount,
                'payment_type' => $paymentType,
                'status' => 'completed',
                'notes' => trim((string)($b['notes'] ?? '')) ?: null,
                'customer_display_name' => $customerDisplayName,
                'customer_phone_snapshot' => $customerPhoneSnapshot ?: null,
                'sale_date' => $saleDate,
                'sale_time' => $saleTime,
            ]);

            // Insert sale items and cost allocations & update product quantities
            foreach ($verifiedItems as $item) {
                $saleItemId = dbInsert('sale_items', [
                    'sale_id' => $saleId,
                    'product_id' => $item['product_id'],
                    'product_name' => $item['product_name'],
                    'part_number' => $item['part_number'] ?: null,
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'unit_price' => $item['unit_price'],
                    'discount' => $item['discount'],
                    'total_price' => $item['total_price'],
                    'total_cost' => $item['total_cost'],
                ]);

                // Insert batch cost allocations
                foreach ($item['allocations'] as $alloc) {
                    dbInsert('sale_item_cost_allocations', [
                        'sale_id' => $saleId,
                        'sale_item_id' => $saleItemId,
                        'product_id' => $item['product_id'],
                        'batch_id' => $alloc['batch_id'],
                        'quantity' => $alloc['quantity'],
                        'unit_cost' => $alloc['unit_cost'],
                        'total_cost' => $alloc['total_cost'],
                    ]);
                }

                // Update product stock
                $newStock = $item['stock_before'] - $item['quantity'];
                dbQuery("UPDATE products SET quantity = :qty, updated_at = NOW() WHERE id = :id", [
                    'qty' => $newStock,
                    'id' => $item['product_id'],
                ]);

                // Record inventory movement
                dbInsert('inventory_movements', [
                    'product_id' => $item['product_id'],
                    'quantity_change' => -$item['quantity'],
                    'stock_after' => $newStock,
                    'movement_type' => 'SALE',
                    'reference_id' => $saleId,
                    'user_id' => $currentUser['id'],
                    'notes' => "فرۆشتن بە وەسڵی {$receiptNumber}",
                ]);
            }

            // Customer or Company debt record
            if ($debtAmount > 0) {
                if ($isCompany && $companyId) {
                    dbInsert('company_debts', [
                        'company_id' => $companyId,
                        'sale_id' => $saleId,
                        'driver_id' => $companyDriverId,
                        'vehicle_id' => $companyVehicleId,
                        'original_amount' => $debtAmount,
                        'paid_amount' => 0,
                        'remaining_balance' => $debtAmount,
                        'remaining_amount' => $debtAmount,
                        'status' => 'unpaid',
                    ]);
                    dbQuery(
                        "UPDATE companies
                         SET current_debt = current_debt + :debt, total_purchases = total_purchases + :tot, updated_at = NOW()
                         WHERE id = :id",
                        ['debt' => $debtAmount, 'tot' => $totalAmount, 'id' => $companyId]
                    );
                } elseif ($customerId) {
                    dbInsert('customer_debts', [
                        'customer_id' => $customerId,
                        'sale_id' => $saleId,
                        'original_amount' => $debtAmount,
                        'paid_amount' => 0,
                        'remaining_balance' => $debtAmount,
                        'status' => 'unpaid',
                    ]);
                    dbQuery(
                        "UPDATE customers
                         SET current_debt = current_debt + :debt, total_spent = total_spent + :tot, updated_at = NOW()
                         WHERE id = :id",
                        ['debt' => $debtAmount, 'tot' => $totalAmount, 'id' => $customerId]
                    );
                }
            } else {
                // Fully paid sale
                if ($isCompany && $companyId) {
                    dbQuery(
                        "UPDATE companies
                         SET total_purchases = total_purchases + :tot, total_paid = total_paid + :tot, updated_at = NOW()
                         WHERE id = :id",
                        ['tot' => $totalAmount, 'id' => $companyId]
                    );
                } elseif ($customerId) {
                    dbQuery(
                        "UPDATE customers
                         SET total_spent = total_spent + :tot, total_paid = total_paid + :tot, updated_at = NOW()
                         WHERE id = :id",
                        ['tot' => $totalAmount, 'id' => $customerId]
                    );
                }
            }

            // Payments & Cash Register synchronization
            if ($paidAmount > 0) {
                $paymentId = dbInsert('payments', [
                    'sale_id' => $saleId,
                    'customer_id' => $customerId,
                    'amount' => $paidAmount,
                    'payment_type' => 'cash',
                    'payment_date' => $saleDate,
                    'user_id' => $currentUser['id'],
                    'notes' => "پارەی دراوی وەسڵی {$receiptNumber}",
                ]);
            }

            $pdo->commit();

            logAudit($currentUser['id'], $currentUser['email'], 'CREATE_SALE', 'SALE', (string)$saleId, null, [
                'receipt_number' => $receiptNumber,
                'total_amount' => $totalAmount,
                'items_count' => count($verifiedItems),
            ]);

            $createdSale = dbFetchOne("SELECT * FROM sales WHERE id = :id", ['id' => $saleId]);
            $createdItems = dbFetchAll("SELECT * FROM sale_items WHERE sale_id = :id", ['id' => $saleId]);

            jsonSuccess([
                'sale' => $createdSale,
                'items' => $createdItems,
                'receipt_number' => $receiptNumber,
            ], 'فرۆشتن بە سەرکەوتوویی تۆمارکرا');
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            jsonError('هەڵە لە تۆمارکردنی فرۆشتن: ' . $e->getMessage(), 500);
        }
    }

    public static function list(): void {
        $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
        $customerId = isset($_GET['customer_id']) && $_GET['customer_id'] !== '' ? (int)$_GET['customer_id'] : null;
        $companyId = isset($_GET['company_id']) && $_GET['company_id'] !== '' ? (int)$_GET['company_id'] : null;
        $driverId = isset($_GET['driver_id']) && $_GET['driver_id'] !== '' ? (int)$_GET['driver_id'] : null;
        $vehicleId = isset($_GET['vehicle_id']) && $_GET['vehicle_id'] !== '' ? (int)$_GET['vehicle_id'] : null;
        $paymentType = trim((string)($_GET['payment_type'] ?? ''));
        $fromDate = trim((string)($_GET['from_date'] ?? $_GET['from'] ?? ''));
        $toDate = trim((string)($_GET['to_date'] ?? $_GET['to'] ?? ''));
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 50;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $where = ["1=1"];
        $params = [];

        if ($search !== '') {
            $where[] = "(s.receipt_number LIKE :search OR s.customer_display_name LIKE :search OR s.customer_phone_snapshot LIKE :search)";
            $params['search'] = "%{$search}%";
        }
        if ($customerId !== null) {
            $where[] = "s.customer_id = :cid";
            $params['cid'] = $customerId;
        }
        if ($companyId !== null) {
            $where[] = "s.company_id = :comp_id";
            $params['comp_id'] = $companyId;
        }
        if ($driverId !== null) {
            $where[] = "s.company_driver_id = :did";
            $params['did'] = $driverId;
        }
        if ($vehicleId !== null) {
            $where[] = "s.company_vehicle_id = :vid";
            $params['vid'] = $vehicleId;
        }
        if ($paymentType !== '') {
            $where[] = "s.payment_type = :ptype";
            $params['ptype'] = $paymentType;
        }
        if ($fromDate !== '') {
            $where[] = "s.sale_date >= :from_date";
            $params['from_date'] = $fromDate;
        }
        if ($toDate !== '') {
            $where[] = "s.sale_date <= :to_date";
            $params['to_date'] = $toDate;
        }

        $whereClause = implode(' AND ', $where);
        $total = (int)(dbFetchOne("SELECT COUNT(*) as cnt FROM sales s WHERE {$whereClause}", $params)['cnt'] ?? 0);

        $sql = "SELECT s.*, u.name as cashier_name,
                       c.name as customer_name,
                       cmp.name as company_name,
                       cd.full_name as driver_name,
                       cv.plate_number as vehicle_plate
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                LEFT JOIN customers c ON s.customer_id = c.id
                LEFT JOIN companies cmp ON s.company_id = cmp.id
                LEFT JOIN company_drivers cd ON s.company_driver_id = cd.id
                LEFT JOIN company_vehicles cv ON s.company_vehicle_id = cv.id
                WHERE {$whereClause}
                ORDER BY s.id DESC
                LIMIT {$limit} OFFSET {$offset}";

        $rows = dbFetchAll($sql, $params);

        $page = $limit > 0 ? (int)floor($offset / $limit) + 1 : 1;
        jsonSuccess($rows, null, 200, [
            'sales' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function get(int $id): void {
        $sale = dbFetchOne(
            "SELECT s.*, u.name as cashier_name,
                    c.name as customer_name, c.phone as customer_phone, c.current_debt as customer_current_debt,
                    cmp.name as company_name, cmp.phone as company_phone, cmp.current_debt as company_current_debt,
                    cd.full_name as driver_name, cd.phone as driver_phone,
                    cv.plate_number as vehicle_plate, cv.truck_model as vehicle_model
             FROM sales s
             LEFT JOIN users u ON s.user_id = u.id
             LEFT JOIN customers c ON s.customer_id = c.id
             LEFT JOIN companies cmp ON s.company_id = cmp.id
             LEFT JOIN company_drivers cd ON s.company_driver_id = cd.id
             LEFT JOIN company_vehicles cv ON s.company_vehicle_id = cv.id
             WHERE s.id = :id",
            ['id' => $id]
        );

        if (!$sale) {
            jsonError('وەسڵ نەدۆزرایەوە', 404);
        }

        $items = dbFetchAll(
            "SELECT si.*, p.barcode, p.part_number as prod_part_number
             FROM sale_items si
             LEFT JOIN products p ON si.product_id = p.id
             WHERE si.sale_id = :id",
            ['id' => $id]
        );

        $sale['items'] = $items;
        jsonSuccess($sale);
    }

    public static function getCostAllocations(int $id): void {
        $rows = dbFetchAll(
            "SELECT ca.*, si.product_name, ib.batch_number, ib.purchase_date
             FROM sale_item_cost_allocations ca
             JOIN sale_items si ON ca.sale_item_id = si.id
             JOIN inventory_batches ib ON ca.inventory_batch_id = ib.id
             WHERE ca.sale_id = :id",
            ['id' => $id]
        );
        jsonSuccess($rows);
    }

    public static function getInvoice(int $id): void {
        $config = require __DIR__ . '/../config/config.php';
        $business = $config['business'];

        $sale = dbFetchOne(
            "SELECT s.*, u.name as cashier_name,
                    c.name as customer_name, c.phone as customer_phone, c.current_debt as customer_current_debt,
                    cmp.name as company_name, cmp.phone as company_phone, cmp.current_debt as company_current_debt,
                    cd.full_name as driver_name, cd.phone as driver_phone,
                    cv.plate_number as vehicle_plate, cv.truck_model as vehicle_model
             FROM sales s
             LEFT JOIN users u ON s.user_id = u.id
             LEFT JOIN customers c ON s.customer_id = c.id
             LEFT JOIN companies cmp ON s.company_id = cmp.id
             LEFT JOIN company_drivers cd ON s.company_driver_id = cd.id
             LEFT JOIN company_vehicles cv ON s.company_vehicle_id = cv.id
             WHERE s.id = :id",
            ['id' => $id]
        );

        if (!$sale) {
            jsonError('وەسڵ نەدۆزرایەوە', 404);
        }

        $items = dbFetchAll(
            "SELECT si.*, p.barcode, p.part_number as prod_part_number, p.oem_number
             FROM sale_items si
             LEFT JOIN products p ON si.product_id = p.id
             WHERE si.sale_id = :id",
            ['id' => $id]
        );

        $previousDebt = 0;
        $currentDebt = 0;
        if (!empty($sale['company_id'])) {
            $currentDebt = (int)($sale['company_current_debt'] ?? 0);
            $previousDebt = max(0, $currentDebt - (int)$sale['debt_amount']);
        } elseif (!empty($sale['customer_id'])) {
            $currentDebt = (int)($sale['customer_current_debt'] ?? 0);
            $previousDebt = max(0, $currentDebt - (int)$sale['debt_amount']);
        }

        jsonSuccess([
            'business' => $business,
            'sale' => $sale,
            'items' => $items,
            'previous_debt' => $previousDebt,
            'current_debt' => $currentDebt,
            'total_debt_after_sale' => $currentDebt,
        ]);
    }
}
