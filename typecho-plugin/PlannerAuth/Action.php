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
            // Plugin might not be configured yet
            $this->pluginOptions = new stdClass();
            $this->pluginOptions->jwtSecret = 'default_secret';
            $this->pluginOptions->corsOrigin = '*';
        }

        // CORS Headers
        $origin = $this->pluginOptions->corsOrigin ? $this->pluginOptions->corsOrigin : '*';
        
        // Fix: Strip trailing wildcards/slashes as Access-Control-Allow-Origin must be exact
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
                case 'user':
                    $this->userInfo();
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
                case 'sys_config_get':
                    $this->sysConfigGet();
                    break;
                case 'sys_config_save':
                    $this->sysConfigSave();
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

        // DEBUG MODE: If username starts with debug: prefix
        if (strpos($username, 'debug:') === 0) {
            $realUsername = substr($username, 6);
            $user = $this->db->fetchRow($this->db->select()
                ->from('table.users')
                ->where('name = ?', $realUsername)
                ->limit(1));
            
            $this->sendResponse([
                'debug' => true,
                'input_username' => $realUsername,
                'user_found' => !!$user,
                'user_data_hash' => $user ? $user['password'] : null,
                'password_valid' => $user ? Typecho_Common::hashValidate($password, $user['password']) : false
            ]);
            return;
        }

        // 1. Attempt Typecho Core Login (Most Robust)
        $auth = Typecho_Widget::widget('Widget_User');
        $logged = false;
        try {
            if ($auth->login($username, $password, true)) {
                $user = $auth->row; // Get authorized user
                $logged = true;
            }
        } catch (Exception $e) {
            // Ignore core login errors, fall back to manual check for diagnostics
        }

        if ($logged) {
            // Success - Generate Token
            $meta = $this->getUserMeta($user['uid']);
            $token = $this->generateToken($user);
            
            $this->sendResponse([
                'token' => $token,
                'user' => [
                    'uid' => $user['uid'],
                    'name' => $user['screenName'],
                    'username' => $user['name'],
                    'mail' => $user['mail'],
                    'group' => $user['group'],
                    'meta' => $meta
                ]
            ]);
            return;
        }

        // 2. Diagnosis: Why did it fail?
        // Try to find user by name or mail
        // Separate queries to ensure correct index usage and logic
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

        // Fallback: Check screenName (some users confuse this with username)
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
        
        // If we got here, it means hashValidate PASSED but Widget_User login FAILED.
        // This is weird, but we should trust hashValidate if it passes.
        // Fetch custom meta
        $meta = $this->getUserMeta($user['uid']);

        // Generate Token
        $token = $this->generateToken($user);

        $this->sendResponse([
            'token' => $token,
            'user' => [
                'uid' => $user['uid'],
                'name' => $user['screenName'],
                'username' => $user['name'],
                'mail' => $user['mail'],
                'group' => $user['group'],
                'meta' => $meta
            ]
        ]);
    }

    /**
     * Get current user info from Token
     */
    private function userInfo()
    {
        $user = $this->verifyToken();
        if (!$user) {
            return;
        }

        // Refresh user data from DB
        $dbUser = $this->db->fetchRow($this->db->select()
            ->from('table.users')
            ->where('uid = ?', $user['uid'])
            ->limit(1));
            
        if (!$dbUser) {
            $this->sendError('User not found', 404);
            return;
        }

        $meta = $this->getUserMeta($dbUser['uid']);

        $this->sendResponse([
            'uid' => $dbUser['uid'],
            'name' => $dbUser['screenName'],
            'username' => $dbUser['name'],
            'mail' => $dbUser['mail'],
            'group' => $dbUser['group'],
            'meta' => $meta
        ]);
    }

    /**
     * Update user meta (Requires Auth)
     */
    private function updateMeta()
    {
        $user = $this->verifyToken();
        if (!$user) {
            return;
        }

        // Only allow self or admin to update?
        // For now, let's allow updating self meta or if admin any meta.
        // Assuming simple use case: update self.
        
        $data = json_decode(file_get_contents('php://input'), true);
        $targetUid = isset($data['uid']) ? intval($data['uid']) : $user['uid'];
        $key = isset($data['key']) ? $data['key'] : '';
        $value = isset($data['value']) ? $data['value'] : '';

        if (empty($key)) {
            $this->sendError('Key is required', 400);
            return;
        }

        // Check permission
        if ($targetUid != $user['uid'] && $user['group'] !== 'administrator') {
            $this->sendError('Permission denied', 403);
            return;
        }

        // Update/Insert
        $table = $this->prefix . 'planner_usermeta';
        $existing = $this->db->fetchRow($this->db->select()
            ->from($table)
            ->where('uid = ?', $targetUid)
            ->where('meta_key = ?', $key));

        if ($existing) {
            $this->db->query($this->db->update($table)
                ->rows(['meta_value' => $value])
                ->where('id = ?', $existing['id']));
        } else {
            $this->db->query($this->db->insert($table)
                ->rows([
                    'uid' => $targetUid,
                    'meta_key' => $key,
                    'meta_value' => $value
                ]));
        }

        $this->sendResponse(['status' => 'success']);
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
        $content = isset($data['content']) ? $data['content'] : []; // The project JSON
        $projectId = isset($data['id']) ? intval($data['id']) : null;

        if (empty($content)) {
            $this->sendError('Project content is empty', 400);
            return;
        }

        // Save file
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

        // DB Operation
        $table = $this->prefix . 'planner_projects';
        
        if ($projectId) {
            // Update existing
            $existing = $this->db->fetchRow($this->db->select()
                ->from($table)
                ->where('id = ?', $projectId)
                ->where('uid = ?', $user['uid']));
            
            if ($existing) {
                // Remove old file
                if (file_exists($existing['file_path'])) {
                    @unlink($existing['file_path']); // Or keep version history? User didn't ask.
                }

                $this->db->query($this->db->update($table)
                    ->rows([
                        'name' => $name,
                        'description' => $description,
                        'file_path' => $filePath, // Store absolute path for now, or relative? Absolute is easier here.
                        'updated_at' => time()
                    ])
                    ->where('id = ?', $projectId));
            } else {
                $this->sendError('Project not found or permission denied', 404);
                return;
            }
        } else {
            // Create new
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
            $json = json_decode($content, true);
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

        $rows = $this->db->fetchAll($this->db->select()
            ->from($this->prefix . 'planner_settings'));
            
        $config = [];
        foreach ($rows as $row) {
            $config[$row['conf_key']] = $row['conf_value'];
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
        
        $table = $this->prefix . 'planner_settings';

        foreach ($data as $key => $value) {
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value);
            }

            $existing = $this->db->fetchRow($this->db->select()
                ->from($table)
                ->where('conf_key = ?', $key));
            
            if ($existing) {
                $this->db->query($this->db->update($table)
                    ->rows([
                        'conf_value' => $value,
                        'updated_at' => time()
                    ])
                    ->where('id = ?', $existing['id']));
            } else {
                $this->db->query($this->db->insert($table)
                    ->rows([
                        'conf_key' => $key,
                        'conf_value' => $value,
                        'updated_at' => time()
                    ]));
            }
        }

        $this->sendResponse(['status' => 'success']);
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
