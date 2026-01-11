# 快速前端整合 - 5分钟完成

## 🚀 方式一：最小整合（推荐，仅需 2 步）

### 步骤 1：修改 API 地址

打开 `services/subscriptionService.ts`，找到 `baseUrl`：

```typescript
export const subscriptionService = {
  // ✅ 改成这个
  baseUrl: '/planner/subscription',
  
  // ... 其他代码不变
};
```

### 步骤 2：添加订阅入口

打开 `components/AccountSettingsModal.tsx`，在用户信息区域添加：

```tsx
// 在文件开头添加导入
import { subscriptionService } from '../services/subscriptionService';

// 在显示用户信息的地方添加
{user?.plannerRole !== 'admin' && (
  <div className="p-4 bg-gray-50 rounded-lg mb-4">
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-semibold">订阅管理</h3>
      <button
        onClick={() => setActiveModal('subscription')}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        管理 →
      </button>
    </div>
    <p className="text-sm text-gray-600">
      当前级别: {user.plannerRole === 'trial' ? '试用版' : 
                user.plannerRole === 'licensed' ? '标准版' : '专业版'}
    </p>
  </div>
)}
```

### 完成！✅

---

## 🎨 方式二：完整整合（推荐用于生产）

### 步骤 1：修改订阅服务

同上，修改 `services/subscriptionService.ts` 的 `baseUrl`。

### 步骤 2：添加订阅状态显示

在 `components/AccountSettingsModal.tsx` 中添加完整的订阅状态：

```tsx
import { useState, useEffect } from 'react';
import { subscriptionService } from '../services/subscriptionService';

// 在组件中添加
const [subscription, setSubscription] = useState<any>(null);
const [loadingSub, setLoadingSub] = useState(false);

useEffect(() => {
  if (user && user.plannerRole !== 'admin') {
    loadSubscription();
  }
}, [user]);

const loadSubscription = async () => {
  try {
    setLoadingSub(true);
    const data = await subscriptionService.getSubscription();
    setSubscription(data);
  } catch (error) {
    console.error('Failed to load subscription:', error);
  } finally {
    setLoadingSub(false);
  }
};

// 在 JSX 中添加
{user?.plannerRole !== 'admin' && (
  <div className="p-4 bg-gray-50 rounded-lg mb-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-lg">订阅状态</h3>
      <button
        onClick={() => setActiveModal('subscription')}
        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
      >
        管理订阅
      </button>
    </div>
    
    {loadingSub ? (
      <div className="flex items-center space-x-2 text-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span>加载中...</span>
      </div>
    ) : subscription ? (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">当前计划:</span>
          <span className={`font-semibold ${
            subscription.status === 'active' ? 'text-green-600' :
            subscription.status === 'expired' ? 'text-red-600' :
            'text-gray-600'
          }`}>
            {subscription.plan === 'licensed' ? '标准版' : 
             subscription.plan === 'premium' ? '专业版' :
             subscription.status === 'trial' ? '试用版' :
             subscription.status}
          </span>
        </div>
        
        {subscription.status === 'active' && subscription.end_date && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">到期时间:</span>
              <span className="font-medium">
                {new Date(subscription.end_date).toLocaleDateString('zh-CN')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">剩余天数:</span>
              <span className="font-medium">
                {subscriptionService.calculateDaysLeft(subscription.end_date)} 天
              </span>
            </div>
          </>
        )}
        
        {subscription.status === 'expired' && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            ⚠️ 订阅已过期，请立即续费
          </div>
        )}
        
        {subscription.status === 'active' && subscriptionService.calculateDaysLeft(subscription.end_date) <= 7 && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ 订阅将在 {subscriptionService.calculateDaysLeft(subscription.end_date)} 天后到期
          </div>
        )}
      </div>
    ) : (
      <p className="text-gray-600">加载失败，请刷新页面</p>
    )}
  </div>
)}
```

### 步骤 3：添加订阅模态框

打开 `components/Modals.tsx`：

```tsx
// 在文件开头添加
import { SubscriptionModal } from './SubscriptionModal';

// 在 switch (activeModal) 中添加
case 'subscription':
  return <SubscriptionModal />;
```

### 步骤 4：添加菜单入口（可选）

打开 `components/MenuBar.tsx`：

```tsx
// 在 Help 菜单中添加
Help: [
  t('About') || 'About',
  '-',
  { label: '订阅管理', action: 'open_subscription' },
],

// 在 handleMenuAction 中添加
case 'open_subscription':
  setActiveModal('subscription');
  break;
```

### 完成！✅

---

## 🧪 测试

### 1. 测试订阅显示

1. 启动应用：`npm run dev`
2. 登录系统
3. 打开账户设置
4. 检查订阅状态是否显示

### 2. 测试订阅升级

```sql
-- 手动升级到 Premium
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

刷新页面，检查状态是否更新为"专业版"。

### 3. 测试订阅管理

1. 点击"管理订阅"按钮
2. 检查订阅界面是否正常打开
3. 检查订阅计划是否显示

---

## 📋 文件修改清单

### 最小整合（2 个文件）

- ✅ `services/subscriptionService.ts` - 修改 baseUrl
- ✅ `components/AccountSettingsModal.tsx` - 添加订阅入口

### 完整整合（4 个文件）

- ✅ `services/subscriptionService.ts` - 修改 baseUrl
- ✅ `components/AccountSettingsModal.tsx` - 添加完整订阅状态
- ✅ `components/Modals.tsx` - 添加订阅模态框
- ✅ `components/MenuBar.tsx` - 添加菜单入口（可选）

---

## ❓ 常见问题

### Q: API 调用返回 404？
A: 
1. 检查插件是否已启用
2. 检查 API 地址是否为 `/planner/subscription`
3. 检查是否在同一域名下

### Q: 订阅状态不显示？
A:
1. 检查用户是否已登录
2. 打开浏览器控制台查看错误
3. 检查网络请求是否成功

### Q: 订阅升级后状态不更新？
A:
1. 刷新页面
2. 重新登录
3. 检查数据库是否正确更新

### Q: 点击"管理订阅"没反应？
A:
1. 检查 `Modals.tsx` 中是否添加了 `SubscriptionModal`
2. 检查 `setActiveModal('subscription')` 是否正确调用
3. 打开控制台查看错误

---

## ✅ 完成检查

- [ ] `subscriptionService.ts` 中的 baseUrl 已修改
- [ ] 订阅入口已添加到账户设置
- [ ] 订阅模态框已添加到 Modals.tsx
- [ ] 订阅状态正常显示
- [ ] 订阅管理界面可以打开
- [ ] API 调用正常

---

## 📚 相关文档

- [详细前端整合指南](./FRONTEND-INTEGRATION.md)
- [插件快速开始](../typecho-plugin/PlannerSubscription/QUICKSTART.md)
- [插件使用指南](../typecho-plugin/PlannerSubscription/USAGE-GUIDE.md)

---

**完成时间**: 5 分钟  
**难度**: ⭐⭐☆☆☆  
**推荐方式**: 最小整合
