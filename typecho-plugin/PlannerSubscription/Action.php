<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

require_once 'Traits/SubscriptionTrait.php';
require_once 'Traits/PaymentTrait.php';
require_once 'Traits/CouponTrait.php';

class PlannerSubscription_Action extends Typecho_Widget implements Widget_Interface_Do
{
    use SubscriptionTrait;
    use PaymentTrait;
    use CouponTrait;

    public function __construct($request, $response, $params = NULL)
    {
        parent::__construct($request, $response, $params);
        
        // 设置 CORS 头
        $plugin = Typecho_Widget::widget('PlannerSubscription_Plugin');
        $options = $plugin->options;
        $corsOrigin = isset($options->corsOrigin) ? $options->corsOrigin : '*';
        
        header('Access-Control-Allow-Origin: ' . $corsOrigin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            exit;
        }
    }

    public function action()
    {
        $this->widget('Widget_User')->pass('administrator');
        
        $action = $this->request->action;

        switch ($action) {
            // API 端点
            case 'info':
                $this->handleSubscriptionInfo();
                break;
            case 'plans':
                $this->handleSubscriptionPlans();
                break;
            case 'create_order':
                $this->handleCreateOrder();
                break;
            case 'order_status':
                $this->handleOrderStatus();
                break;
            case 'cancel':
                $this->handleCancelSubscription();
                break;
            case 'renew':
                $this->handleRenewSubscription();
                break;
            case 'orders':
                $this->handleOrderHistory();
                break;
            case 'check_coupon':
                $this->handleCheckCoupon();
                break;
            case 'apply_coupon':
                $this->handleApplyCoupon();
                break;
            default:
                $this->responseJSON(['error' => 'Invalid action'], 404);
        }
    }

    /**
     * 支付回调处理
     */
    public function handlePaymentCallback()
    {
        $provider = $this->request->provider;

        try {
            switch ($provider) {
                case 'wechat':
                    $this->handleWeChatCallback();
                    break;
                case 'alipay':
                    $this->handleAlipayCallback();
                    break;
                case 'stripe':
                    $this->handleStripeCallback();
                    break;
                default:
                    $this->responseJSON(['error' => 'Unsupported payment provider'], 400);
            }
        } catch (Exception $e) {
            $this->responseJSON(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * 处理订阅信息查询
     */
    protected function handleSubscriptionInfo()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);

        if (!$user) {
            $this->responseJSON(['error' => 'Invalid token'], 401);
            return;
        }

        // 检查并更新订阅状态（自动降级）
        $this->checkAndUpdateSubscription($user['uid']);

        // 获取订阅信息
        $subscription = $this->getSubscription($user['uid']);

        $this->responseJSON([
            'success' => true,
            'data' => $subscription
        ]);
    }

    /**
     * 处理订阅计划查询
     */
    protected function handleSubscriptionPlans()
    {
        $plans = $this->getSubscriptionPlans();
        $this->responseJSON($plans);
    }

    /**
     * 处理订单创建
     */
    protected function handleCreateOrder()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);

        if (!$user) {
            $this->responseJSON(['error' => 'Invalid token'], 401);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $plan = $data['plan'];
        $paymentProvider = $data['payment_provider'];
        $couponCode = $data['coupon'] ?? null;

        // 验证计划
        $plans = $this->getSubscriptionPlans();
        if (!isset($plans[$plan])) {
            $this->responseJSON(['error' => 'Invalid plan'], 400);
            return;
        }

        $amount = $plans[$plan]['price'];

        // 应用优惠券
        if ($couponCode) {
            $discount = $this->validateAndCalculateDiscount($couponCode, $plan);
            if ($discount) {
                $amount = $amount - $discount;
                if ($amount < 0) $amount = 0;
            }
        }

        // 创建订单
        $orderNo = $this->createPaymentOrder($user['uid'], $plan, $amount, $paymentProvider, $couponCode);

        // 生成支付数据
        $paymentData = $this->generatePaymentData($orderNo, $amount, $paymentProvider);

        $this->responseJSON([
            'success' => true,
            'order_no' => $orderNo,
            'amount' => $amount,
            ...$paymentData
        ]);
    }

    /**
     * 处理订单状态查询
     */
    protected function handleOrderStatus()
    {
        $orderNo = $this->request->get('order_no');
        $token = $this->request->get('token');
        $user = $this->validateToken($token);

        if (!$user) {
            $this->responseJSON(['error' => 'Invalid token'], 401);
            return;
        }

        $order = $this->getOrderByNo($orderNo);

        if (!$order) {
            $this->responseJSON(['error' => 'Order not found'], 404);
            return;
        }

        $this->responseJSON([
            'success' => true,
            'status' => $order['status']
        ]);
    }

    /**
     * 处理取消订阅
     */
    protected function handleCancelSubscription()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);

        if (!$user) {
            $this->responseJSON(['error' => 'Invalid token'], 401);
            return;
        }

        $result = $this->cancelSubscription($user['uid']);
        $this->responseJSON($result);
    }

    /**
     * 处理续费订阅
     */
    protected function handleRenewSubscription()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);

        if (!$user) {
            $this->responseJSON(['error' => 'Invalid token'], 401);
            return;
        }

        $result = $this->renewSubscription($user['uid']);
        $this->responseJSON($result);
    }

    /**
     * 处理订单历史
     */
    protected function handleOrderHistory()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);

        if (!$user) {
            $this->responseJSON(['error' => 'Invalid token'], 401);
            return;
        }

        $page = $this->request->get('page', 1);
        $pageSize = $this->request->get('pageSize', 20);

        $orders = $this->getUserOrders($user['uid'], $page, $pageSize);
        $this->responseJSON($orders);
    }

    /**
     * 处理优惠券检查
     */
    protected function handleCheckCoupon()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $code = $data['code'];
        $plan = $data['plan'];

        $coupon = $this->getCouponByCode($code);

        if (!$coupon) {
            $this->responseJSON(['valid' => false, 'message' => '优惠券不存在']);
            return;
        }

        if ($coupon['status'] !== 'active') {
            $this->responseJSON(['valid' => false, 'message' => '优惠券已失效']);
            return;
        }

        if ($coupon['plan'] && $coupon['plan'] !== $plan) {
            $this->responseJSON(['valid' => false, 'message' => '优惠券不适用于此套餐']);
            return;
        }

        if ($coupon['valid_from'] && $coupon['valid_from'] > date('Y-m-d H:i:s')) {
            $this->responseJSON(['valid' => false, 'message' => '优惠券尚未生效']);
            return;
        }

        if ($coupon['valid_until'] && $coupon['valid_until'] < date('Y-m-d H:i:s')) {
            $this->responseJSON(['valid' => false, 'message' => '优惠券已过期']);
            return;
        }

        if ($coupon['max_uses'] && $coupon['used_count'] >= $coupon['max_uses']) {
            $this->responseJSON(['valid' => false, 'message' => '优惠券已用完']);
            return;
        }

        $discount = $this->calculateCouponDiscount($coupon, $plan);

        $this->responseJSON([
            'valid' => true,
            'coupon' => [
                'code' => $coupon['code'],
                'discount_type' => $coupon['discount_type'],
                'discount_value' => $coupon['discount_value']
            ],
            'discount' => $discount
        ]);
    }

    /**
     * 验证 Token
     */
    protected function validateToken($token)
    {
        if (!$token) {
            return null;
        }

        // 尝试从 PlannerAuth 插件获取用户信息
        $authAction = new PlannerAuth_Action($this->request, $this->response, $this->params);

        // 调用 PlannerAuth 的 token 验证逻辑
        // 这里需要根据实际的 PlannerAuth 实现调整
        try {
            // 解析 JWT token
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                return null;
            }

            $payload = base64_decode($parts[1]);
            $data = json_decode($payload, true);

            if (!$data || !isset($data['uid'])) {
                return null;
            }

            // 从数据库获取用户信息
            $db = Typecho_Db::get();
            $prefix = $db->getPrefix();
            $user = $db->fetchRow($db->select()->from($prefix . 'users')->where('uid = ?', $data['uid']));

            if ($user) {
                return [
                    'uid' => $user['uid'],
                    'name' => $user['name'],
                    'mail' => $user['mail'],
                    'group' => $user['group']
                ];
            }

            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * 统一 JSON 响应
     */
    protected function responseJSON($data, $status = 200)
    {
        $this->response->setStatus($status);
        $this->response->setContentType('application/json');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }
}
