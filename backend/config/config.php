<?php
/**
 * System Configuration for سەنگەر زمارەیی و جێگر زمارەیی
 * Truck Parts POS & Inventory System
 */

declare(strict_types=1);

date_default_timezone_set('Asia/Baghdad');

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => (int)(getenv('DB_PORT') ?: 3306),
        'database' => getenv('DB_NAME') ?: 'sangar_pos',
        'username' => getenv('DB_USER') ?: 'root',
        'password' => getenv('DB_PASS') !== false ? getenv('DB_PASS') : '',
        'charset' => 'utf8mb4',
    ],
    'jwt' => [
        'secret' => getenv('JWT_SECRET') ?: 'szjz_truck_parts_secret_jwt_key_erbil_2026',
        'expires_in' => 86400 * 30, // 30 days
    ],
    'business' => [
        'name' => 'سەنگەر زمارەیی و جێگر زمارەیی',
        'subtitle' => 'بۆ فرۆشتنی سەرجەم پارچەی یەدەگی بارهەڵگر و چاککردنەوە',
        'city' => 'هەولێر',
        'country' => 'عێراق - هەرێمی کوردستان',
        'address' => 'هەولێر - ناوچەی پیشەسازی باکوور - شەقامی سەرەکی',
        'phone_jegr' => '07503149696',
        'phone_sangar_1' => '07504687412',
        'phone_sangar_2' => '07804457301',
        'currency' => 'د.ع',
    ],
];
