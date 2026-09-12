<?php
/**
 * Product, Category & Brand Controller (PHP)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

class ProductController {
    public static function list(): void {
        $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
        $categoryId = isset($_GET['category_id']) && $_GET['category_id'] !== '' ? (int)$_GET['category_id'] : null;
        $brandId = isset($_GET['brand_id']) && $_GET['brand_id'] !== '' ? (int)$_GET['brand_id'] : null;
        $truckBrand = trim((string)($_GET['truck_brand'] ?? ''));
        $lowStock = isset($_GET['low_stock']) && ($_GET['low_stock'] === '1' || $_GET['low_stock'] === 'true');
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $where = ["p.is_active = 1"];
        $params = [];

        if ($search !== '') {
            $where[] = "(p.name LIKE :search OR p.barcode LIKE :search OR p.part_number LIKE :search OR p.oem_number LIKE :search OR p.truck_brand LIKE :search)";
            $params['search'] = "%{$search}%";
        }
        if ($categoryId !== null) {
            $where[] = "p.category_id = :cat_id";
            $params['cat_id'] = $categoryId;
        }
        if ($brandId !== null) {
            $where[] = "p.brand_id = :brand_id";
            $params['brand_id'] = $brandId;
        }
        if ($truckBrand !== '') {
            $where[] = "p.truck_brand LIKE :truck_brand";
            $params['truck_brand'] = "%{$truckBrand}%";
        }
        if ($lowStock) {
            $where[] = "p.quantity <= p.min_stock_level";
        }

        $whereClause = implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) as total FROM products p WHERE {$whereClause}";
        $total = (int)(dbFetchOne($countSql, $params)['total'] ?? 0);

        $sql = "SELECT p.*, c.name as category_name, b.name as brand_name, s.name as supplier_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN brands b ON p.brand_id = b.id
                LEFT JOIN suppliers s ON p.supplier_id = s.id
                WHERE {$whereClause}
                ORDER BY p.id DESC
                LIMIT {$limit} OFFSET {$offset}";

        $rows = dbFetchAll($sql, $params);

        $page = $limit > 0 ? (int)floor($offset / $limit) + 1 : 1;
        jsonSuccess($rows, null, 200, [
            'products' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public static function search(): void {
        $q = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
        $limit = isset($_GET['limit']) ? max(1, min(150, (int)$_GET['limit'])) : 20;

        if ($q === '') {
            $sql = "SELECT p.*, c.name as category_name, b.name as brand_name
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN brands b ON p.brand_id = b.id
                    WHERE p.is_active = 1
                    ORDER BY p.id DESC
                    LIMIT {$limit}";
            $rows = dbFetchAll($sql);
            jsonSuccess($rows, null, 200, ['products' => $rows]);
        }

        $sql = "SELECT p.*, c.name as category_name, b.name as brand_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN brands b ON p.brand_id = b.id
                WHERE p.is_active = 1 AND (
                    p.name LIKE :q OR p.barcode LIKE :q OR p.part_number LIKE :q OR p.oem_number LIKE :q OR p.truck_brand LIKE :q
                )
                ORDER BY p.name ASC
                LIMIT {$limit}";

        $rows = dbFetchAll($sql, ['q' => "%{$q}%"]);
        jsonSuccess($rows, null, 200, ['products' => $rows]);
    }

    public static function getByBarcode(string $barcode): void {
        $barcode = trim($barcode);
        $prod = dbFetchOne(
            "SELECT p.*, c.name as category_name, b.name as brand_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN brands b ON p.brand_id = b.id
             WHERE p.barcode = :bc AND p.is_active = 1
             LIMIT 1",
            ['bc' => $barcode]
        );

        if (!$prod) {
            jsonError('هیچ کاڵایەک بەم بارکۆدە نەدۆزرایەوە', 404);
        }

        jsonSuccess($prod);
    }

    public static function get(int $id): void {
        $prod = dbFetchOne(
            "SELECT p.*, c.name as category_name, b.name as brand_name, s.name as supplier_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN brands b ON p.brand_id = b.id
             LEFT JOIN suppliers s ON p.supplier_id = s.id
             WHERE p.id = :id AND p.is_active = 1",
            ['id' => $id]
        );

        if (!$prod) {
            jsonError('کاڵا نەدۆزرایەوە', 404);
        }

        $batches = dbFetchAll(
            "SELECT * FROM inventory_batches WHERE product_id = :pid ORDER BY purchase_date ASC, id ASC",
            ['pid' => $id]
        );
        $prod['batches'] = $batches;

        jsonSuccess($prod);
    }

    public static function create(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();

        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی کاڵا بنووسە', 400);
        }

        $purchasePrice = max(0, (int)($b['purchase_price'] ?? 0));
        $sellingPrice = max(0, (int)($b['selling_price'] ?? 0));
        $quantity = max(0, (int)($b['quantity'] ?? 0));
        $minStock = isset($b['min_stock_level']) ? max(0, (int)$b['min_stock_level']) : 3;

        dbBegin();
        try {
            $prodId = dbInsert('products', [
                'name' => $name,
                'barcode' => trim((string)($b['barcode'] ?? '')) ?: null,
                'sku' => trim((string)($b['sku'] ?? '')) ?: null,
                'part_number' => trim((string)($b['part_number'] ?? '')) ?: null,
                'oem_number' => trim((string)($b['oem_number'] ?? '')) ?: null,
                'category_id' => !empty($b['category_id']) ? (int)$b['category_id'] : null,
                'brand_id' => !empty($b['brand_id']) ? (int)$b['brand_id'] : null,
                'truck_brand' => trim((string)($b['truck_brand'] ?? '')) ?: null,
                'truck_model' => trim((string)($b['truck_model'] ?? '')) ?: null,
                'supplier_id' => !empty($b['supplier_id']) ? (int)$b['supplier_id'] : null,
                'purchase_price' => $purchasePrice,
                'selling_price' => $sellingPrice,
                'quantity' => $quantity,
                'min_stock_level' => $minStock,
                'storage_location' => trim((string)($b['storage_location'] ?? '')) ?: null,
                'description' => trim((string)($b['description'] ?? '')) ?: null,
                'notes' => trim((string)($b['notes'] ?? '')) ?: null,
                'is_active' => 1,
            ]);

            // If initial quantity > 0, create an initial FIFO batch and movement
            if ($quantity > 0) {
                dbInsert('inventory_batches', [
                    'product_id' => $prodId,
                    'batch_type' => 'INITIAL',
                    'batch_number' => 'INIT-' . date('Ymd') . "-{$prodId}",
                    'original_quantity' => $quantity,
                    'remaining_quantity' => $quantity,
                    'unit_cost' => $purchasePrice,
                    'purchase_date' => getErbilDate(),
                    'notes' => 'مەخزەنی سەرەتایی لە کاتی دروستکردنی کاڵا',
                ]);

                dbInsert('inventory_movements', [
                    'product_id' => $prodId,
                    'quantity_change' => $quantity,
                    'stock_after' => $quantity,
                    'movement_type' => 'INITIAL',
                    'user_id' => $currentUser['id'],
                    'notes' => 'تۆمارکردنی سەرەتایی کاڵا',
                ]);
            }

            dbCommit();

            logAudit($currentUser['id'], $currentUser['email'], 'CREATE_PRODUCT', 'PRODUCT', (string)$prodId, null, $b);

            $created = dbFetchOne("SELECT * FROM products WHERE id = :id", ['id' => $prodId]);
            jsonSuccess($created, 'کاڵا بە سەرکەوتوویی زیادکرا');
        } catch (Exception $e) {
            dbRollback();
            jsonError('هەڵە لە زیادکردنی کاڵا: ' . $e->getMessage(), 500);
        }
    }

    public static function update(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();

        $prod = dbFetchOne("SELECT * FROM products WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$prod) {
            jsonError('کاڵا نەدۆزرایەوە', 404);
        }

        $data = [];
        if (isset($b['name'])) $data['name'] = trim((string)$b['name']);
        if (isset($b['barcode'])) $data['barcode'] = trim((string)$b['barcode']) ?: null;
        if (isset($b['sku'])) $data['sku'] = trim((string)$b['sku']) ?: null;
        if (isset($b['part_number'])) $data['part_number'] = trim((string)$b['part_number']) ?: null;
        if (isset($b['oem_number'])) $data['oem_number'] = trim((string)$b['oem_number']) ?: null;
        if (array_key_exists('category_id', $b)) $data['category_id'] = !empty($b['category_id']) ? (int)$b['category_id'] : null;
        if (array_key_exists('brand_id', $b)) $data['brand_id'] = !empty($b['brand_id']) ? (int)$b['brand_id'] : null;
        if (isset($b['truck_brand'])) $data['truck_brand'] = trim((string)$b['truck_brand']) ?: null;
        if (isset($b['truck_model'])) $data['truck_model'] = trim((string)$b['truck_model']) ?: null;
        if (array_key_exists('supplier_id', $b)) $data['supplier_id'] = !empty($b['supplier_id']) ? (int)$b['supplier_id'] : null;
        if (isset($b['purchase_price'])) $data['purchase_price'] = max(0, (int)$b['purchase_price']);
        if (isset($b['selling_price'])) $data['selling_price'] = max(0, (int)$b['selling_price']);
        if (isset($b['min_stock_level'])) $data['min_stock_level'] = max(0, (int)$b['min_stock_level']);
        if (isset($b['storage_location'])) $data['storage_location'] = trim((string)$b['storage_location']) ?: null;
        if (isset($b['description'])) $data['description'] = trim((string)$b['description']) ?: null;
        if (isset($b['notes'])) $data['notes'] = trim((string)$b['notes']) ?: null;

        if (!empty($data)) {
            dbUpdate('products', $data, 'id = :id', ['id' => $id]);
            logAudit($currentUser['id'], $currentUser['email'], 'UPDATE_PRODUCT', 'PRODUCT', (string)$id, $prod, $data);
        }

        $updated = dbFetchOne("SELECT * FROM products WHERE id = :id", ['id' => $id]);
        jsonSuccess($updated, 'زانیارییەکانی کاڵا نوێکرانەوە');
    }

    public static function delete(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $prod = dbFetchOne("SELECT * FROM products WHERE id = :id AND is_active = 1", ['id' => $id]);
        if (!$prod) {
            jsonError('کاڵا نەدۆزرایەوە', 404);
        }

        dbUpdate('products', ['is_active' => 0], 'id = :id', ['id' => $id]);
        logAudit($currentUser['id'], $currentUser['email'], 'DELETE_PRODUCT', 'PRODUCT', (string)$id, $prod, ['is_active' => 0]);

        jsonSuccess(null, 'کاڵا بە سەرکەوتوویی سڕایەوە');
    }

    public static function getBatches(int $id): void {
        $batches = dbFetchAll(
            "SELECT * FROM inventory_batches WHERE product_id = :id ORDER BY purchase_date ASC, id ASC",
            ['id' => $id]
        );
        jsonSuccess($batches);
    }

    // Categories
    public static function listCategories(): void {
        $rows = dbFetchAll("SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC");
        jsonSuccess($rows);
    }

    public static function createCategory(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی پۆل بنووسە', 400);
        }
        $id = dbInsert('categories', [
            'name' => $name,
            'description' => trim((string)($b['description'] ?? '')) ?: null,
            'is_active' => 1,
        ]);
        jsonSuccess(dbFetchOne("SELECT * FROM categories WHERE id = :id", ['id' => $id]), 'پۆل زیادکرا');
    }

    public static function updateCategory(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی پۆل بنووسە', 400);
        }
        dbUpdate('categories', [
            'name' => $name,
            'description' => trim((string)($b['description'] ?? '')) ?: null,
        ], 'id = :id', ['id' => $id]);
        jsonSuccess(dbFetchOne("SELECT * FROM categories WHERE id = :id", ['id' => $id]), 'پۆل نوێکرایەوە');
    }

    public static function deleteCategory(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        dbUpdate('categories', ['is_active' => 0], 'id = :id', ['id' => $id]);
        jsonSuccess(null, 'پۆل سڕایەوە');
    }

    // Brands
    public static function listBrands(): void {
        $rows = dbFetchAll("SELECT * FROM brands WHERE is_active = 1 ORDER BY name ASC");
        jsonSuccess($rows);
    }

    public static function createBrand(array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی براند بنووسە', 400);
        }
        $id = dbInsert('brands', [
            'name' => $name,
            'country' => trim((string)($b['country'] ?? '')) ?: null,
            'is_truck_brand' => isset($b['is_truck_brand']) ? (int)$b['is_truck_brand'] : 1,
            'is_active' => 1,
        ]);
        jsonSuccess(dbFetchOne("SELECT * FROM brands WHERE id = :id", ['id' => $id]), 'براند زیادکرا');
    }

    public static function updateBrand(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        $b = getJsonInput();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') {
            jsonError('تکایە ناوی براند بنووسە', 400);
        }
        dbUpdate('brands', [
            'name' => $name,
            'country' => trim((string)($b['country'] ?? '')) ?: null,
            'is_truck_brand' => isset($b['is_truck_brand']) ? (int)$b['is_truck_brand'] : 1,
        ], 'id = :id', ['id' => $id]);
        jsonSuccess(dbFetchOne("SELECT * FROM brands WHERE id = :id", ['id' => $id]), 'براند نوێکرایەوە');
    }

    public static function deleteBrand(int $id, array $currentUser): void {
        requireAdmin($currentUser);
        dbUpdate('brands', ['is_active' => 0], 'id = :id', ['id' => $id]);
        jsonSuccess(null, 'براند سڕایەوە');
    }
}
