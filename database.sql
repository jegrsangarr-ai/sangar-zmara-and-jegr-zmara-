-- ==========================================================
-- سەنگەر زمارەیی و جێگر زمارەیی - Truck Parts POS & Inventory
-- MySQL / MariaDB Database Schema
-- Character Set: utf8mb4 / utf8mb4_unicode_ci
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+03:00";

-- --------------------------------------------------------
-- Table: roles
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `display_name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: users
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_id` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `username` VARCHAR(100) NULL,
  `password` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `is_active` TINYINT DEFAULT 1,
  `last_login` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role_id`),
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_username` (`username`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: user_profiles
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `auth_user_id` VARCHAR(100) NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `role_id` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `phone` VARCHAR(50) NULL,
  `last_login` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_user_profiles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: categories
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `is_active` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: brands
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `brands` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL UNIQUE,
  `country` VARCHAR(100) NULL,
  `is_truck_brand` TINYINT DEFAULT 1,
  `is_active` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: suppliers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `company_name` VARCHAR(150) NULL,
  `phone` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `notes` TEXT NULL,
  `total_purchases` BIGINT DEFAULT 0,
  `total_paid` BIGINT DEFAULT 0,
  `balance_debt` BIGINT DEFAULT 0,
  `is_active` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_suppliers_search` (`name`, `phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: customers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `notes` TEXT NULL,
  `total_spent` BIGINT DEFAULT 0,
  `total_paid` BIGINT DEFAULT 0,
  `current_debt` BIGINT DEFAULT 0,
  `is_active` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_cust_search_name` (`name`),
  INDEX `idx_cust_search_phone` (`phone`),
  INDEX `idx_customers_search` (`name`, `phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: companies
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `companies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `owner_name` VARCHAR(150) NULL,
  `phone` VARCHAR(50) NULL,
  `phone2` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `notes` TEXT NULL,
  `total_purchases` BIGINT DEFAULT 0,
  `total_paid` BIGINT DEFAULT 0,
  `current_debt` BIGINT DEFAULT 0,
  `is_active` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_comp_search_name` (`name`),
  INDEX `idx_comp_search_owner` (`owner_name`),
  INDEX `idx_companies_search` (`name`, `phone`, `owner_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: company_vehicles
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_vehicles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `plate_number` VARCHAR(100) NULL,
  `vehicle_number` VARCHAR(100) NULL,
  `truck_brand` VARCHAR(100) NULL,
  `truck_model` VARCHAR(100) NULL,
  `driver_id` INT NULL,
  `notes` TEXT NULL,
  `is_active` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_veh_search_plate` (`plate_number`),
  INDEX `idx_veh_search_number` (`vehicle_number`),
  INDEX `idx_vehicles_search` (`plate_number`, `vehicle_number`, `company_id`),
  CONSTRAINT `fk_comp_vehicles_comp` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: company_drivers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_drivers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `is_active` TINYINT DEFAULT 1,
  `vehicle_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_drv_search_name` (`full_name`),
  INDEX `idx_drv_search_phone` (`phone`),
  INDEX `idx_drivers_search` (`full_name`, `phone`, `company_id`),
  CONSTRAINT `fk_comp_drivers_comp` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comp_drivers_veh` FOREIGN KEY (`vehicle_id`) REFERENCES `company_vehicles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: products
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `barcode` VARCHAR(100) NULL,
  `sku` VARCHAR(100) NULL,
  `part_number` VARCHAR(100) NULL,
  `oem_number` VARCHAR(100) NULL,
  `category_id` INT NULL,
  `brand_id` INT NULL,
  `truck_brand` VARCHAR(100) NULL,
  `truck_model` VARCHAR(100) NULL,
  `supplier_id` INT NULL,
  `purchase_price` BIGINT NOT NULL DEFAULT 0,
  `selling_price` BIGINT NOT NULL DEFAULT 0,
  `quantity` INT NOT NULL DEFAULT 0,
  `min_stock_level` INT NOT NULL DEFAULT 3,
  `storage_location` VARCHAR(100) NULL,
  `description` TEXT NULL,
  `notes` TEXT NULL,
  `is_active` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_products_barcode` (`barcode`),
  INDEX `idx_products_part_num` (`part_number`),
  INDEX `idx_products_truck_brand` (`truck_brand`),
  INDEX `idx_products_search` (`name`, `barcode`, `part_number`, `oem_number`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sales
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `receipt_number` VARCHAR(100) NOT NULL UNIQUE,
  `customer_id` INT NULL,
  `user_id` INT NOT NULL,
  `subtotal` BIGINT NOT NULL DEFAULT 0,
  `discount_amount` BIGINT NOT NULL DEFAULT 0,
  `total_amount` BIGINT NOT NULL DEFAULT 0,
  `total_cost` BIGINT NOT NULL DEFAULT 0,
  `gross_profit` BIGINT NOT NULL DEFAULT 0,
  `paid_amount` BIGINT NOT NULL DEFAULT 0,
  `debt_amount` BIGINT NOT NULL DEFAULT 0,
  `change_amount` BIGINT NOT NULL DEFAULT 0,
  `payment_type` VARCHAR(50) NOT NULL DEFAULT 'cash',
  `status` VARCHAR(50) NOT NULL DEFAULT 'completed',
  `notes` TEXT NULL,
  `sale_date` VARCHAR(20) NOT NULL,
  `sale_time` VARCHAR(20) NOT NULL,
  `customer_type` VARCHAR(50) DEFAULT 'individual',
  `company_id` INT NULL,
  `company_driver_id` INT NULL,
  `company_vehicle_id` INT NULL,
  `customer_display_name` VARCHAR(150) NULL,
  `customer_phone_snapshot` VARCHAR(50) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sales_date` (`sale_date`),
  INDEX `idx_sales_receipt` (`receipt_number`),
  INDEX `idx_sales_company` (`company_id`),
  INDEX `idx_sales_cust_snapshot` (`customer_display_name`),
  CONSTRAINT `fk_sales_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sales_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_driver` FOREIGN KEY (`company_driver_id`) REFERENCES `company_drivers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_vehicle` FOREIGN KEY (`company_vehicle_id`) REFERENCES `company_vehicles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sale_items
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `part_number` VARCHAR(100) NULL,
  `quantity` INT NOT NULL,
  `returned_quantity` INT NOT NULL DEFAULT 0,
  `unit_cost` BIGINT NOT NULL DEFAULT 0,
  `unit_price` BIGINT NOT NULL DEFAULT 0,
  `discount` BIGINT NOT NULL DEFAULT 0,
  `total_price` BIGINT NOT NULL DEFAULT 0,
  `total_cost` BIGINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sale_items_sale` (`sale_id`),
  INDEX `idx_sale_items_product` (`product_id`),
  CONSTRAINT `fk_sale_items_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sale_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: payments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reference_type` VARCHAR(50) NOT NULL,
  `reference_id` INT NOT NULL,
  `customer_id` INT NULL,
  `supplier_id` INT NULL,
  `amount` BIGINT NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'cash',
  `user_id` INT NOT NULL,
  `payment_date` VARCHAR(20) NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: purchases
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_number` VARCHAR(100) NOT NULL,
  `supplier_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `total_amount` BIGINT NOT NULL DEFAULT 0,
  `paid_amount` BIGINT NOT NULL DEFAULT 0,
  `debt_amount` BIGINT NOT NULL DEFAULT 0,
  `purchase_date` VARCHAR(20) NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_purchases_date` (`purchase_date`),
  INDEX `idx_purchases_invoice` (`invoice_number`),
  CONSTRAINT `fk_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_purchases_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: purchase_items
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` INT NOT NULL,
  `product_id` INT NULL,
  `item_name` VARCHAR(255) NULL,
  `part_number` VARCHAR(100) NULL,
  `quantity` INT NOT NULL,
  `purchase_price` BIGINT NOT NULL,
  `selling_price` BIGINT NOT NULL DEFAULT 0,
  `total_price` BIGINT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_purchase_items_purch` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_purchase_items_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: inventory_batches (FIFO Lots)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `purchase_id` INT NULL,
  `purchase_item_id` INT NULL,
  `supplier_id` INT NULL,
  `batch_type` VARCHAR(50) NOT NULL DEFAULT 'PURCHASE',
  `batch_number` VARCHAR(100) NULL,
  `original_quantity` INT NOT NULL,
  `remaining_quantity` INT NOT NULL,
  `unit_cost` BIGINT NOT NULL DEFAULT 0,
  `purchase_date` VARCHAR(20) NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_batches_product_remaining` (`product_id`, `remaining_quantity`),
  INDEX `idx_inv_batches_prod_fifo` (`product_id`, `purchase_date` ASC, `id` ASC),
  CONSTRAINT `fk_inv_batches_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_inv_batches_purch` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv_batches_pitem` FOREIGN KEY (`purchase_item_id`) REFERENCES `purchase_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv_batches_supp` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: inventory_movements
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_movements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `quantity_change` INT NOT NULL,
  `stock_after` INT NOT NULL,
  `movement_type` VARCHAR(50) NOT NULL,
  `reference_type` VARCHAR(50) NULL,
  `reference_id` INT NULL,
  `user_id` INT NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_inv_movements_prod` (`product_id`),
  CONSTRAINT `fk_inv_movements_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_inv_movements_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sale_item_cost_allocations
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_item_cost_allocations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `sale_item_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `batch_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `unit_cost` BIGINT NOT NULL DEFAULT 0,
  `total_cost` BIGINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cost_alloc_sale` (`sale_id`),
  INDEX `idx_cost_alloc_sale_item` (`sale_item_id`),
  INDEX `idx_cost_alloc_batch` (`batch_id`),
  CONSTRAINT `fk_cost_alloc_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cost_alloc_item` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cost_alloc_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cost_alloc_batch` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: returns
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `returns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `return_number` VARCHAR(100) NOT NULL UNIQUE,
  `sale_id` INT NOT NULL,
  `customer_id` INT NULL,
  `user_id` INT NOT NULL,
  `total_refund` BIGINT NOT NULL DEFAULT 0,
  `return_date` VARCHAR(20) NOT NULL,
  `reason` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_returns_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_returns_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_returns_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: return_items
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `return_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `return_id` INT NOT NULL,
  `sale_item_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` BIGINT NOT NULL,
  `unit_cost` BIGINT NOT NULL,
  `refund_amount` BIGINT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_return_items_ret` FOREIGN KEY (`return_id`) REFERENCES `returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_return_items_item` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_return_items_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sale_return_cost_allocations
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_return_cost_allocations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `return_id` INT NOT NULL,
  `return_item_id` INT NOT NULL,
  `sale_item_cost_allocation_id` INT NULL,
  `batch_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `unit_cost` BIGINT NOT NULL DEFAULT 0,
  `total_cost` BIGINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_return_alloc_ret` FOREIGN KEY (`return_id`) REFERENCES `returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_return_alloc_item` FOREIGN KEY (`return_item_id`) REFERENCES `return_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_return_alloc_cost` FOREIGN KEY (`sale_item_cost_allocation_id`) REFERENCES `sale_item_cost_allocations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_return_alloc_batch` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: customer_debts
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_debts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `sale_id` INT NULL,
  `original_amount` BIGINT NOT NULL,
  `paid_amount` BIGINT NOT NULL DEFAULT 0,
  `remaining_balance` BIGINT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cust_debts_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cust_debts_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: customer_debt_payments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_debt_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_debt_id` INT NULL,
  `customer_id` INT NOT NULL,
  `amount` BIGINT NOT NULL,
  `previous_balance` BIGINT NOT NULL,
  `new_balance` BIGINT NOT NULL,
  `user_id` INT NOT NULL,
  `payment_date` VARCHAR(20) NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cust_pay_debt` FOREIGN KEY (`customer_debt_id`) REFERENCES `customer_debts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cust_pay_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cust_pay_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: company_debts
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_debts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `sale_id` INT NULL,
  `driver_id` INT NULL,
  `vehicle_id` INT NULL,
  `original_amount` BIGINT NOT NULL,
  `paid_amount` BIGINT NOT NULL DEFAULT 0,
  `remaining_balance` BIGINT NOT NULL,
  `remaining_amount` BIGINT DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_company_debts_company` (`company_id`),
  INDEX `idx_company_debts_driver` (`driver_id`),
  INDEX `idx_company_debts_vehicle` (`vehicle_id`),
  CONSTRAINT `fk_comp_debts_comp` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comp_debts_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_comp_debts_driver` FOREIGN KEY (`driver_id`) REFERENCES `company_drivers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_comp_debts_veh` FOREIGN KEY (`vehicle_id`) REFERENCES `company_vehicles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: company_debt_payments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_debt_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_debt_id` INT NULL,
  `company_id` INT NOT NULL,
  `driver_id` INT NULL,
  `vehicle_id` INT NULL,
  `amount` BIGINT NOT NULL,
  `previous_balance` BIGINT NOT NULL,
  `new_balance` BIGINT NOT NULL,
  `user_id` INT NOT NULL,
  `received_by` INT NULL,
  `cash_account_id` INT DEFAULT 1,
  `payment_date` VARCHAR(20) NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_company_payments_company` (`company_id`),
  CONSTRAINT `fk_comp_pay_debt` FOREIGN KEY (`company_debt_id`) REFERENCES `company_debts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_comp_pay_comp` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comp_pay_driver` FOREIGN KEY (`driver_id`) REFERENCES `company_drivers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_comp_pay_veh` FOREIGN KEY (`vehicle_id`) REFERENCES `company_vehicles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_comp_pay_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_comp_pay_recv` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: supplier_payments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `supplier_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `supplier_id` INT NOT NULL,
  `purchase_id` INT NULL,
  `amount` BIGINT NOT NULL,
  `previous_balance` BIGINT NOT NULL,
  `new_balance` BIGINT NOT NULL,
  `user_id` INT NOT NULL,
  `payment_date` VARCHAR(20) NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_supp_pay_supp` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_supp_pay_purch` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_supp_pay_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: expense_categories
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expense_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: expenses
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NOT NULL,
  `amount` BIGINT NOT NULL,
  `description` TEXT NOT NULL,
  `expense_date` VARCHAR(20) NOT NULL,
  `user_id` INT NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_expenses_cat` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_expenses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: settings
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `key_name` VARCHAR(100) PRIMARY KEY,
  `value` LONGTEXT NOT NULL,
  `description` TEXT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: audit_logs
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `username` VARCHAR(150) NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_id` VARCHAR(100) NULL,
  `old_values` LONGTEXT NULL,
  `new_values` LONGTEXT NULL,
  `ip_address` VARCHAR(50) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: cash_accounts
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cash_accounts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL DEFAULT 'قاسەی سەرەکی',
  `opening_balance` BIGINT NOT NULL DEFAULT 0,
  `current_balance` BIGINT NOT NULL DEFAULT 0,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'drawer',
  `currency` VARCHAR(20) NOT NULL DEFAULT 'IQD',
  `is_active` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: cash_sessions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cash_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cash_account_id` INT NOT NULL DEFAULT 1,
  `account_id` INT DEFAULT 1,
  `user_id` INT NOT NULL,
  `session_date` VARCHAR(20) NULL,
  `opening_balance` BIGINT NOT NULL DEFAULT 0,
  `closing_balance` BIGINT NULL,
  `closing_balance_expected` BIGINT NULL,
  `closing_balance_actual` BIGINT NULL,
  `expected_balance` BIGINT NULL,
  `difference` BIGINT DEFAULT 0,
  `difference_amount` BIGINT DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  `opened_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `closed_at` DATETIME NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cash_sessions_status` (`status`, `opened_at`),
  CONSTRAINT `fk_cash_sess_acc` FOREIGN KEY (`cash_account_id`) REFERENCES `cash_accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cash_sess_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: cash_transactions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cash_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cash_account_id` INT NOT NULL DEFAULT 1,
  `account_id` INT DEFAULT 1,
  `cash_session_id` INT NULL,
  `session_id` INT NULL,
  `user_id` INT NULL,
  `transaction_type` VARCHAR(50) NOT NULL,
  `direction` VARCHAR(10) NOT NULL DEFAULT 'IN',
  `amount` BIGINT NOT NULL,
  `balance_before` BIGINT DEFAULT 0,
  `balance_after` BIGINT NOT NULL DEFAULT 0,
  `reference_type` VARCHAR(50) NULL,
  `reference_id` INT NULL,
  `description` TEXT NULL,
  `notes` TEXT NULL,
  `is_reversal` TINYINT DEFAULT 0,
  `reversal_of_id` INT NULL,
  `backfilled` TINYINT DEFAULT 0,
  `transaction_date` VARCHAR(30) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cash_tx_created` (`created_at`),
  INDEX `idx_cash_tx_account_dir` (`cash_account_id`, `direction`, `created_at`),
  INDEX `idx_cash_tx_session` (`cash_session_id`),
  CONSTRAINT `fk_cash_tx_acc` FOREIGN KEY (`cash_account_id`) REFERENCES `cash_accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cash_tx_sess` FOREIGN KEY (`cash_session_id`) REFERENCES `cash_sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cash_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cash_tx_rev` FOREIGN KEY (`reversal_of_id`) REFERENCES `cash_transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Default Seeds
-- --------------------------------------------------------
INSERT IGNORE INTO `roles` (`id`, `name`, `display_name`, `description`) VALUES
(1, 'admin', 'بەڕێوەبەر', 'دەسەڵاتی تەواو بەسەر سەرجەم بەشەکاندا هەیە'),
(2, 'cashier', 'کاشێر', 'تەنها دەسەڵاتی فرۆشتن، پسووڵە و قەرزەکانی هەیە');

INSERT IGNORE INTO `cash_accounts` (`id`, `name`, `opening_balance`, `current_balance`, `account_type`, `currency`, `is_active`) VALUES
(1, 'قاسەی سەرەکی', 0, 0, 'drawer', 'IQD', 1);

INSERT IGNORE INTO `settings` (`key_name`, `value`, `description`) VALUES
('shop_name', 'سەنگەر زمارەیی و جێگر زمارەیی', 'ناوی دوکان / کار'),
('phone_jegr', '07503149696', 'ژمارەی مۆبایلی جێگر'),
('phone_sangar_1', '07504687412', 'ژمارەی مۆبایلی سەنگەر 1'),
('phone_sangar_2', '07804457301', 'ژمارەی مۆبایلی سەنگەر 2'),
('currency', 'د.ع', 'دراوی مامەڵە'),
('address', 'هەولێر - ناوچەی پیشەسازی باکوور - شەقامی سەرەکی', 'ناونیشانی فەرمی'),
('receipt_footer', 'سوپاس بۆ سەردانیکردنتان - کاڵای فرۆشراو دەگۆڕدرێتەوە بەپێی مەرج', 'دەقی خوارەوەی پسووڵە');

INSERT IGNORE INTO `users` (`id`, `role_id`, `name`, `email`, `username`, `password`, `phone`, `is_active`) VALUES
(1, 1, 'سەنگەر و جێگر (بەڕێوەبەر)', 'jegrsangarr@gmail.com', 'admin', '$2b$10$c1uDHc7gJOvZJvcTvuGVYu6lttJR7HOxvgSbKgTrHW7xrcsu9hx/C', '07503149696', 1);

INSERT IGNORE INTO `user_profiles` (`id`, `auth_user_id`, `full_name`, `email`, `role_id`, `status`, `phone`) VALUES
(1, '1', 'سەنگەر و جێگر (بەڕێوەبەر)', 'jegrsangarr@gmail.com', 1, 'active', '07503149696');

SET FOREIGN_KEY_CHECKS = 1;
