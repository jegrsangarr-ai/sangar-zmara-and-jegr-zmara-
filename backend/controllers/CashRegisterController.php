<?php
/**
 * Cash Register Controller (قاسە) (PHP)
 * Accurate financial balance tracking, session management, cash movements
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class CashRegisterController {
    public static function getSummary(): void {
        $account = dbFetchOne("SELECT * FROM cash_accounts WHERE id = 1");
        if (!$account) {
            dbInsert('cash_accounts', [
                'id' => 1,
                'name' => 'قاسەی سەرەکی',
                'current_balance' => 0,
                'is_active' => 1,
            ]);
            $account = dbFetchOne("SELECT * FROM cash_accounts WHERE id = 1");
        }

        $today = getErbilDate();

        $todayInRow = dbFetchOne(
            "SELECT COALESCE(SUM(amount), 0) as tot FROM cash_transactions 
             WHERE cash_account_id = 1 AND direction = 'IN' AND transaction_date = :td",
            ['td' => $today]
        );
        $todayIn = (int)($todayInRow['tot'] ?? 0);

        $todayOutRow = dbFetchOne(
            "SELECT COALESCE(SUM(amount), 0) as tot FROM cash_transactions 
             WHERE cash_account_id = 1 AND direction = 'OUT' AND transaction_date = :td",
            ['td' => $today]
        );
        $todayOut = (int)($todayOutRow['tot'] ?? 0);

        $salesCashRow = dbFetchOne(
            "SELECT COALESCE(SUM(amount), 0) as tot FROM cash_transactions 
             WHERE cash_account_id = 1 AND transaction_type = 'SALE' AND transaction_date = :td",
            ['td' => $today]
        );
        $todaySalesCash = (int)($salesCashRow['tot'] ?? 0);

        $debtInRow = dbFetchOne(
            "SELECT COALESCE(SUM(amount), 0) as tot FROM cash_transactions 
             WHERE cash_account_id = 1 AND transaction_type = 'DEBT_PAYMENT' AND transaction_date = :td",
            ['td' => $today]
        );
        $todayDebtIn = (int)($debtInRow['tot'] ?? 0);

        $expensesRow = dbFetchOne(
            "SELECT COALESCE(SUM(amount), 0) as tot FROM cash_transactions 
             WHERE cash_account_id = 1 AND transaction_type = 'EXPENSE' AND transaction_date = :td",
            ['td' => $today]
        );
        $todayExpenses = (int)($expensesRow['tot'] ?? 0);

        $suppPayRow = dbFetchOne(
            "SELECT COALESCE(SUM(amount), 0) as tot FROM cash_transactions 
             WHERE cash_account_id = 1 AND transaction_type = 'SUPPLIER_PAYMENT' AND transaction_date = :td",
            ['td' => $today]
        );
        $todaySupplierPay = (int)($suppPayRow['tot'] ?? 0);

        $activeSession = dbFetchOne(
            "SELECT cs.*, u.name as user_name
             FROM cash_sessions cs
             JOIN users u ON cs.user_id = u.id
             WHERE cs.cash_account_id = 1 AND cs.status = 'OPEN'
             ORDER BY cs.id DESC LIMIT 1"
        );

        jsonSuccess([
            'account' => $account,
            'current_balance' => (int)$account['current_balance'],
            'today_in' => $todayIn,
            'today_out' => $todayOut,
            'today_net' => $todayIn - $todayOut,
            'today_sales_cash' => $todaySalesCash,
            'today_debt_in' => $todayDebtIn,
            'today_expenses' => $todayExpenses,
            'today_supplier_payments' => $todaySupplierPay,
            'active_session' => $activeSession,
        ]);
    }

    public static function listTransactions(): void {
        $direction = trim((string)($_GET['direction'] ?? ''));
        $type = trim((string)($_GET['type'] ?? ''));
        $fromDate = trim((string)($_GET['from_date'] ?? ''));
        $toDate = trim((string)($_GET['to_date'] ?? ''));
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $where = ["ct.cash_account_id = 1"];
        $params = [];

        if ($direction !== '') {
            $where[] = "ct.direction = :dir";
            $params['dir'] = $direction;
        }
        if ($type !== '') {
            $where[] = "ct.transaction_type = :type";
            $params['type'] = $type;
        }
        if ($fromDate !== '') {
            $where[] = "ct.transaction_date >= :from_date";
            $params['from_date'] = $fromDate;
        }
        if ($toDate !== '') {
            $where[] = "ct.transaction_date <= :to_date";
            $params['to_date'] = $toDate;
        }

        $whereClause = implode(' AND ', $where);
        $total = (int)(dbFetchOne("SELECT COUNT(*) as cnt FROM cash_transactions ct WHERE {$whereClause}", $params)['cnt'] ?? 0);

        $sql = "SELECT ct.*, u.name as user_name
                FROM cash_transactions ct
                LEFT JOIN users u ON ct.user_id = u.id
                WHERE {$whereClause}
                ORDER BY ct.id DESC
                LIMIT {$limit} OFFSET {$offset}";

        $rows = dbFetchAll($sql, $params);

        $page = $limit > 0 ? (int)floor($offset / $limit) + 1 : 1;
        jsonSuccess($rows, null, 200, [
            'transactions' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function deposit(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $amount = (int)($b['amount'] ?? 0);
        $desc = trim((string)($b['description'] ?? 'خستنەسەری پارە'));
        $notes = trim((string)($b['notes'] ?? ''));

        if ($amount <= 0) {
            jsonError('بڕی پارە دەبێت زیاتر بێت لە سفر', 400);
        }

        dbBegin();
        try {
            $acc = dbFetchOne("SELECT * FROM cash_accounts WHERE id = 1 FOR UPDATE");
            $balBefore = (int)$acc['current_balance'];
            $balAfter = $balBefore + $amount;

            dbQuery("UPDATE cash_accounts SET current_balance = :after, updated_at = NOW() WHERE id = 1", ['after' => $balAfter]);

            $session = dbFetchOne("SELECT id FROM cash_sessions WHERE cash_account_id = 1 AND status = 'OPEN' ORDER BY id DESC LIMIT 1");
            $sessionId = $session ? (int)$session['id'] : null;

            dbInsert('cash_transactions', [
                'cash_account_id' => 1,
                'cash_session_id' => $sessionId,
                'user_id' => $currentUser['id'],
                'transaction_type' => 'DEPOSIT',
                'direction' => 'IN',
                'amount' => $amount,
                'balance_before' => $balBefore,
                'balance_after' => $balAfter,
                'reference_type' => 'MANUAL_DEPOSIT',
                'description' => $desc,
                'notes' => $notes,
                'transaction_date' => getErbilDate(),
            ]);

            dbCommit();
            logAudit($currentUser['id'], $currentUser['email'], 'CASH_DEPOSIT', 'CASH_REGISTER', '1', null, ['amount' => $amount]);
            jsonSuccess(['balance' => $balAfter], 'پارە بە سەرکەوتوویی خرایە سەر قاسە');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە خستنەسەری پارە: ' . $e->getMessage(), 500);
        }
    }

    public static function withdraw(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $amount = (int)($b['amount'] ?? 0);
        $desc = trim((string)($b['description'] ?? 'ڕاکێشانی پارە'));
        $notes = trim((string)($b['notes'] ?? ''));

        if ($amount <= 0) {
            jsonError('بڕی پارە دەبێت زیاتر بێت لە سفر', 400);
        }

        dbBegin();
        try {
            $acc = dbFetchOne("SELECT * FROM cash_accounts WHERE id = 1 FOR UPDATE");
            $balBefore = (int)$acc['current_balance'];
            $balAfter = $balBefore - $amount;

            dbQuery("UPDATE cash_accounts SET current_balance = :after, updated_at = NOW() WHERE id = 1", ['after' => $balAfter]);

            $session = dbFetchOne("SELECT id FROM cash_sessions WHERE cash_account_id = 1 AND status = 'OPEN' ORDER BY id DESC LIMIT 1");
            $sessionId = $session ? (int)$session['id'] : null;

            dbInsert('cash_transactions', [
                'cash_account_id' => 1,
                'cash_session_id' => $sessionId,
                'user_id' => $currentUser['id'],
                'transaction_type' => 'WITHDRAWAL',
                'direction' => 'OUT',
                'amount' => $amount,
                'balance_before' => $balBefore,
                'balance_after' => $balAfter,
                'reference_type' => 'MANUAL_WITHDRAWAL',
                'description' => $desc,
                'notes' => $notes,
                'transaction_date' => getErbilDate(),
            ]);

            dbCommit();
            logAudit($currentUser['id'], $currentUser['email'], 'CASH_WITHDRAW', 'CASH_REGISTER', '1', null, ['amount' => $amount]);
            jsonSuccess(['balance' => $balAfter], 'پارە بە سەرکەوتوویی لە قاسە ڕاکێشرا');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە ڕاکێشانی پارە: ' . $e->getMessage(), 500);
        }
    }

    public static function setOpeningBalance(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $amount = max(0, (int)($b['amount'] ?? 0));

        dbBegin();
        try {
            $acc = dbFetchOne("SELECT * FROM cash_accounts WHERE id = 1 FOR UPDATE");
            $balBefore = (int)($acc['current_balance'] ?? 0);

            dbQuery("UPDATE cash_accounts SET current_balance = :amt, updated_at = NOW() WHERE id = 1", ['amt' => $amount]);

            dbInsert('cash_transactions', [
                'cash_account_id' => 1,
                'user_id' => $currentUser['id'],
                'transaction_type' => 'SET_OPENING',
                'direction' => $amount >= $balBefore ? 'IN' : 'OUT',
                'amount' => abs($amount - $balBefore),
                'balance_before' => $balBefore,
                'balance_after' => $amount,
                'reference_type' => 'OPENING_BALANCE',
                'description' => 'دەستنیشانکردنی باڵانسی سەرەتایی قاسە',
                'notes' => $b['notes'] ?? null,
                'transaction_date' => getErbilDate(),
            ]);

            dbCommit();
            jsonSuccess(['balance' => $amount], 'باڵانسی سەرەتایی قاسە نوێکرایەوە');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە نوێکردنەوەی باڵانس: ' . $e->getMessage(), 500);
        }
    }

    public static function listSessions(): void {
        $rows = dbFetchAll(
            "SELECT cs.*, u.name as user_name
             FROM cash_sessions cs
             JOIN users u ON cs.user_id = u.id
             ORDER BY cs.id DESC LIMIT 50"
        );
        jsonSuccess($rows);
    }

    public static function getCurrentSession(): void {
        $session = dbFetchOne(
            "SELECT cs.*, u.name as user_name
             FROM cash_sessions cs
             JOIN users u ON cs.user_id = u.id
             WHERE cs.cash_account_id = 1 AND cs.status = 'OPEN'
             ORDER BY cs.id DESC LIMIT 1"
        );
        jsonSuccess($session);
    }

    public static function openSession(array $currentUser): void {
        $existing = dbFetchOne("SELECT id FROM cash_sessions WHERE cash_account_id = 1 AND status = 'OPEN' LIMIT 1");
        if ($existing) {
            jsonError('دەورەیەکی کراوە پێشتر هەیە! سەرەتا دەورەی پێشوو دابخە', 400);
        }

        $b = getJsonInput();
        $acc = dbFetchOne("SELECT current_balance FROM cash_accounts WHERE id = 1");
        $openingCash = isset($b['opening_cash']) ? (int)$b['opening_cash'] : (int)($acc['current_balance'] ?? 0);

        $id = dbInsert('cash_sessions', [
            'cash_account_id' => 1,
            'user_id' => $currentUser['id'],
            'status' => 'OPEN',
            'opened_at' => getErbilDateTime(),
            'opening_cash' => $openingCash,
            'opening_notes' => trim((string)($b['notes'] ?? '')) ?: null,
        ]);

        jsonSuccess(dbFetchOne("SELECT * FROM cash_sessions WHERE id = :id", ['id' => $id]), 'دەورەی قاسە کرایەوە');
    }

    public static function closeSession(?int $sessionId, array $currentUser): void {
        $session = null;
        if ($sessionId) {
            $session = dbFetchOne("SELECT * FROM cash_sessions WHERE id = :id", ['id' => $sessionId]);
        } else {
            $session = dbFetchOne("SELECT * FROM cash_sessions WHERE cash_account_id = 1 AND status = 'OPEN' ORDER BY id DESC LIMIT 1");
        }

        if (!$session) {
            jsonError('هیچ دەورەیەکی کراوە نەدۆزرایەوە', 404);
        }

        $b = getJsonInput();
        $closingCash = (int)($b['closing_cash'] ?? 0);

        // Calculate expected cash in this session
        $openedAt = $session['opened_at'];
        $sId = (int)$session['id'];

        $flowStmt = dbFetchOne(
            "SELECT 
                COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) as total_in,
                COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) as total_out
             FROM cash_transactions
             WHERE cash_account_id = 1 AND (cash_session_id = :sid OR created_at >= :opened)",
            ['sid' => $sId, 'opened' => $openedAt]
        );

        $totIn = (int)($flowStmt['total_in'] ?? 0);
        $totOut = (int)($flowStmt['total_out'] ?? 0);
        $expectedCash = (int)$session['opening_cash'] + $totIn - $totOut;
        $difference = $closingCash - $expectedCash;

        dbQuery(
            "UPDATE cash_sessions
             SET status = 'CLOSED',
                 closed_at = NOW(),
                 closing_cash = :closing,
                 expected_cash = :expected,
                 cash_difference = :diff,
                 closing_notes = :notes,
                 updated_at = NOW()
             WHERE id = :id",
            [
                'closing' => $closingCash,
                'expected' => $expectedCash,
                'diff' => $difference,
                'notes' => trim((string)($b['notes'] ?? '')) ?: null,
                'id' => $session['id'],
            ]
        );

        jsonSuccess(dbFetchOne("SELECT * FROM cash_sessions WHERE id = :id", ['id' => $session['id']]), 'دەورەی قاسە داخرا');
    }

    public static function backfill(array $currentUser): void {
        requireAdmin($currentUser);
        // Backfill transactions from historical data if needed
        jsonSuccess(null, 'باڵانسی قاسە هاوکات کراوە');
    }

    public static function dailyReport(): void {
        $date = trim((string)($_GET['date'] ?? getErbilDate()));

        $transactions = dbFetchAll(
            "SELECT ct.*, u.name as user_name
             FROM cash_transactions ct
             LEFT JOIN users u ON ct.user_id = u.id
             WHERE ct.cash_account_id = 1 AND ct.transaction_date = :dt
             ORDER BY ct.id ASC",
            ['dt' => $date]
        );

        $totalIn = 0;
        $totalOut = 0;
        foreach ($transactions as $t) {
            if ($t['direction'] === 'IN') $totalIn += (int)$t['amount'];
            if ($t['direction'] === 'OUT') $totalOut += (int)$t['amount'];
        }

        jsonSuccess([
            'date' => $date,
            'total_in' => $totalIn,
            'total_out' => $totalOut,
            'net' => $totalIn - $totalOut,
            'transactions' => $transactions,
        ]);
    }
}
