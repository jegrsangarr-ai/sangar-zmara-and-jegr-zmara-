<?php
/**
 * Expense & Expense Category Controller (PHP)
 * Synchronized with Cash Register
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class ExpenseController {
    public static function list(): void {
        $categoryId = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;
        $fromDate = trim((string)($_GET['from_date'] ?? ''));
        $toDate = trim((string)($_GET['to_date'] ?? ''));
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $where = ["1=1"];
        $params = [];

        if ($categoryId !== null) {
            $where[] = "e.category_id = :cid";
            $params['cid'] = $categoryId;
        }
        if ($fromDate !== '') {
            $where[] = "e.expense_date >= :from_date";
            $params['from_date'] = $fromDate;
        }
        if ($toDate !== '') {
            $where[] = "e.expense_date <= :to_date";
            $params['to_date'] = $toDate;
        }

        $whereClause = implode(' AND ', $where);
        $total = (int)(dbFetchOne("SELECT COUNT(*) as cnt FROM expenses e WHERE {$whereClause}", $params)['cnt'] ?? 0);

        $sql = "SELECT e.*, c.name as category_name, u.name as user_name
                FROM expenses e
                LEFT JOIN expense_categories c ON e.category_id = c.id
                LEFT JOIN users u ON e.user_id = u.id
                WHERE {$whereClause}
                ORDER BY e.id DESC
                LIMIT {$limit} OFFSET {$offset}";

        $rows = dbFetchAll($sql, $params);

        $sumRow = dbFetchOne("SELECT COALESCE(SUM(amount), 0) as tot FROM expenses e WHERE {$whereClause}", $params);
        $totalAmount = (int)($sumRow['tot'] ?? 0);

        $page = $limit > 0 ? (int)floor($offset / $limit) + 1 : 1;
        jsonSuccess($rows, null, 200, [
            'expenses' => $rows,
            'total' => $total,
            'totalAmount' => $totalAmount,
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function create(array $currentUser): void {
        $b = getJsonInput();
        $title = trim((string)($b['title'] ?? $b['description'] ?? ''));
        $description = trim((string)($b['description'] ?? $title));
        $amount = (int)($b['amount'] ?? 0);
        $categoryId = !empty($b['category_id']) ? (int)$b['category_id'] : null;
        $expenseDate = trim((string)($b['expense_date'] ?? getErbilDate()));

        if ($title === '') {
            jsonError('تکایە ناونیشانی خەرجی بنووسە', 400);
        }
        if ($amount <= 0) {
            jsonError('بڕی خەرجی دەبێت زیاتر بێت لە سفر', 400);
        }

        dbBegin();
        try {
            $expenseId = dbInsert('expenses', [
                'title' => $title,
                'description' => $description,
                'category_id' => $categoryId,
                'amount' => $amount,
                'expense_date' => $expenseDate,
                'user_id' => $currentUser['id'],
                'notes' => trim((string)($b['notes'] ?? '')) ?: null,
            ]);

            dbCommit();

            logAudit($currentUser['id'], $currentUser['email'], 'CREATE_EXPENSE', 'EXPENSE', (string)$expenseId, null, [
                'title' => $title,
                'amount' => $amount,
            ]);

            jsonSuccess(dbFetchOne("SELECT * FROM expenses WHERE id = :id", ['id' => $expenseId]), 'خەرجی بە سەرکەوتوویی تۆمارکرا');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە تۆمارکردنی خەرجی: ' . $e->getMessage(), 500);
        }
    }

    public static function delete(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $exp = dbFetchOne("SELECT * FROM expenses WHERE id = :id", ['id' => $id]);
        if (!$exp) {
            jsonError('خەرجی نەدۆزرایەوە', 404);
        }

        dbBegin();
        try {
            dbQuery("DELETE FROM expenses WHERE id = :id", ['id' => $id]);
            dbCommit();

            logAudit($currentUser['id'], $currentUser['email'], 'DELETE_EXPENSE', 'EXPENSE', (string)$id, $exp, null);
            jsonSuccess(null, 'خەرجی بە سەرکەوتوویی سڕایەوە');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە سڕینەوەی خەرجی: ' . $e->getMessage(), 500);
        }
    }

    public static function listCategories(): void {
        $rows = dbFetchAll("SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name ASC");
        jsonSuccess($rows);
    }

    public static function createCategory(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی جۆری خەرجی بنووسە', 400);
        }
        $id = dbInsert('expense_categories', [
            'name' => $name,
            'description' => trim((string)($b['description'] ?? '')) ?: null,
            'is_active' => 1,
        ]);
        jsonSuccess(dbFetchOne("SELECT * FROM expense_categories WHERE id = :id", ['id' => $id]), 'جۆری خەرجی زیادکرا');
    }
}
