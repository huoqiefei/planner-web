<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait PlannerAuth_Traits_AuthTrait
{
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
        
        // Default from DB or trial
        $plannerRole = isset($meta['planner_role']) ? $meta['planner_role'] : 'trial';
        
        // Force/Auto-map based on Group
        if ($user['group'] === 'administrator') {
            $plannerRole = 'admin';
        } else if ($user['group'] === 'editor') {
            $plannerRole = 'premium';
        } else if ($user['group'] === 'contributor') {
            $plannerRole = 'licensed';
        } else if ($user['group'] === 'subscriber') {
             // Subscriber keeps DB role (likely trial) unless upgraded
             // But if DB is empty, it's trial.
             if (!isset($meta['planner_role'])) $plannerRole = 'trial';
        }

        // Update user array for token generation
        $user['planner_role'] = $plannerRole;

        $token = $this->generateToken($user);
        
        $this->sendResponse([
            'token' => $token,
            'user' => [
                'uid' => $user['uid'],
                'name' => $user['screenName'],
                'username' => $user['name'],
                'mail' => $user['mail'],
                'group' => $user['group'],
                'plannerRole' => $plannerRole,
                'avatar' => isset($meta['avatar']) ? $meta['avatar'] : null,
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
        // Debug
        $this->log("verifyToken called");
        
        // Try to get token from multiple sources
        $token = null;
        $authHeader = $this->request->getHeader('Authorization');
        
        // Fallback for Apache/CGI environments where header is stripped
        if (!$authHeader) {
            if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
                $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
            } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
                $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
            } elseif (function_exists('apache_request_headers')) {
                $headers = apache_request_headers();
                if (isset($headers['Authorization'])) {
                    $authHeader = $headers['Authorization'];
                }
            }
        }

        // Fallback: Check for token in Query String or POST body
        if (!$authHeader) {
            $authHeader = $this->request->get('token');
        }

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
}
