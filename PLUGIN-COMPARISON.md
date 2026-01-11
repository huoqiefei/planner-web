# 付费订阅功能 - 方案对比与选择

## 📊 方案对比

| 特性 | 方案 1：手动集成 | 方案 2：独立插件 |
|------|-----------------|-----------------|
| **部署复杂度** | 高（需修改代码） | 低（上传即用） |
| **修改现有代码** | 是 | 否 |
| **数据库迁移** | 手动执行 SQL | 自动创建 |
| **路由注册** | 手动修改 | 自动注册 |
| **管理界面** | 需要自己开发 | 内置完整后台 |
| **可维护性** | 依赖原项目更新 | 独立维护 |
| **更新难度** | 需要重新集成 | 替换插件文件 |
| **可禁用性** | 困难 | 一键禁用 |
| **扩展性** | 受限于原项目 | 完全独立 |

---

## 🎯 推荐方案：独立插件（PlannerSubscription）

### 核心优势

1. **零侵入** - 完全不影响现有代码
2. **易部署** - 上传即用，3分钟完成
3. **易维护** - 独立更新，不依赖原项目
4. **完整后台** - 可视化管理，数据统计
5. **灵活配置** - 插件设置 + 后台配置
6. **随时禁用** - 一键禁用，无残留

---

## 📦 插件文件清单

```
typecho-plugin/PlannerSubscription/
├── Plugin.php                    # 插件主文件
├── Action.php                     # API 处理
├── panel.php                      # 后台管理界面
├── README.md                      # 详细文档
├── QUICKSTART.md                  # 快速开始
├── USAGE-GUIDE.md                 # 使用指南
└── Traits/
    ├── SubscriptionTrait.php      # 订阅逻辑
    ├── PaymentTrait.php           # 支付逻辑
    └── CouponTrait.php            # 优惠券逻辑
```

---

## 🚀 3步部署

### 1. 上传插件
```bash
cp -r typecho-plugin/PlannerSubscription /path/to/typecho/usr/plugins/
```

### 2. 启用插件
在 Typecho 后台启用插件

### 3. 配置插件
填写订阅价格、权限限制等

---

## 🔌 前端集成（仅需修改 API 地址）

### services/subscriptionService.ts
```typescript
export const subscriptionService = {
  baseUrl: '/planner/subscription',  // 改为插件的 API 路由
  // ... 其他代码完全无需修改
};
```

### .env
```env
VITE_API_BASE_URL=/planner/subscription
```

---

## 📋 API 接口（自动注册）

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

## 🎨 管理后台

访问路径：**控制台** → **订阅管理**

功能包括：
- 📊 数据统计
- 📋 订阅管理
- 💰 订单管理
- 🎟️ 优惠券管理
- 💳 支付配置

---

## 💾 数据库表（自动创建）

| 表名 | 说明 |
|------|------|
| `planner_subscriptions` | 订阅记录 |
| `planner_payment_orders` | 支付订单 |
| `planner_payment_config` | 支付配置 |
| `planner_coupons` | 优惠券 |

同时为 `users` 表添加订阅字段。

---

## 🔧 配置说明

### 插件设置（基础配置）
- 是否启用订阅
- 标准版价格
- 专业版价格
- 各计划作业限制
- 到期提醒天数
- 支付方式开关
- CORS 配置

### 后台配置（高级配置）
- 微信支付密钥
- 支付宝密钥
- Stripe 密钥
- 优惠券管理

---

## 🧪 快速测试（无需支付）

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

然后在前端刷新用户信息，检查权限。

---

## ✅ 功能清单

- ✅ 订阅创建、更新、取消、续费
- ✅ 订阅过期自动降级
- ✅ 多支付平台支持（微信、支付宝、Stripe）
- ✅ 支付回调处理
- ✅ 订单管理和查询
- ✅ 优惠券系统
- ✅ 完整后台管理
- ✅ 数据统计
- ✅ 权限系统集成

---

## 📚 文档索引

| 文档 | 说明 |
|------|------|
| `README.md` | 插件详细说明 |
| `QUICKSTART.md` | 3分钟快速开始 |
| `USAGE-GUIDE.md` | 完整使用指南 |

---

## ❓ 常见问题

### Q: 为什么推荐使用独立插件？
A: 独立插件不修改现有代码，易于部署和维护，可随时禁用。

### Q: 插件是否需要修改前端代码？
A: 只需修改 API 地址，其他代码无需改动。

### Q: 插件启用失败怎么办？
A: 检查 PHP 版本（>= 7.4）和数据库权限。

### Q: 如何测试订阅功能？
A: 可以手动在数据库中创建订阅，或使用支付平台的沙箱环境。

### Q: 支付回调地址是什么？
A: `/planner/payment/callback/:provider`（如 `/planner/payment/callback/wechat`）

---

## 🎉 总结

### 独立插件的优势

1. **极简部署** - 3步即可上线
2. **零侵入** - 不修改现有代码
3. **完整功能** - 订阅、支付、管理、统计
4. **易于维护** - 独立更新
5. **可扩展** - 支持自定义订阅计划

### 推荐使用场景

- ✅ 快速上线订阅功能
- ✅ 不想修改现有代码
- ✅ 需要独立维护订阅系统
- ✅ 需要可视化管理后台
- ✅ 需要随时禁用订阅功能

---

**版本**: v1.0.0  
**最后更新**: 2024-01-10
