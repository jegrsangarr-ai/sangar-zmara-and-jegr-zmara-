<?php
/**
 * Customer & Debt Controller (PHP)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class CustomerController {
    public static function list(): void {
        $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
        $hasDebt = isset($_GET['has_debt']) && ($_GET['has_debt'] === '1' || $_GET['has_debt'] === 'true');
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $where = ["is_active = 1"];
        $params = [];

        if ($search !== '') {
            $where[] = "(name LIKE :search OR phone LIKE :search)";
            $params['search'] = "%{$search}%";
        }
        if ($hasDebt) {
            $where[] = "current_debt > 0";
        }

        $whereClause = implode(' AND ', $where);
        $countSql = "SELECT COUNT(*) as total FROM customers WHERE {$whereClause}";
        $total = (int)(dbFetchOne($countSql, $params)['total'] ?? 0);

        $sql = "SELECT * FROM customers WHERE {$whereClause} ORDER BY current_debt DESC, name ASC LIMIT {$limit} OFFSET {$offset}";
        $rows = dbFetchAll($sql, $params);

        jsonSuccess($rows, null, 200, [
            'customers' => $rows,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function search(): void {
        $q = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
        $hasDebt = isset($_GET['has_debt']) && ($_GET['has_debt'] === '1' || $_GET['has_debt'] === 'true');
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;

        $where = ["is_active = 1"];
        $params = [];

        if ($q !== '') {
            $where[] = "(name LIKE :q OR phone LIKE :q)";
            $params['q'] = "%{$q}%";
        }
        if ($hasDebt) {
            $where[] = "current_debt > 0";
        }

        $whereClause = implode(' AND ', $where);
        $sql = "SELECT * FROM customers WHERE {$whereClause} ORDER BY name ASC LIMIT {$limit}";
        $rows = dbFetchAll($sql, $params);
        jsonSuccess($rows, null, 200, ['customers' => $rows]);
    }

    public static function get(int $id): void {
        $cust = dbFetchOne("SELECT * FROM customers WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$cust) {
            jsonError('کڕیار نەدۆزرایەوە', 404);
        }
        jsonSuccess($cust);
    }

    public static function create(array $currentUser): void {
        $b = getJsonInput();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی کڕیار بنووسە', 400);
        }

        $id = dbInsert('customers', [
            'name' => $name,
            'phone' => trim((string)($b['phone'] ?? '')) ?: null,
            'address' => trim((string)($b['address'] ?? '')) ?: null,
            'notes' => trim((string)($b['notes'] ?? '')) ?: null,
            'current_debt' => max(0, (int)($b['initial_debt'] ?? $b['current_debt'] ?? 0)),
            'total_spent' => 0,
            'total_paid' => 0,
            'is_active' => 1,
        ]);

        logAudit($currentUser['id'], $currentUser['email'], 'CREATE_CUSTOMER', 'CUSTOMER', (string)$id, null, $b);
        jsonSuccess(dbFetchOne("SELECT * FROM customers WHERE id = :id", ['id' => $id]), 'کڕیار بە سەرکەوتوویی زیادکرا');
    }

    public static function update(int $id, array $currentUser): void {
        $b = getJsonInput();
        $cust = dbFetchOne("SELECT * FROM customers WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$cust) {
            jsonError('کڕیار نەدۆزرایەوە', 404);
        }

        $data = [];
        if (isset($b['name'])) $data['name'] = trim((string)$b['name']);
        if (isset($b['phone'])) $data['phone'] = trim((string)$b['phone']) ?: null;
        if (isset($b['address'])) $data['address'] = trim((string)$b['address']) ?: null;
        if (isset($b['notes'])) $data['notes'] = trim((string)$b['notes']) ?: null;

        if (!empty($data)) {
            dbUpdate('customers', $data, 'id = :id', ['id' => $id]);
            logAudit($currentUser['id'], $currentUser['email'], 'UPDATE_CUSTOMER', 'CUSTOMER', (string)$id, $cust, $data);
        }

        jsonSuccess(dbFetchOne("SELECT * FROM customers WHERE id = :id", ['id' => $id]), 'زانیاری کڕیار نوێکرایەوە');
    }

    public static function getDebtDetails(int $id): void {
        $cust = dbFetchOne("SELECT * FROM customers WHERE id = :id", ['id' => $id]);
        if (!$cust) {
            jsonError('کڕیار نەدۆزرایەوە', 404);
        }

        $debts = dbFetchAll(
            "SELECT cd.*, s.receipt_number, s.sale_date, s.total_amount, s.paid_amount as sale_paid_amount
             FROM customer_debts cd
             LEFT JOIN sales s ON cd.sale_id = s.id
             WHERE cd.customer_id = :id AND cd.remaining_balance > 0
             ORDER BY cd.id ASC",
            ['id' => $id]
        );

        $payments = dbFetchAll(
            "SELECT cdp.*, u.name as user_name
             FROM customer_debt_payments cdp
             LEFT JOIN users u ON cdp.user_id = u.id
             WHERE cdp.customer_id = :id
             ORDER BY cdp.id DESC",
            ['id' => $id]
        );

        jsonSuccess([
            'customer' => $cust,
            'debts' => $debts,
            'payments' => $payments,
            'total_debt' => (int)$cust['current_debt'],
        ]);
    }

    public static function getAccount(int $id): void {
        $cust = dbFetchOne("SELECT * FROM customers WHERE id = :id", ['id' => $id]);
        if (!$cust) {
            jsonError('کڕیار نەدۆزرایەوە', 404);
        }

        $sales = dbFetchAll(
            "SELECT s.id, s.receipt_number, s.sale_date, s.sale_time, s.total_amount, s.paid_amount, s.debt_amount, s.payment_type
             FROM sales s
             WHERE s.customer_id = :id
             ORDER BY s.id DESC",
            ['id' => $id]
        );

        $payments = dbFetchAll(
            "SELECT p.id, p.amount, p.previous_balance, p.new_balance, p.payment_date, p.notes, u.name as user_name
             FROM customer_debt_payments p
             LEFT JOIN users u ON p.user_id = u.id
             WHERE p.customer_id = :id
             ORDER BY p.id DESC",
            ['id' => $id]
        );

        jsonSuccess([
            'customer' => $cust,
            'sales' => $sales,
            'payments' => $payments,
            'summary' => [
                'current_debt' => (int)$cust['current_debt'],
                'total_spent' => (int)$cust['total_spent'],
                'total_paid' => (int)$cust['total_paid'],
            ]
        ]);
    }

    public static function payDebt(array $currentUser): void {
        $b = getJsonInput();
        $customerId = (int)($b['customer_id'] ?? 0);
        $amount = (int)($b['amount'] ?? 0);
        $notes = trim((string)($b['notes'] ?? ''));
        $paymentDate = trim((string)($b['payment_date'] ?? getErbilDate()));

        if ($customerId <= 0) {
            jsonError('کڕیار دیاری نەکراوە', 400);
        }
        if ($amount <= 0) {
            jsonError('بڕی پارەی وەرگیراو دەبێت زیاتر بێت لە سفر', 400);
        }

        dbBegin();
        try {
            $cust = dbFetchOne("SELECT * FROM customers WHERE id = :id FOR UPDATE", ['id' => $customerId]);
            if (!$cust) {
                dbRollback();
                jsonError('کڕیار نەدۆزرایەوە', 404);
            }

            $currentDebt = (int)$cust['current_debt'];
            if ($currentDebt <= 0) {
                dbRollback();
                jsonError('ئەم کڕیارە هیچ قەرزێکی لەسەر نییە', 400);
            }

            $actualPay = min($amount, $currentDebt);
            $newDebt = $currentDebt - $actualPay;

            // Update customer debt balance
            dbQuery(
                "UPDATE customers
                 SET current_debt = :new_debt, total_paid = total_paid + :pay, updated_at = NOW()
                 WHERE id = :id",
                ['new_debt' => $newDebt, 'pay' => $actualPay, 'id' => $customerId]
            );

            // Record debt payment
            $paymentId = dbInsert('customer_debt_payments', [
                'customer_id' => $customerId,
                'amount' => $actualPay,
                'previous_balance' => $currentDebt,
                'new_balance' => $newDebt,
                'user_id' => $currentUser['id'],
                'payment_date' => $paymentDate,
                'notes' => $notes ?: 'پارەدان بە قەرز',
            ]);

            // Allocate payment to customer_debts rows in FIFO order
            $unpaidDebts = dbFetchAll(
                "SELECT * FROM customer_debts
                 WHERE customer_id = :cid AND remaining_balance > 0
                 ORDER BY id ASC FOR UPDATE",
                ['cid' => $customerId]
            );

            $payRemaining = $actualPay;
            foreach ($unpaidDebts as $debtRow) {
                if ($payRemaining <= 0) break;
                $rem = (int)$debtRow['remaining_balance'];
                $deduct = min($rem, $payRemaining);
                $newRem = $rem - $deduct;
                $status = $newRem <= 0 ? 'paid' : 'partial';

                dbQuery(
                    "UPDATE customer_debts
                     SET paid_amount = paid_amount + :deduct, remaining_balance = :new_rem, status = :status, updated_at = NOW()
                     WHERE id = :id",
                    ['deduct' => $deduct, 'new_rem' => $newRem, 'status' => $status, 'id' => $debtRow['id']]
                );

                $payRemaining -= $deduct;
            }

            dbCommit();

            logAudit($currentUser['id'], $currentUser['email'], 'PAY_CUSTOMER_DEBT', 'CUSTOMER', (string)$customerId, [
                'previous_debt' => $currentDebt
            ], [
                'paid' => $actualPay,
                'remaining_debt' => $newDebt
            ]);

            jsonSuccess([
                'payment_id' => $paymentId,
                'customer_id' => $customerId,
                'paid_amount' => $actualPay,
                'previous_balance' => $currentDebt,
                'remaining_balance' => $newDebt,
            ], 'قەرز بە سەرکەوتوویی وەرگیرا');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە وەرگرتنی قەرز: ' . $e->getMessage(), 500);
        }
    }

    public static function unifiedDebts(): void {
        $search = trim((string)($_GET['search'] ?? ''));
        $type = strtolower(trim((string)($_GET['type'] ?? 'all')));
        $onlyIndebted = isset($_GET['only_indebted']) && ($_GET['only_indebted'] === '1' || $_GET['only_indebted'] === 'true');

        // Calculate summary statistics
        $custStats = dbFetchOne("
            SELECT 
                COALESCE(SUM(current_debt), 0) as total_cust_debt,
                COUNT(CASE WHEN current_debt > 0 THEN 1 END) as indebted_cust_count,
                COUNT(*) as total_cust_count
            FROM customers
            WHERE is_active = 1
        ");

        $compStats = dbFetchOne("
            SELECT 
                COALESCE(SUM(current_debt), 0) as total_comp_debt,
                COUNT(CASE WHEN current_debt > 0 THEN 1 END) as indebted_comp_count,
                COUNT(*) as total_comp_count
            FROM companies
            WHERE is_active = 1
        ");

        $suppStats = dbFetchOne("
            SELECT 
                COALESCE(SUM(balance_debt), 0) as total_supp_debt,
                COUNT(CASE WHEN balance_debt > 0 THEN 1 END) as indebted_supp_count
            FROM suppliers
            WHERE is_active = 1
        ");

        $totalCustDebt = (int)($custStats['total_cust_debt'] ?? 0);
        $totalCompDebt = (int)($compStats['total_comp_debt'] ?? 0);
        $totalSuppDebt = (int)($suppStats['total_supp_debt'] ?? 0);
        $totalAllDebt = $totalCustDebt + $totalCompDebt;
        $indebtedCustCount = (int)($custStats['indebted_cust_count'] ?? 0);
        $indebtedCompCount = (int)($compStats['indebted_comp_count'] ?? 0);
        $indebtedSuppCount = (int)($suppStats['indebted_supp_count'] ?? 0);
        $totalCustCount = (int)($custStats['total_cust_count'] ?? 0);
        $totalCompCount = (int)($compStats['total_comp_count'] ?? 0);

        $rows = [];

        // 1. Individual Customers
        if ($type === 'all' || $type === 'individual' || $type === 'cust') {
            $custWhere = ["c.is_active = 1"];
            $custParams = [];

            if ($onlyIndebted) {
                $custWhere[] = "c.current_debt > 0";
            }
            if ($search !== '') {
                $custWhere[] = "(c.name LIKE :c_search OR c.phone LIKE :c_search OR c.address LIKE :c_search)";
                $custParams['c_search'] = "%{$search}%";
            }

            $custSql = "
                SELECT 
                    'individual' AS account_type,
                    c.id,
                    c.name,
                    NULL AS owner_name,
                    NULL AS driver_names,
                    NULL AS vehicle_plates,
                    c.phone,
                    c.address,
                    c.notes,
                    c.current_debt,
                    c.total_spent AS total_purchases,
                    c.total_paid,
                    c.created_at
                FROM customers c
                WHERE " . implode(' AND ', $custWhere) . "
                ORDER BY c.current_debt DESC, c.id DESC
            ";
            $custRows = dbFetchAll($custSql, $custParams);
            foreach ($custRows as $cr) {
                $rows[] = $cr;
            }
        }

        // 2. Companies
        if ($type === 'all' || $type === 'company' || $type === 'cmp') {
            $compWhere = ["cmp.is_active = 1"];
            $compParams = [];

            if ($onlyIndebted) {
                $compWhere[] = "cmp.current_debt > 0";
            }
            if ($search !== '') {
                $compWhere[] = "(cmp.name LIKE :cmp_search OR cmp.owner_name LIKE :cmp_search OR cmp.phone LIKE :cmp_search OR cmp.address LIKE :cmp_search)";
                $compParams['cmp_search'] = "%{$search}%";
            }

            $compSql = "
                SELECT 
                    'company' AS account_type,
                    cmp.id,
                    cmp.name,
                    cmp.owner_name,
                    (SELECT GROUP_CONCAT(d.full_name SEPARATOR '، ') FROM company_drivers d WHERE d.company_id = cmp.id AND d.is_active = 1) AS driver_names,
                    (SELECT GROUP_CONCAT(CONCAT(IFNULL(v.plate_number, ''), ' ', IFNULL(v.truck_brand, '')) SEPARATOR '، ') FROM company_vehicles v WHERE v.company_id = cmp.id AND v.is_active = 1) AS vehicle_plates,
                    cmp.phone,
                    cmp.address,
                    cmp.notes,
                    cmp.current_debt,
                    cmp.total_purchases,
                    cmp.total_paid,
                    cmp.created_at
                FROM companies cmp
                WHERE " . implode(' AND ', $compWhere) . "
                ORDER BY cmp.current_debt DESC, cmp.id DESC
            ";
            $compRows = dbFetchAll($compSql, $compParams);
            foreach ($compRows as $cmpr) {
                $rows[] = $cmpr;
            }
        }

        // Sort combined list: current_debt DESC, then name ASC
        usort($rows, function ($a, $b) {
            $diff = ((int)($b['current_debt'] ?? 0)) - ((int)($a['current_debt'] ?? 0));
            if ($diff !== 0) return $diff;
            return strcmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
        });

        $summary = [
            'totalAllDebt' => $totalAllDebt,
            'totalCustDebt' => $totalCustDebt,
            'totalCompDebt' => $totalCompDebt,
            'totalSuppDebt' => $totalSuppDebt,
            'indebtedCustCount' => $indebtedCustCount,
            'indebtedCompCount' => $indebtedCompCount,
            'indebtedSuppCount' => $indebtedSuppCount,
            'totalAccounts' => $totalCustCount + $totalCompCount,
            'totalIndebtedAccounts' => $indebtedCustCount + $indebtedCompCount,
        ];

        jsonSuccess($rows, null, 200, [
            'summary' => $summary,
            'total' => count($rows),
        ]);
    }
}
