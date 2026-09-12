<?php
/**
 * Setting, Audit & System Info Controller (PHP)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class SettingController {
    public static function getPublic(): void {
        $config = require __DIR__ . '/../config/config.php';
        $business = $config['business'];

        // Also merge any DB custom settings
        $rows = dbFetchAll("SELECT key_name, value FROM settings WHERE key_name IN ('shop_name', 'shop_phone', 'shop_address', 'currency', 'receipt_footer_note')");
        $dbSettings = [];
        foreach ($rows as $r) {
            $dbSettings[$r['key_name']] = $r['value'];
        }

        jsonSuccess([
            'business_name' => $dbSettings['shop_name'] ?? $business['name'],
            'subtitle' => $business['subtitle'],
            'city' => $business['city'],
            'country' => $business['country'],
            'address' => $dbSettings['shop_address'] ?? $business['address'],
            'phone' => $dbSettings['shop_phone'] ?? $business['phone_jegr'],
            'phone_jegr' => $business['phone_jegr'],
            'phone_sangar_1' => $business['phone_sangar_1'],
            'phone_sangar_2' => $business['phone_sangar_2'],
            'currency' => $dbSettings['currency'] ?? $business['currency'],
            'receipt_footer_note' => $dbSettings['receipt_footer_note'] ?? 'سوپاس بۆ سەردانەکەتان - مەرجی گەڕاندنەوە لە ماوەی ۳ ڕۆژدایە بە پسوولەوە',
        ]);
    }

    public static function getSettings(array $currentUser): void {
        requireAdmin($currentUser);
        $rows = dbFetchAll("SELECT key_name, value, description FROM settings");
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['key_name']] = $r['value'];
        }
        jsonSuccess($settings);
    }

    public static function updateSettings(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();

        foreach ($b as $key => $val) {
            $valStr = is_bool($val) ? ($val ? 'true' : 'false') : (string)$val;
            dbQuery(
                "INSERT INTO settings (key_name, value, updated_at)
                 VALUES (:k, :v, NOW())
                 ON DUPLICATE KEY UPDATE value = :v2, updated_at = NOW()",
                ['k' => $key, 'v' => $valStr, 'v2' => $valStr]
            );
        }

        logAudit($currentUser['id'], $currentUser['email'], 'UPDATE_SETTINGS', 'SETTINGS', '', null, $b);
        jsonSuccess(null, 'ڕێکخستنەکان بە سەرکەوتوویی نوێکرانەوە');
    }

    public static function getAuditLogs(array $currentUser): void {
        requireAdmin($currentUser);
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $rows = dbFetchAll("SELECT * FROM audit_logs ORDER BY id DESC LIMIT {$limit} OFFSET {$offset}");
        jsonSuccess($rows);
    }

    public static function getSystemInfo(array $currentUser): void {
        $pdo = getDbConnection();
        $dbVer = $pdo->query('SELECT VERSION() as ver')->fetch()['ver'] ?? 'Unknown';

        jsonSuccess([
            'system_name' => 'سیستەمی ژمێریاری و فرۆشتنی سەنگەر زمارەیی و جێگر زمارەیی',
            'php_version' => phpversion(),
            'database' => 'MariaDB / MySQL',
            'database_version' => $dbVer,
            'timezone' => date_default_timezone_get(),
            'current_time' => getErbilDateTime(),
            'server_os' => php_uname('s') . ' ' . php_uname('r'),
        ]);
    }

    public static function getHealth(): void {
        try {
            $pdo = getDbConnection();
            $pdo->query('SELECT 1');
            jsonSuccess([
                'status' => 'ok',
                'database' => 'connected',
                'timestamp' => getErbilDateTime(),
            ]);
        } catch (Exception $e) {
            jsonError('Database connection error: ' . $e->getMessage(), 500);
        }
    }
}
