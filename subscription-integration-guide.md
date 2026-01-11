# 付费订阅功能集成指南

## 概述

本文档说明如何在不改变现有核心代码的基础上，为 Planner Web 添加付费订阅功能。

**设计原则：**
- 最小化对现有代码的修改
- 利用现有的 `plannerRole` 系统和权限框架
- 通过配置和环境变量控制功能
- 支持多种支付方式（微信支付、支付宝、Stripe）

## 1. 架构说明

### 现有系统（无需改动）
```
┌─────────────────────────────────────────┐
│  PlannerRole 系统                        │
│  - trial / licensed / premium / admin    │
│  usePermissions hook                      │
│  authService API                         │
└─────────────────────────────────────────┘
```

### 新增订阅系统
```
┌─────────────────────────────────────────┐
│  后端                    前端             │
│  - SubscriptionTrait     - SubscriptionModal │
│  - 订单管理              - subscriptionService  │
│  - 支付回调              - 订阅状态显示    │
└─────────────────────────────────────────┘
```

## 2. 后端集成步骤

### 2.1 数据库迁移

```bash
# 执行数据库迁移脚本
mysql -u your_username -p your_database < typecho-plugin/PlannerAuth/database_subscription.sql
```

### 2.2 集成 SubscriptionTrait

在 `typecho-plugin/PlannerAuth/Action.php` 中添加：

```php
<?php
// 引入 SubscriptionTrait
require_once 'Traits/SubscriptionTrait.php';

class PlannerAuth_Action extends Typecho_Widget implements Widget_Interface_Do
{
    use SubscriptionTrait;  // 新增

    public function action()
    {
        // 现有路由...
        
        // 新增订阅路由
        case 'subscription_info':
            $this->handleSubscriptionInfo();
            break;
        case 'subscription_plans':
            $this->handleSubscriptionPlans();
            break;
        case 'subscription_create_order':
            $this->handleCreateOrder();
            break;
        case 'subscription_order_status':
            $this->handleOrderStatus();
            break;
        case 'subscription_cancel':
            $this->handleCancelSubscription();
            break;
        case 'subscription_renew':
            $this->handleRenewSubscription();
            break;
        case 'subscription_orders':
            $this->handleOrderHistory();
            break;
    }

    // 新增处理方法示例
    protected function handleSubscriptionInfo()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);
        
        // 检查并更新订阅状态（自动降级）
        $this->checkAndUpdateSubscription($user['uid']);
        
        // 获取订阅信息
        $subscription = $this->getSubscription($user['uid']);
        
        $this->responseJSON([
            'success' => true,
            'data' => $subscription
        ]);
    }

    protected function handleSubscriptionPlans()
    {
        $plans = $this->getSubscriptionPlans();
        $this->responseJSON($plans);
    }

    protected function handleCreateOrder()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);
        
        $data = json_decode(file_get_contents('php://input'), true);
        $plan = $data['plan'];
        $paymentProvider = $data['payment_provider'];
        
        // 获取计划价格
        $plans = $this->getSubscriptionPlans();
        if (!isset($plans[$plan])) {
            throw new Exception('Invalid plan');
        }
        
        $amount = $plans[$plan]['price'];
        
        // 创建订单
        $orderNo = $this->createPaymentOrder($user['uid'], $plan, $amount, $paymentProvider);
        
        // 生成支付信息（根据支付方式）
        $paymentData = $this->generatePaymentData($orderNo, $amount, $paymentProvider);
        
        $this->responseJSON([
            'success' => true,
            'order_no' => $orderNo,
            ...$paymentData
        ]);
    }

    protected function handleOrderStatus()
    {
        $orderNo = $this->request->get('order_no');
        $token = $this->request->get('token');
        $user = $this->validateToken($token);
        
        // 查询订单状态
        $order = $this->getOrderByNo($orderNo);
        
        $this->responseJSON([
            'success' => true,
            'status' => $order['status']
        ]);
    }

    protected function handleCancelSubscription()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);
        
        $result = $this->cancelSubscription($user['uid']);
        $this->responseJSON($result);
    }

    protected function handleRenewSubscription()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);
        
        $result = $this->renewSubscription($user['uid']);
        $this->responseJSON($result);
    }

    protected function handleOrderHistory()
    {
        $token = $this->request->get('token');
        $user = $this->validateToken($token);
        
        $orders = $this->getUserOrders($user['uid']);
        $this->responseJSON($orders);
    }

    // 支付回调处理（需要根据实际支付平台调整）
    protected function handlePaymentCallback($paymentProvider)
    {
        $data = $this->getPaymentCallbackData($paymentProvider);
        $orderNo = $data['out_trade_no'];
        $paymentId = $data['transaction_id'];
        $status = $data['trade_state'] === 'SUCCESS' ? 'paid' : 'failed';
        
        $result = $this->handlePaymentCallback($orderNo, $paymentId, $status);
        
        // 返回支付平台需要的响应
        return $this->getPaymentResponse($paymentProvider, $result);
    }

    // 生成支付数据
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

    // 其他辅助方法...
}
```

### 2.3 添加支付回调路由

在 `Plugin.php` 的 `activate()` 方法中添加：

```php
public static function activate()
{
    // 现有代码...

    // 新增支付回调路由
    Helper::addRoute('payment_callback', '/planner/payment/callback/[provider]', 'PlannerAuth_Action', 'handlePaymentCallback');
    
    return _t('Planner Auth Plugin Activated');
}
```

## 3. 前端集成步骤

### 3.1 添加订阅组件到 Modals

在 `components/Modals.tsx` 中添加订阅模态框：

```tsx
import { SubscriptionModal } from './SubscriptionModal';

// 在 switch (activeModal) 中添加：
case 'subscription':
    return <SubscriptionModal />;
```

### 3.2 在 AccountSettings 中添加订阅入口

在 `components/AccountSettingsModal.tsx` 中添加订阅管理按钮：

```tsx
{user?.plannerRole !== 'admin' && (
    <div className="space-y-4 mb-6">
        <h3 className="text-lg font-semibold">订阅管理</h3>
        <button
            onClick={() => setActiveModal('subscription')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
            管理订阅
        </button>
        {user.plannerRole && (
            <p className="text-sm text-gray-600">
                当前级别: {user.plannerRole === 'trial' ? '试用版' : 
                          user.plannerRole === 'licensed' ? '标准版' : '专业版'}
            </p>
        )}
    </div>
)}
```

### 3.3 添加订阅状态检查 Hook

创建新文件 `hooks/useSubscription.ts`：

```tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { subscriptionService } from '../services/subscriptionService';

export const useSubscription = () => {
    const { user, setModalData, setActiveModal } = useAppStore();
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user && user.plannerRole !== 'admin') {
            loadSubscription();
        }
    }, [user]);

    const loadSubscription = async () => {
        try {
            setLoading(true);
            const data = await subscriptionService.getSubscription();
            setSubscription(data);
            
            // 检查是否需要提醒
            if (data.status === 'active' && data.end_date) {
                const daysLeft = subscriptionService.calculateDaysLeft(data.end_date);
                const reminderDays = parseInt(import.meta.env.VITE_SUBSCRIPTION_REMINDER_DAYS) || 7;
                
                if (daysLeft > 0 && daysLeft <= reminderDays) {
                    // 可以在这里显示提醒
                    console.log(`Subscription will expire in ${daysLeft} days`);
                }
            }
        } catch (error) {
            console.error('Failed to load subscription:', error);
        } finally {
            setLoading(false);
        }
    };

    return { subscription, loading, refreshSubscription: loadSubscription };
};
```

### 3.4 在 App.tsx 中集成订阅检查

```tsx
import { useSubscription } from './hooks/useSubscription';

// 在 App 组件中
const { subscription } = useSubscription();

// 可选：在登录后自动检查订阅状态
useEffect(() => {
    if (user && user.plannerRole !== 'admin') {
        // 自动刷新用户数据以获取最新订阅状态
        handleRefreshUser();
    }
}, [subscription]);
```

## 4. 配置说明

### 4.1 环境变量配置

复制 `.env.subscription` 为 `.env` 并修改：

```env
# 启用订阅功能
VITE_SUBSCRIPTION_ENABLED=true

# 配置各计划的权限角色
VITE_FEATURE_ROLES_EXPORT=licensed,premium,admin
VITE_PLAN_TRIAL_LIMIT=20
VITE_PLAN_LICENSED_LIMIT=100
VITE_PLAN_PREMIUM_LIMIT=500

# 启用支付方式
VITE_PAYMENT_WECHAT_ENABLED=true
VITE_PAYMENT_ALIPAY_ENABLED=true
```

### 4.2 后端配置

在 Typecho 插件设置中配置：

1. **微信支付**
   - AppID
   - MchID（商户号）
   - API Key
   - Certificates（证书）

2. **支付宝**
   - App ID
   - Private Key
   - Public Key

3. **Stripe**（国际支付）
   - Public Key
   - Secret Key

## 5. 支付平台集成

### 5.1 微信支付

推荐使用官方 SDK：
```bash
composer require wechatpay/wechatpay-guzzle-middleware
```

示例代码（在 SubscriptionTrait 中）：
```php
protected function generateWeChatPayment($orderNo, $amount)
{
    // 使用微信支付 Native Pay 生成二维码
    // 参考：https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_4_1.shtml
    
    // 返回二维码图片 URL 或 base64
    return ['qr_code' => $qrCodeUrl];
}
```

### 5.2 支付宝

推荐使用官方 SDK：
```bash
composer require alipaysdk/easysdk
```

示例代码：
```php
protected function generateAlipayPayment($orderNo, $amount)
{
    // 使用支付宝当面付生成二维码
    // 参考：https://opendocs.alipay.com/open/194
    
    return ['qr_code' => $qrCodeUrl];
}
```

### 5.3 Stripe

```bash
npm install @stripe/stripe-js
```

前端调用：
```tsx
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('your-public-key');
const { error, paymentIntent } = await stripe.confirmCardPayment(
    paymentIntentClientSecret,
    {
        payment_method: {
            card: elements.getElement(CardElement)
        }
    }
);
```

## 6. 测试清单

### 6.1 功能测试

- [ ] 试用用户默认为 trial 角色
- [ ] 试用用户作业数量限制正确（20个）
- [ ] 标准版用户可以创建 100 个作业
- [ ] 专业版用户可以创建 500 个作业
- [ ] 超过限制时显示权限提示
- [ ] 订阅后角色自动升级
- [ ] 订阅到期后自动降级到 trial

### 6.2 支付测试

- [ ] 微信支付订单创建成功
- [ ] 支付宝支付订单创建成功
- [ ] 支付成功后订阅状态更新
- [ ] 支付失败订单状态正确
- [ ] 订单历史显示正确

### 6.3 用户体验测试

- [ ] 订阅界面显示正常
- [ ] 计划选择和支付方式切换流畅
- [ ] 支付二维码加载正常
- [ ] 支付状态轮询正常
- [ ] 支付成功后自动跳转
- [ ] 订阅到期前提醒

## 7. 部署注意事项

### 7.1 数据库

- 确保数据库迁移在生产环境正确执行
- 备份现有数据库

### 7.2 SSL 证书

- 支付回调需要 HTTPS
- 确保域名已备案（国内支付）

### 7.3 安全性

- 保护支付密钥不要泄露
- 使用环境变量存储敏感信息
- 验证支付回调签名

### 7.4 监控

- 监控支付成功率
- 监控订阅续费率
- 记录支付失败原因

## 8. 维护和扩展

### 8.1 添加新计划

1. 修改 `SubscriptionTrait::getSubscriptionPlans()`
2. 更新前端 `SubscriptionModal`
3. 添加相应的权限配置

### 8.2 添加新支付方式

1. 实现 `generatePaymentData` 方法
2. 添加支付回调处理
3. 前端添加支付选项

### 8.3 促销活动

可以通过数据库字段扩展：
- 添加优惠券功能
- 添加限时折扣
- 添加年付优惠

## 9. 常见问题

### Q: 订阅到期后数据会丢失吗？
A: 不会。数据保留，但受试用版限制（如超过 20 个作业的部分将无法编辑）。

### Q: 如何处理退款？
A: 通过支付平台操作退款，然后手动调整订阅状态。

### Q: 可以使用自定义支付网关吗？
A: 可以，参考支付平台集成部分，实现 `generatePaymentData` 和回调处理即可。

### Q: 如何测试支付功能？
A: 使用支付平台的沙箱环境进行测试。

## 10. 技术支持

如有问题，请联系：
- 文档：https://github.com/your-repo/planner-web
- Issues：https://github.com/your-repo/planner-web/issues
- Email：support@planner.cn
