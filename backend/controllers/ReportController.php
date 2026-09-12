<?php
/**
 * Report & Analytics Controller (PHP)
 * Dashboard metrics, Daily reports, FIFO Profit/Loss, Company/Driver/Vehicle analytics
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class ReportController {
    public static function getDashboardSummary(): void {
        $today = getErbilDate();

        // Today sales
        $todaySalesRow = dbFetchOne(
            "SELECT COALESCE(SUM(total_amount), 0) as total_sales,
                    COALESCE(SUM(gross_profit), 0) as total_profit,
                    COALESCE(SUM(paid_amount), 0) as cash_collected,
                    COALESCE(SUM(debt_amount), 0) as new_debts,
                    COUNT(*) as invoice_count
             FROM sales
             WHERE sale_date = :td",
            ['td' => $today]
        );

        // Total debts owed by customers and companies
        $custDebtRow = dbFetchOne("SELECT COALESCE(SUM(current_debt), 0) as tot FROM customers WHERE is_active = 1");
        $compDebtRow = dbFetchOne("SELECT COALESCE(SUM(current_debt), 0) as tot FROM companies WHERE is_active = 1");
        $totalCustomerDebt = (int)($custDebtRow['tot'] ?? 0);
        $totalCompanyDebt = (int)($compDebtRow['tot'] ?? 0);
        $totalReceivable = $totalCustomerDebt + $totalCompanyDebt;

        // Total supplier debt owed
        $suppDebtRow = dbFetchOne("SELECT COALESCE(SUM(current_debt), 0) as tot FROM suppliers WHERE is_active = 1");
        $totalPayable = (int)($suppDebtRow['tot'] ?? 0);

        // Total inventory metrics
        $invRow = dbFetchOne(
            "SELECT COALESCE(SUM(quantity * purchase_price), 0) as total_cost_value,
                    COALESCE(SUM(quantity * selling_price), 0) as total_sell_value,
                    COALESCE(SUM(quantity), 0) as total_pieces,
                    COUNT(*) as total_items,
                    COUNT(CASE WHEN quantity <= min_stock_level THEN 1 END) as low_stock_count
             FROM products
             WHERE is_active = 1"
        );

        // Cash balance
        $cashRow = dbFetchOne("SELECT current_balance FROM cash_accounts WHERE id = 1");
        $cashBalance = (int)($cashRow['current_balance'] ?? 0);

        // Recent 5 sales
        $recentSales = dbFetchAll(
            "SELECT s.id, s.receipt_number, s.customer_display_name, s.total_amount, s.payment_type, s.sale_time, s.sale_date
             FROM sales s
             ORDER BY s.id DESC LIMIT 6"
        );

        // Low stock products
        $lowStockProducts = dbFetchAll(
            "SELECT id, name, part_number, quantity, min_stock_level, purchase_price, selling_price
             FROM products
             WHERE is_active = 1 AND quantity <= min_stock_level
             ORDER BY quantity ASC LIMIT 10"
        );

        jsonSuccess([
            'today_sales' => (int)($todaySalesRow['total_sales'] ?? 0),
            'today_profit' => (int)($todaySalesRow['total_profit'] ?? 0),
            'today_cash_collected' => (int)($todaySalesRow['cash_collected'] ?? 0),
            'today_new_debts' => (int)($todaySalesRow['new_debts'] ?? 0),
            'today_invoice_count' => (int)($todaySalesRow['invoice_count'] ?? 0),
            'total_receivable_debts' => $totalReceivable,
            'customer_debts' => $totalCustomerDebt,
            'company_debts' => $totalCompanyDebt,
            'total_payable_debts' => $totalPayable,
            'total_inventory_cost' => (int)($invRow['total_cost_value'] ?? 0),
            'total_inventory_sell' => (int)($invRow['total_sell_value'] ?? 0),
            'total_products' => (int)($invRow['total_items'] ?? 0),
            'low_stock_count' => (int)($invRow['low_stock_count'] ?? 0),
            'cash_balance' => $cashBalance,
            'recent_sales' => $recentSales,
            'low_stock_products' => $lowStockProducts,
        ]);
    }

    public static function getDailyReport(): void {
        $date = trim((string)($_GET['date'] ?? getErbilDate()));

        // Sales summary
        $salesSummary = dbFetchOne(
            "SELECT COALESCE(SUM(total_amount), 0) as total_sales,
                    COALESCE(SUM(total_cost), 0) as total_cost,
                    COALESCE(SUM(gross_profit), 0) as gross_profit,
                    COALESCE(SUM(paid_amount), 0) as paid_amount,
                    COALESCE(SUM(debt_amount), 0) as debt_amount,
                    COALESCE(SUM(discount_amount), 0) as discount_amount,
                    COUNT(*) as invoice_count
             FROM sales
             WHERE sale_date = :dt",
            ['dt' => $date]
        );

        // Sales items sold
        $itemsSold = dbFetchAll(
            "SELECT si.product_id, si.product_name, si.part_number,
                    SUM(si.quantity) as total_quantity,
                    SUM(si.total_price) as total_revenue,
                    SUM(si.total_cost) as total_cogs,
                    (SUM(si.total_price) - SUM(si.total_cost)) as item_profit
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE s.sale_date = :dt
             GROUP BY si.product_id, si.product_name, si.part_number
             ORDER BY total_revenue DESC",
            ['dt' => $date]
        );

        // Expenses
        $expenses = dbFetchAll(
            "SELECT e.*, c.name as category_name
             FROM expenses e
             LEFT JOIN expense_categories c ON e.category_id = c.id
             WHERE e.expense_date = :dt
             ORDER BY e.id DESC",
            ['dt' => $date]
        );
        $totalExpenses = array_sum(array_column($expenses, 'amount'));

        // Debt payments collected
        $debtPayments = dbFetchAll(
            "SELECT cdp.*, c.name as customer_name
             FROM customer_debt_payments cdp
             JOIN customers c ON cdp.customer_id = c.id
             WHERE cdp.payment_date = :dt",
            ['dt' => $date]
        );
        $totalDebtPayments = array_sum(array_column($debtPayments, 'amount'));

        // Company debt payments
        $compDebtPayments = dbFetchAll(
            "SELECT cdp.*, c.name as company_name
             FROM company_debt_payments cdp
             JOIN companies c ON cdp.company_id = c.id
             WHERE cdp.payment_date = :dt",
            ['dt' => $date]
        );
        $totalCompDebtPayments = array_sum(array_column($compDebtPayments, 'amount'));

        $grossProfit = (int)($salesSummary['gross_profit'] ?? 0);
        $netProfit = $grossProfit - $totalExpenses;

        jsonSuccess([
            'date' => $date,
            'summary' => [
                'total_sales' => (int)($salesSummary['total_sales'] ?? 0),
                'total_cost' => (int)($salesSummary['total_cost'] ?? 0),
                'gross_profit' => $grossProfit,
                'total_expenses' => $totalExpenses,
                'net_profit' => $netProfit,
                'paid_amount' => (int)($salesSummary['paid_amount'] ?? 0),
                'debt_amount' => (int)($salesSummary['debt_amount'] ?? 0),
                'discount_amount' => (int)($salesSummary['discount_amount'] ?? 0),
                'invoice_count' => (int)($salesSummary['invoice_count'] ?? 0),
                'debt_payments_collected' => $totalDebtPayments + $totalCompDebtPayments,
            ],
            'items_sold' => $itemsSold,
            'expenses' => $expenses,
            'debt_payments' => array_merge($debtPayments, $compDebtPayments),
        ]);
    }

    public static function getSalesReport(): void {
        $fromDate = trim((string)($_GET['from_date'] ?? $_GET['from'] ?? ''));
        $toDate = trim((string)($_GET['to_date'] ?? $_GET['to'] ?? ''));

        $where = ["1=1"];
        $params = [];
        if ($fromDate !== '') {
            $where[] = "s.sale_date >= :from_date";
            $params['from_date'] = $fromDate;
        }
        if ($toDate !== '') {
            $where[] = "s.sale_date <= :to_date";
            $params['to_date'] = $toDate;
        }

        $whereClause = implode(' AND ', $where);

        $summary = dbFetchOne(
            "SELECT COALESCE(SUM(total_amount), 0) as total_sales,
                    COALESCE(SUM(total_cost), 0) as total_cost,
                    COALESCE(SUM(gross_profit), 0) as total_profit,
                    COALESCE(SUM(paid_amount), 0) as total_paid,
                    COALESCE(SUM(debt_amount), 0) as total_debt,
                    COUNT(*) as invoice_count
             FROM sales s
             WHERE {$whereClause}",
            $params
        );

        $dailyBreakdown = dbFetchAll(
            "SELECT s.sale_date,
                    COUNT(*) as invoice_count,
                    SUM(total_amount) as daily_sales,
                    SUM(total_cost) as daily_cost,
                    SUM(gross_profit) as daily_profit,
                    SUM(paid_amount) as daily_paid,
                    SUM(debt_amount) as daily_debt
             FROM sales s
             WHERE {$whereClause}
             GROUP BY s.sale_date
             ORDER BY s.sale_date DESC",
            $params
        );

        jsonSuccess([
            'summary' => $summary,
            'daily_breakdown' => $dailyBreakdown,
        ]);
    }

    public static function getProfitLossReport(): void {
        $fromDate = trim((string)($_GET['from_date'] ?? $_GET['from'] ?? ''));
        $toDate = trim((string)($_GET['to_date'] ?? $_GET['to'] ?? ''));

        $whereSales = ["1=1"];
        $paramsSales = [];
        if ($fromDate !== '') {
            $whereSales[] = "sale_date >= :from_date";
            $paramsSales['from_date'] = $fromDate;
        }
        if ($toDate !== '') {
            $whereSales[] = "sale_date <= :to_date";
            $paramsSales['to_date'] = $toDate;
        }

        $salesRow = dbFetchOne(
            "SELECT COALESCE(SUM(total_amount), 0) as revenue,
                    COALESCE(SUM(total_cost), 0) as cogs,
                    COALESCE(SUM(gross_profit), 0) as gross_profit,
                    COALESCE(SUM(discount_amount), 0) as discounts,
                    COUNT(*) as count
             FROM sales WHERE " . implode(' AND ', $whereSales),
            $paramsSales
        );

        $whereExp = ["1=1"];
        $paramsExp = [];
        if ($fromDate !== '') {
            $whereExp[] = "expense_date >= :from_date";
            $paramsExp['from_date'] = $fromDate;
        }
        if ($toDate !== '') {
            $whereExp[] = "expense_date <= :to_date";
            $paramsExp['to_date'] = $toDate;
        }

        $expRow = dbFetchOne(
            "SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as count
             FROM expenses WHERE " . implode(' AND ', $whereExp),
            $paramsExp
        );

        $expCategories = dbFetchAll(
            "SELECT c.name as category_name, SUM(e.amount) as category_total
             FROM expenses e
             LEFT JOIN expense_categories c ON e.category_id = c.id
             WHERE " . implode(' AND ', $whereExp) . "
             GROUP BY c.name
             ORDER BY category_total DESC",
            $paramsExp
        );

        $revenue = (int)($salesRow['revenue'] ?? 0);
        $cogs = (int)($salesRow['cogs'] ?? 0);
        $grossProfit = (int)($salesRow['gross_profit'] ?? 0);
        $expenses = (int)($expRow['total_expenses'] ?? 0);
        $netProfit = $grossProfit - $expenses;
        $profitMargin = $revenue > 0 ? round(($netProfit / $revenue) * 100, 1) : 0;

        jsonSuccess([
            'revenue' => $revenue,
            'cost_of_goods_sold' => $cogs,
            'gross_profit' => $grossProfit,
            'total_expenses' => $expenses,
            'net_profit' => $netProfit,
            'profit_margin_percent' => $profitMargin,
            'sales_count' => (int)($salesRow['count'] ?? 0),
            'expense_categories' => $expCategories,
        ]);
    }

    public static function getCompaniesReport(): void {
        $rows = dbFetchAll(
            "SELECT c.id, c.name, c.phone, c.owner_name, c.current_debt, c.total_purchases, c.total_paid,
                    (SELECT COUNT(*) FROM sales WHERE company_id = c.id) as sales_count,
                    (SELECT COUNT(*) FROM company_vehicles WHERE company_id = c.id AND is_active = 1) as vehicle_count,
                    (SELECT COUNT(*) FROM company_drivers WHERE company_id = c.id AND is_active = 1) as driver_count
             FROM companies c
             WHERE c.is_active = 1
             ORDER BY c.total_purchases DESC"
        );
        jsonSuccess($rows);
    }

    public static function getDriversReport(): void {
        $rows = dbFetchAll(
            "SELECT cd.id, cd.full_name, cd.phone, c.name as company_name,
                    COUNT(s.id) as sales_count,
                    COALESCE(SUM(s.total_amount), 0) as total_spent
             FROM company_drivers cd
             JOIN companies c ON cd.company_id = c.id
             LEFT JOIN sales s ON s.company_driver_id = cd.id
             WHERE cd.is_active = 1
             GROUP BY cd.id, cd.full_name, cd.phone, c.name
             ORDER BY total_spent DESC"
        );
        jsonSuccess($rows);
    }

    public static function getVehiclesReport(): void {
        $rows = dbFetchAll(
            "SELECT cv.id, cv.plate_number, cv.truck_model, c.name as company_name,
                    COUNT(s.id) as sales_count,
                    COALESCE(SUM(s.total_amount), 0) as total_spent
             FROM company_vehicles cv
             JOIN companies c ON cv.company_id = c.id
             LEFT JOIN sales s ON s.company_vehicle_id = cv.id
             WHERE cv.is_active = 1
             GROUP BY cv.id, cv.plate_number, cv.truck_model, c.name
             ORDER BY total_spent DESC"
        );
        jsonSuccess($rows);
    }
}
