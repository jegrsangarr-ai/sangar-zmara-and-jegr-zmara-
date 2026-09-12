<?php
/**
 * Inventory Controller (PHP)
 * Batches, Stock adjustments, and Inventory Movements
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class InventoryController {
    public static function listMovements(): void {
        $productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : null;
        $type = trim((string)($_GET['type'] ?? ''));
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $where = ["1=1"];
        $params = [];

        if ($productId !== null) {
            $where[] = "m.product_id = :pid";
            $params['pid'] = $productId;
        }
        if ($type !== '') {
            $where[] = "m.movement_type = :type";
            $params['type'] = $type;
        }

        $whereClause = implode(' AND ', $where);
        $total = (int)(dbFetchOne("SELECT COUNT(*) as cnt FROM inventory_movements m WHERE {$whereClause}", $params)['cnt'] ?? 0);

        $sql = "SELECT m.*, p.name as product_name, p.part_number, u.name as user_name
                FROM inventory_movements m
                JOIN products p ON m.product_id = p.id
                LEFT JOIN users u ON m.user_id = u.id
                WHERE {$whereClause}
                ORDER BY m.id DESC
                LIMIT {$limit} OFFSET {$offset}";

        $rows = dbFetchAll($sql, $params);

        $page = $limit > 0 ? (int)floor($offset / $limit) + 1 : 1;
        jsonSuccess($rows, null, 200, [
            'movements' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function adjustStock(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $productId = (int)($b['product_id'] ?? 0);
        $newQuantity = (int)($b['new_quantity'] ?? $b['quantity'] ?? 0);
        $reason = trim((string)($b['reason'] ?? $b['notes'] ?? 'چاککردنی مەخزەن'));

        if ($productId <= 0) {
            jsonError('کاڵا دیاری نەکراوە', 400);
        }

        $pdo = getDbConnection();
        $pdo->beginTransaction();

        try {
            $prodStmt = $pdo->prepare("SELECT * FROM products WHERE id = :id FOR UPDATE");
            $prodStmt->execute(['id' => $productId]);
            $prod = $prodStmt->fetch();

            if (!$prod) {
                $pdo->rollBack();
                jsonError('کاڵا نەدۆزرایەوە', 404);
            }

            $currentStock = (int)$prod['quantity'];
            $change = $newQuantity - $currentStock;

            if ($change === 0) {
                $pdo->rollBack();
                jsonSuccess($prod, 'هیچ گۆڕانکارییەک لە ژمارەی مەخزەن ڕووی نەداوە');
            }

            // Update product stock
            $upStmt = $pdo->prepare("UPDATE products SET quantity = :q, updated_at = NOW() WHERE id = :id");
            $upStmt->execute(['q' => $newQuantity, 'id' => $productId]);

            // Record movement
            $movStmt = $pdo->prepare(
                "INSERT INTO inventory_movements (product_id, quantity_change, stock_after, movement_type, user_id, notes, created_at)
                 VALUES (:pid, :chg, :after, 'ADJUSTMENT', :uid, :notes, NOW())"
            );
            $movStmt->execute([
                'pid' => $productId,
                'chg' => $change,
                'after' => $newQuantity,
                'uid' => $currentUser['id'],
                'notes' => $reason,
            ]);

            // Adjust batch
            if ($change > 0) {
                // Add new batch for extra stock
                $insBatch = $pdo->prepare(
                    "INSERT INTO inventory_batches (product_id, batch_type, batch_number, original_quantity, remaining_quantity, unit_cost, purchase_date, notes, created_at, updated_at)
                     VALUES (:pid, 'ADJUSTMENT', :bnum, :orig, :rem, :cost, CURDATE(), :notes, NOW(), NOW())"
                );
                $insBatch->execute([
                    'pid' => $productId,
                    'bnum' => 'ADJ-' . date('Ymd') . "-{$productId}",
                    'orig' => $change,
                    'rem' => $change,
                    'cost' => (int)$prod['purchase_price'],
                    'notes' => $reason,
                ]);
            } else {
                // Deduct from existing batches
                $absChange = abs($change);
                $batches = dbFetchAll("SELECT * FROM inventory_batches WHERE product_id = :pid AND remaining_quantity > 0 ORDER BY purchase_date ASC, id ASC FOR UPDATE", ['pid' => $productId]);
                $remDeduct = $absChange;
                foreach ($batches as $batch) {
                    if ($remDeduct <= 0) break;
                    $avail = (int)$batch['remaining_quantity'];
                    $take = min($avail, $remDeduct);
                    $pdo->prepare("UPDATE inventory_batches SET remaining_quantity = remaining_quantity - :t WHERE id = :id")->execute(['t' => $take, 'id' => $batch['id']]);
                    $remDeduct -= $take;
                }
            }

            $pdo->commit();

            logAudit($currentUser['id'], $currentUser['email'], 'ADJUST_STOCK', 'INVENTORY', (string)$productId, [
                'stock_before' => $currentStock
            ], [
                'stock_after' => $newQuantity,
                'change' => $change,
                'reason' => $reason,
            ]);

            $updatedProd = dbFetchOne("SELECT * FROM products WHERE id = :id", ['id' => $productId]);
            jsonSuccess($updatedProd, 'مەخزەن بە سەرکەوتوویی نوێکرایەوە');
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            jsonError('هەڵە لە نوێکردنەوەی مەخزەن: ' . $e->getMessage(), 500);
        }
    }

    public static function listBatches(): void {
        $productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : null;
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 150;

        $where = ["ib.remaining_quantity > 0"];
        $params = [];

        if ($productId !== null) {
            $where[] = "ib.product_id = :pid";
            $params['pid'] = $productId;
        }

        $sql = "SELECT ib.*, p.name as product_name, p.part_number, p.barcode
                FROM inventory_batches ib
                JOIN products p ON ib.product_id = p.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY ib.purchase_date ASC, ib.id ASC
                LIMIT {$limit}";

        $rows = dbFetchAll($sql, $params);

        $totalFifoValuation = 0;
        $totalFifoUnits = 0;
        $uniqueProducts = [];
        foreach ($rows as $r) {
            $totalFifoValuation += ((int)$r['remaining_quantity']) * ((int)$r['unit_cost']);
            $totalFifoUnits += (int)$r['remaining_quantity'];
            $uniqueProducts[$r['product_id']] = true;
        }

        $summary = [
            'total_fifo_valuation' => $totalFifoValuation,
            'total_fifo_units' => $totalFifoUnits,
            'total_batched_products' => count($uniqueProducts),
        ];

        jsonSuccess($rows, null, 200, [
            'batches' => $rows,
            'summary' => $summary,
        ]);
    }
}
