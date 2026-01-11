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

        // 从用户表读取
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

        // 检查用户表中的订阅是否过期
        $user = $db->fetchRow($db->select()->from($prefix . 'users')->where('uid = ?', $uid));

        if ($user && isset($user['subscription_end']) && 
            $user['subscription_status'] === 'active' && 
            $user['subscription_end'] < $now) {
            
            // 订阅已过期，降级到 trial
            $db->query($db->update($prefix . 'users')
                ->where('uid = ?', $uid)
                ->rows([
                    'subscription_status' => 'expired',
                    'subscription_plan' => null
                ]));

            // 更新 planner_usermeta 中的 planner_role
            $this->updateUserRole($uid, 'trial');
            return false;
        }

        return true;
    }

    /**
     * 更新用户订阅
     */
    protected function updateSubscription($uid, $plan, $durationDays = 30, $autoRenew = true, $paymentId = null, $paymentProvider = null)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();
        $now = date('Y-m-d H:i:s');
        $endDate = date('Y-m-d H:i:s', strtotime("+$durationDays days"));

        // 在订阅表中创建记录
        $db->query($db->insert($prefix . 'planner_subscriptions')->rows([
            'user_id' => $uid,
            'plan' => $plan,
            'status' => 'active',
            'start_date' => $now,
            'end_date' => $endDate,
            'auto_renew' => $autoRenew ? 1 : 0,
            'payment_provider' => $paymentProvider,
            'payment_id' => $paymentId,
            'created_at' => $now
        ]));

        // 更新用户表的订阅信息
        $db->query($db->update($prefix . 'users')
            ->where('uid = ?', $uid)
            ->rows([
                'subscription_status' => 'active',
                'subscription_plan' => $plan,
                'subscription_start' => $now,
                'subscription_end' => $endDate,
                'subscription_auto_renew' => $autoRenew ? 1 : 0
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
        $metaTable = $prefix . 'planner_usermeta';

        // 检查是否已存在该记录
        $existing = $db->fetchRow($db->select()
            ->from($metaTable)
            ->where('uid = ? AND meta_key = ?', $uid, 'planner_role'));

        if ($existing) {
            $db->query($db->update($metaTable)
                ->where('uid = ? AND meta_key = ?', $uid, 'planner_role')
                ->rows('meta_value', $role));
        } else {
            $db->query($db->insert($metaTable)->rows([
                'uid' => $uid,
                'meta_key' => 'planner_role',
                'meta_value' => $role
            ]));
        }
    }

    /**
     * 获取订阅计划配置
     */
    protected function getSubscriptionPlans()
    {
        $plugin = Typecho_Widget::widget('PlannerSubscription_Plugin');
        $options = $plugin->options;

        return [
            'licensed' => [
                'id' => 'licensed',
                'name' => '标准版',
                'price' => (float)(isset($options->licensed_price) ? $options->licensed_price : 99),
                'duration' => 30,
                'features' => [
                    '100 个作业',
                    '10 个项目',
                    '无限制导出',
                    '无水印'
                ]
            ],
            'premium' => [
                'id' => 'premium',
                'name' => '专业版',
                'price' => (float)(isset($options->premium_price) ? $options->premium_price : 199),
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
     * 取消订阅
     */
    protected function cancelSubscription($uid)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        // 更新用户表
        $db->query($db->update($prefix . 'users')
            ->where('uid = ?', $uid)
            ->rows([
                'subscription_status' => 'cancelled'
            ]));

        // 更新订阅表
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

        $subscription = $db->fetchRow($db->select()
            ->from($prefix . 'planner_subscriptions')
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
        $currentEnd = $subscription['end_date'];
        $newEndDate = date('Y-m-d H:i:s', strtotime($currentEnd . " +$duration days"));

        $db->query($db->update($prefix . 'planner_subscriptions')
            ->where('user_id = ? AND status = ?', $uid, 'active')
            ->rows([
                'end_date' => $newEndDate,
                'updated_at' => date('Y-m-d H:i:s')
            ]));

        // 更新用户表
        $db->query($db->update($prefix . 'users')
            ->where('uid = ?', $uid)
            ->rows(['subscription_end' => $newEndDate]));

        return [
            'success' => true,
            'end_date' => $newEndDate
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
        $latestProject = $db->fetchRow($db->select()
            ->from($prefix . 'planner_projects')
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
}
