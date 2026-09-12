<?php
/**
 * Backup & Database Export Controller (PHP)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class BackupController {
    public static function list(array $currentUser): void {
        requireAdmin($currentUser);
        $backupDir = __DIR__ . '/../../backups';
        if (!is_dir($backupDir)) {
            @mkdir($backupDir, 0755, true);
        }

        $files = scandir($backupDir);
        $backups = [];

        foreach ($files as $file) {
            if ($file === '.' || $file === '..' || is_dir("{$backupDir}/{$file}")) {
                continue;
            }

            $filePath = "{$backupDir}/{$file}";
            $backups[] = [
                'filename' => $file,
                'size' => filesize($filePath),
                'created_at' => date('Y-m-d H:i:s', filemtime($filePath)),
            ];
        }

        usort($backups, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));
        jsonSuccess($backups);
    }

    public static function create(array $currentUser): void {
        requireAdmin($currentUser);
        $backupDir = __DIR__ . '/../../backups';
        if (!is_dir($backupDir)) {
            @mkdir($backupDir, 0755, true);
        }

        $filename = 'sangar_pos_' . date('Y_m_d_His') . '.sql';
        $targetPath = "{$backupDir}/{$filename}";

        $config = require __DIR__ . '/../config/config.php';
        $db = $config['db'];

        $dumpCmd = sprintf(
            'mariadb-dump -h %s -P %d -u %s %s %s > %s 2>/dev/null',
            escapeshellarg($db['host']),
            $db['port'],
            escapeshellarg($db['username']),
            $db['password'] !== '' ? '-p' . escapeshellarg($db['password']) : '',
            escapeshellarg($db['database']),
            escapeshellarg($targetPath)
        );

        exec($dumpCmd, $output, $returnVar);

        if ($returnVar !== 0 || !file_exists($targetPath) || filesize($targetPath) === 0) {
            // Fallback to mysqldump
            $dumpCmd2 = sprintf(
                'mysqldump -u root %s > %s 2>/dev/null',
                escapeshellarg($db['database']),
                escapeshellarg($targetPath)
            );
            exec($dumpCmd2);
        }

        logAudit($currentUser['id'], $currentUser['email'], 'CREATE_BACKUP', 'BACKUP', $filename, null, ['filename' => $filename]);

        jsonSuccess([
            'filename' => $filename,
            'size' => file_exists($targetPath) ? filesize($targetPath) : 0,
        ], 'کۆپی یەدەگ (باکئەپ) بە سەرکەوتوویی دروستکرا');
    }

    public static function download(string $filename, array $currentUser): void {
        requireAdmin($currentUser);
        $cleanFilename = basename($filename);
        $filePath = __DIR__ . '/../../backups/' . $cleanFilename;

        if (!file_exists($filePath)) {
            jsonError('فایلی باکئەپ نەدۆزرایەوە', 404);
        }

        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $cleanFilename . '"');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }

    public static function export(array $currentUser): void {
        requireAdmin($currentUser);
        $filename = 'sangar_pos_export_' . date('Ymd_His') . '.sql';
        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $config = require __DIR__ . '/../config/config.php';
        $db = $config['db'];

        passthru(sprintf('mariadb-dump -u %s %s', escapeshellarg($db['username']), escapeshellarg($db['database'])));
        exit;
    }

    public static function restore(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $filename = basename((string)($b['filename'] ?? ''));
        $filePath = __DIR__ . '/../../backups/' . $filename;

        if ($filename === '' || !file_exists($filePath)) {
            jsonError('فایلی باکئەپ نەدۆزرایەوە', 404);
        }

        $config = require __DIR__ . '/../config/config.php';
        $db = $config['db'];

        $restoreCmd = sprintf(
            'mariadb -u %s %s < %s',
            escapeshellarg($db['username']),
            escapeshellarg($db['database']),
            escapeshellarg($filePath)
        );

        exec($restoreCmd, $output, $returnVar);

        if ($returnVar !== 0) {
            jsonError('هەڵە لە گەڕاندنەوەی باکئەپ', 500);
        }

        logAudit($currentUser['id'], $currentUser['email'], 'RESTORE_BACKUP', 'BACKUP', $filename, null, ['filename' => $filename]);
        jsonSuccess(null, 'بنکەی زانیاری بە سەرکەوتوویی لە باکئەپ گەڕێندرایەوە');
    }
}
