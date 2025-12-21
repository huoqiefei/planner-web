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
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) {
            $data = $_POST;
        }
        
        $username = isset($data['username']) ? $data['username'] : '';
        $password = isset($data['password']) ? $data['password'] : '';

        if (empty($username) || empty($password)) {
            $this->sendError('Username and password required', 400);
            return;
        }

        $user = $this->db->fetchRow($this->db->select()
            ->from('table.users')
            ->where('name = ?', $username)
            ->limit(1));

        if (!$user || !Typecho_Common::hashValidate($password, $user['password'])) {
            $this->sendError('Invalid credentials', 401);
            return;
        }

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
