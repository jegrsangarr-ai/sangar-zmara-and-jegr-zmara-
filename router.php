<?php
/**
 * Router for PHP Built-in Web Server
 * Usage: php -S 0.0.0.0:3000 router.php
 */

declare(strict_types=1);

$rawUri = $_SERVER['REQUEST_URI'];
$uriPath = parse_url($rawUri, PHP_URL_PATH);
$decodedPath = urldecode($uriPath);

// 1. Route API requests
if (str_starts_with($decodedPath, '/api/') || $decodedPath === '/api') {
    require __DIR__ . '/api/index.php';
    exit;
}

// 2. Serve static files if they exist
$fullPath = __DIR__ . $decodedPath;
if ($decodedPath !== '/' && file_exists($fullPath) && !is_dir($fullPath)) {
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    $mimeTypes = [
        'js' => 'application/javascript; charset=utf-8',
        'mjs' => 'application/javascript; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'eot' => 'application/vnd.ms-fontobject',
    ];

    if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
    }
    readfile($fullPath);
    exit;
}

// 3. Login page
if ($decodedPath === '/login' || $decodedPath === '/login.html') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/login.html');
    exit;
}

// 4. Root / Dashboard page
if ($decodedPath === '/' || $decodedPath === '/index.html') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');
    exit;
}

// 5. Fallback for client-side navigation
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');
exit;
