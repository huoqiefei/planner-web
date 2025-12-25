<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

class PlannerAuth_Action extends Typecho_Widget implements Widget_Interface_Do
{
    private $db;
    private $prefix;
    private $options;
    private $pluginOptions;

    public function __construct($request, $response, $params = NULL)
    {
        parent::__construct($request, $response, $params);
        $this->db = Typecho_Db::get();
        $this->prefix = $this->db->getPrefix();
        $this->options = Typecho_Widget::widget('Widget_Options');
        try {
            $this->pluginOptions = $this->options->plugin('PlannerAuth');
        } catch (Exception $e) {
            $this->pluginOptions = new stdClass();
            $this->pluginOptions->jwtSecret = 'default_secret';
            $this->pluginOptions->corsOrigin = '*';
        }

        // CORS Headers
        $origin = $this->pluginOptions->corsOrigin ? $this->pluginOptions->corsOrigin : '*';
        if ($origin !== '*') {
            $origin = rtrim($origin, '/*');
            $origin = rtrim($origin, '/');
        }

        $this->response->setHeader('Access-Control-Allow-Origin', $origin);
        $this->response->setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        $this->response->setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        $this->response->setHeader('Access-Control-Allow-Credentials', 'true');
        $this->response->setHeader('Access-Control-Max-Age', '86400');
        $this->response->setHeader('Content-Type', 'application/json');
        
        if ($this->request->is('OPTIONS')) {
            http_response_code(204);
            exit;
        }
    }

    public function execute()
    {
        // Interface requirement
    }

    public function action()
    {
        $this->dispatch();
    }

    public function dispatch()
    {
        $action = $this->request->action;
        try {
            switch ($action) {
                case 'login':
                    $this->login();
                    break;
                case 'register':
                    $this->register();
                    break;
                case 'user':
                    $this->userInfo();
                    break;
                case 'update_profile':
                    $this->updateProfile();
                    break;
                case 'update_meta':
                    $this->updateMeta();
                    break;
                case 'project_list':
                    $this->projectList();
                    break;
                case 'project_save':
                    $this->projectSave();
                    break;
                case 'project_get':
                    $this->projectGet();
                    break;
                case 'project_delete':
                    $this->projectDelete();
                    break;
                case 'change_password':
                    $this->changePassword();
                    break;
                case 'sys_config_get':
                    $this->sysConfigGet();
                    break;
                case 'sys_config_save':
                    $this->sysConfigSave();
                    break;
                case 'public_config':
                    $this->publicConfig();
                    break;
                case 'admin_user_list':
                    $this->adminUserList();
                    break;
                case 'admin_user_update':
                    $this->adminUserUpdate();
                    break;
                default:
                    $this->sendError('Invalid action', 400);
            }
        } catch (Exception $e) {
            $this->sendError($e->getMessage(), 500);
        }
    }

    /**
     * Authenticate user and return JWT + User Info
     */
    private function login()
    {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        if (!$data) {
            $data = $_POST;
        }
        
        $username = isset($data['username']) ? trim($data['username']) : '';
        $password = isset($data['password']) ? $data['password'] : '';

        if (empty($username) || empty($password)) {
            $this->sendError('Username and password required', 400);
            return;
        }

        // 1. Attempt Typecho Core Login
        $auth = Typecho_Widget::widget('Widget_User');
        $logged = false;
        try {
            if ($auth->login($username, $password, true)) {
                $user = $auth->row;
                $logged = true;
            }
        } catch (Exception $e) {
            // Ignore
        }

        if ($logged) {
            $this->sendLoginResponse($user);
            return;
        }

        // 2. Fallback Manual Check
        $user = $this->db->fetchRow($this->db->select()
            ->from('table.users')
            ->where('name = ?', $username)
            ->limit(1));

        if (!$user && strpos($username, '@') !== false) {
             $user = $this->db->fetchRow($this->db->select()
                ->from('table.users')
                ->where('mail = ?', $username)
                ->limit(1));
        }

        if (!$user) {
             $user = $this->db->fetchRow($this->db->select()
                ->from('table.users')
                ->where('screenName = ?', $username)
                ->limit(1));
        }

        if (!$user) {
            $this->sendError('User not found', 401);
            return;
        }

        if (!Typecho_Common::hashValidate($password, $user['password'])) {
            $this->sendError('Password mismatch', 401);
            return;
        }
        
        $this->sendLoginResponse($user);
    }

    private function sendLoginResponse($user) {
        $meta = $this->getUserMeta($user['uid']);
        // Add role to user array for token generation
        $user['planner_role'] = isset($meta['planner_role']) ? $meta['planner_role'] : 'trial';
        
        // Auto-map if not set but group is set
        if ($user['planner_role'] === 'trial' && isset($user['group'])) {
             if ($user['group'] === 'contributor') $user['planner_role'] = 'licensed';
             if ($user['group'] === 'editor') $user['planner_role'] = 'premium';
             if ($user['group'] === 'administrator') $user['planner_role'] = 'admin';
        }

        $token = $this->generateToken($user);
        
        $this->sendResponse([
            'token' => $token,
            'user' => [
                'uid' => $user['uid'],
                'name' => $user['screenName'],
                'username' => $user['name'],
                'mail' => $user['mail'],
                'group' => $user['group'],
                'plannerRole' => $user['planner_role'],
                'meta' => $meta
            ]
        ]);
    }

    /**
     * Register new user
     */
    private function register()
    {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        $username = isset($data['username']) ? trim($data['username']) : '';
        $password = isset($data['password']) ? $data['password'] : '';
        $mail = isset($data['mail']) ? trim($data['mail']) : '';
        $screenName = isset($data['screenName']) ? trim($data['screenName']) : $username;

        if (empty($username) || empty($password) || empty($mail)) {
            $this->sendError('Username, password and email are required', 400);
            return;
        }

        // Check exists - Separately for clearer error
        $existName = $this->db->fetchRow($this->db->select()
            ->from('table.users')
            ->where('name = ?', $username)
            ->limit(1));
        if ($existName) {
            $this->sendError('Username already exists', 409);
            return;
        }

        $existMail = $this->db->fetchRow($this->db->select()
            ->from('table.users')
            ->where('mail = ?', $mail)
            ->limit(1));
        if ($existMail) {
            $this->sendError('Email already exists', 409);
            return;
        }

        $hasher = new Typecho_Common();
        $hashPassword = Typecho_Common::hash($password);

        $uid = $this->db->query($this->db->insert('table.users')
            ->rows([
                'name' => $username,
                'password' => $hashPassword,
                'mail' => $mail,
                'screenName' => $screenName,
                'created' => time(),
                'group' => 'subscriber'
            ]));

        // Set default role: Trial
        $this->updateUserMeta($uid, 'planner_role', 'trial');

        $this->sendResponse(['status' => 'success', 'uid' => $uid]);
    }

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
        if ($plannerRole === 'trial') {
             if ($dbUser['group'] === 'contributor') $plannerRole = 'licensed';
             if ($dbUser['group'] === 'editor') $plannerRole = 'premium';
             if ($dbUser['group'] === 'administrator') $plannerRole = 'admin';
        }

        $this->sendResponse([
            'uid' => $dbUser['uid'],
            'name' => $dbUser['screenName'],
            'username' => $dbUser['name'],
            'mail' => $dbUser['mail'],
            'group' => $dbUser['group'],
            'plannerRole' => $plannerRole,
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
                $avatarUrl = '/usr/uploads/avatars/' . $fileName; // Relative path usually works if root is set correctly
                // Or better, assume API is relative to index.php, so we might need full URL or relative to root
                // For now, store relative path
                $this->updateUserMeta($user['uid'], 'avatar', $avatarUrl);
            }
        }

        $this->sendResponse(['status' => 'success']);
    }

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

        $users = $this->db->fetchAll($this->db->select('uid', 'name', 'screenName', 'mail', 'group', 'created')
            ->from('table.users')
            ->order('uid', Typecho_Db::SORT_ASC));

        foreach ($users as &$u) {
            $u['meta'] = $this->getUserMeta($u['uid']);
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

    private function generateToken($user)
    {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'uid' => $user['uid'],
            'group' => $user['group'],
            'planner_role' => isset($user['planner_role']) ? $user['planner_role'] : 'trial',
            'iat' => time(),
            'exp' => time() + (86400 * 7) // 7 days
        ]);

        $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->pluginOptions->jwtSecret, true);
        $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    private function verifyToken()
    {
        $authHeader = $this->request->getHeader('Authorization');
        if (!$authHeader) {
            $this->sendError('No token provided', 401);
            return false;
        }

        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        } else {
            $token = $authHeader;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            $this->sendError('Invalid token format', 401);
            return false;
        }

        list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->pluginOptions->jwtSecret, true);
        $base64UrlSignatureCheck = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

        if ($base64UrlSignature !== $base64UrlSignatureCheck) {
            $this->sendError('Invalid signature', 401);
            return false;
        }

        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $base64UrlPayload)), true);
        
        if ($payload['exp'] < time()) {
            $this->sendError('Token expired', 401);
            return false;
        }

        return $payload;
    }

    /**
     * List user projects
     */
    private function projectList()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $projects = $this->db->fetchAll($this->db->select()
            ->from($this->prefix . 'planner_projects')
            ->where('uid = ?', $user['uid'])
            ->order('updated_at', Typecho_Db::SORT_DESC));

        $this->sendResponse(['projects' => $projects]);
    }

    /**
     * Change Password
     */
    private function changePassword()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        $oldPassword = isset($data['oldPassword']) ? $data['oldPassword'] : '';
        $newPassword = isset($data['newPassword']) ? $data['newPassword'] : '';

        if (empty($oldPassword) || empty($newPassword)) {
            $this->sendError('Old and new passwords are required', 400);
            return;
        }

        // Verify old password
        $dbUser = $this->db->fetchRow($this->db->select('password')
            ->from('table.users')
            ->where('uid = ?', $user['uid']));

        if (!$dbUser || !Typecho_Common::hashValidate($oldPassword, $dbUser['password'])) {
            $this->sendError('Incorrect old password', 401);
            return;
        }

        $newHash = Typecho_Common::hash($newPassword);

        $this->db->query($this->db->update('table.users')
            ->rows(['password' => $newHash])
            ->where('uid = ?', $user['uid']));

        $this->sendResponse(['status' => 'success']);
    }

    /**
     * Save/Upload Project
     */
    private function projectSave()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        $name = isset($data['name']) ? $data['name'] : 'Untitled Project';
        $description = isset($data['description']) ? $data['description'] : '';
        $content = isset($data['content']) ? $data['content'] : [];
        $projectId = isset($data['id']) ? intval($data['id']) : null;

        if (empty($content)) {
            $this->sendError('Project content is empty', 400);
            return;
        }

        // Check Limits for NEW projects
        if (!$projectId) {
            // Determine Role
            $meta = $this->getUserMeta($user['uid']);
            $plannerRole = isset($meta['planner_role']) ? $meta['planner_role'] : '';
            $group = $user['group'];
            
            if (!$plannerRole) {
                if ($group === 'subscriber') $plannerRole = 'trial';
                elseif ($group === 'contributor') $plannerRole = 'licensed';
                elseif ($group === 'editor') $plannerRole = 'premium';
                elseif ($group === 'administrator') $plannerRole = 'admin';
                else $plannerRole = 'trial';
            }

            $limit = 1; // Default Trial
            if ($plannerRole === 'licensed') $limit = 3;
            if ($plannerRole === 'premium') $limit = 20;
            if ($plannerRole === 'admin') $limit = 9999;

            $count = $this->db->fetchObject($this->db->select(['COUNT(id)' => 'num'])
                ->from($this->prefix . 'planner_projects')
                ->where('uid = ?', $user['uid']))->num;

            if ($count >= $limit) {
                $this->sendError("Project limit reached for your account type ({$plannerRole}). Limit: {$limit}", 403);
                return;
            }
        }

        $uploadDir = __TYPECHO_ROOT_DIR__ . '/usr/uploads/planner_projects/';
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true)) {
                $this->sendError('Failed to create upload directory', 500);
                return;
            }
        }

        $fileName = $user['uid'] . '_' . time() . '_' . uniqid() . '.json';
        $filePath = $uploadDir . $fileName;

        if (file_put_contents($filePath, json_encode($content)) === false) {
            $this->sendError('Failed to save file', 500);
            return;
        }

        $table = $this->prefix . 'planner_projects';
        
        if ($projectId) {
            $existing = $this->db->fetchRow($this->db->select()
                ->from($table)
                ->where('id = ?', $projectId)
                ->where('uid = ?', $user['uid']));
            
            if ($existing) {
                if (file_exists($existing['file_path'])) {
                    @unlink($existing['file_path']);
                }

                $this->db->query($this->db->update($table)
                    ->rows([
                        'name' => $name,
                        'description' => $description,
                        'file_path' => $filePath,
                        'updated_at' => time()
                    ])
                    ->where('id = ?', $projectId));
            } else {
                $this->sendError('Project not found or permission denied', 404);
                return;
            }
        } else {
            $this->db->query($this->db->insert($table)
                ->rows([
                    'uid' => $user['uid'],
                    'name' => $name,
                    'description' => $description,
                    'file_path' => $filePath,
                    'created_at' => time(),
                    'updated_at' => time()
                ]));
            $projectId = $this->db->lastInsertId();
        }

        $this->sendResponse(['status' => 'success', 'id' => $projectId, 'name' => $name]);
    }

    /**
     * Get Project Content
     */
    private function projectGet()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if (!$id) {
            $this->sendError('ID required', 400);
            return;
        }

        $project = $this->db->fetchRow($this->db->select()
            ->from($this->prefix . 'planner_projects')
            ->where('id = ?', $id)
            ->where('uid = ?', $user['uid']));

        if (!$project) {
            $this->sendError('Project not found', 404);
            return;
        }

        if (file_exists($project['file_path'])) {
            $content = file_get_contents($project['file_path']);
            // Check if it's already JSON or double encoded
            $json = json_decode($content, true);
            // If it was a string that contained JSON, decode again
            if (is_string($json)) {
                $json = json_decode($json, true);
            }
            $this->sendResponse(['project' => $project, 'content' => $json]);
        } else {
            $this->sendError('Project file missing', 500);
        }
    }

    /**
     * Delete Project
     */
    private function projectDelete()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        $id = isset($data['id']) ? intval($data['id']) : 0;

        if (!$id) {
            $this->sendError('ID required', 400);
            return;
        }

        $table = $this->prefix . 'planner_projects';
        $project = $this->db->fetchRow($this->db->select()
            ->from($table)
            ->where('id = ?', $id)
            ->where('uid = ?', $user['uid']));

        if ($project) {
            if (file_exists($project['file_path'])) {
                @unlink($project['file_path']);
            }
            $this->db->query($this->db->delete($table)->where('id = ?', $id));
            $this->sendResponse(['status' => 'success']);
        } else {
            $this->sendError('Project not found', 404);
        }
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

        $options = Typecho_Widget::widget('Widget_Options');
        $config = [];
        // Check if option exists in table.options
        // Note: Custom options might not be automatically loaded by Widget_Options unless registered, 
        // but we can query DB directly to be safe or rely on dynamic property if Typecho supports it for all options.
        // Direct DB query is safer for custom inserted options.
        
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

    private function sendResponse($data)
    {
        echo json_encode($data);
        exit;
    }

    private function sendError($message, $code = 400)
    {
        http_response_code($code);
        echo json_encode(['error' => $message]);
        exit;
    }
}
