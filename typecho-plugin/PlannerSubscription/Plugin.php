<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

/**
 * Planner Subscription Manager Plugin
 * 
 * 独立的订阅管理插件，与 PlannerAuth 分离
 * 提供完整的订阅、支付、订单管理功能
 * 
 * @package PlannerSubscription
 * @author Planner Team
 * @version 1.0.0
 * @link https://github.com/planner/planner-subscription
 */
class PlannerSubscription_Plugin implements Typecho_Plugin_Interface
{
    /**
     * 激活插件
     */
    public static function activate()
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();
        $adapter = $db->getAdapterName();

        // 1. 创建订阅表
        self::createSubscriptionTable($db, $prefix, $adapter);

        // 2. 创建支付订单表
        self::createPaymentOrderTable($db, $prefix, $adapter);

        // 3. 创建支付配置表
        self::createPaymentConfigTable($db, $prefix, $adapter);

        // 4. 创建优惠券表
        self::createCouponTable($db, $prefix, $adapter);

        // 5. 检查并添加订阅字段到用户表
        self::addSubscriptionFieldsToUserTable($db, $prefix, $adapter);

        // 6. 注册 API 路由
        Helper::addRoute('subscription_api', '/planner/subscription/[action]', 'PlannerSubscription_Action', 'dispatch');

        // 7. 注册支付回调路由
        Helper::addRoute('payment_callback', '/planner/payment/callback/[provider]', 'PlannerSubscription_Action', 'handlePaymentCallback');

        // 8. 添加后台管理面板
        Helper::addPanel(3, 'PlannerSubscription/panel.php', '订阅管理', '订阅管理后台', 'administrator');

        return _t('订阅管理插件已激活，数据库表创建完成');
    }

    /**
     * 禁用插件
     */
    public static function deactivate()
    {
        Helper::removeRoute('subscription_api');
        Helper::removeRoute('payment_callback');
        Helper::removePanel(3, 'PlannerSubscription/panel.php');
        return _t('订阅管理插件已禁用');
    }

    /**
     * 插件配置界面
     */
    public static function config(Typecho_Widget_Helper_Form $form)
    {
        // 基础配置
        $enableSubscription = new Typecho_Widget_Helper_Form_Element_Radio(
            'enable_subscription',
            ['1' => _t('启用'), '0' => _t('禁用')],
            '1',
            _t('启用订阅功能'),
            _t('是否启用付费订阅功能')
        );
        $form->addInput($enableSubscription);

        // 订阅计划配置
        $licensedPrice = new Typecho_Widget_Helper_Form_Element_Text(
            'licensed_price',
            NULL,
            '99',
            _t('标准版价格（元/月）'),
            _t('Licensed 版本每月订阅价格')
        );
        $form->addInput($licensedPrice);

        $premiumPrice = new Typecho_Widget_Helper_Form_Element_Text(
            'premium_price',
            NULL,
            '199',
            _t('专业版价格（元/月）'),
            _t('Premium 版本每月订阅价格')
        );
        $form->addInput($premiumPrice);

        // 权限配置
        $trialLimit = new Typecho_Widget_Helper_Form_Element_Text(
            'trial_limit',
            NULL,
            '20',
            _t('试用版作业数量限制'),
            _t('试用版用户最多可创建的作业数量')
        );
        $form->addInput($trialLimit);

        $licensedLimit = new Typecho_Widget_Helper_Form_Element_Text(
            'licensed_limit',
            NULL,
            '100',
            _t('标准版作业数量限制'),
            _t('标准版用户最多可创建的作业数量')
        );
        $form->addInput($licensedLimit);

        $premiumLimit = new Typecho_Widget_Helper_Form_Element_Text(
            'premium_limit',
            NULL,
            '500',
            _t('专业版作业数量限制'),
            _t('专业版用户最多可创建的作业数量')
        );
        $form->addInput($premiumLimit);

        // 到期提醒
        $reminderDays = new Typecho_Widget_Helper_Form_Element_Text(
            'reminder_days',
            NULL,
            '7',
            _t('到期提醒天数'),
            _t('订阅到期前多少天提醒用户')
        );
        $form->addInput($reminderDays);

        // 支付配置
        $enableWechat = new Typecho_Widget_Helper_Form_Element_Radio(
            'enable_wechat',
            ['1' => _t('启用'), '0' => _t('禁用')],
            '1',
            _t('启用微信支付'),
            _t('是否启用微信支付')
        );
        $form->addInput($enableWechat);

        $enableAlipay = new Typecho_Widget_Helper_Form_Element_Radio(
            'enable_alipay',
            ['1' => _t('启用'), '0' => _t('禁用')],
            '1',
            _t('启用支付宝'),
            _t('是否启用支付宝')
        );
        $form->addInput($enableAlipay);

        // CORS 配置
        $corsOrigin = new Typecho_Widget_Helper_Form_Element_Text(
            'cors_origin',
            NULL,
            '*',
            _t('CORS 允许的源'),
            _t('API 允许的跨域来源，* 表示允许所有')
        );
        $form->addInput($corsOrigin);
    }

    /**
     * 个人配置界面
     */
    public static function personalConfig(Typecho_Widget_Helper_Form $form)
    {
    }

    /**
     * 创建订阅表
     */
    private static function createSubscriptionTable($db, $prefix, $adapter)
    {
        if ("Pdo_Pgsql" === $adapter || "Pgsql" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                plan VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                start_date TIMESTAMP NOT NULL,
                end_date TIMESTAMP NOT NULL,
                auto_renew BOOLEAN DEFAULT FALSE,
                payment_provider VARCHAR(20),
                payment_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )";
        } elseif ("Pdo_SQLite" === $adapter || "SQLite" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                auto_renew INTEGER DEFAULT 0,
                payment_provider TEXT,
                payment_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )";
        } else {
            // MySQL
            $sql = "CREATE TABLE IF NOT EXISTS `" . $prefix . "planner_subscriptions` (
                `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
                `user_id` int(11) unsigned NOT NULL,
                `plan` varchar(20) NOT NULL COMMENT 'licensed/premium',
                `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT 'active/expired/cancelled',
                `start_date` datetime NOT NULL,
                `end_date` datetime NOT NULL,
                `auto_renew` tinyint(1) DEFAULT '0',
                `payment_provider` varchar(20) DEFAULT NULL,
                `payment_id` varchar(100) DEFAULT NULL,
                `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
                `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_user_id` (`user_id`),
                KEY `idx_status` (`status`),
                KEY `idx_end_date` (`end_date`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅记录表';";
        }
        $db->query($sql);
    }

    /**
     * 创建支付订单表
     */
    private static function createPaymentOrderTable($db, $prefix, $adapter)
    {
        if ("Pdo_Pgsql" === $adapter || "Pgsql" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_payment_orders (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                order_no VARCHAR(64) NOT NULL UNIQUE,
                plan VARCHAR(20) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'CNY',
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                payment_provider VARCHAR(20) NOT NULL,
                payment_id VARCHAR(100),
                payment_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP
            )";
        } elseif ("Pdo_SQLite" === $adapter || "SQLite" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_payment_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                order_no TEXT NOT NULL UNIQUE,
                plan TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'CNY',
                status TEXT NOT NULL DEFAULT 'pending',
                payment_provider TEXT NOT NULL,
                payment_id TEXT,
                payment_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                paid_at DATETIME
            )";
        } else {
            // MySQL
            $sql = "CREATE TABLE IF NOT EXISTS `" . $prefix . "planner_payment_orders` (
                `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
                `user_id` int(11) unsigned NOT NULL,
                `order_no` varchar(64) NOT NULL,
                `plan` varchar(20) NOT NULL,
                `amount` decimal(10,2) NOT NULL,
                `currency` varchar(3) DEFAULT 'CNY',
                `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/failed/refunded',
                `payment_provider` varchar(20) NOT NULL,
                `payment_id` varchar(100) DEFAULT NULL,
                `payment_data` text,
                `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
                `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                `paid_at` datetime DEFAULT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_order_no` (`order_no`),
                KEY `idx_user_id` (`user_id`),
                KEY `idx_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付订单表';";
        }
        $db->query($sql);
    }

    /**
     * 创建支付配置表
     */
    private static function createPaymentConfigTable($db, $prefix, $adapter)
    {
        if ("Pdo_Pgsql" === $adapter || "Pgsql" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_payment_config (
                id SERIAL PRIMARY KEY,
                provider VARCHAR(20) NOT NULL UNIQUE,
                config_key VARCHAR(50) NOT NULL,
                config_value TEXT,
                is_encrypted BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )";
        } elseif ("Pdo_SQLite" === $adapter || "SQLite" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_payment_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL UNIQUE,
                config_key TEXT NOT NULL,
                config_value TEXT,
                is_encrypted INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )";
        } else {
            // MySQL
            $sql = "CREATE TABLE IF NOT EXISTS `" . $prefix . "planner_payment_config` (
                `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
                `provider` varchar(20) NOT NULL,
                `config_key` varchar(50) NOT NULL,
                `config_value` text,
                `is_encrypted` tinyint(1) DEFAULT '0',
                `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_provider_key` (`provider`, `config_key`),
                KEY `idx_provider` (`provider`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付配置表';";
        }
        $db->query($sql);
    }

    /**
     * 创建优惠券表
     */
    private static function createCouponTable($db, $prefix, $adapter)
    {
        if ("Pdo_Pgsql" === $adapter || "Pgsql" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_coupons (
                id SERIAL PRIMARY KEY,
                code VARCHAR(20) NOT NULL UNIQUE,
                plan VARCHAR(20),
                discount_type VARCHAR(10) NOT NULL,
                discount_value DECIMAL(10,2) NOT NULL,
                max_uses INT DEFAULT NULL,
                used_count INT DEFAULT 0,
                valid_from TIMESTAMP,
                valid_until TIMESTAMP,
                status VARCHAR(10) NOT NULL DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )";
        } elseif ("Pdo_SQLite" === $adapter || "SQLite" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_coupons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                plan TEXT,
                discount_type TEXT NOT NULL,
                discount_value REAL NOT NULL,
                max_uses INTEGER,
                used_count INTEGER DEFAULT 0,
                valid_from DATETIME,
                valid_until DATETIME,
                status TEXT NOT NULL DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )";
        } else {
            // MySQL
            $sql = "CREATE TABLE IF NOT EXISTS `" . $prefix . "planner_coupons` (
                `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
                `code` varchar(20) NOT NULL,
                `plan` varchar(20) DEFAULT NULL,
                `discount_type` varchar(10) NOT NULL COMMENT 'percent/fixed',
                `discount_value` decimal(10,2) NOT NULL,
                `max_uses` int(11) DEFAULT NULL,
                `used_count` int(11) DEFAULT '0',
                `valid_from` datetime DEFAULT NULL,
                `valid_until` datetime DEFAULT NULL,
                `status` varchar(10) NOT NULL DEFAULT 'active' COMMENT 'active/expired/disabled',
                `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_code` (`code`),
                KEY `idx_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优惠券表';";
        }
        $db->query($sql);
    }

    /**
     * 添加订阅字段到用户表
     */
    private static function addSubscriptionFieldsToUserTable($db, $prefix, $adapter)
    {
        $table = $prefix . 'users';

        try {
            // 尝试查询现有字段
            $db->fetchRow($db->select('subscription_status')->from($table)->limit(1));
        } catch (Exception $e) {
            // 字段不存在，添加字段
            try {
                if ("Pdo_SQLite" === $adapter || "SQLite" === $adapter) {
                    $db->query("ALTER TABLE $table ADD COLUMN subscription_status TEXT DEFAULT 'trial'");
                    $db->query("ALTER TABLE $table ADD COLUMN subscription_plan TEXT");
                    $db->query("ALTER TABLE $table ADD COLUMN subscription_start DATETIME");
                    $db->query("ALTER TABLE $table ADD COLUMN subscription_end DATETIME");
                    $db->query("ALTER TABLE $table ADD COLUMN subscription_auto_renew INTEGER DEFAULT 0");
                } else {
                    $db->query("ALTER TABLE `$table` ADD COLUMN `subscription_status` VARCHAR(20) DEFAULT 'trial' COMMENT 'trial/active/expired/cancelled'");
                    $db->query("ALTER TABLE `$table` ADD COLUMN `subscription_plan` VARCHAR(20) DEFAULT NULL COMMENT 'licensed/premium'");
                    $db->query("ALTER TABLE `$table` ADD COLUMN `subscription_start` DATETIME DEFAULT NULL");
                    $db->query("ALTER TABLE `$table` ADD COLUMN `subscription_end` DATETIME DEFAULT NULL");
                    $db->query("ALTER TABLE `$table` ADD COLUMN `subscription_auto_renew` TINYINT(1) DEFAULT '0'");
                }
            } catch (Exception $ex) {
                // 添加失败，可能是表结构不同，记录但不中断
                error_log("Failed to add subscription fields to users table: " . $ex->getMessage());
            }
        }
    }
}
