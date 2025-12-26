<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

require_once 'Traits/ResponseTrait.php';
require_once 'Traits/MetaTrait.php';
require_once 'Traits/AuthTrait.php';
require_once 'Traits/UserTrait.php';
require_once 'Traits/ProjectTrait.php';
require_once 'Traits/AdminTrait.php';

class PlannerAuth_Action extends Typecho_Widget implements Widget_Interface_Do
{
    use PlannerAuth_Traits_ResponseTrait;
    use PlannerAuth_Traits_MetaTrait;
    use PlannerAuth_Traits_AuthTrait;
    use PlannerAuth_Traits_UserTrait;
    use PlannerAuth_Traits_ProjectTrait;
    use PlannerAuth_Traits_AdminTrait;

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

        // CORS Headers - Send immediately using native header() to avoid Typecho buffering issues on error
        $origin = $this->pluginOptions->corsOrigin ? $this->pluginOptions->corsOrigin : '*';
        
        $requestOrigin = $this->request->getHeader('Origin');
        if ($origin === '*') {
             if ($requestOrigin) {
                 $origin = $requestOrigin;
             }
        } else {
             $origin = rtrim($origin, '/*');
             $origin = rtrim($origin, '/');
        }

        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
        header('Content-Type: application/json');
        
        if ($this->request->is('OPTIONS')) {
            http_response_code(204);
            exit;
        }
    }

    protected function log($message) {
        $logFile = __DIR__ . '/debug.log';
        $timestamp = date('Y-m-d H:i:s');
        file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
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
