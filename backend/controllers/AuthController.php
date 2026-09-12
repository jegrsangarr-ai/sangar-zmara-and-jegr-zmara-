<?php
/**
 * Auth Controller (PHP)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class AuthController {
    public static function login(): void {
        $body = getJsonInput();
        $input = trim(strtolower((string)($body['email'] ?? $body['username'] ?? '')));
        $password = (string)($body['password'] ?? '');

        if ($input === '') {
            jsonError('تکایە ئیمەیڵ یان ناوی بەکارهێنەر بنووسە', 400);
        }
        if ($password === '') {
            jsonError('تکایە وشەی نهێنی بنووسە', 400);
        }

        $user = dbFetchOne(
            "SELECT u.id, u.name, u.email, u.username, u.password, u.role_id, u.is_active, u.phone, u.must_change_password,
                    r.name as role_name, r.display_name as role_display_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE LOWER(TRIM(u.email)) = :input OR LOWER(TRIM(u.username)) = :input
             LIMIT 1",
            ['input' => $input]
        );

        if (!$user) {
            logAudit(null, $input, 'LOGIN_FAILED', 'AUTH', '', '', 'ناوی بەکارهێنەر یان ئیمەیڵ نەدۆزرایەوە');
            jsonError('ئیمەیڵ یان وشەی نهێنی هەڵەیە', 401);
        }

        if ((int)$user['is_active'] !== 1) {
            logAudit((int)$user['id'], $user['email'], 'LOGIN_BLOCKED', 'AUTH', '', '', 'هەوڵی چوونەژوورەوە لە هەژماری ناچالاک');
            jsonError('هەژمارەکەت ناچالاک کراوە', 403, 'ACCOUNT_INACTIVE');
        }

        if (!password_verify($password, (string)$user['password'])) {
            logAudit((int)$user['id'], $user['email'], 'LOGIN_FAILED', 'AUTH', '', '', 'وشەی نهێنی هەڵەیە');
            jsonError('ئیمەیڵ یان وشەی نهێنی هەڵەیە', 401);
        }

        // Update last_login
        dbQuery("UPDATE users SET last_login = NOW() WHERE id = :id", ['id' => $user['id']]);

        $config = require __DIR__ . '/../config/config.php';
        $token = jwtEncode([
            'id' => (int)$user['id'],
            'user_id' => (int)$user['id'],
            'email' => $user['email'],
            'username' => $user['username'] ?: explode('@', $user['email'])[0],
            'role' => $user['role_name'],
            'role_name' => $user['role_name'],
            'role_id' => (int)$user['role_id'],
        ], $config['jwt']['secret'], $config['jwt']['expires_in']);

        logAudit((int)$user['id'], $user['email'], 'LOGIN', 'AUTH', '', '', 'چوونەژوورەوەی سەرکەوتوو (PHP MySQL)');

        jsonSuccess([
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'full_name' => $user['name'],
                'email' => $user['email'],
                'username' => $user['username'],
                'role' => $user['role_name'],
                'role_name' => $user['role_name'],
                'role_display_name' => $user['role_display_name'],
                'role_id' => (int)$user['role_id'],
                'must_change_password' => (int)($user['must_change_password'] ?? 0),
                'phone' => $user['phone'] ?? '',
            ]
        ], 'بە سەرکەوتوویی چوویتە ژوورەوە');
    }

    public static function me(array $currentUser): void {
        jsonSuccess($currentUser);
    }

    public static function changeEmail(array $currentUser): void {
        $body = getJsonInput();
        $newEmail = trim(strtolower((string)($body['email'] ?? $body['new_email'] ?? '')));

        if ($newEmail === '' || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
            jsonError('تکایە ئیمەیڵێکی دروست بنووسە', 400);
        }

        $existing = dbFetchOne("SELECT id FROM users WHERE LOWER(email) = :email AND id != :id", [
            'email' => $newEmail,
            'id' => $currentUser['id'],
        ]);

        if ($existing) {
            jsonError('ئەم ئیمەیڵە پێشتر بەکارهاتووە', 400);
        }

        dbQuery("UPDATE users SET email = :email WHERE id = :id", [
            'email' => $newEmail,
            'id' => $currentUser['id'],
        ]);

        logAudit($currentUser['id'], $currentUser['email'], 'CHANGE_EMAIL', 'USER', (string)$currentUser['id'], ['email' => $currentUser['email']], ['email' => $newEmail]);

        jsonSuccess(['email' => $newEmail], 'ئیمەیڵ بە سەرکەوتوویی گۆڕدرا');
    }

    public static function changePassword(array $currentUser): void {
        $body = getJsonInput();
        $oldPassword = (string)($body['current_password'] ?? $body['old_password'] ?? '');
        $newPassword = (string)($body['new_password'] ?? '');

        if ($oldPassword === '') {
            jsonError('تکایە وشەی نهێنی ئێستا بنووسە', 400);
        }
        if (strlen($newPassword) < 6) {
            jsonError('وشەی نهێنی نوێ دەبێت لانیکەم ٦ پیت یان ژمارە بێت', 400);
        }

        $user = dbFetchOne("SELECT password FROM users WHERE id = :id", ['id' => $currentUser['id']]);
        if (!$user || !password_verify($oldPassword, (string)$user['password'])) {
            jsonError('وشەی نهێنی ئێستا هەڵەیە', 400);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
        dbQuery("UPDATE users SET password = :password, must_change_password = 0 WHERE id = :id", [
            'password' => $newHash,
            'id' => $currentUser['id'],
        ]);

        logAudit($currentUser['id'], $currentUser['email'], 'CHANGE_PASSWORD', 'USER', (string)$currentUser['id'], '', 'وشەی نهێنی گۆڕدرا');

        jsonSuccess(null, 'وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە');
    }
}
