<?php
/**
 * Company, Driver & Vehicle Controller (PHP)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class CompanyController {
    public static function list(): void {
        $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
        $hasDebt = isset($_GET['has_debt']) && ($_GET['has_debt'] === '1' || $_GET['has_debt'] === 'true');
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $where = ["c.is_active = 1"];
        $params = [];

        if ($search !== '') {
            $where[] = "(c.name LIKE :search OR c.phone LIKE :search OR c.owner_name LIKE :search)";
            $params['search'] = "%{$search}%";
        }
        if ($hasDebt) {
            $where[] = "c.current_debt > 0";
        }

        $whereClause = implode(' AND ', $where);
        $countSql = "SELECT COUNT(*) as total FROM companies c WHERE {$whereClause}";
        $total = (int)(dbFetchOne($countSql, $params)['total'] ?? 0);

        $sql = "SELECT c.*,
                    (SELECT COUNT(*) FROM company_vehicles cv WHERE cv.company_id = c.id AND cv.is_active = 1) as vehicle_count,
                    (SELECT COUNT(*) FROM company_drivers cd WHERE cd.company_id = c.id AND cd.is_active = 1) as driver_count
                FROM companies c
                WHERE {$whereClause}
                ORDER BY c.current_debt DESC, c.name ASC
                LIMIT {$limit} OFFSET {$offset}";

        $rows = dbFetchAll($sql, $params);
        $page = $limit > 0 ? (int)floor($offset / $limit) + 1 : 1;
        jsonSuccess($rows, null, 200, [
            'companies' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function search(): void {
        $q = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;

        $where = ["is_active = 1"];
        $params = [];

        if ($q !== '') {
            $where[] = "(name LIKE :q OR phone LIKE :q OR owner_name LIKE :q)";
            $params['q'] = "%{$q}%";
        }

        $whereClause = implode(' AND ', $where);
        $sql = "SELECT * FROM companies WHERE {$whereClause} ORDER BY name ASC LIMIT {$limit}";
        jsonSuccess(dbFetchAll($sql, $params));
    }

    public static function get(int $id): void {
        $comp = dbFetchOne("SELECT * FROM companies WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$comp) {
            jsonError('کۆمپانیا نەدۆزرایەوە', 404);
        }

        $vehicles = dbFetchAll("SELECT * FROM company_vehicles WHERE company_id = :id AND is_active = 1", ['id' => $id]);
        $drivers = dbFetchAll("SELECT * FROM company_drivers WHERE company_id = :id AND is_active = 1", ['id' => $id]);

        $comp['vehicles'] = $vehicles;
        $comp['drivers'] = $drivers;

        jsonSuccess($comp);
    }

    public static function create(array $currentUser): void {
        $b = getJsonInput();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی کۆمپانیا بنووسە', 400);
        }

        $id = dbInsert('companies', [
            'name' => $name,
            'owner_name' => trim((string)($b['owner_name'] ?? '')) ?: null,
            'phone' => trim((string)($b['phone'] ?? '')) ?: null,
            'address' => trim((string)($b['address'] ?? '')) ?: null,
            'notes' => trim((string)($b['notes'] ?? '')) ?: null,
            'current_debt' => max(0, (int)($b['initial_debt'] ?? $b['current_debt'] ?? 0)),
            'total_purchases' => 0,
            'total_paid' => 0,
            'is_active' => 1,
        ]);

        logAudit($currentUser['id'], $currentUser['email'], 'CREATE_COMPANY', 'COMPANY', (string)$id, null, $b);
        jsonSuccess(dbFetchOne("SELECT * FROM companies WHERE id = :id", ['id' => $id]), 'کۆمپانیا بە سەرکەوتوویی زیادکرا');
    }

    public static function update(int $id, array $currentUser): void {
        $b = getJsonInput();
        $comp = dbFetchOne("SELECT * FROM companies WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$comp) {
            jsonError('کۆمپانیا نەدۆزرایەوە', 404);
        }

        $data = [];
        if (isset($b['name'])) $data['name'] = trim((string)$b['name']);
        if (isset($b['owner_name'])) $data['owner_name'] = trim((string)$b['owner_name']) ?: null;
        if (isset($b['phone'])) $data['phone'] = trim((string)$b['phone']) ?: null;
        if (isset($b['address'])) $data['address'] = trim((string)$b['address']) ?: null;
        if (isset($b['notes'])) $data['notes'] = trim((string)$b['notes']) ?: null;

        if (!empty($data)) {
            dbUpdate('companies', $data, 'id = :id', ['id' => $id]);
            logAudit($currentUser['id'], $currentUser['email'], 'UPDATE_COMPANY', 'COMPANY', (string)$id, $comp, $data);
        }

        jsonSuccess(dbFetchOne("SELECT * FROM companies WHERE id = :id", ['id' => $id]), 'زانیاری کۆمپانیا نوێکرایەوە');
    }

    public static function delete(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $comp = dbFetchOne("SELECT * FROM companies WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$comp) {
            jsonError('کۆمپانیا نەدۆزرایەوە', 404);
        }

        dbUpdate('companies', ['is_active' => 0], 'id = :id', ['id' => $id]);
        logAudit($currentUser['id'], $currentUser['email'], 'DELETE_COMPANY', 'COMPANY', (string)$id, $comp, ['is_active' => 0]);

        jsonSuccess(null, 'کۆمپانیا سڕایەوە');
    }

    public static function getAccount(int $id): void {
        $comp = dbFetchOne("SELECT * FROM companies WHERE id = :id", ['id' => $id]);
        if (!$comp) {
            jsonError('کۆمپانیا نەدۆزرایەوە', 404);
        }

        $sales = dbFetchAll(
            "SELECT s.*, 
                    cd.full_name as driver_name, 
                    cv.plate_number as vehicle_plate
             FROM sales s
             LEFT JOIN company_drivers cd ON s.company_driver_id = cd.id
             LEFT JOIN company_vehicles cv ON s.company_vehicle_id = cv.id
             WHERE s.company_id = :id
             ORDER BY s.id DESC",
            ['id' => $id]
        );

        $payments = dbFetchAll(
            "SELECT p.*, u.name as user_name
             FROM company_debt_payments p
             LEFT JOIN users u ON p.user_id = u.id
             WHERE p.company_id = :id
             ORDER BY p.id DESC",
            ['id' => $id]
        );

        $vehicles = dbFetchAll(
            "SELECT cv.*,
                    (SELECT COUNT(*) FROM sales WHERE company_vehicle_id = cv.id) as sales_count,
                    (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE company_vehicle_id = cv.id) as total_spent
             FROM company_vehicles cv
             WHERE cv.company_id = :id AND cv.is_active = 1
             ORDER BY cv.plate_number ASC",
            ['id' => $id]
        );

        $drivers = dbFetchAll(
            "SELECT cd.*,
                    (SELECT COUNT(*) FROM sales WHERE company_driver_id = cd.id) as sales_count,
                    (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE company_driver_id = cd.id) as total_spent
             FROM company_drivers cd
             WHERE cd.company_id = :id AND cd.is_active = 1
             ORDER BY cd.full_name ASC",
            ['id' => $id]
        );

        jsonSuccess([
            'company' => $comp,
            'sales' => $sales,
            'payments' => $payments,
            'vehicles' => $vehicles,
            'drivers' => $drivers,
            'summary' => [
                'current_debt' => (int)$comp['current_debt'],
                'total_purchases' => (int)$comp['total_purchases'],
                'total_paid' => (int)$comp['total_paid'],
            ]
        ]);
    }

    // Drivers
    public static function listDrivers(int $companyId): void {
        $rows = dbFetchAll("SELECT * FROM company_drivers WHERE company_id = :cid AND is_active = 1 ORDER BY full_name ASC", ['cid' => $companyId]);
        jsonSuccess($rows);
    }

    public static function createDriver(int $companyId, array $currentUser): void {
        $b = getJsonInput();
        $name = trim((string)($b['full_name'] ?? $b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی شۆفێر بنووسە', 400);
        }

        $id = dbInsert('company_drivers', [
            'company_id' => $companyId,
            'full_name' => $name,
            'phone' => trim((string)($b['phone'] ?? '')) ?: null,
            'notes' => trim((string)($b['notes'] ?? '')) ?: null,
            'is_active' => 1,
        ]);

        jsonSuccess(dbFetchOne("SELECT * FROM company_drivers WHERE id = :id", ['id' => $id]), 'شۆفێر زیادکرا');
    }

    public static function updateDriver(int $driverId, array $currentUser): void {
        $b = getJsonInput();
        $drv = dbFetchOne("SELECT * FROM company_drivers WHERE id = :id", ['id' => $driverId]);
        if (!$drv) jsonError('شۆفێر نەدۆزرایەوە', 404);

        $data = [];
        if (isset($b['full_name']) || isset($b['name'])) $data['full_name'] = trim((string)($b['full_name'] ?? $b['name']));
        if (isset($b['phone'])) $data['phone'] = trim((string)$b['phone']) ?: null;
        if (isset($b['notes'])) $data['notes'] = trim((string)$b['notes']) ?: null;

        if (!empty($data)) {
            dbUpdate('company_drivers', $data, 'id = :id', ['id' => $driverId]);
        }
        jsonSuccess(dbFetchOne("SELECT * FROM company_drivers WHERE id = :id", ['id' => $driverId]), 'شۆفێر نوێکرایەوە');
    }

    public static function deleteDriver(int $driverId, array $currentUser): void {
        dbUpdate('company_drivers', ['is_active' => 0], 'id = :id', ['id' => $driverId]);
        jsonSuccess(null, 'شۆفێر سڕایەوە');
    }

    public static function getDriverPurchases(int $companyId, int $driverId): void {
        $sales = dbFetchAll(
            "SELECT s.*, cv.plate_number as vehicle_plate
             FROM sales s
             LEFT JOIN company_vehicles cv ON s.company_vehicle_id = cv.id
             WHERE s.company_id = :cid AND s.company_driver_id = :did
             ORDER BY s.id DESC",
            ['cid' => $companyId, 'did' => $driverId]
        );
        jsonSuccess($sales);
    }

    // Vehicles
    public static function listVehicles(int $companyId): void {
        $rows = dbFetchAll("SELECT * FROM company_vehicles WHERE company_id = :cid AND is_active = 1 ORDER BY plate_number ASC", ['cid' => $companyId]);
        jsonSuccess($rows);
    }

    public static function createVehicle(int $companyId, array $currentUser): void {
        $b = getJsonInput();
        $plate = trim((string)($b['plate_number'] ?? $b['vehicle_number'] ?? ''));
        if ($plate === '') {
            jsonError('تکایە ژمارەی تابلۆی ئۆتۆمبێل بنووسە', 400);
        }

        $id = dbInsert('company_vehicles', [
            'company_id' => $companyId,
            'plate_number' => $plate,
            'vehicle_number' => $plate,
            'truck_model' => trim((string)($b['truck_model'] ?? '')) ?: null,
            'notes' => trim((string)($b['notes'] ?? '')) ?: null,
            'is_active' => 1,
        ]);

        jsonSuccess(dbFetchOne("SELECT * FROM company_vehicles WHERE id = :id", ['id' => $id]), 'ئۆتۆمبێل زیادکرا');
    }

    public static function updateVehicle(int $vehicleId, array $currentUser): void {
        $b = getJsonInput();
        $veh = dbFetchOne("SELECT * FROM company_vehicles WHERE id = :id", ['id' => $vehicleId]);
        if (!$veh) jsonError('ئۆتۆمبێل نەدۆزرایەوە', 404);

        $data = [];
        if (isset($b['plate_number']) || isset($b['vehicle_number'])) {
            $val = trim((string)($b['plate_number'] ?? $b['vehicle_number']));
            $data['plate_number'] = $val;
            $data['vehicle_number'] = $val;
        }
        if (isset($b['truck_model'])) $data['truck_model'] = trim((string)$b['truck_model']) ?: null;
        if (isset($b['notes'])) $data['notes'] = trim((string)$b['notes']) ?: null;

        if (!empty($data)) {
            dbUpdate('company_vehicles', $data, 'id = :id', ['id' => $vehicleId]);
        }
        jsonSuccess(dbFetchOne("SELECT * FROM company_vehicles WHERE id = :id", ['id' => $vehicleId]), 'ئۆتۆمبێل نوێکرایەوە');
    }

    public static function deleteVehicle(int $vehicleId, array $currentUser): void {
        dbUpdate('company_vehicles', ['is_active' => 0], 'id = :id', ['id' => $vehicleId]);
        jsonSuccess(null, 'ئۆتۆمبێل سڕایەوە');
    }

    public static function getVehiclePurchases(int $companyId, int $vehicleId): void {
        $sales = dbFetchAll(
            "SELECT s.*, cd.full_name as driver_name
             FROM sales s
             LEFT JOIN company_drivers cd ON s.company_driver_id = cd.id
             WHERE s.company_id = :cid AND s.company_vehicle_id = :vid
             ORDER BY s.id DESC",
            ['cid' => $companyId, 'vid' => $vehicleId]
        );
        jsonSuccess($sales);
    }

    // Search Drivers & Vehicles
    public static function searchDrivers(): void {
        $q = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
        $compId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : null;

        $where = ["cd.is_active = 1"];
        $params = [];
        if ($q !== '') {
            $where[] = "(cd.full_name LIKE :q OR cd.phone LIKE :q)";
            $params['q'] = "%{$q}%";
        }
        if ($compId !== null) {
            $where[] = "cd.company_id = :cid";
            $params['cid'] = $compId;
        }

        $sql = "SELECT cd.*, c.name as company_name
                FROM company_drivers cd
                JOIN companies c ON cd.company_id = c.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY cd.full_name ASC LIMIT 50";

        jsonSuccess(dbFetchAll($sql, $params));
    }

    public static function searchVehicles(): void {
        $q = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
        $compId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : null;

        $where = ["cv.is_active = 1"];
        $params = [];
        if ($q !== '') {
            $where[] = "(cv.plate_number LIKE :q OR cv.truck_model LIKE :q)";
            $params['q'] = "%{$q}%";
        }
        if ($compId !== null) {
            $where[] = "cv.company_id = :cid";
            $params['cid'] = $compId;
        }

        $sql = "SELECT cv.*, c.name as company_name
                FROM company_vehicles cv
                JOIN companies c ON cv.company_id = c.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY cv.plate_number ASC LIMIT 50";

        jsonSuccess(dbFetchAll($sql, $params));
    }

    public static function payDebt(int $companyId, array $currentUser): void {
        $b = getJsonInput();
        $amount = (int)($b['amount'] ?? 0);
        $notes = trim((string)($b['notes'] ?? ''));
        $paymentDate = trim((string)($b['payment_date'] ?? getErbilDate()));

        if ($companyId <= 0) {
            jsonError('کۆمپانیا دیاری نەکراوە', 400);
        }
        if ($amount <= 0) {
            jsonError('بڕی پارەی دراو دەبێت زیاتر بێت لە سفر', 400);
        }

        dbBegin();
        try {
            $comp = dbFetchOne("SELECT * FROM companies WHERE id = :id FOR UPDATE", ['id' => $companyId]);
            if (!$comp) {
                dbRollback();
                jsonError('کۆمپانیا نەدۆزرایەوە', 404);
            }

            $currentDebt = (int)$comp['current_debt'];
            if ($currentDebt <= 0) {
                dbRollback();
                jsonError('ئەم کۆمپانیایە هیچ قەرزێکی لەسەر نییە', 400);
            }

            $actualPay = min($amount, $currentDebt);
            $newDebt = $currentDebt - $actualPay;

            // Update company
            dbQuery(
                "UPDATE companies
                 SET current_debt = :new_debt, total_paid = total_paid + :pay, updated_at = NOW()
                 WHERE id = :id",
                ['new_debt' => $newDebt, 'pay' => $actualPay, 'id' => $companyId]
            );

            // Record company debt payment
            $paymentId = dbInsert('company_debt_payments', [
                'company_id' => $companyId,
                'amount' => $actualPay,
                'previous_balance' => $currentDebt,
                'new_balance' => $newDebt,
                'user_id' => $currentUser['id'],
                'payment_date' => $paymentDate,
                'notes' => $notes ?: 'پارەدان بە قەرزی کۆمپانیا',
            ]);

            // Allocate payment to company_debts in FIFO order
            $unpaidDebts = dbFetchAll(
                "SELECT * FROM company_debts
                 WHERE company_id = :cid AND remaining_balance > 0
                 ORDER BY id ASC FOR UPDATE",
                ['cid' => $companyId]
            );

            $payRemaining = $actualPay;
            foreach ($unpaidDebts as $debtRow) {
                if ($payRemaining <= 0) break;
                $rem = (int)$debtRow['remaining_balance'];
                $deduct = min($rem, $payRemaining);
                $newRem = $rem - $deduct;
                $status = $newRem <= 0 ? 'paid' : 'partial';

                dbQuery(
                    "UPDATE company_debts
                     SET paid_amount = paid_amount + :deduct, remaining_balance = :new_rem, status = :status, updated_at = NOW()
                     WHERE id = :id",
                    ['deduct' => $deduct, 'new_rem' => $newRem, 'status' => $status, 'id' => $debtRow['id']]
                );

                $payRemaining -= $deduct;
            }

            dbCommit();

            logAudit($currentUser['id'], $currentUser['email'], 'PAY_COMPANY_DEBT', 'COMPANY', (string)$companyId, [
                'previous_debt' => $currentDebt
            ], [
                'paid' => $actualPay,
                'remaining_debt' => $newDebt
            ]);

            jsonSuccess([
                'payment_id' => $paymentId,
                'company_id' => $companyId,
                'paid_amount' => $actualPay,
                'previous_balance' => $currentDebt,
                'remaining_balance' => $newDebt,
            ], 'قەرزی کۆمپانیا بە سەرکەوتوویی وەرگیرا');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە وەرگرتنی قەرز: ' . $e->getMessage(), 500);
        }
    }
}
