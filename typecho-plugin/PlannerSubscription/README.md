# PlannerSubscription 独立订阅管理插件

## 快速部署指南

### 1. 上传插件文件

将 `PlannerSubscription` 文件夹上传到 Typecho 的插件目录：

```bash
# 方法 1：FTP/SFTP 上传
上传到: /usr/plugins/PlannerSubscription/

# 方法 2：命令行复制
cp -r typecho-plugin/PlannerSubscription /path/to/typecho/usr/plugins/
```

### 2. 在 Typecho 后台启用插件

1. 登录 Typecho 后台
2. 进入 **控制台** → **插件**
3. 找到 **PlannerSubscription** 插件
4. 点击 **启用**

### 3. 配置插件

点击插件设置，配置以下参数：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 启用订阅功能 | 是否开启付费订阅 | 启用 |
| 标准版价格（元/月） | Licensed 版本价格 | 99 |
| 专业版价格（元/月） | Premium 版本价格 | 199 |
| 试用版作业数量限制 | Trial 用户最多作业数 | 20 |
| 标准版作业数量限制 | Licensed 用户最多作业数 | 100 |
| 专业版作业数量限制 | Premium 用户最多作业数 | 500 |
| 到期提醒天数 | 订阅到期前提醒天数 | 7 |
| 启用微信支付 | 是否启用微信支付 | 启用 |
| 启用支付宝 | 是否启用支付宝 | 启用 |
| CORS 允许的源 | API 跨域设置 | * |

### 4. 配置支付方式

进入 **控制台** → **订阅管理后台**，配置支付方式：

#### 微信支付
- AppID（应用ID）
- MchID（商户号）
- API Key（API密钥）
- 证书序列号

#### 支付宝
- App ID
- Private Key（应用私钥）
- Public Key（支付宝公钥）

#### Stripe（国际支付）
- Public Key
- Secret Key
- Webhook Secret

### 5. 数据库说明

插件会自动创建以下表：

| 表名 | 说明 |
|------|------|
| `planner_subscriptions` | 订阅记录表 |
| `planner_payment_orders` | 支付订单表 |
| `planner_payment_config` | 支付配置表 |
| `planner_coupons` | 优惠券表 |

### 6. API 端点

插件会自动注册以下路由：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/planner/subscription/info` | GET | 获取订阅信息 |
| `/planner/subscription/plans` | GET | 获取订阅计划 |
| `/planner/subscription/create_order` | POST | 创建支付订单 |
| `/planner/subscription/order_status` | GET | 查询订单状态 |
| `/planner/subscription/cancel` | POST | 取消订阅 |
| `/planner/subscription/renew` | POST | 续费订阅 |
| `/planner/subscription/orders` | GET | 订单历史 |
| `/planner/payment/callback/:provider` | POST | 支付回调 |

## 前端集成

### 1. 更新订阅服务 API 地址

修改 `services/subscriptionService.ts` 中的 baseUrl：

```typescript
export const subscriptionService = {
  baseUrl: '/planner/subscription',  // 修改为插件的 API 路由
  
  // ... 其他代码保持不变
};
```

### 2. 配置环境变量

更新 `.env` 文件：

```env
VITE_API_BASE_URL=/planner/subscription
VITE_SUBSCRIPTION_ENABLED=true
```

### 3. 前端代码无需修改

订阅管理界面（`SubscriptionModal.tsx`）和服务层（`subscriptionService.ts`）**无需修改**，插件提供了完全兼容的 API 接口。

## 功能特性

### 1. 订阅管理
- ✅ 自动创建/更新订阅
- ✅ 订阅过期自动降级
- ✅ 支持取消订阅
- ✅ 支持手动续费

### 2. 支付管理
- ✅ 支持微信支付
- ✅ 支持支付宝
- ✅ 支持 Stripe（国际）
- ✅ 支付回调处理
- ✅ 订单状态追踪

### 3. 优惠券系统
- ✅ 创建优惠券
- ✅ 百分比折扣
- ✅ 固定金额折扣
- ✅ 优惠券有效期
- ✅ 使用次数限制

### 4. 后台管理
- ✅ 订阅列表
- ✅ 订单列表
- ✅ 收入统计
- ✅ 支付配置
- ✅ 优惠券管理

## 权限系统

插件会自动与 PlannerAuth 的权限系统集成：

| 角色 | 作业限制 | 说明 |
|------|---------|------|
| trial | 20 | 试用版，自动降级 |
| licensed | 100 | 标准版，付费订阅 |
| premium | 500 | 专业版，付费订阅 |
| admin | 无限 | 管理员 |

## 测试

### 1. 测试支付功能

使用支付平台的**沙箱环境**进行测试：

#### 微信支付沙箱
- 文档：https://pay.weixin.qq.com/wiki/doc/apiv3/practices/chapter1_1.shtml

#### 支付宝沙箱
- 文档：https://opendocs.alipay.com/open/01y2kq

#### Stripe 测试模式
- 文档：https://stripe.com/docs/testing

### 2. 测试自动降级

1. 创建一个订阅并设置较短的有效期（如 1 分钟）
2. 等待过期
3. 检查用户是否自动降级到 trial
4. 检查权限是否正确限制

## 常见问题

### Q1: 插件启用后数据库表没有创建？
A: 检查数据库用户权限，确保有 CREATE TABLE 权限。

### Q2: 支付回调失败？
A: 
- 检查回调地址是否正确
- 确保域名已配置 HTTPS（微信支付/支付宝要求）
- 检查支付平台配置的回调地址

### Q3: CORS 跨域错误？
A: 
- 在插件设置中配置 CORS 允许的源
- 或者将前端部署到同一域名下

### Q4: 订阅到期后没有自动降级？
A: 需要设置定时任务检查过期订阅：

```bash
# 添加 crontab 任务
0 * * * * curl http://your-domain.com/planner/subscription/check_expired
```

### Q5: 如何手动更新用户订阅？
A: 可以直接在 Typecho 后台的 **订阅管理** 面板中操作，或直接修改数据库：

```sql
-- 将用户 ID 为 1 的用户升级到 Premium
UPDATE typecho_users 
SET subscription_status = 'active',
    subscription_plan = 'premium',
    subscription_start = NOW(),
    subscription_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
WHERE uid = 1;

-- 更新 planner_usermeta
UPDATE typecho_planner_usermeta
SET meta_value = 'premium'
WHERE uid = 1 AND meta_key = 'planner_role';
```

## 技术支持

- Issues: https://github.com/your-repo/planner-subscription/issues
- Email: support@planner.cn

## 版本历史

### v1.0.0 (2024-01-10)
- ✨ 初始版本发布
- ✅ 完整的订阅管理功能
- ✅ 支持微信支付、支付宝、Stripe
- ✅ 后台管理界面
- ✅ 优惠券系统

## 许可证

MIT License
