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
 * @version 1.0.0
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
        
        // Create custom user meta table
        if ("Pdo_Pgsql" === $adapter || "Pgsql" === $adapter) {
            $sql = "CREATE TABLE IF NOT EXISTS " . $prefix . "planner_usermeta (
                id SERIAL PRIMARY KEY,
                uid INT NOT NULL,
                meta_key VARCHAR(255) NOT NULL,
                meta_value TEXT,
                UNIQUE (uid, meta_key)
            )";
        } else {
            $sql = "CREATE TABLE IF NOT EXISTS `" . $prefix . "planner_usermeta` (
                `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
                `uid` int(10) unsigned NOT NULL,
                `meta_key` varchar(255) NOT NULL,
                `meta_value` text,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uid_key` (`uid`, `meta_key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;";
        }
        
        try {
            $db->query($sql);
        } catch (Exception $e) {
            // Table might exist
        }

        // Register API route
        // Matches /planner/api/[action]
        Helper::addRoute('planner_api', '/planner/api/[action]', 'PlannerAuth_Action', 'dispatch');
        
        return _t('Planner Auth Plugin Activated');
    }

    /**
     * Deactivate the plugin
     */
    public static function deactivate()
    {
        Helper::removeRoute('planner_api');
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
     * Personal Configuration Panel (User Profile)
     */
    public static function personalConfig(Typecho_Widget_Helper_Form $form)
    {
        // Can add simple fields here if needed, but we handle via API/Table
    }
}
