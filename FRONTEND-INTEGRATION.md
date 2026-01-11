# 前端整合指南

## 📋 整合清单

- [ ] 1. 修改订阅服务 API 地址
- [ ] 2. 更新环境变量
- [ ] 3. 添加订阅入口
- [ ] 4. 测试订阅功能

---

## 🎯 第一步：修改订阅服务 API 地址

### 1. 打开文件
```
services/subscriptionService.ts
```

### 2. 修改 baseUrl

**修改前：**
```typescript
export const subscriptionService = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  // 或
  baseUrl: 'https://your-domain.com/index.php/planner/api',
  // ...
};
```

**修改后：**
```typescript
export const subscriptionService = {
  baseUrl: '/planner/subscription',  // 修改为插件的 API 路由
  
  // ... 其他代码保持不变
};
```

### 3. 完整示例

```typescript
import { authService } from './authService';

export interface SubscriptionPlan {
  id: 'licensed' | 'premium';
  name: string;
  nameEn: string;
  price: number;
  duration: number;
  features: string[];
}

export interface SubscriptionInfo {
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  plan: string | null;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  days_left?: number;
}

export interface PaymentOrder {
  id: number;
  order_no: string;
  plan: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_provider: string;
  created_at: string;
}

export const subscriptionService = {
  // ✅ 修改这里
  baseUrl: '/planner/subscription',

  /**
   * 获取订阅计划列表
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await fetch(`${this.baseUrl}/plans`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to load plans');
    return await response.json();
  },

  /**
   * 获取当前用户订阅信息
   */
  async getSubscription(): Promise<SubscriptionInfo> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}/info?token=${user.token}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to load subscription');
    return await response.json();
  },

  /**
   * 创建支付订单
   */
  async createOrder(plan: 'licensed' | 'premium', paymentProvider: 'wechat' | 'alipay' | 'stripe', coupon?: string): Promise<{
    order_no: string;
    amount: number;
    payment_url?: string;
    qr_code?: string;
  }> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const body: any = { plan, payment_provider: paymentProvider };
    if (coupon) body.coupon = coupon;

    const response = await fetch(`${this.baseUrl}/create_order?token=${user.token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error('Failed to create order');
    return await response.json();
  },

  /**
   * 检查订单状态
   */
  async checkOrderStatus(orderNo: string): Promise<{ status: string }> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}/order_status?order_no=${orderNo}&token=${user.token}`);
    if (!response.ok) throw new Error('Failed to check order status');
    return await response.json();
  },

  /**
   * 取消订阅
   */
  async cancelSubscription(): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}/cancel?token=${user.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to cancel subscription');
  },

  /**
   * 续费订阅
   */
  async renewSubscription(): Promise<{ end_date: string }> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}/renew?token=${user.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to renew subscription');
    return await response.json();
  },

  /**
   * 获取订单历史
   */
  async getOrderHistory(): Promise<PaymentOrder[]> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}/orders?token=${user.token}`);
    if (!response.ok) throw new Error('Failed to load orders');
    return await response.json();
  },

  /**
   * 本地计算剩余天数
   */
  calculateDaysLeft(endDate: string | null): number {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },

  /**
   * 格式化订阅状态显示
   */
  formatSubscriptionStatus(status: string, endDate: string | null, lang: 'en' | 'zh'): string {
    if (status === 'trial') return lang === 'zh' ? '试用版' : 'Trial';
    if (status === 'active') {
      const daysLeft = this.calculateDaysLeft(endDate);
      if (daysLeft <= 0) return lang === 'zh' ? '已过期' : 'Expired';
      return lang === 'zh' ? `剩余 ${daysLeft} 天` : `${daysLeft} days left`;
    }
    if (status === 'expired') return lang === 'zh' ? '已过期' : 'Expired';
    if (status === 'cancelled') return lang === 'zh' ? '已取消' : 'Cancelled';
    return status;
  }
};
```

---

## 🎯 第二步：更新环境变量

### 1. 打开文件
```
.env
```

### 2. 修改 API 基础地址

**修改前：**
```env
VITE_API_BASE_URL=https://your-domain.com/index.php/planner/api
```

**修改后：**
```env
# 基础 API 地址（可选，如果其他 API 还在使用）
VITE_API_BASE_URL=https://your-domain.com

# 订阅功能专用地址（新增）
VITE_SUBSCRIPTION_API_URL=/planner/subscription
```

### 3. 更新 .env.example

```env
# API 基础配置
VITE_API_BASE_URL=https://your-domain.com

# 订阅功能
VITE_SUBSCRIPTION_ENABLED=true
VITE_SUBSCRIPTION_API_URL=/planner/subscription
```

---

## 🎯 第三步：添加订阅入口

### 方案 A：在账户设置中添加（推荐）

#### 1. 打开文件
```
components/AccountSettingsModal.tsx
```

#### 2. 在用户信息显示区域添加订阅状态

找到显示用户信息的位置，添加：

```tsx
import { subscriptionService } from '../services/subscriptionService';
import { useSubscription } from '../hooks/useSubscription';  // 如果有这个 hook

// 在组件中添加订阅状态显示
const { subscription, loading } = useSubscription();

// 在 JSX 中添加订阅入口
{user?.plannerRole !== 'admin' && (
  <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
    <h3 className="text-lg font-semibold flex items-center justify-between">
      订阅状态
      <button
        onClick={() => setActiveModal('subscription')}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        管理订阅 →
      </button>
    </h3>
    
    {loading ? (
      <div className="flex items-center space-x-2 text-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span>加载中...</span>
      </div>
    ) : subscription ? (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">当前计划:</span>
          <span className={`font-medium ${
            subscription.status === 'active' ? 'text-green-600' :
            subscription.status === 'expired' ? 'text-red-600' :
            'text-gray-600'
          }`}>
            {subscription.plan === 'licensed' ? '标准版' : 
             subscription.plan === 'premium' ? '专业版' :
             subscriptionService.formatSubscriptionStatus(subscription.status, subscription.end_date, 'zh')}
          </span>
        </div>
        
        {subscription.status === 'active' && subscription.end_date && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">到期时间:</span>
            <span className="font-medium">
              {new Date(subscription.end_date).toLocaleDateString('zh-CN')}
            </span>
          </div>
        )}
        
        {subscription.status === 'active' && subscriptionService.calculateDaysLeft(subscription.end_date) <= 7 && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ 订阅即将到期，请及时续费
          </div>
        )}
        
        {subscription.status === 'expired' && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            ⚠️ 订阅已过期，请立即续费
          </div>
        )}
      </div>
    ) : (
      <p className="text-gray-600">您当前使用的是试用版</p>
    )}
  </div>
)}
```

### 方案 B：在菜单栏中添加订阅按钮

#### 1. 打开文件
```
components/MenuBar.tsx
```

#### 2. 在 Help 菜单中添加订阅选项

```tsx
// 在 menus 对象中添加
Help: [
  t('About') || 'About',
  '-',
  { label: '订阅管理', action: 'open_subscription' },
  { label: '订阅定价', action: 'open_pricing' },
],

// 在 handleMenuAction 函数中处理
case 'open_subscription':
  setActiveModal('subscription');
  break;
case 'open_pricing':
  window.open('/pricing', '_blank');  // 如果有定价页面
  break;
```

### 方案 C：在工具栏添加订阅按钮

#### 1. 打开文件
```
components/Toolbar.tsx
```

#### 2. 添加订阅按钮

```tsx
// 在现有按钮旁边添加
{user?.plannerRole !== 'admin' && (
  <button
    onClick={() => setActiveModal('subscription')}
    className="toolbar-btn subscription-btn"
    title="订阅管理"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="ml-1">订阅</span>
  </button>
)}
```

---

## 🎯 第四步：添加订阅模态框

### 1. 打开文件
```
components/Modals.tsx
```

### 2. 添加 SubscriptionModal 导入

```tsx
import { SubscriptionModal } from './SubscriptionModal';
```

### 3. 在 switch (activeModal) 中添加

```tsx
switch (activeModal) {
  // ... 其他 modal
  
  case 'subscription':
    return <SubscriptionModal />;
  
  // ... 其他 modal
}
```

---

## 🎯 第五步：添加订阅提醒 Hook（可选）

### 1. 创建文件
```
hooks/useSubscription.ts
```

### 2. 添加以下代码

```tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { subscriptionService } from '../services/subscriptionService';

export const useSubscription = () => {
  const { user, setModalData, setActiveModal } = useAppStore();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);

  useEffect(() => {
    if (user && user.plannerRole !== 'admin') {
      loadSubscription();
    }
  }, [user]);

  // 每 5 分钟刷新一次订阅状态
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && user.plannerRole !== 'admin' && subscription?.status === 'active') {
        const now = Date.now();
        if (now - lastCheckTime > 5 * 60 * 1000) {
          loadSubscription();
          setLastCheckTime(now);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user, subscription, lastCheckTime]);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const data = await subscriptionService.getSubscription();
      setSubscription(data);
      
      // 检查是否需要提醒
      if (data.status === 'active' && data.end_date) {
        const daysLeft = subscriptionService.calculateDaysLeft(data.end_date);
        
        if (daysLeft > 0 && daysLeft <= 7) {
          console.log(`订阅将在 ${daysLeft} 天后到期`);
        } else if (daysLeft <= 0) {
          console.log('订阅已过期');
          // 可选：自动刷新用户数据
        }
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    subscription,
    loading,
    refreshSubscription: loadSubscription,
    daysLeft: subscription?.end_date 
      ? subscriptionService.calculateDaysLeft(subscription.end_date)
      : 0
  };
};
```

---

## 🧪 第六步：测试验证

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 测试订阅信息显示

1. 登录系统
2. 打开账户设置
3. 检查订阅状态是否正确显示

### 3. 测试订阅管理界面

1. 点击"管理订阅"按钮
2. 检查订阅计划是否正确显示
3. 检查支付方式是否可选

### 4. 测试订阅升级（使用手动方式）

```sql
-- 在数据库中手动升级用户
UPDATE typecho_users 
SET subscription_status = 'active',
    subscription_plan = 'premium',
    subscription_start = NOW(),
    subscription_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
WHERE uid = 你的用户ID;

-- 更新权限
UPDATE typecho_planner_usermeta
SET meta_value = 'premium'
WHERE uid = 你的用户ID AND meta_key = 'planner_role';
```

5. 在前端刷新页面，检查：
   - 订阅状态是否更新为"专业版"
   - 到期时间是否正确显示
   - 权限是否生效（如作业数量限制）

### 5. 测试 API 调用

打开浏览器开发者工具（F12），检查网络请求：

```
GET /planner/subscription/info?token=xxx
GET /planner/subscription/plans
```

应该返回正确的 JSON 数据。

---

## ✅ 完成检查清单

- [ ] `subscriptionService.ts` 中的 baseUrl 已修改为 `/planner/subscription`
- [ ] `.env` 文件已更新
- [ ] 订阅入口已添加（账户设置/菜单/工具栏）
- [ ] `Modals.tsx` 中已添加 `SubscriptionModal`
- [ ] 订阅状态显示正确
- [ ] 订阅管理界面可以打开
- [ ] API 调用正常
- [ ] 订阅升级后状态正确更新

---

## 🔧 故障排除

### 问题 1：API 调用返回 404

**检查：**
1. 插件是否已启用
2. API 地址是否正确（`/planner/subscription`）
3. 浏览器控制台是否有错误

**解决方案：**
- 确保插件在 Typecho 后台已启用
- 检查前端和后端是否在同一域名
- 如果跨域，检查 CORS 配置

### 问题 2：订阅状态不显示

**检查：**
1. 用户是否已登录
2. token 是否正确
3. API 是否返回数据

**解决方案：**
- 打开浏览器控制台查看错误
- 检查网络请求是否成功
- 手动调用 API 测试

### 问题 3：订阅入口不显示

**检查：**
1. 代码是否正确添加
2. 用户角色是否为 admin
3. 组件是否正确导入

**解决方案：**
- 检查 `activeModal` 状态
- 确认 `setActiveModal('subscription')` 被正确调用
- 检查 SubscriptionModal 是否正确导入

### 问题 4：订阅升级后状态不更新

**检查：**
1. 数据库是否正确更新
2. 是否需要刷新用户信息
3. 是否需要重新登录

**解决方案：**
- 调用 `authService.refreshUser()` 刷新用户信息
- 重新登录
- 检查 `planner_usermeta` 表是否正确更新

---

## 📚 相关文档

- [插件快速开始](../typecho-plugin/PlannerSubscription/QUICKSTART.md)
- [插件使用指南](../typecho-plugin/PlannerSubscription/USAGE-GUIDE.md)
- [插件详细文档](../typecho-plugin/PlannerSubscription/README.md)

---

**版本**: v1.0.0  
**最后更新**: 2024-01-10
