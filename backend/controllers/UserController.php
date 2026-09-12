<?php
/**
 * User & Role Management Controller (PHP)
 * Uses secure password_hash() and password_verify()
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class UserController {
    public static function list(array $currentUser): void {
        requireAdmin($currentUser);
        $rows = dbFetchAll(
            "SELECT u.id, u.name, u.email, u.username, u.role_id, u.is_active, u.phone, u.last_login, u.created_at,
                    r.name as role_name, r.display_name as role_display_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             ORDER BY u.id ASC"
        );
        jsonSuccess($rows);
    }

    public static function listRoles(): void {
        $rows = dbFetchAll("SELECT * FROM roles ORDER BY id ASC");
        jsonSuccess($rows);
    }

    public static function create(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();

        $name = trim((string)($b['name'] ?? ''));
        $email = trim(strtolower((string)($b['email'] ?? '')));
        $username = trim((string)($b['username'] ?? ''));
        $password = (string)($b['password'] ?? '');
        $roleId = isset($b['role_id']) ? (int)$b['role_id'] : 2;

        if ($name === '') {
            jsonError('تکایە ناوی تەواو بنووسە', 400);
        }
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonError('تکایە ئیمەیڵێکی دروست بنووسە', 400);
        }
        if (strlen($password) < 6) {
            jsonError('وشەی نهێنی دەبێت لانیکەم ٦ پیت یان ژمارە بێت', 400);
        }

        $existing = dbFetchOne("SELECT id FROM users WHERE LOWER(email) = :e OR LOWER(username) = :u", [
            'e' => $email,
            'u' => $username ?: $email,
        ]);
        if ($existing) {
            jsonError('ئەم ئیمەیڵە یان ناوی بەکارهێنەرە پێشتر تۆمارکراوە', 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

        $userId = dbInsert('users', [
            'name' => $name,
            'email' => $email,
            'username' => $username ?: explode('@', $email)[0],
            'password' => $hash,
            'role_id' => $roleId,
            'phone' => trim((string)($b['phone'] ?? '')) ?: null,
            'is_active' => 1,
        ]);

        dbInsert('user_profiles', [
            'user_id' => $userId,
            'display_name' => $name,
        ]);

        logAudit($currentUser['id'], $currentUser['email'], 'CREATE_USER', 'USER', (string)$userId, null, [
            'name' => $name,
            'email' => $email,
            'role_id' => $roleId,
        ]);

        $created = dbFetchOne("SELECT u.id, u.name, u.email, u.username, u.role_id, u.is_active, r.name as role_name, r.display_name as role_display_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = :id", ['id' => $userId]);
        jsonSuccess($created, 'بەکارهێنەر بە سەرکەوتوویی زیادکرا');
    }

    public static function updateRole(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $roleId = (int)($b['role_id'] ?? 0);
        if ($roleId <= 0) {
            jsonError('ڕۆڵ دیاری نەکراوە', 400);
        }

        dbUpdate('users', ['role_id' => $roleId], 'id = :id', ['id' => $id]);
        logAudit($currentUser['id'], $currentUser['email'], 'CHANGE_USER_ROLE', 'USER', (string)$id, null, ['role_id' => $roleId]);
        jsonSuccess(null, 'دەسەڵاتی بەکارهێنەر نوێکرایەوە');
    }

    public static function updateStatus(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        if ($id === $currentUser['id']) {
            jsonError('ناتوانیت هەژماری خۆت ناچالاک بکەیت', 400);
        }

        $b = getJsonInput();
        $isActive = isset($b['is_active']) ? ((int)$b['is_active'] === 1 ? 1 : 0) : 1;

        dbUpdate('users', ['is_active' => $isActive], 'id = :id', ['id' => $id]);
        logAudit($currentUser['id'], $currentUser['email'], 'CHANGE_USER_STATUS', 'USER', (string)$id, null, ['is_active' => $isActive]);
        jsonSuccess(null, $isActive === 1 ? 'هەژمار چالاک کرایەوە' : 'هەژمار ناچالاک کرا');
    }

    public static function resetPassword(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $newPassword = (string)($b['password'] ?? $b['new_password'] ?? '');

        if (strlen($newPassword) < 6) {
            jsonError('وشەی نهێنی دەبێت لانیکەم ٦ پیت یان ژمارە بێت', 400);
        }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
        dbUpdate('users', ['password' => $hash], 'id = :id', ['id' => $id]);

        logAudit($currentUser['id'], $currentUser['email'], 'ADMIN_RESET_PASSWORD', 'USER', (string)$id, null, 'وشەی نهێنی بەڕێوەبەر گۆڕی');
        jsonSuccess(null, 'وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە');
    }

    public static function update(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $user = dbFetchOne("SELECT * FROM users WHERE id = :id", ['id' => $id]);
        if (!$user) {
            jsonError('بەکارهێنەر نەدۆزرایەوە', 404);
        }

        $data = [];
        if (isset($b['name'])) $data['name'] = trim((string)$b['name']);
        if (isset($b['email'])) $data['email'] = trim(strtolower((string)$b['email']));
        if (isset($b['phone'])) $data['phone'] = trim((string)$b['phone']) ?: null;
        if (isset($b['role_id'])) $data['role_id'] = (int)$b['role_id'];
        if (isset($b['is_active'])) $data['is_active'] = (int)$b['is_active'];

        if (!empty($data)) {
            dbUpdate('users', $data, 'id = :id', ['id' => $id]);
            logAudit($currentUser['id'], $currentUser['email'], 'UPDATE_USER', 'USER', (string)$id, $user, $data);
        }

        $updated = dbFetchOne("SELECT u.id, u.name, u.email, u.username, u.role_id, u.is_active, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = :id", ['id' => $id]);
        jsonSuccess($updated, 'زانیاری بەکارهێنەر نوێکرایەوە');
    }

    public static function delete(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        if ($id === $currentUser['id']) {
            jsonError('ناتوانیت هەژماری خۆت بسڕیتەوە', 400);
        }

        dbUpdate('users', ['is_active' => 0], 'id = :id', ['id' => $id]);
        logAudit($currentUser['id'], $currentUser['email'], 'DELETE_USER', 'USER', (string)$id, null, ['is_active' => 0]);
        jsonSuccess(null, 'بەکارهێنەر سڕایەوە');
    }
}
