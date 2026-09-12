<?php
/**
 * Authentication Module for Sangar & Jegr POS (PHP)
 * Uses secure password_hash(), password_verify(), and standard HMAC-SHA256 tokens
 */

declare(strict_types=1);

require_once __DIR__ . '/config/db.php';

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

function jwtEncode(array $payload, string $secret, int $expiresIn = 86400 * 30): string {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload['iat'] = time();
    $payload['exp'] = time() + $expiresIn;
    $payloadJson = json_encode($payload);

    $base64Header = base64UrlEncode($header);
    $base64Payload = base64UrlEncode($payloadJson);
    $signature = hash_hmac('sha256', "{$base64Header}.{$base64Payload}", $secret, true);
    $base64Signature = base64UrlEncode($signature);

    return "{$base64Header}.{$base64Payload}.{$base64Signature}";
}

function jwtDecode(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$base64Header, $base64Payload, $base64Signature] = $parts;
    $signature = hash_hmac('sha256', "{$base64Header}.{$base64Payload}", $secret, true);
    $expectedSignature = base64UrlEncode($signature);

    if (!hash_equals($expectedSignature, $base64Signature)) {
        return null;
    }

    $payload = json_decode(base64UrlDecode($base64Payload), true);
    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }

    return $payload;
}

function getBearerToken(): ?string {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }

    if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        return $matches[1];
    }
    return null;
}

function authenticateUser(): array {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'تکایە سەرەتا بچۆ ژوورەوە'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $config = require __DIR__ . '/config/config.php';
    $decoded = jwtDecode($token, $config['jwt']['secret']);

    if (!$decoded) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'تۆکنەکەت بەسەرچووە یان نادروستە'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $userId = (int)($decoded['id'] ?? $decoded['user_id'] ?? 0);
    $email = trim(strtolower((string)($decoded['email'] ?? '')));

    $user = dbFetchOne(
        "SELECT u.id, u.name, u.email, u.username, u.role_id, u.is_active, u.phone, u.must_change_password,
                r.name as role_name, r.display_name as role_display_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = :id OR LOWER(TRIM(u.email)) = :email
         LIMIT 1",
        ['id' => $userId, 'email' => $email]
    );

    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'بەکارهێنەر نەدۆزرایەوە'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ((int)$user['is_active'] !== 1) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'هەژمارەکەت ناچالاک کراوە',
            'code' => 'ACCOUNT_INACTIVE'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return [
        'id' => (int)$user['id'],
        'user_id' => (int)$user['id'],
        'email' => $user['email'],
        'username' => $user['username'] ?: explode('@', $user['email'])[0],
        'name' => $user['name'],
        'full_name' => $user['name'],
        'role' => $user['role_name'],
        'role_name' => $user['role_name'],
        'role_display_name' => $user['role_display_name'],
        'role_id' => (int)$user['role_id'],
        'is_active' => (int)$user['is_active'],
        'must_change_password' => (int)($user['must_change_password'] ?? 0),
        'phone' => $user['phone'] ?? '',
    ];
}

function requireAdmin(array $user): void {
    if ($user['role'] !== 'admin' && $user['role_name'] !== 'admin' && (int)$user['role_id'] !== 1) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'تەنها بەڕێوەبەر دەسەڵاتی ئەم کارەی هەیە'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
