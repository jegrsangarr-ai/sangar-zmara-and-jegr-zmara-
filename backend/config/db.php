<?php
/**
 * Database Connection & Helper Functions (MySQL / MariaDB via PDO)
 */

declare(strict_types=1);

$config = require __DIR__ . '/config.php';

function getDbConnection(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $config = require __DIR__ . '/config.php';
    $db = $config['db'];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'],
        $db['port'],
        $db['database'],
        $db['charset']
    );

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => true,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+03:00'",
    ];

    try {
        $pdo = new PDO($dsn, $db['username'], $db['password'], $options);
    } catch (PDOException $e) {
        // Fallback try localhost socket or pos_user if root connection fails
        try {
            $dsnFallback = sprintf('mysql:host=localhost;dbname=%s;charset=%s', $db['database'], $db['charset']);
            $pdo = new PDO($dsnFallback, 'pos_user', 'pos_pass123', $options);
        } catch (PDOException $e2) {
            error_log("Database connection failed: " . $e->getMessage());
            throw new Exception("بەیەکەوەبەستنی بنکەی زانیاری سەرکەوتوو نەبوو: " . $e->getMessage());
        }
    }

    return $pdo;
}

function dbQuery(string $sql, array $params = []): PDOStatement {
    $pdo = getDbConnection();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function dbFetchAll(string $sql, array $params = []): array {
    return dbQuery($sql, $params)->fetchAll();
}

function dbFetchOne(string $sql, array $params = []): ?array {
    $res = dbQuery($sql, $params)->fetch();
    return $res !== false ? $res : null;
}

function dbInsert(string $table, array $data): int {
    $pdo = getDbConnection();
    $keys = array_keys($data);
    $escapedKeys = array_map(fn($k) => "`{$k}`", $keys);
    $placeholders = array_map(fn($k) => ":{$k}", $keys);

    $sql = "INSERT INTO `{$table}` (" . implode(', ', $escapedKeys) . ") VALUES (" . implode(', ', $placeholders) . ")";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($data);
    return (int)$pdo->lastInsertId();
}

function dbUpdate(string $table, array $data, string $whereSql, array $whereParams = []): int {
    $pdo = getDbConnection();
    $sets = [];
    $params = [];
    foreach ($data as $col => $val) {
        $sets[] = "`{$col}` = :set_{$col}";
        $params["set_{$col}"] = $val;
    }
    $params = array_merge($params, $whereParams);
    $sql = "UPDATE `{$table}` SET " . implode(', ', $sets) . " WHERE {$whereSql}";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function dbBegin(): void {
    getDbConnection()->beginTransaction();
}

function dbCommit(): void {
    if (getDbConnection()->inTransaction()) {
        getDbConnection()->commit();
    }
}

function dbRollback(): void {
    if (getDbConnection()->inTransaction()) {
        getDbConnection()->rollBack();
    }
}

function getErbilDateTime(): string {
    return (new DateTime('now', new DateTimeZone('Asia/Baghdad')))->format('Y-m-d H:i:s');
}

function getErbilDate(): string {
    return (new DateTime('now', new DateTimeZone('Asia/Baghdad')))->format('Y-m-d');
}

function getErbilTime(): string {
    return (new DateTime('now', new DateTimeZone('Asia/Baghdad')))->format('H:i');
}

function logAudit(
    ?int $userId,
    ?string $username,
    string $action,
    string $entityType,
    string $entityId = '',
    $oldValues = null,
    $newValues = null,
    string $ipAddress = ''
): void {
    try {
        $oldJson = $oldValues !== null ? (is_string($oldValues) ? $oldValues : json_encode($oldValues, JSON_UNESCAPED_UNICODE)) : null;
        $newJson = $newValues !== null ? (is_string($newValues) ? $newValues : json_encode($newValues, JSON_UNESCAPED_UNICODE)) : null;
        
        dbInsert('audit_logs', [
            'user_id' => $userId,
            'username' => $username,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => (string)$entityId,
            'old_values' => $oldJson,
            'new_values' => $newJson,
            'ip_address' => $ipAddress ?: ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
            'created_at' => getErbilDateTime(),
        ]);
    } catch (Exception $e) {
        error_log("Audit log failed: " . $e->getMessage());
    }
}
