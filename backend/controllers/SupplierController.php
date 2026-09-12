<?php
/**
 * Supplier & Supplier Debt Controller (PHP)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class SupplierController {
    public static function list(): void {
        $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
        $hasDebt = isset($_GET['has_debt']) && ($_GET['has_debt'] === '1' || $_GET['has_debt'] === 'true');

        $where = ["is_active = 1"];
        $params = [];

        if ($search !== '') {
            $where[] = "(name LIKE :search OR phone LIKE :search OR contact_person LIKE :search)";
            $params['search'] = "%{$search}%";
        }
        if ($hasDebt) {
            $where[] = "current_debt > 0";
        }

        $sql = "SELECT * FROM suppliers WHERE " . implode(' AND ', $where) . " ORDER BY current_debt DESC, name ASC";
        jsonSuccess(dbFetchAll($sql, $params));
    }

    public static function search(): void {
        $q = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
        $where = ["is_active = 1"];
        $params = [];
        if ($q !== '') {
            $where[] = "(name LIKE :q OR phone LIKE :q OR contact_person LIKE :q)";
            $params['q'] = "%{$q}%";
        }
        $sql = "SELECT * FROM suppliers WHERE " . implode(' AND ', $where) . " ORDER BY name ASC LIMIT 30";
        jsonSuccess(dbFetchAll($sql, $params));
    }

    public static function debtOverview(): void {
        $suppliers = dbFetchAll(
            "SELECT * FROM suppliers WHERE is_active = 1 AND current_debt > 0 ORDER BY current_debt DESC"
        );
        $totalDebt = array_sum(array_column($suppliers, 'current_debt'));

        jsonSuccess([
            'suppliers' => $suppliers,
            'total_debt' => $totalDebt,
            'supplier_count' => count($suppliers),
        ]);
    }

    public static function get(int $id): void {
        $supp = dbFetchOne("SELECT * FROM suppliers WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$supp) {
            jsonError('دابینکەر نەدۆزرایەوە', 404);
        }
        jsonSuccess($supp);
    }

    public static function create(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی دابینکەر بنووسە', 400);
        }

        $id = dbInsert('suppliers', [
            'name' => $name,
            'phone' => trim((string)($b['phone'] ?? '')) ?: null,
            'contact_person' => trim((string)($b['contact_person'] ?? '')) ?: null,
            'address' => trim((string)($b['address'] ?? '')) ?: null,
            'notes' => trim((string)($b['notes'] ?? '')) ?: null,
            'current_debt' => max(0, (int)($b['initial_debt'] ?? $b['current_debt'] ?? 0)),
            'total_purchases' => 0,
            'total_paid' => 0,
            'is_active' => 1,
        ]);

        logAudit($currentUser['id'], $currentUser['email'], 'CREATE_SUPPLIER', 'SUPPLIER', (string)$id, null, $b);
        jsonSuccess(dbFetchOne("SELECT * FROM suppliers WHERE id = :id", ['id' => $id]), 'دابینکەر بە سەرکەوتوویی زیادکرا');
    }

    public static function update(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $supp = dbFetchOne("SELECT * FROM suppliers WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$supp) {
            jsonError('دابینکەر نەدۆزرایەوە', 404);
        }

        $data = [];
        if (isset($b['name'])) $data['name'] = trim((string)$b['name']);
        if (isset($b['phone'])) $data['phone'] = trim((string)$b['phone']) ?: null;
        if (isset($b['contact_person'])) $data['contact_person'] = trim((string)$b['contact_person']) ?: null;
        if (isset($b['address'])) $data['address'] = trim((string)$b['address']) ?: null;
        if (isset($b['notes'])) $data['notes'] = trim((string)$b['notes']) ?: null;

        if (!empty($data)) {
            dbUpdate('suppliers', $data, 'id = :id', ['id' => $id]);
            logAudit($currentUser['id'], $currentUser['email'], 'UPDATE_SUPPLIER', 'SUPPLIER', (string)$id, $supp, $data);
        }

        jsonSuccess(dbFetchOne("SELECT * FROM suppliers WHERE id = :id", ['id' => $id]), 'زانیاری دابینکەر نوێکرایەوە');
    }

    public static function pay(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $supplierId = (int)($b['supplier_id'] ?? 0);
        $amount = (int)($b['amount'] ?? 0);
        $notes = trim((string)($b['notes'] ?? ''));
        $paymentDate = trim((string)($b['payment_date'] ?? getErbilDate()));

        if ($supplierId <= 0) {
            jsonError('دابینکەر دیاری نەکراوە', 400);
        }
        if ($amount <= 0) {
            jsonError('بڕی پارەی دراو دەبێت زیاتر بێت لە سفر', 400);
        }

        dbBegin();
        try {
            $supp = dbFetchOne("SELECT * FROM suppliers WHERE id = :id FOR UPDATE", ['id' => $supplierId]);
            if (!$supp) {
                dbRollback();
                jsonError('دابینکەر نەدۆزرایەوە', 404);
            }

            $currentDebt = (int)$supp['current_debt'];
            if ($currentDebt <= 0) {
                dbRollback();
                jsonError('هیچ قەرزێکی ئەم دابینکەرە لەسەر نییە', 400);
            }

            $actualPay = min($amount, $currentDebt);
            $newDebt = $currentDebt - $actualPay;

            // Update supplier balance
            dbQuery(
                "UPDATE suppliers
                 SET current_debt = :new_debt, total_paid = total_paid + :pay, updated_at = NOW()
                 WHERE id = :id",
                ['new_debt' => $newDebt, 'pay' => $actualPay, 'id' => $supplierId]
            );

            // Record payment
            $paymentId = dbInsert('supplier_payments', [
                'supplier_id' => $supplierId,
                'amount' => $actualPay,
                'previous_balance' => $currentDebt,
                'new_balance' => $newDebt,
                'user_id' => $currentUser['id'],
                'payment_date' => $paymentDate,
                'notes' => $notes ?: 'دانەوەی قەرزی دابینکەر',
            ]);

            dbCommit();

            logAudit($currentUser['id'], $currentUser['email'], 'PAY_SUPPLIER', 'SUPPLIER', (string)$supplierId, [
                'previous_debt' => $currentDebt
            ], [
                'paid' => $actualPay,
                'remaining_debt' => $newDebt
            ]);

            jsonSuccess([
                'payment_id' => $paymentId,
                'supplier_id' => $supplierId,
                'paid_amount' => $actualPay,
                'previous_balance' => $currentDebt,
                'remaining_balance' => $newDebt,
            ], 'قەرزی دابینکەر بە سەرکەوتوویی درایەوە');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە دانەوەی قەرز: ' . $e->getMessage(), 500);
        }
    }

    public static function getPayments(int $id): void {
        $payments = dbFetchAll(
            "SELECT p.*, u.name as user_name
             FROM supplier_payments p
             LEFT JOIN users u ON p.user_id = u.id
             WHERE p.supplier_id = :id
             ORDER BY p.id DESC",
            ['id' => $id]
        );
        jsonSuccess($payments);
    }

    public static function getStatement(int $id): void {
        $supp = dbFetchOne("SELECT * FROM suppliers WHERE id = :id", ['id' => $id]);
        if (!$supp) {
            jsonError('دابینکەر نەدۆزرایەوە', 404);
        }

        $purchases = dbFetchAll(
            "SELECT p.*, u.name as user_name
             FROM purchases p
             LEFT JOIN users u ON p.user_id = u.id
             WHERE p.supplier_id = :id
             ORDER BY p.id DESC",
            ['id' => $id]
        );

        $payments = dbFetchAll(
            "SELECT sp.*, u.name as user_name
             FROM supplier_payments sp
             LEFT JOIN users u ON sp.user_id = u.id
             WHERE sp.supplier_id = :id
             ORDER BY sp.id DESC",
            ['id' => $id]
        );

        jsonSuccess([
            'supplier' => $supp,
            'purchases' => $purchases,
            'payments' => $payments,
            'summary' => [
                'current_debt' => (int)$supp['current_debt'],
                'total_purchases' => (int)$supp['total_purchases'],
                'total_paid' => (int)$supp['total_paid'],
            ]
        ]);
    }
}
