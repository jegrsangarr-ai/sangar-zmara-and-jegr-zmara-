<?php
/**
 * Safe Admin Password Reset Tool for Sangar & Jegr POS (PHP + MySQL/MariaDB)
 * 
 * Usage:
 *   php backend/reset_admin_password.php [username_or_email] [new_password]
 * 
 * Defaults:
 *   Target: admin (jegrsangarr@gmail.com)
 *   Password: Sangar2026!
 *   Must change password on next login: YES
 */

declare(strict_types=1);

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/helpers.php';

// Allow CLI execution or secure internal invocation
$targetUser = $argv[1] ?? 'admin';
$rawPassword = $argv[2] ?? 'Sangar2026!';

echo "======================================================\n";
echo "Sangar & Jegr POS - Safe Admin Password Reset Utility\n";
echo "======================================================\n";

try {
    $pdo = getDbConnection();

    // 1. Locate the user
    $stmt = $pdo->prepare("
        SELECT u.id, u.name, u.email, u.username, u.role_id, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE LOWER(TRIM(u.username)) = :target OR LOWER(TRIM(u.email)) = :target
        LIMIT 1
    ");
    $stmt->execute(['target' => strtolower(trim($targetUser))]);
    $user = $stmt->fetch();

    if (!$user) {
        // If 'admin' username not found, try by ID 1 or first admin
        $stmt2 = $pdo->query("
            SELECT u.id, u.name, u.email, u.username, u.role_id, r.name as role_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.role_id = 1 OR r.name = 'admin'
            ORDER BY u.id ASC
            LIMIT 1
        ");
        $user = $stmt2->fetch();
    }

    if (!$user) {
        echo "Error: No administrator account found in the database.\n";
        exit(1);
    }

    echo "Found Admin Account:\n";
    echo "  - ID: {$user['id']}\n";
    echo "  - Name: {$user['name']}\n";
    echo "  - Email: {$user['email']}\n";
    echo "  - Username: {$user['username']}\n";
    echo "  - Role: {$user['role_name']}\n\n";

    // 2. Generate secure hash using password_hash()
    $hash = password_hash($rawPassword, PASSWORD_BCRYPT, ['cost' => 10]);

    // 3. Immediately test password_verify()
    if (!password_verify($rawPassword, $hash)) {
        echo "Self-test error: password_verify() failed on generated hash.\n";
        exit(1);
    }
    echo "Password hashing self-test: PASS (BCRYPT cost 10)\n";

    // 4. Update the database securely
    $updateStmt = $pdo->prepare("
        UPDATE users
        SET password = :password,
            must_change_password = 1,
            updated_at = NOW()
        WHERE id = :id
    ");
    $updateStmt->execute([
        'password' => $hash,
        'id' => $user['id'],
    ]);

    // 5. Verify database record
    $verifyStmt = $pdo->prepare("SELECT password, must_change_password FROM users WHERE id = :id");
    $verifyStmt->execute(['id' => $user['id']]);
    $updated = $verifyStmt->fetch();

    if (!$updated || !password_verify($rawPassword, $updated['password'])) {
        echo "Verification Error: Stored password hash does not match.\n";
        exit(1);
    }

    // 6. Log audit event
    logAudit(
        (int)$user['id'],
        $user['email'],
        'ADMIN_PASSWORD_RESET',
        'USER',
        (string)$user['id'],
        null,
        'Admin password securely reset with requirement to change on next login'
    );

    echo "Database update: SUCCESS\n";
    echo "Verification test: PASS\n";
    echo "Must change password flag: " . ($updated['must_change_password'] ? 'YES' : 'NO') . "\n";
    echo "======================================================\n";
    echo "Admin Account Successfully Reset:\n";
    echo "  Username / Email: {$user['username']} / {$user['email']}\n";
    echo "  Temporary Password: {$rawPassword}\n";
    echo "  Requirement: Must change password after login.\n";
    echo "======================================================\n";

} catch (Exception $e) {
    echo "Fatal Error during reset: " . $e->getMessage() . "\n";
    exit(1);
}
