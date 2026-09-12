<?php
/**
 * Return Controller (ئیسترجاع) (PHP)
 * Restores product stock, handles cash refunds and debt adjustments
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class ReturnController {
    public static function create(array $currentUser): void {
        $b = getJsonInput();
        $saleId = (int)($b['sale_id'] ?? 0);
        $items = $b['items'] ?? [];

        if ($saleId <= 0) {
            jsonError('وەسڵ دیاری نەکراوە', 400);
        }
        if (empty($items) || !is_array($items)) {
            jsonError('هیچ کاڵایەک بۆ گەڕاندنەوە دیاری نەکراوە', 400);
        }

        $pdo = getDbConnection();
        $pdo->beginTransaction();

        try {
            $saleStmt = $pdo->prepare("SELECT * FROM sales WHERE id = :id FOR UPDATE");
            $saleStmt->execute(['id' => $saleId]);
            $sale = $saleStmt->fetch();

            if (!$sale) {
                $pdo->rollBack();
                jsonError('وەسڵ نەدۆزرایەوە', 404);
            }

            $totalRefund = 0;
            $verifiedReturnItems = [];

            foreach ($items as $it) {
                $saleItemId = (int)($it['sale_item_id'] ?? 0);
                $returnQty = (int)($it['quantity'] ?? 0);

                if ($returnQty <= 0) continue;

                $siStmt = $pdo->prepare("SELECT * FROM sale_items WHERE id = :id AND sale_id = :sid FOR UPDATE");
                $siStmt->execute(['id' => $saleItemId, 'sid' => $saleId]);
                $saleItem = $siStmt->fetch();

                if (!$saleItem) {
                    $pdo->rollBack();
                    jsonError('کاڵای وەسڵ نەدۆزرایەوە', 400);
                }

                // Check already returned quantity
                $retPrevStmt = $pdo->prepare("SELECT COALESCE(SUM(quantity), 0) as ret_qty FROM return_items WHERE sale_item_id = :si_id");
                $retPrevStmt->execute(['si_id' => $saleItemId]);
                $alreadyReturned = (int)($retPrevStmt->fetch()['ret_qty'] ?? 0);

                $availableToReturn = (int)$saleItem['quantity'] - $alreadyReturned;
                if ($returnQty > $availableToReturn) {
                    $pdo->rollBack();
                    jsonError("بڕی گەڕاوەی ({$saleItem['product_name']}) لە بڕی فرۆشراوی ماوە زیاترە! ماوە بۆ گەڕاندنەوە: {$availableToReturn}", 400);
                }

                $unitPrice = (int)$saleItem['unit_price'];
                $itemRefund = $unitPrice * $returnQty;
                $totalRefund += $itemRefund;

                $verifiedReturnItems[] = [
                    'sale_item_id' => $saleItemId,
                    'product_id' => (int)$saleItem['product_id'],
                    'product_name' => $saleItem['product_name'],
                    'quantity' => $returnQty,
                    'unit_price' => $unitPrice,
                    'unit_cost' => (int)$saleItem['unit_cost'],
                    'total_price' => $itemRefund,
                ];
            }

            if (empty($verifiedReturnItems)) {
                $pdo->rollBack();
                jsonError('هیچ بڕێکی دروست بۆ گەڕاندنەوە دیاری نەکراوە', 400);
            }

            $year = date('Y');
            $maxRetRow = dbFetchOne("SELECT COALESCE(MAX(id), 0) as max_id FROM returns");
            $nextRetId = (int)($maxRetRow['max_id'] ?? 0) + 1;
            $returnNumber = sprintf('RET-%s-%06d', $year, $nextRetId);

            $refundType = (string)($b['refund_type'] ?? 'cash'); // 'cash' or 'debt_reduction'

            $returnId = dbInsert('returns', [
                'return_number' => $returnNumber,
                'sale_id' => $saleId,
                'customer_id' => $sale['customer_id'],
                'user_id' => $currentUser['id'],
                'total_refund' => $totalRefund,
                'refund_type' => $refundType,
                'notes' => trim((string)($b['notes'] ?? '')) ?: 'ئیسترجاعی فرۆشتن',
                'return_date' => getErbilDate(),
            ]);

            foreach ($verifiedReturnItems as $vItem) {
                dbInsert('return_items', [
                    'return_id' => $returnId,
                    'sale_item_id' => $vItem['sale_item_id'],
                    'product_id' => $vItem['product_id'],
                    'quantity' => $vItem['quantity'],
                    'unit_price' => $vItem['unit_price'],
                    'total_price' => $vItem['total_price'],
                    'reason' => trim((string)($b['reason'] ?? '')) ?: null,
                ]);

                // Restore product stock
                dbQuery("UPDATE products SET quantity = quantity + :q, updated_at = NOW() WHERE id = :id", [
                    'q' => $vItem['quantity'],
                    'id' => $vItem['product_id'],
                ]);

                // Record inventory movement
                $prodRow = dbFetchOne("SELECT quantity FROM products WHERE id = :id", ['id' => $vItem['product_id']]);
                dbInsert('inventory_movements', [
                    'product_id' => $vItem['product_id'],
                    'quantity_change' => $vItem['quantity'],
                    'stock_after' => (int)($prodRow['quantity'] ?? 0),
                    'movement_type' => 'SALE_RETURN',
                    'reference_id' => $returnId,
                    'user_id' => $currentUser['id'],
                    'notes' => "گەڕاندنەوەی کاڵا بە وەسڵی {$returnNumber}",
                ]);

                // Restore inventory batch
                dbInsert('inventory_batches', [
                    'product_id' => $vItem['product_id'],
                    'batch_type' => 'RETURN',
                    'batch_number' => 'RET-' . date('Ymd') . "-{$vItem['product_id']}",
                    'original_quantity' => $vItem['quantity'],
                    'remaining_quantity' => $vItem['quantity'],
                    'unit_cost' => $vItem['unit_cost'],
                    'purchase_date' => getErbilDate(),
                    'notes' => "گەڕاوە لە وەسڵی فرۆشتن {$sale['receipt_number']}",
                ]);
            }

            // Adjust debts or refund cash
            if ($refundType === 'debt_reduction') {
                if (!empty($sale['company_id'])) {
                    dbQuery("UPDATE companies SET current_debt = GREATEST(0, current_debt - :ref), updated_at = NOW() WHERE id = :id", [
                        'ref' => $totalRefund,
                        'id' => $sale['company_id']
                    ]);
                } elseif (!empty($sale['customer_id'])) {
                    dbQuery("UPDATE customers SET current_debt = GREATEST(0, current_debt - :ref), updated_at = NOW() WHERE id = :id", [
                        'ref' => $totalRefund,
                        'id' => $sale['customer_id']
                    ]);
                }
            }

            $pdo->commit();

            logAudit($currentUser['id'], $currentUser['email'], 'CREATE_RETURN', 'RETURN', (string)$returnId, null, [
                'return_number' => $returnNumber,
                'total_refund' => $totalRefund,
            ]);

            jsonSuccess([
                'return_id' => $returnId,
                'return_number' => $returnNumber,
                'total_refund' => $totalRefund,
            ], 'ئیسترجاع بە سەرکەوتوویی تۆمارکرا');
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            jsonError('هەڵە لە تۆمارکردنی ئیسترجاع: ' . $e->getMessage(), 500);
        }
    }

    public static function list(): void {
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 50;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $total = (int)(dbFetchOne("SELECT COUNT(*) as cnt FROM returns")['cnt'] ?? 0);

        $sql = "SELECT r.*, s.receipt_number, u.name as user_name, c.name as customer_name
                FROM returns r
                JOIN sales s ON r.sale_id = s.id
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN customers c ON r.customer_id = c.id
                ORDER BY r.id DESC
                LIMIT {$limit} OFFSET {$offset}";

        $rows = dbFetchAll($sql);

        $page = $limit > 0 ? (int)floor($offset / $limit) + 1 : 1;
        jsonSuccess($rows, null, 200, [
            'returns' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function get(int $id): void {
        $ret = dbFetchOne(
            "SELECT r.*, s.receipt_number, u.name as user_name, c.name as customer_name
             FROM returns r
             JOIN sales s ON r.sale_id = s.id
             LEFT JOIN users u ON r.user_id = u.id
             LEFT JOIN customers c ON r.customer_id = c.id
             WHERE r.id = :id",
            ['id' => $id]
        );

        if (!$ret) {
            jsonError('ئیسترجاع نەدۆزرایەوە', 404);
        }

        $items = dbFetchAll(
            "SELECT ri.*, p.name as product_name, p.part_number
             FROM return_items ri
             LEFT JOIN products p ON ri.product_id = p.id
             WHERE ri.return_id = :id",
            ['id' => $id]
        );

        $ret['items'] = $items;
        jsonSuccess($ret);
    }
}
