<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait PlannerAuth_Traits_UserTrait
{
    /**
     * Get current user info from Token
     */
    private function userInfo()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $dbUser = $this->db->fetchRow($this->db->select()
            ->from('table.users')
            ->where('uid = ?', $user['uid'])
            ->limit(1));
            
        if (!$dbUser) {
            $this->sendError('User not found', 404);
            return;
        }

        $meta = $this->getUserMeta($dbUser['uid']);

        // Determine Role
        $plannerRole = isset($meta['planner_role']) ? $meta['planner_role'] : 'trial';
        
        // Force/Auto-map based on Group
        if ($dbUser['group'] === 'administrator') {
            $plannerRole = 'admin';
        } else if ($dbUser['group'] === 'editor') {
            $plannerRole = 'premium';
        } else if ($dbUser['group'] === 'contributor') {
            $plannerRole = 'licensed';
        } else if ($dbUser['group'] === 'subscriber') {
             if (!isset($meta['planner_role'])) $plannerRole = 'trial';
        }

        $this->sendResponse([
            'uid' => $dbUser['uid'],
            'name' => $dbUser['screenName'],
            'username' => $dbUser['name'],
            'mail' => $dbUser['mail'],
            'group' => $dbUser['group'],
            'plannerRole' => $plannerRole,
            'avatar' => isset($meta['avatar']) ? $meta['avatar'] : null,
            'meta' => $meta
        ]);
    }

    /**
     * Update Profile (Avatar, Nickname, etc.)
     */
    private function updateProfile()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $screenName = isset($_POST['screenName']) ? trim($_POST['screenName']) : null;
        $password = isset($_POST['password']) ? $_POST['password'] : null;
        
        $updateRows = [];
        if ($screenName) $updateRows['screenName'] = $screenName;
        if ($password && strlen($password) > 0) {
            $updateRows['password'] = Typecho_Common::hash($password);
        }

        if (!empty($updateRows)) {
            $this->db->query($this->db->update('table.users')
                ->rows($updateRows)
                ->where('uid = ?', $user['uid']));
        }

        // Handle Avatar Upload
        if (isset($_FILES['avatar']) && $_FILES['avatar']['error'] === 0) {
            $file = $_FILES['avatar'];
            $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
            if (!in_array(strtolower($ext), ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                $this->sendError('Invalid image format', 400);
                return;
            }
            
            $uploadDir = __TYPECHO_ROOT_DIR__ . '/usr/uploads/avatars/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $fileName = 'avatar_' . $user['uid'] . '_' . time() . '.' . $ext;
            $targetPath = $uploadDir . $fileName;
            
            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $avatarUrl = '/usr/uploads/avatars/' . $fileName; 
                $this->updateUserMeta($user['uid'], 'avatar', $avatarUrl);
                $this->sendResponse(['status' => 'success', 'avatar' => $avatarUrl]);
                return;
            }
        }

        $this->sendResponse(['status' => 'success']);
    }

    /**
     * Update user meta (Generic)
     */
    private function updateMeta()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $data = json_decode(file_get_contents('php://input'), true);
        $targetUid = isset($data['uid']) ? intval($data['uid']) : $user['uid'];
        $key = isset($data['key']) ? $data['key'] : '';
        $value = isset($data['value']) ? $data['value'] : '';

        if (empty($key)) {
            $this->sendError('Key is required', 400);
            return;
        }

        if ($targetUid != $user['uid'] && $user['group'] !== 'administrator') {
            $this->sendError('Permission denied', 403);
            return;
        }

        $this->updateUserMeta($targetUid, $key, $value);
        $this->sendResponse(['status' => 'success']);
    }

    private function updateUserMeta($uid, $key, $value)
    {
        $table = $this->prefix . 'planner_usermeta';
        $existing = $this->db->fetchRow($this->db->select()
            ->from($table)
            ->where('uid = ?', $uid)
            ->where('meta_key = ?', $key));

        if ($existing) {
            $this->db->query($this->db->update($table)
                ->rows(['meta_value' => $value])
                ->where('id = ?', $existing['id']));
        } else {
            $this->db->query($this->db->insert($table)
                ->rows([
                    'uid' => $uid,
                    'meta_key' => $key,
                    'meta_value' => $value
                ]));
        }
    }

    private function getUserMeta($uid)
    {
        $rows = $this->db->fetchAll($this->db->select()
            ->from($this->prefix . 'planner_usermeta')
            ->where('uid = ?', $uid));
            
        $meta = [];
        foreach ($rows as $row) {
            $meta[$row['meta_key']] = $row['meta_value'];
        }
        return $meta;
    }
}
