-- 订阅管理数据库迁移 SQL
-- 说明：此 SQL 为示例，需要根据实际 Typecho 数据库结构调整

-- 方案 A：在现有用户表添加字段（推荐，最小改动）
ALTER TABLE `typecho_users`
ADD COLUMN `subscription_status` ENUM('trial', 'active', 'expired', 'cancelled') DEFAULT 'trial' COMMENT '订阅状态',
ADD COLUMN `subscription_plan` VARCHAR(20) DEFAULT NULL COMMENT '订阅计划：licensed/premium',
ADD COLUMN `subscription_start` DATETIME DEFAULT NULL COMMENT '订阅开始时间',
ADD COLUMN `subscription_end` DATETIME DEFAULT NULL COMMENT '订阅结束时间',
ADD COLUMN `subscription_auto_renew` TINYINT(1) DEFAULT 0 COMMENT '是否自动续费',
ADD COLUMN `subscription_payment_id` VARCHAR(100) DEFAULT NULL COMMENT '支付平台订阅ID',
ADD COLUMN `subscription_data` TEXT DEFAULT NULL COMMENT '订阅扩展数据（JSON）';

-- 方案 B：创建独立订阅表（更灵活）
CREATE TABLE IF NOT EXISTS `planner_subscriptions` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) UNSIGNED NOT NULL,
  `plan` VARCHAR(20) NOT NULL COMMENT 'licensed/premium',
  `status` ENUM('active', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NOT NULL,
  `auto_renew` TINYINT(1) DEFAULT 0,
  `payment_provider` VARCHAR(20) DEFAULT NULL COMMENT 'wechat/alipay/stripe',
  `payment_id` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅记录表';

-- 创建支付订单表
CREATE TABLE IF NOT EXISTS `planner_payment_orders` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) UNSIGNED NOT NULL,
  `order_no` VARCHAR(64) NOT NULL,
  `plan` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'CNY',
  `status` ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  `payment_provider` VARCHAR(20) NOT NULL,
  `payment_id` VARCHAR(100) DEFAULT NULL,
  `payment_data` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付订单表';
