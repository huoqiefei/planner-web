<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

/**
 * Planner Web Integration Plugin
 * 
 * Provides API for Planner Web application to authenticate and sync user data.
 * Supports custom user fields via a dedicated table.
 * 
 * @package PlannerAuth
 * @author Planner Team
 * @version 1.1.0
 * @link https://github.com/planner
 */
class PlannerAuth_Plugin implements Typecho_Plugin_Interface
{
    /**
     * Activate the plugin
     */
    public static function activate()
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();
        $adapter = $db->getAdapterName();
        
        // 1. Create Tables
        if ("Pdo_Pgsql" === $adapter || "Pgsql" === $adapter) {
            // PostgreSQL logic
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_usermeta (
                id SERIAL PRIMARY KEY,
                uid INT NOT NULL,
                meta_key VARCHAR(255) NOT NULL,
                meta_value TEXT,
                UNIQUE (uid, meta_key)
            )";
            $db->query($sql);

            $sqlProjects = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_projects (
                id SERIAL PRIMARY KEY,
                uid INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                file_path VARCHAR(255) NOT NULL,
                activity_count INT DEFAULT 0,
                resource_count INT DEFAULT 0,
                created_at INT NOT NULL,
                updated_at INT NOT NULL
            )";
            $db->query($sqlProjects);

        } elseif ("Pdo_SQLite" === $adapter || "SQLite" === $adapter) {
            // SQLite Logic
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_usermeta (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid INTEGER NOT NULL,
                meta_key TEXT NOT NULL,
                meta_value TEXT,
                UNIQUE (uid, meta_key)
            )";
            $db->query($sql);

            $sqlProjects = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                file_path TEXT NOT NULL,
                activity_count INTEGER DEFAULT 0,
                resource_count INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )";
            $db->query($sqlProjects);
            
        } else {
            // MySQL Logic (Default)
            $sql = "CREATE TABLE IF NOT EXISTS `" . $prefix . "planner_usermeta` (
                `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
                `uid` int(10) unsigned NOT NULL,
                `meta_key` varchar(255) NOT NULL,
                `meta_value` text,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uid_key` (`uid`, `meta_key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;";
            $db->query($sql);

            $sqlProjects = "CREATE TABLE IF NOT EXISTS `" . $prefix . "planner_projects` (
                `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
                `uid` int(10) unsigned NOT NULL,
                `name` varchar(255) NOT NULL,
                `description` text,
                `file_path` varchar(255) NOT NULL,
                `activity_count` int(10) DEFAULT 0,
                `resource_count` int(10) DEFAULT 0,
                `created_at` int(10) unsigned NOT NULL,
                `updated_at` int(10) unsigned NOT NULL,
                PRIMARY KEY (`id`),
                KEY `uid` (`uid`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;";
            $db->query($sqlProjects);
        }

        // 2. Upgrade Tables (Add columns if missing)
        self::upgradeDatabase($db, $prefix, $adapter);

        // 3. Register Routes and Panel
        Helper::addRoute('planner_api', '/planner/api/[action]', 'PlannerAuth_Action', 'dispatch');
        Helper::addPanel(3, 'PlannerAuth/panel.php', 'Planner Admin', 'Planner System Management', 'administrator');
        
        return _t('Planner Auth Plugin Activated & Database Checked');
    }

    /**
     * Deactivate the plugin
     */
    public static function deactivate()
    {
        Helper::removeRoute('planner_api');
        Helper::removePanel(3, 'PlannerAuth/panel.php');
    }

    /**
     * Plugin Configuration Panel
     */
    public static function config(Typecho_Widget_Helper_Form $form)
    {
        $secret = new Typecho_Widget_Helper_Form_Element_Text(
            'jwtSecret', 
            NULL, 
            'planner_secret_key_' . uniqid(), 
            _t('JWT Secret'), 
            _t('Secret key for signing tokens. Change this to a secure random string.')
        );
        $form->addInput($secret);
        
        $cors = new Typecho_Widget_Helper_Form_Element_Text(
            'corsOrigin',
            NULL,
            '*',
            _t('CORS Allow Origin'),
            _t('Allowed origin for API requests (e.g., http://localhost:5173). Use * for all.')
        );
        $form->addInput($cors);
    }

    /**
     * Personal Configuration Panel
     */
    public static function personalConfig(Typecho_Widget_Helper_Form $form)
    {
    }

    /**
     * Upgrade Database Columns
     */
    private static function upgradeDatabase($db, $prefix, $adapter)
    {
        $table = $prefix . 'planner_projects';
        
        // Helper to check and add column
        $addColumn = function($colName, $colDef) use ($db, $table, $adapter) {
            try {
                // Try to select the column to see if it exists
                $db->query($db->select($colName)->from($table)->limit(1));
            } catch (Exception $e) {
                // Column doesn't exist (or other error), try to add it
                try {
                    if ("Pdo_SQLite" === $adapter || "SQLite" === $adapter) {
                        $db->query("ALTER TABLE $table ADD COLUMN $colName $colDef");
                    } else {
                        $db->query("ALTER TABLE $table ADD $colName $colDef");
                    }
                } catch (Exception $ex) {
                    // Ignore addition errors
                }
            }
        };

        $addColumn('activity_count', 'INTEGER DEFAULT 0');
        $addColumn('resource_count', 'INTEGER DEFAULT 0');
    }
}
