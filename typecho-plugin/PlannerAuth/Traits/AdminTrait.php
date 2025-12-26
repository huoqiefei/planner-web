<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait PlannerAuth_Traits_AdminTrait
{
    /**
     * Admin: List Users
     */
    private function adminUserList()
    {
        $user = $this->verifyToken();
        if (!$user || $user['group'] !== 'administrator') {
            $this->sendError('Permission denied', 403);
            return;
        }

        // Select all columns to avoid 'group' keyword collision
        $users = $this->db->fetchAll($this->db->select()
            ->from('table.users')
            ->order('uid', Typecho_Db::SORT_ASC));

        foreach ($users as &$u) {
            $u['meta'] = $this->getUserMeta($u['uid']);
            // Filter sensitive data if needed, but admin is trusted
            unset($u['password']);
        }

        $this->sendResponse(['users' => $users]);
    }

    /**
     * Admin: Update User Group/Role
     */
    private function adminUserUpdate()
    {
        $user = $this->verifyToken();
        if (!$user || $user['group'] !== 'administrator') {
            $this->sendError('Permission denied', 403);
            return;
        }

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        $targetUid = isset($data['uid']) ? intval($data['uid']) : 0;
        $role = isset($data['role']) ? $data['role'] : null; // trial, licensed, premium

        if (!$targetUid) {
            $this->sendError('Target UID required', 400);
            return;
        }

        if ($role) {
            $this->updateUserMeta($targetUid, 'planner_role', $role);
        }

        $this->sendResponse(['status' => 'success']);
    }

    /**
     * Get System Config
     */
    private function sysConfigGet()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        if ($user['group'] !== 'administrator') {
            $this->sendError('Permission denied', 403);
            return;
        }

        $config = [];
        $row = $this->db->fetchRow($this->db->select('value')->from('table.options')->where('name = ?', 'planner_system_config'));
        if ($row) {
            $config = json_decode($row['value'], true);
        }
        
        $this->sendResponse(['config' => $config]);
    }

    /**
     * Save System Config
     */
    private function sysConfigSave()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        if ($user['group'] !== 'administrator') {
            $this->sendError('Permission denied', 403);
            return;
        }

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        // Fetch current
        $current = [];
        $row = $this->db->fetchRow($this->db->select('value')->from('table.options')->where('name = ?', 'planner_system_config'));
        if ($row) {
            $current = json_decode($row['value'], true);
        }

        if (is_array($data)) {
            $current = array_merge($current, $data);
        }

        $value = json_encode($current);

        if ($row) {
            $this->db->query($this->db->update('table.options')
                ->rows(['value' => $value])
                ->where('name = ?', 'planner_system_config'));
        } else {
            $this->db->query($this->db->insert('table.options')
                ->rows([
                    'name' => 'planner_system_config',
                    'user' => 0,
                    'value' => $value
                ]));
        }

        $this->sendResponse(['status' => 'success']);
    }

    /**
     * Get Public System Config (No Auth Required)
     */
    private function publicConfig()
    {
        $row = $this->db->fetchRow($this->db->select('value')->from('table.options')->where('name = ?', 'planner_system_config'));
        $config = [];
        
        if ($row) {
             $fullConfig = json_decode($row['value'], true);
             // Filter public keys
             $allowed = ['appLogo', 'appName', 'watermarkText', 'enableWatermark', 'watermarkFontSize', 'watermarkOpacity', 'watermarkImage', 'copyrightText', 'ganttBarRatio'];
             if (is_array($fullConfig)) {
                 foreach ($allowed as $key) {
                     if (isset($fullConfig[$key])) $config[$key] = $fullConfig[$key];
                 }
             }
        }
        
        $this->sendResponse(['config' => $config]);
    }
}
