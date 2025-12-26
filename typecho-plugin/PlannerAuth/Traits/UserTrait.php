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

        // Handle Avatar URL (Prepend Site URL)
        $avatar = isset($meta['avatar']) ? $meta['avatar'] : null;
        if ($avatar && strpos($avatar, 'http') !== 0) {
             $options = Typecho_Widget::widget('Widget_Options');
             $siteUrl = $options->siteUrl;
             $avatar = rtrim($siteUrl, '/') . '/' . ltrim($avatar, '/');
        }

        // Usage Statistics
        $stats = [
            'project_count' => 0,
            'project_limit' => 1,
            'activity_count' => 0,
            'resource_count' => 0
        ];

        // Limits
        if ($plannerRole === 'licensed') $stats['project_limit'] = 3;
        if ($plannerRole === 'premium') $stats['project_limit'] = 20;
        if ($plannerRole === 'admin') $stats['project_limit'] = 9999;

        // DB Stats
        try {
            $projectStats = $this->db->fetchRow($this->db->select([
                'COUNT(id)' => 'p_count',
                'SUM(activity_count)' => 'a_count',
                'SUM(resource_count)' => 'r_count'
            ])
            ->from($this->prefix . 'planner_projects')
            ->where('uid = ?', $dbUser['uid']));

            if ($projectStats) {
                $stats['project_count'] = intval($projectStats['p_count']);
                $stats['activity_count'] = intval($projectStats['a_count']);
                $stats['resource_count'] = intval($projectStats['r_count']);
            }
        } catch (Exception $e) {
            // Ignore if columns missing (backwards compatibility)
            $count = $this->db->fetchObject($this->db->select(['COUNT(id)' => 'num'])
                ->from($this->prefix . 'planner_projects')
                ->where('uid = ?', $dbUser['uid']))->num;
            $stats['project_count'] = intval($count);
        }

        $this->sendResponse([
            'uid' => $dbUser['uid'],
            'name' => $dbUser['screenName'],
            'username' => $dbUser['name'],
            'mail' => $dbUser['mail'],
            'group' => $dbUser['group'],
            'plannerRole' => $plannerRole,
            'avatar' => $avatar,
            'meta' => $meta,
            'usage' => $stats
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
}
