<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait PaymentTrait
{
    /**
     * 创建支付订单
     */
    protected function createPaymentOrder($uid, $plan, $amount, $paymentProvider, $couponCode = null)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();
        $orderNo = 'PL' . date('YmdHis') . rand(1000, 9999);

        $db->query($db->insert($prefix . 'planner_payment_orders')->rows([
            'user_id' => $uid,
            'order_no' => $orderNo,
            'plan' => $plan,
            'amount' => $amount,
            'currency' => 'CNY',
            'status' => 'pending',
            'payment_provider' => $paymentProvider,
            'created_at' => date('Y-m-d H:i:s')
        ]));

        return $orderNo;
    }

    /**
     * 处理支付回调
     */
    protected function handlePaymentCallback($orderNo, $paymentId, $status, $paymentData = [])
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        // 获取订单
        $order = $db->fetchRow($db->select()
            ->from($prefix . 'planner_payment_orders')
            ->where('order_no = ?', $orderNo)
            ->limit(1));

        if (!$order) {
            return ['success' => false, 'message' => 'Order not found'];
        }

        if ($order['status'] !== 'pending') {
            return ['success' => false, 'message' => 'Order already processed'];
        }

        // 更新订单状态
        $updateData = [
            'status' => $status,
            'payment_id' => $paymentId,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($paymentData) {
            $updateData['payment_data'] = json_encode($paymentData);
        }

        if ($status === 'paid') {
            $updateData['paid_at'] = date('Y-m-d H:i:s');
        }

        $db->query($db->update($prefix . 'planner_payment_orders')
            ->where('order_no = ?', $orderNo)
            ->rows($updateData));

        // 如果支付成功，创建订阅
        if ($status === 'paid') {
            $planDurations = [
                'licensed' => 30,
                'premium' => 30
            ];

            $duration = $planDurations[$order['plan']] ?? 30;
            $this->updateSubscription(
                $order['user_id'],
                $order['plan'],
                $duration,
                true,
                $paymentId,
                $order['payment_provider']
            );
        }

        return ['success' => true];
    }

    /**
     * 获取订单
     */
    protected function getOrderByNo($orderNo)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        return $db->fetchRow($db->select()
            ->from($prefix . 'planner_payment_orders')
            ->where('order_no = ?', $orderNo)
            ->limit(1));
    }

    /**
     * 获取用户订单列表
     */
    protected function getUserOrders($uid, $page = 1, $pageSize = 20)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        $offset = ($page - 1) * $pageSize;

        $orders = $db->fetchAll($db->select()
            ->from($prefix . 'planner_payment_orders')
            ->where('user_id = ?', $uid)
            ->order('created_at', Typecho_Db::SORT_DESC)
            ->limit($pageSize)
            ->offset($offset));

        $total = $db->fetchObject($db->select(['COUNT(*)' => 'count'])
            ->from($prefix . 'planner_payment_orders')
            ->where('user_id = ?', $uid))->count;

        return [
            'orders' => $orders,
            'total' => (int)$total,
            'page' => (int)$page,
            'pageSize' => (int)$pageSize
        ];
    }

    /**
     * 生成支付数据
     */
    protected function generatePaymentData($orderNo, $amount, $provider)
    {
        switch ($provider) {
            case 'wechat':
                return $this->generateWeChatPayment($orderNo, $amount);
            case 'alipay':
                return $this->generateAlipayPayment($orderNo, $amount);
            case 'stripe':
                return $this->generateStripePayment($orderNo, $amount);
            default:
                throw new Exception('Unsupported payment provider');
        }
    }

    /**
     * 生成微信支付数据
     */
    protected function generateWeChatPayment($orderNo, $amount)
    {
        // 这里需要集成微信支付 SDK
        // 参考：https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_4_1.shtml
        
        // 简化示例 - 实际使用时需要替换为真实的微信支付 API 调用
        $config = $this->getPaymentConfig('wechat');
        
        if (!$config || !isset($config['appid']) || !isset($config['mch_id'])) {
            throw new Exception('微信支付未配置');
        }

        // 调用微信支付 API 生成 Native Pay 二维码
        // 这里返回模拟数据
        $qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' . urlencode('weixin://wxpay/bizpayurl?pr=' . $orderNo);

        return [
            'qr_code' => $qrCodeUrl,
            'payment_url' => null
        ];
    }

    /**
     * 生成支付宝支付数据
     */
    protected function generateAlipayPayment($orderNo, $amount)
    {
        // 这里需要集成支付宝 SDK
        // 参考：https://opendocs.alipay.com/open/194
        
        $config = $this->getPaymentConfig('alipay');
        
        if (!$config || !isset($config['app_id'])) {
            throw new Exception('支付宝未配置');
        }

        // 调用支付宝 API 生成当面付二维码
        // 这里返回模拟数据
        $qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' . urlencode('alipays://platformapi/startapp?saId=10000007&qrcode=' . $orderNo);

        return [
            'qr_code' => $qrCodeUrl,
            'payment_url' => null
        ];
    }

    /**
     * 生成 Stripe 支付数据
     */
    protected function generateStripePayment($orderNo, $amount)
    {
        $config = $this->getPaymentConfig('stripe');
        
        if (!$config || !isset($config['public_key'])) {
            throw new Exception('Stripe 未配置');
        }

        // Stripe 使用 Checkout Session，需要在前端处理
        return [
            'payment_url' => 'https://checkout.stripe.com/pay', // 实际应该创建 Checkout Session
            'qr_code' => null,
            'public_key' => $config['public_key']
        ];
    }

    /**
     * 处理微信支付回调
     */
    protected function handleWeChatCallback()
    {
        $rawData = file_get_contents('php://input');
        $data = json_decode($rawData, true);

        if (!$data) {
            $this->responseXML(['return_code' => 'FAIL', 'return_msg' => 'Invalid request']);
            return;
        }

        // 验证签名（简化版，实际需要完整验证）
        $orderNo = $data['out_trade_no'] ?? '';
        $paymentId = $data['transaction_id'] ?? '';
        $status = $data['trade_state'] === 'SUCCESS' ? 'paid' : 'failed';

        $result = $this->handlePaymentCallback($orderNo, $paymentId, $status, $data);

        if ($result['success']) {
            $this->responseXML(['return_code' => 'SUCCESS', 'return_msg' => 'OK']);
        } else {
            $this->responseXML(['return_code' => 'FAIL', 'return_msg' => $result['message']]);
        }
    }

    /**
     * 处理支付宝回调
     */
    protected function handleAlipayCallback()
    {
        // 支付宝回调验证
        $params = $_POST;
        
        // 验证签名（简化版）
        $orderNo = $params['out_trade_no'] ?? '';
        $paymentId = $params['trade_no'] ?? '';
        $status = $params['trade_status'] === 'TRADE_SUCCESS' ? 'paid' : 'failed';

        $result = $this->handlePaymentCallback($orderNo, $paymentId, $status, $params);

        if ($result['success']) {
            echo 'success';
        } else {
            echo 'fail';
        }
    }

    /**
     * 处理 Stripe 回调
     */
    protected function handleStripeCallback()
    {
        $payload = file_get_contents('php://input');
        $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'];

        $config = $this->getPaymentConfig('stripe');
        $endpointSecret = $config['webhook_secret'] ?? '';

        // 验证 webhook 签名
        // 实际需要使用 Stripe SDK 验证

        $event = json_decode($payload, true);

        if ($event['type'] === 'checkout.session.completed') {
            $session = $event['data']['object'];
            $orderNo = $session['metadata']['order_no'] ?? '';
            $paymentId = $session['payment_intent'];

            $this->handlePaymentCallback($orderNo, $paymentId, 'paid', $session);
        }

        $this->responseJSON(['received' => true]);
    }

    /**
     * 获取支付配置
     */
    protected function getPaymentConfig($provider)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        $configs = $db->fetchAll($db->select()
            ->from($prefix . 'planner_payment_config')
            ->where('provider = ?', $provider));

        $result = [];
        foreach ($configs as $config) {
            $result[$config['config_key']] = $config['config_value'];
        }

        return $result;
    }

    /**
     * 保存支付配置
     */
    protected function savePaymentConfig($provider, $configs)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        foreach ($configs as $key => $value) {
            // 检查是否存在
            $existing = $db->fetchRow($db->select()
                ->from($prefix . 'planner_payment_config')
                ->where('provider = ? AND config_key = ?', $provider, $key));

            if ($existing) {
                $db->query($db->update($prefix . 'planner_payment_config')
                    ->where('provider = ? AND config_key = ?', $provider, $key)
                    ->rows(['config_value' => $value]));
            } else {
                $db->query($db->insert($prefix . 'planner_payment_config')
                    ->rows([
                        'provider' => $provider,
                        'config_key' => $key,
                        'config_value' => $value
                    ]));
            }
        }

        return true;
    }

    /**
     * XML 响应（用于微信支付）
     */
    protected function responseXML($data)
    {
        $this->response->setContentType('application/xml');
        $xml = '<xml>';
        foreach ($data as $key => $value) {
            $xml .= "<$key><
![CDATA[$value]]></$key>";
        }
        $xml .= '</xml>';
        echo $xml;
        exit;
    }
}
