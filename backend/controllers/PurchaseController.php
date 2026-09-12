<?php
/**
 * Purchase Controller (PHP)
 * Supplier purchase receipts, inventory batches creation, supplier debt, cash sync
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class PurchaseController {
    public static function create(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $supplierId = (int)($b['supplier_id'] ?? 0);
        $items = $b['items'] ?? [];

        if ($supplierId <= 0) {
            jsonError('تکایە دابینکەر دیاری بکە', 400);
        }
        if (empty($items) || !is_array($items)) {
            jsonError('هیچ کاڵایەک لە پسوولەی کڕین نییە', 400);
        }

        $pdo = getDbConnection();
        $pdo->beginTransaction();

        try {
            $suppStmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = :id FOR UPDATE");
            $suppStmt->execute(['id' => $supplierId]);
            $supplier = $suppStmt->fetch();

            if (!$supplier) {
                $pdo->rollBack();
                jsonError('دابینکەر نەدۆزرایەوە', 404);
            }

            $totalAmount = 0;
            $verifiedItems = [];

            foreach ($items as $it) {
                $productId = (int)($it['product_id'] ?? 0);
                $quantity = (int)($it['quantity'] ?? 0);
                $unitCost = max(0, (int)($it['unit_cost'] ?? $it['purchase_price'] ?? 0));

                if ($productId <= 0 || $quantity <= 0) {
                    continue;
                }

                $prodStmt = $pdo->prepare("SELECT * FROM products WHERE id = :id FOR UPDATE");
                $prodStmt->execute(['id' => $productId]);
                $prod = $prodStmt->fetch();

                if (!$prod) {
                    $pdo->rollBack();
                    jsonError("کاڵای ژمارە {$productId} نەدۆزرایەوە", 400);
                }

                $totalCost = $quantity * $unitCost;
                $totalAmount += $totalCost;

                $verifiedItems[] = [
                    'product_id' => $productId,
                    'product_name' => $prod['name'],
                    'part_number' => $prod['part_number'] ?? null,
                    'quantity' => $quantity,
                    'unit_cost' => $unitCost,
                    'selling_price' => (int)($prod['selling_price'] ?? 0),
                    'total_cost' => $totalCost,
                    'current_stock' => (int)$prod['quantity'],
                ];
            }

            if (empty($verifiedItems)) {
                $pdo->rollBack();
                jsonError('تکایە لانیکەم یەک کاڵا بە بڕی دروست بنووسە', 400);
            }

            $paidAmount = min($totalAmount, max(0, (int)($b['paid_amount'] ?? 0)));
            $debtAmount = $totalAmount - $paidAmount;
            $purchaseDate = trim((string)($b['purchase_date'] ?? getErbilDate()));

            $year = date('Y');
            $maxPurRow = dbFetchOne("SELECT COALESCE(MAX(id), 0) as max_id FROM purchases");
            $nextPurId = (int)($maxPurRow['max_id'] ?? 0) + 1;
            $invoiceNumber = trim((string)($b['invoice_number'] ?? '')) ?: sprintf('PUR-%s-%06d', $year, $nextPurId);

            $purchaseId = dbInsert('purchases', [
                'supplier_id' => $supplierId,
                'user_id' => $currentUser['id'],
                'invoice_number' => $invoiceNumber,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'debt_amount' => $debtAmount,
                'purchase_date' => $purchaseDate,
                'notes' => trim((string)($b['notes'] ?? '')) ?: null,
            ]);

            foreach ($verifiedItems as $vIt) {
                dbInsert('purchase_items', [
                    'purchase_id' => $purchaseId,
                    'product_id' => $vIt['product_id'],
                    'item_name' => $vIt['product_name'],
                    'part_number' => $vIt['part_number'],
                    'quantity' => $vIt['quantity'],
                    'purchase_price' => $vIt['unit_cost'],
                    'selling_price' => $vIt['selling_price'],
                    'total_price' => $vIt['total_cost'],
                ]);
            }

            // Update supplier balance (only supplier debt and purchase history)
            dbQuery(
                "UPDATE suppliers
                 SET total_purchases = total_purchases + :tot,
                     total_paid = total_paid + :paid,
                     current_debt = current_debt + :debt,
                     balance_debt = balance_debt + :debt2,
                     updated_at = NOW()
                 WHERE id = :id",
                [
                    'tot' => $totalAmount,
                    'paid' => $paidAmount,
                    'debt' => $debtAmount,
                    'debt2' => $debtAmount,
                    'id' => $supplierId
                ]
            );

            // Record payment in supplier payment history if paid amount > 0
            if ($paidAmount > 0) {
                dbInsert('supplier_payments', [
                    'supplier_id' => $supplierId,
                    'amount' => $paidAmount,
                    'previous_balance' => (int)($supplier['current_debt'] ?? 0) + $totalAmount,
                    'new_balance' => (int)($supplier['current_debt'] ?? 0) + $debtAmount,
                    'user_id' => $currentUser['id'],
                    'payment_date' => $purchaseDate,
                    'notes' => "پارەی دراو دەستبەجێ لەکاتی کڕینی وەسڵی {$invoiceNumber}",
                ]);
            }

            $pdo->commit();

            logAudit($currentUser['id'], $currentUser['email'], 'CREATE_PURCHASE', 'PURCHASE', (string)$purchaseId, null, [
                'invoice_number' => $invoiceNumber,
                'total_amount' => $totalAmount,
                'supplier_name' => $supplier['name'],
            ]);

            jsonSuccess([
                'purchase_id' => $purchaseId,
                'invoice_number' => $invoiceNumber,
                'total_amount' => $totalAmount,
            ], 'پسوولەی کڕین بە سەرکەوتوویی تۆمارکرا');
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            jsonError('هەڵە لە تۆمارکردنی کڕین: ' . $e->getMessage(), 500);
        }
    }

    public static function list(): void {
        $supplierId = isset($_GET['supplier_id']) ? (int)$_GET['supplier_id'] : null;
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 50;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $where = ["1=1"];
        $params = [];

        if ($supplierId !== null) {
            $where[] = "p.supplier_id = :sid";
            $params['sid'] = $supplierId;
        }

        $whereClause = implode(' AND ', $where);
        $total = (int)(dbFetchOne("SELECT COUNT(*) as cnt FROM purchases p WHERE {$whereClause}", $params)['cnt'] ?? 0);

        $sql = "SELECT p.*, s.name as supplier_name, u.name as user_name
                FROM purchases p
                LEFT JOIN suppliers s ON p.supplier_id = s.id
                LEFT JOIN users u ON p.user_id = u.id
                WHERE {$whereClause}
                ORDER BY p.id DESC
                LIMIT {$limit} OFFSET {$offset}";

        $rows = dbFetchAll($sql, $params);

        $page = $limit > 0 ? (int)floor($offset / $limit) + 1 : 1;
        jsonSuccess($rows, null, 200, [
            'purchases' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function get(int $id): void {
        $pur = dbFetchOne(
            "SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, u.name as user_name
             FROM purchases p
             LEFT JOIN suppliers s ON p.supplier_id = s.id
             LEFT JOIN users u ON p.user_id = u.id
             WHERE p.id = :id",
            ['id' => $id]
        );

        if (!$pur) {
            jsonError('پسوولەی کڕین نەدۆزرایەوە', 404);
        }

        $items = dbFetchAll(
            "SELECT pi.*, pr.name as product_name, pr.part_number, pr.barcode
             FROM purchase_items pi
             LEFT JOIN products pr ON pi.product_id = pr.id
             WHERE pi.purchase_id = :id",
            ['id' => $id]
        );

        $pur['items'] = $items;
        jsonSuccess($pur);
    }

    public static function returnPurchase(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        // Returns items from purchase back to supplier
        jsonError('گەڕاندنەوەی کڕین لەم وەشانەدا پشتیوانی ناکرێت', 501);
    }

    public static function supplierDebtsReport(): void {
        $rows = dbFetchAll(
            "SELECT s.id, s.name, s.phone, s.contact_person, s.current_debt, s.total_purchases, s.total_paid
             FROM suppliers s
             WHERE s.is_active = 1 AND s.current_debt > 0
             ORDER BY s.current_debt DESC"
        );
        $total = array_sum(array_column($rows, 'current_debt'));

        jsonSuccess([
            'suppliers' => $rows,
            'total_debt' => $total,
            'count' => count($rows),
        ]);
    }
}
