# PlannerSubscription 独立订阅管理插件 - 快速开始

## 🚀 3分钟快速部署

### 第一步：上传插件

```bash
# 上传整个 PlannerSubscription 文件夹到 Typecho 插件目录
路径: /path/to/typecho/usr/plugins/PlannerSubscription/
```

**目录结构：**
```
PlannerSubscription/
├── Plugin.php              # 插件主文件
├── Action.php               # API 处理
├── panel.php                # 后台管理界面
├── README.md                # 详细文档
└── Traits/
    ├── SubscriptionTrait.php  # 订阅逻辑
    ├── PaymentTrait.php       # 支付逻辑
    └── CouponTrait.php        # 优惠券逻辑
```

### 第二步：启用插件

1. 登录 Typecho 后台
2. 进入 **控制台** → **插件**
3. 找到 **PlannerSubscription**
4. 点击 **启用**
5. ✅ 数据库表自动创建（无需手动执行 SQL）

### 第三步：配置插件

点击插件设置，填写以下信息：

| 配置项 | 推荐值 |
|--------|--------|
| 启用订阅功能 | 启用 |
| 标准版价格 | 99 |
| 专业版价格 | 199 |
| 试用版作业限制 | 20 |
| 标准版作业限制 | 100 |
| 专业版作业限制 | 500 |
| CORS 允许的源 | *（或填你的前端域名） |

### 第四步：配置支付方式（可选）

1. 在 Typecho 后台点击左侧 **订阅管理**
2. 选择 **支付配置** 标签
3. 填写支付平台密钥

#### 微信支付
- AppID（应用ID）
- MchID（商户号）
- API Key（API密钥）

#### 支付宝
- App ID
- Private Key（应用私钥）
- Public Key（支付宝公钥）

#### Stripe（国际支付）
- Public Key
- Secret Key
- Webhook Secret

**注意：** 如果暂时不配置支付，可以使用沙箱环境测试，或者手动在数据库中更新用户订阅状态。

### 第五步：前端集成

**修改 API 地址：**

```typescript
// services/subscriptionService.ts
export const subscriptionService = {
  baseUrl: '/planner/subscription',  // 改为插件的 API 路由
  // ... 其他代码无需修改
};
```

**更新环境变量：**
```env
# .env
VITE_API_BASE_URL=/planner/subscription
```

**前端代码无需任何修改！** 插件提供了完全兼容的 API 接口。

---

## ✅ 完成检查清单

- [ ] 插件文件已上传
- [ ] 插件已启用
- [ ] 数据库表已自动创建（planner_subscriptions, planner_payment_orders 等）
- [ ] 插件配置已保存
- [ ] 前端 API 地址已更新
- [ ] 测试登录用户能看到订阅状态

---

## 🎯 API 接口（自动注册）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/planner/subscription/info` | GET | 获取订阅信息 |
| `/planner/subscription/plans` | GET | 获取订阅计划 |
| `/planner/subscription/create_order` | POST | 创建支付订单 |
| `/planner/subscription/order_status` | GET | 查询订单状态 |
| `/planner/subscription/cancel` | POST | 取消订阅 |
| `/planner/subscription/renew` | POST | 续费订阅 |
| `/planner/subscription/orders` | GET | 订单历史 |
| `/planner/payment/callback/:provider` | POST | 支付回调 |

---

## 🔧 管理功能

### 后台管理界面

访问：**控制台** → **订阅管理**

功能包括：
- 📊 数据统计（活跃订阅、本月收入、总收入）
- 📋 订阅列表（查看、编辑订阅）
- 💰 订单列表（查看所有支付订单）
- 🎟️ 优惠券管理（创建、删除优惠券）
- 💳 支付配置（配置微信支付、支付宝、Stripe）

---

## 🧪 测试建议

### 1. 快速测试（无需支付）

直接在数据库中手动创建订阅：

```sql
-- 将用户 ID 为 1 的用户升级到 Premium，有效期 30 天
UPDATE typecho_users 
SET subscription_status = 'active',
    subscription_plan = 'premium',
    subscription_start = NOW(),
    subscription_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
WHERE uid = 1;

-- 更新权限
UPDATE typecho_planner_usermeta
SET meta_value = 'premium'
WHERE uid = 1 AND meta_key = 'planner_role';
```

然后在前端刷新用户信息，检查是否获得 Premium 权限。

### 2. 测试支付功能

使用支付平台的沙箱环境：
- **微信支付沙箱**: https://pay.weixin.qq.com/wiki/doc/apiv3/practices/chapter1_1.shtml
- **支付宝沙箱**: https://opendocs.alipay.com/open/01y2kq
- **Stripe 测试**: https://stripe.com/docs/testing

---

## ❓ 常见问题

### Q: 插件启用失败？
A: 检查 PHP 版本（需要 >= 7.4）和数据库权限。

### Q: 数据库表没有创建？
A: 插件会自动创建，如果没有，检查数据库用户是否有 CREATE TABLE 权限。

### Q: 前端调用 API 报 404？
A: 检查：
1. 插件是否已启用
2. API 地址是否正确（`/planner/subscription`）
3. CORS 是否配置正确

### Q: 如何手动降级用户？
A: 直接修改用户表：
```sql
UPDATE typecho_users 
SET subscription_status = 'expired',
    subscription_plan = NULL
WHERE uid = 用户ID;
```

### Q: 支付回调失败？
A: 检查：
1. 回调地址是否正确（`/planner/payment/callback/:provider`）
2. 是否使用 HTTPS（微信/支付宝要求）
3. 支付平台配置的回调地址是否一致

---

## 📞 技术支持

- 📧 Email: support@planner.cn
- 🐛 Issues: GitHub Issues
- 📖 详细文档: `README.md`

---

## 🎉 完成！

现在你的 Planner Web 已经拥有完整的付费订阅功能！

用户可以：
- 查看订阅状态
- 选择订阅计划
- 在线支付
- 管理订阅
- 查看订单历史

管理员可以：
- 查看统计数据
- 管理所有订阅
- 配置支付方式
- 创建优惠券
- 查看订单记录

---

**版本**: v1.0.0  
**最后更新**: 2024-01-10
