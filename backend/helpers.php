<?php
/**
 * Global HTTP and JSON Helper Functions for Sangar & Jegr POS (PHP)
 */

declare(strict_types=1);

function jsonResponse(array $payload, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonSuccess($data = null, ?string $message = null, int $statusCode = 200, array $extra = []): void {
    $payload = ['success' => true];
    if ($message !== null) {
        $payload['message'] = $message;
    }
    if ($data !== null) {
        $payload['data'] = $data;
    }
    if (!empty($extra)) {
        foreach ($extra as $k => $v) {
            $payload[$k] = $v;
        }
    }
    jsonResponse($payload, $statusCode);
}

function jsonError(string $message, int $statusCode = 400, ?string $code = null): void {
    $payload = [
        'success' => false,
        'message' => $message,
    ];
    if ($code !== null) {
        $payload['code'] = $code;
    }
    jsonResponse($payload, $statusCode);
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $data = json_decode($raw, true);
        if (is_array($data)) {
            return $data;
        }
    }
    return $_POST ?: [];
}

function allocateFifoStock(PDO $pdo, int $productId, int $requiredQty, int $fallbackUnitCost = 0): array {
    $remainingNeeded = $requiredQty;
    $allocations = [];
    $totalCost = 0;

    // Lock active batches in FIFO order
    $stmt = $pdo->prepare(
        "SELECT * FROM inventory_batches
         WHERE product_id = :product_id AND remaining_quantity > 0
         ORDER BY purchase_date ASC, id ASC
         FOR UPDATE"
    );
    $stmt->execute(['product_id' => $productId]);
    $availableBatches = $stmt->fetchAll();

    foreach ($availableBatches as $batch) {
        if ($remainingNeeded <= 0) {
            break;
        }

        $availableInBatch = (int)$batch['remaining_quantity'];
        $takeQty = min($availableInBatch, $remainingNeeded);
        $unitCost = (int)$batch['unit_cost'];
        $allocCost = $takeQty * $unitCost;

        $allocations[] = [
            'batch_id' => (int)$batch['id'],
            'quantity' => $takeQty,
            'unit_cost' => $unitCost,
            'total_cost' => $allocCost,
        ];

        $totalCost += $allocCost;
        $remainingNeeded -= $takeQty;

        // Deduct from batch
        $upStmt = $pdo->prepare(
            "UPDATE inventory_batches
             SET remaining_quantity = remaining_quantity - :take_qty, updated_at = NOW()
             WHERE id = :batch_id"
        );
        $upStmt->execute([
            'take_qty' => $takeQty,
            'batch_id' => $batch['id'],
        ]);
    }

    // Fallback if stock is negative or unbatched margin
    if ($remainingNeeded > 0) {
        $fallbackCost = max(0, $fallbackUnitCost);
        $allocCost = $remainingNeeded * $fallbackCost;

        $insBatchStmt = $pdo->prepare(
            "INSERT INTO inventory_batches (
                product_id, batch_type, batch_number, original_quantity, remaining_quantity,
                unit_cost, purchase_date, notes, created_at, updated_at
             ) VALUES (
                :product_id, 'SYSTEM_DEFICIT', :batch_num, :orig_qty, 0,
                :unit_cost, CURDATE(), 'وەجبەی تۆمارکراو بەهۆی کەمبوونی وەجبەی کڕین', NOW(), NOW()
             )"
        );
        $batchNum = 'DEF-' . date('Ymd') . '-' . rand(1000, 9999);
        $insBatchStmt->execute([
            'product_id' => $productId,
            'batch_num' => $batchNum,
            'orig_qty' => $remainingNeeded,
            'unit_cost' => $fallbackCost,
        ]);
        $fallbackBatchId = (int)$pdo->lastInsertId();

        $allocations[] = [
            'batch_id' => $fallbackBatchId,
            'quantity' => $remainingNeeded,
            'unit_cost' => $fallbackCost,
            'total_cost' => $allocCost,
        ];
        $totalCost += $allocCost;
    }

    $avgUnitCost = $requiredQty > 0 ? (int)round($totalCost / $requiredQty) : 0;

    return [
        'allocations' => $allocations,
        'total_cost' => $totalCost,
        'average_unit_cost' => $avgUnitCost,
    ];
}
