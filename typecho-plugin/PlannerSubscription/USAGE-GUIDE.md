# 独立订阅管理插件 - 使用指南

## 📦 插件结构

```
typecho-plugin/PlannerSubscription/
├── Plugin.php                    # 插件主文件（自动创建数据库表、注册路由）
├── Action.php                     # API 处理类
├── panel.php                      # 后台管理界面
├── README.md                      # 详细文档
├── QUICKSTART.md                  # 快速开始指南
└── Traits/
    ├── SubscriptionTrait.php      # 订阅管理逻辑
    ├── PaymentTrait.php           # 支付处理逻辑
    └── CouponTrait.php            # 优惠券管理逻辑
```

---

## 🎯 相比之前方案的优势

### ❌ 之前方案（需要手动修改现有代码）
- 需要修改 `Action.php` 添加路由
- 需要修改 `Plugin.php` 注册路由
- 需要修改前端 `Modals.tsx` 添加订阅入口
- 需要手动执行数据库迁移 SQL
- 需要手动配置后端 API

### ✅ 新方案（独立插件，零修改）
- ✅ 插件自动创建数据库表
- ✅ 插件自动注册路由
- ✅ 插件提供完整的管理后台
- ✅ 前端只需修改 API 地址
- ✅ 完全独立，不影响现有代码
- ✅ 支持随时禁用
- ✅ 更新方便，只需替换插件文件

---

## 🚀 部署步骤（仅需 3 步）

### 1. 上传插件

```bash
cp -r typecho-plugin/PlannerSubscription /path/to/typecho/usr/plugins/
```

### 2. 启用插件

在 Typecho 后台启用插件

### 3. 配置插件

填写订阅价格、权限限制等配置

---

## 📋 数据库表（自动创建）

| 表名 | 说明 |
|------|------|
| `planner_subscriptions` | 订阅记录表（用户订阅历史） |
| `planner_payment_orders` | 支付订单表（所有订单记录） |
| `planner_payment_config` | 支付配置表（支付平台密钥） |
| `planner_coupons` | 优惠券表（优惠活动） |

**同时会给 users 表添加字段：**
- `subscription_status` - 订阅状态
- `subscription_plan` - 订阅计划
- `subscription_start` - 开始时间
- `subscription_end` - 结束时间
- `subscription_auto_renew` - 是否自动续费

---

## 🔌 API 接口（自动注册）

插件启用后自动注册以下路由：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/planner/subscription/info` | GET | 获取用户订阅信息 |
| `/planner/subscription/plans` | GET | 获取订阅计划列表 |
| `/planner/subscription/create_order` | POST | 创建支付订单 |
| `/planner/subscription/order_status` | GET | 查询订单状态 |
| `/planner/subscription/cancel` | POST | 取消订阅 |
| `/planner/subscription/renew` | POST | 续费订阅 |
| `/planner/subscription/orders` | GET | 获取订单历史 |
| `/planner/payment/callback/wechat` | POST | 微信支付回调 |
| `/planner/payment/callback/alipay` | POST | 支付宝回调 |
| `/planner/payment/callback/stripe` | POST | Stripe 回调 |

---

## 🎨 前端集成

### 修改 API 地址

```typescript
// services/subscriptionService.ts
export const subscriptionService = {
  baseUrl: '/planner/subscription',  // 改为插件的 API 路由
  
  // ... 其他代码完全无需修改
};
```

### 更新环境变量

```env
VITE_API_BASE_URL=/planner/subscription
```

### 完成！

前端组件（`SubscriptionModal.tsx`）和服务（`subscriptionService.ts`）**完全无需修改**。

---

## 🛠️ 后台管理

访问路径：**控制台** → **订阅管理**

### 功能模块

#### 1. 概览
- 活跃订阅数
- 本月收入
- 总收入
- 最近订单列表

#### 2. 订阅列表
- 查看所有订阅
- 编辑订阅详情
- 查看订阅历史

#### 3. 订单列表
- 查看所有订单
- 按状态筛选
- 查看订单详情

#### 4. 优惠券管理
- 创建优惠券
- 设置折扣类型（百分比/固定金额）
- 设置有效期
- 设置使用次数限制

#### 5. 支付配置
- 配置微信支付（AppID、MchID、API Key）
- 配置支付宝（App ID、Private Key、Public Key）
- 配置 Stripe（Public Key、Secret Key、Webhook Secret）

---

## 🧪 测试方法

### 方法 1：手动创建订阅（无需支付）

```sql
-- 升级用户到 Premium，有效期 30 天
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

### 方法 2：使用沙箱测试

**微信支付沙箱：**
- 文档：https://pay.weixin.qq.com/wiki/doc/apiv3/practices/chapter1_1.shtml
- 使用沙箱 AppID 和 MchID 测试

**支付宝沙箱：**
- 文档：https://opendocs.alipay.com/open/01y2kq
- 使用沙箱 App ID 测试

**Stripe 测试：**
- 文档：https://stripe.com/docs/testing
- 使用测试卡号测试

---

## 🔒 权限系统

插件自动与 PlannerAuth 的权限系统集成：

| 角色 | 订阅状态 | 作业限制 | 说明 |
|------|---------|---------|------|
| trial | 无订阅/已过期 | 20 | 试用版，免费 |
| licensed | active | 100 | 标准版，¥99/月 |
| premium | active | 500 | 专业版，¥199/月 |
| admin | - | 无限 | 管理员 |

---

## 📊 数据统计

后台提供实时统计：

- **活跃订阅**：当前有效的订阅数量
- **本月收入**：本月已完成的订单金额
- **总收入**：所有已完成订单的总金额

---

## 🎁 优惠券系统

支持创建两种类型的优惠券：

### 1. 百分比折扣
- 例如：9折优惠
- 适用于高价值套餐

### 2. 固定金额折扣
- 例如：立减 20 元
- 适用于新用户推广

### 优惠券属性
- 代码：唯一标识符（如 `NEWUSER2024`）
- 适用计划：可选，默认适用于所有计划
- 有效期：可设置开始和结束时间
- 使用次数限制：可设置最大使用次数

---

## 🔄 自动降级

当订阅到期时，系统会自动：

1. 将用户订阅状态设置为 `expired`
2. 将用户 `plannerRole` 降级到 `trial`
3. 限制用户访问高级功能

**自动降级触发时机：**
- 用户登录时（每次 API 请求都会检查）
- 手动调用检查接口时
- 定时任务检查（可选）

---

## ⚙️ 高级配置

### 启用定时检查过期订阅

```bash
# 添加到 crontab
0 * * * * curl http://your-domain.com/planner/subscription/check_expired
```

### 自定义订阅计划

修改插件配置文件中的 `getSubscriptionPlans()` 方法：

```php
protected function getSubscriptionPlans()
{
    return [
        'licensed' => [
            'id' => 'licensed',
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
            'id' => 'premium',
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
```

---

## ❓ 常见问题

### Q: 如何禁用订阅功能？
A: 在插件设置中选择"禁用"，或者直接禁用插件。

### Q: 如何手动调整用户订阅？
A: 可以在后台管理界面操作，或直接修改数据库。

### Q: 支付回调失败怎么办？
A: 
1. 检查回调地址是否正确
2. 检查是否使用 HTTPS
3. 查看支付平台配置
4. 查看服务器日志

### Q: 如何导出订单数据？
A: 可以在后台手动导出，或直接从数据库导出：

```sql
SELECT * FROM typecho_planner_payment_orders 
WHERE status = 'paid' 
ORDER BY created_at DESC;
```

### Q: 支持哪些支付方式？
A: 目前支持：
- 微信支付（Native Pay）
- 支付宝（当面付）
- Stripe（国际支付）

可扩展支持其他支付方式。

---

## 📞 技术支持

- 📧 Email: support@planner.cn
- 🐛 Issues: GitHub Issues
- 📖 文档: README.md

---

## ✨ 总结

这个独立插件提供了：

1. **零修改部署** - 不需要修改任何现有代码
2. **自动数据库迁移** - 插件启用时自动创建表
3. **完整的管理后台** - 可视化配置和管理
4. **多支付平台支持** - 微信、支付宝、Stripe
5. **优惠券系统** - 促销活动支持
6. **自动降级** - 订阅到期自动处理
7. **数据统计** - 实时收入和订阅统计

**部署仅需 3 步，前端只需修改 API 地址！**

---

**版本**: v1.0.0  
**最后更新**: 2024-01-10
