<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait SubscriptionTrait
{
    /**
     * 获取用户订阅信息
     */
    protected function getSubscription($uid)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        // 方案 A: 从用户表读取
        $user = $db->fetchRow($db->select()->from($prefix . 'users')->where('uid = ?', $uid));
        
        if ($user && isset($user['subscription_status'])) {
            return [
                'status' => $user['subscription_status'],
                'plan' => $user['subscription_plan'],
                'start_date' => $user['subscription_start'],
                'end_date' => $user['subscription_end'],
                'auto_renew' => (bool)$user['subscription_auto_renew']
            ];
        }

        // 方案 B: 从独立订阅表读取
        $subscription = $db->fetchRow($db->select()->from($prefix . 'planner_subscriptions')
            ->where('user_id = ? AND status = ?', $uid, 'active')
            ->order('id', Typecho_Db::SORT_DESC)
            ->limit(1));

        if ($subscription) {
            return [
                'status' => $subscription['status'],
                'plan' => $subscription['plan'],
                'start_date' => $subscription['start_date'],
                'end_date' => $subscription['end_date'],
                'auto_renew' => (bool)$subscription['auto_renew']
            ];
        }

        // 默认试用状态
        return [
            'status' => 'trial',
            'plan' => null,
            'start_date' => null,
            'end_date' => null,
            'auto_renew' => false
        ];
    }

    /**
     * 检查并更新订阅状态（自动降级）
     */
    protected function checkAndUpdateSubscription($uid)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();
        $now = date('Y-m-d H:i:s');

        // 检查是否过期
        $subscription = $db->fetchRow($db->select()->from($prefix . 'planner_subscriptions')
            ->where('user_id = ? AND status = ?', $uid, 'active')
            ->limit(1));

        if ($subscription && $subscription['end_date'] < $now) {
            // 订阅已过期，降级到 trial
            $db->query($db->update($prefix . 'planner_subscriptions')
                ->where('user_id = ? AND status = ?', $uid, 'active')
                ->rows('status', 'expired'));

            // 更新用户 role
            $this->updateUserRole($uid, 'trial');
            return false;
        }

        return true;
    }

    /**
     * 更新用户订阅
     */
    protected function updateSubscription($uid, $plan, $durationDays = 30, $autoRenew = true)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();
        $now = date('Y-m-d H:i:s');
        $endDate = date('Y-m-d H:i:s', strtotime("+$durationDays days"));

        $db->query($db->insert($prefix . 'planner_subscriptions')->rows([
            'user_id' => $uid,
            'plan' => $plan,
            'status' => 'active',
            'start_date' => $now,
            'end_date' => $endDate,
            'auto_renew' => $autoRenew ? 1 : 0,
            'created_at' => $now
        ]));

        // 更新用户 role
        $this->updateUserRole($uid, $plan);

        return [
            'success' => true,
            'end_date' => $endDate,
            'plan' => $plan
        ];
    }

    /**
     * 更新用户 plannerRole
     */
    protected function updateUserRole($uid, $role)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        // 更新 planner_usermeta
        $db->query($db->update($prefix . 'planner_usermeta')
            ->where('uid = ? AND meta_key = ?', $uid, 'planner_role')
            ->rows('meta_value', $role));
    }

    /**
     * 创建支付订单
     */
    protected function createPaymentOrder($uid, $plan, $amount, $paymentProvider)
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
    protected function handlePaymentCallback($orderNo, $paymentId, $status)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        // 获取订单
        $order = $db->fetchRow($db->select()->from($prefix . 'planner_payment_orders')
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
            $this->updateSubscription($order['user_id'], $order['plan'], $duration);
        }

        return ['success' => true];
    }

    /**
     * 获取订阅计划配置
     */
    protected function getSubscriptionPlans()
    {
        return [
            'licensed' => [
                'name' => '标准版',
                'price' => 99,
                'duration' => 30,
                'features' => [
                    '100 个作业',
                    '10 个项目',
                    '无限制导出',
                    '无水印'
                ]
            ],
            'premium' => [
                'name' => '专业版',
                'price' => 199,
                'duration' => 30,
                'features' => [
                    '500 个作业',
                    '无限制项目',
                    '无限制导出',
                    '无水印',
                    '优先支持'
                ]
            ]
        ];
    }

    /**
     * 获取用量统计
     */
    protected function getUserUsage($uid)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        // 项目数量
        $projectCount = $db->fetchObject($db->select(['COUNT(*)' => 'count'])
            ->from($prefix . 'planner_projects')
            ->where('uid = ?', $uid))->count;

        // 资源数量 (从最新的项目)
        $latestProject = $db->fetchRow($db->select()->from($prefix . 'planner_projects')
            ->where('uid = ?', $uid)
            ->order('updated_at', Typecho_Db::SORT_DESC)
            ->limit(1));

        $resourceCount = $latestProject['resource_count'] ?? 0;
        $activityCount = $latestProject['activity_count'] ?? 0;

        return [
            'project_count' => (int)$projectCount,
            'activity_count' => (int)$activityCount,
            'resource_count' => (int)$resourceCount
        ];
    }

    /**
     * 取消订阅
     */
    protected function cancelSubscription($uid)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        $db->query($db->update($prefix . 'planner_subscriptions')
            ->where('user_id = ? AND status = ?', $uid, 'active')
            ->rows([
                'status' => 'cancelled',
                'updated_at' => date('Y-m-d H:i:s')
            ]));

        return ['success' => true];
    }

    /**
     * 续费订阅
     */
    protected function renewSubscription($uid)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        $subscription = $db->fetchRow($db->select()->from($prefix . 'planner_subscriptions')
            ->where('user_id = ? AND status = ?', $uid, 'active')
            ->limit(1));

        if (!$subscription) {
            return ['success' => false, 'message' => 'No active subscription'];
        }

        // 计算新的结束日期
        $planDurations = [
            'licensed' => 30,
            'premium' => 30
        ];

        $duration = $planDurations[$subscription['plan']] ?? 30;
        $newEndDate = date('Y-m-d H:i:s', strtotime($subscription['end_date'] . " +$duration days"));

        $db->query($db->update($prefix . 'planner_subscriptions')
            ->where('user_id = ? AND status = ?', $uid, 'active')
            ->rows([
                'end_date' => $newEndDate,
                'updated_at' => date('Y-m-d H:i:s')
            ]));

        return [
            'success' => true,
            'end_date' => $newEndDate
        ];
    }
}
