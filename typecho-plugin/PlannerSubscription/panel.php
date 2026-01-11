<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

include 'common.php';
include 'header.php';

$plugin = Typecho_Widget::widget('PlannerSubscription_Plugin');
$db = Typecho_Db::get();
$prefix = $db->getPrefix();

// 获取统计数据
$activeSubscriptions = $db->fetchObject($db->select(['COUNT(*)' => 'count'])
    ->from($prefix . 'planner_subscriptions')
    ->where('status = ?', 'active'))->count;

$totalRevenue = $db->fetchObject($db->select(['SUM(amount)' => 'total'])
    ->from($prefix . 'planner_payment_orders')
    ->where('status = ?', 'paid'))->total ?? 0;

$monthlyRevenue = $db->fetchObject($db->select(['SUM(amount)' => 'total'])
    ->from($prefix . 'planner_payment_orders')
    ->where('status = ? AND created_at >= ?', 'paid', date('Y-m-01')))->total ?? 0;

$page = $this->request->get('page', 1);
$tab = $this->request->get('tab', 'dashboard');
?>

<style>
    .planner-subscription-container { padding: 20px; }
    .planner-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
    .planner-stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .planner-stat-card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
    .planner-stat-card .value { font-size: 32px; font-weight: bold; color: #333; }
    .planner-tabs { display: flex; border-bottom: 2px solid #e0e0e0; margin-bottom: 20px; }
    .planner-tab { padding: 10px 20px; cursor: pointer; color: #666; }
    .planner-tab.active { color: #1976d2; border-bottom: 2px solid #1976d2; margin-bottom: -2px; }
    .planner-tab:hover { color: #1976d2; }
    .planner-table { width: 100%; border-collapse: collapse; }
    .planner-table th, .planner-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    .planner-table th { background: #f5f5f5; font-weight: 600; }
    .planner-btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
    .planner-btn-primary { background: #1976d2; color: white; }
    .planner-btn-danger { background: #d32f2f; color: white; }
    .planner-btn-success { background: #388e3c; color: white; }
    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .status-active { background: #e8f5e9; color: #388e3c; }
    .status-expired { background: #ffebee; color: #d32f2f; }
    .status-cancelled { background: #fff3e0; color: #f57c00; }
    .status-pending { background: #e3f2fd; color: #1976d2; }
    .status-paid { background: #e8f5e9; color: #388e3c; }
</style>

<div class="planner-subscription-container">
    <h1>订阅管理后台</h1>

    <!-- 统计卡片 -->
    <div class="planner-stats">
        <div class="planner-stat-card">
            <h3>活跃订阅</h3>
            <div class="value"><?php echo $activeSubscriptions; ?></div>
        </div>
        <div class="planner-stat-card">
            <h3>本月收入</h3>
            <div class="value">¥<?php echo number_format($monthlyRevenue, 2); ?></div>
        </div>
        <div class="planner-stat-card">
            <h3>总收入</h3>
            <div class="value">¥<?php echo number_format($totalRevenue, 2); ?></div>
        </div>
    </div>

    <!-- 标签页 -->
    <div class="planner-tabs">
        <div class="planner-tab <?php echo $tab === 'dashboard' ? 'active' : ''; ?>" onclick="switchTab('dashboard')">概览</div>
        <div class="planner-tab <?php echo $tab === 'subscriptions' ? 'active' : ''; ?>" onclick="switchTab('subscriptions')">订阅列表</div>
        <div class="planner-tab <?php echo $tab === 'orders' ? 'active' : ''; ?>" onclick="switchTab('orders')">订单列表</div>
        <div class="planner-tab <?php echo $tab === 'coupons' ? 'active' : ''; ?>" onclick="switchTab('coupons')">优惠券管理</div>
        <div class="planner-tab <?php echo $tab === 'payment' ? 'active' : ''; ?>" onclick="switchTab('payment')">支付配置</div>
    </div>

    <!-- 标签页内容 -->
    <div id="tab-dashboard">
        <h2>最近订单</h2>
        <?php
        $recentOrders = $db->fetchAll($db->select()
            ->from($prefix . 'planner_payment_orders')
            ->order('created_at', Typecho_Db::SORT_DESC)
            ->limit(10));
        ?>
        <table class="planner-table">
            <thead>
                <tr>
                    <th>订单号</th>
                    <th>用户ID</th>
                    <th>计划</th>
                    <th>金额</th>
                    <th>状态</th>
                    <th>创建时间</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($recentOrders as $order): ?>
                <tr>
                    <td><?php echo $order['order_no']; ?></td>
                    <td><?php echo $order['user_id']; ?></td>
                    <td><?php echo $order['plan'] === 'licensed' ? '标准版' : '专业版'; ?></td>
                    <td>¥<?php echo number_format($order['amount'], 2); ?></td>
                    <td><span class="status-badge status-<?php echo $order['status']; ?>"><?php echo $order['status'] === 'paid' ? '已支付' : ($order['status'] === 'pending' ? '待支付' : $order['status']); ?></span></td>
                    <td><?php echo $order['created_at']; ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <div id="tab-subscriptions" style="display: <?php echo $tab === 'subscriptions' ? 'block' : 'none'; ?>;">
        <h2>订阅列表</h2>
        <?php
        $subscriptions = $db->fetchAll($db->select()
            ->from($prefix . 'planner_subscriptions')
            ->order('created_at', Typecho_Db::SORT_DESC)
            ->limit(20));
        ?>
        <table class="planner-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>用户ID</th>
                    <th>计划</th>
                    <th>状态</th>
                    <th>开始时间</th>
                    <th>结束时间</th>
                    <th>自动续费</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($subscriptions as $sub): ?>
                <tr>
                    <td><?php echo $sub['id']; ?></td>
                    <td><?php echo $sub['user_id']; ?></td>
                    <td><?php echo $sub['plan'] === 'licensed' ? '标准版' : '专业版'; ?></td>
                    <td><span class="status-badge status-<?php echo $sub['status']; ?>"><?php echo $sub['status']; ?></span></td>
                    <td><?php echo $sub['start_date']; ?></td>
                    <td><?php echo $sub['end_date']; ?></td>
                    <td><?php echo $sub['auto_renew'] ? '是' : '否'; ?></td>
                    <td>
                        <button class="planner-btn planner-btn-primary" onclick="editSubscription(<?php echo $sub['id']; ?>)">编辑</button>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <div id="tab-orders" style="display: <?php echo $tab === 'orders' ? 'block' : 'none'; ?>;">
        <h2>订单列表</h2>
        <?php
        $orders = $db->fetchAll($db->select()
            ->from($prefix . 'planner_payment_orders')
            ->order('created_at', Typecho_Db::SORT_DESC)
            ->limit(50));
        ?>
        <table class="planner-table">
            <thead>
                <tr>
                    <th>订单号</th>
                    <th>用户ID</th>
                    <th>计划</th>
                    <th>金额</th>
                    <th>支付方式</th>
                    <th>状态</th>
                    <th>创建时间</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($orders as $order): ?>
                <tr>
                    <td><?php echo $order['order_no']; ?></td>
                    <td><?php echo $order['user_id']; ?></td>
                    <td><?php echo $order['plan'] === 'licensed' ? '标准版' : '专业版'; ?></td>
                    <td>¥<?php echo number_format($order['amount'], 2); ?></td>
                    <td><?php echo $order['payment_provider']; ?></td>
                    <td><span class="status-badge status-<?php echo $order['status']; ?>"><?php echo $order['status'] === 'paid' ? '已支付' : ($order['status'] === 'pending' ? '待支付' : $order['status']); ?></span></td>
                    <td><?php echo $order['created_at']; ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <div id="tab-coupons" style="display: <?php echo $tab === 'coupons' ? 'block' : 'none'; ?>;">
        <div style="margin-bottom: 20px;">
            <button class="planner-btn planner-btn-primary" onclick="showCreateCouponModal()">创建优惠券</button>
        </div>
        
        <?php
        $coupons = $db->fetchAll($db->select()
            ->from($prefix . 'planner_coupons')
            ->order('created_at', Typecho_Db::SORT_DESC));
        ?>
        <table class="planner-table">
            <thead>
                <tr>
                    <th>代码</th>
                    <th>适用计划</th>
                    <th>折扣类型</th>
                    <th>折扣值</th>
                    <th>使用次数</th>
                    <th>有效期</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($coupons as $coupon): ?>
                <tr>
                    <td><?php echo $coupon['code']; ?></td>
                    <td><?php echo $coupon['plan'] ? ($coupon['plan'] === 'licensed' ? '标准版' : '专业版') : '全部'; ?></td>
                    <td><?php echo $coupon['discount_type'] === 'percent' ? '百分比' : '固定金额'; ?></td>
                    <td><?php echo $coupon['discount_value'] . ($coupon['discount_type'] === 'percent' ? '%' : '元'); ?></td>
                    <td><?php echo $coupon['used_count'] . '/' . ($coupon['max_uses'] ?: '∞'); ?></td>
                    <td><?php echo $coupon['valid_from']; ?> ~ <?php echo $coupon['valid_until']; ?></td>
                    <td><span class="status-badge status-<?php echo $coupon['status']; ?>"><?php echo $coupon['status']; ?></span></td>
                    <td>
                        <button class="planner-btn planner-btn-danger" onclick="deleteCoupon('<?php echo $coupon['code']; ?>')">删除</button>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <div id="tab-payment" style="display: <?php echo $tab === 'payment' ? 'block' : 'none'; ?>;">
        <h2>微信支付配置</h2>
        <form id="wechat-payment-form" style="margin-bottom: 40px;">
            <table class="planner-table">
                <tr>
                    <th>AppID</th>
                    <td><input type="text" id="wechat-appid" style="width: 300px;"></td>
                </tr>
                <tr>
                    <th>MchID (商户号)</th>
                    <td><input type="text" id="wechat-mchid" style="width: 300px;"></td>
                </tr>
                <tr>
                    <th>API Key</th>
                    <td><input type="password" id="wechat-apikey" style="width: 300px;"></td>
                </tr>
                <tr>
                    <th>证书序列号</th>
                    <td><input type="text" id="wechat-serial" style="width: 300px;"></td>
                </tr>
            </table>
            <button type="button" class="planner-btn planner-btn-primary" onclick="savePaymentConfig('wechat')">保存配置</button>
        </form>

        <h2>支付宝配置</h2>
        <form id="alipay-payment-form" style="margin-bottom: 40px;">
            <table class="planner-table">
                <tr>
                    <th>App ID</th>
                    <td><input type="text" id="alipay-appid" style="width: 300px;"></td>
                </tr>
                <tr>
                    <th>Private Key</th>
                    <td><textarea id="alipay-privatekey" rows="4" style="width: 400px;"></textarea></td>
                </tr>
                <tr>
                    <th>Public Key</th>
                    <td><textarea id="alipay-publickey" rows="4" style="width: 400px;"></textarea></td>
                </tr>
            </table>
            <button type="button" class="planner-btn planner-btn-primary" onclick="savePaymentConfig('alipay')">保存配置</button>
        </form>

        <h2>Stripe 配置</h2>
        <form id="stripe-payment-form">
            <table class="planner-table">
                <tr>
                    <th>Public Key</th>
                    <td><input type="text" id="stripe-publickey" style="width: 300px;"></td>
                </tr>
                <tr>
                    <th>Secret Key</th>
                    <td><input type="password" id="stripe-secretkey" style="width: 300px;"></td>
                </tr>
                <tr>
                    <th>Webhook Secret</th>
                    <td><input type="password" id="stripe-webhook" style="width: 300px;"></td>
                </tr>
            </table>
            <button type="button" class="planner-btn planner-btn-primary" onclick="savePaymentConfig('stripe')">保存配置</button>
        </form>
    </div>
</div>

<script>
function switchTab(tab) {
    document.querySelectorAll('.planner-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById('tab-' + tab).style.display = 'block';
    
    window.location.href = '?tab=' + tab;
}

function savePaymentConfig(provider) {
    const data = {};
    
    if (provider === 'wechat') {
        data.appid = document.getElementById('wechat-appid').value;
        data.mch_id = document.getElementById('wechat-mchid').value;
        data.api_key = document.getElementById('wechat-apikey').value;
        data.serial = document.getElementById('wechat-serial').value;
    } else if (provider === 'alipay') {
        data.app_id = document.getElementById('alipay-appid').value;
        data.private_key = document.getElementById('alipay-privatekey').value;
        data.public_key = document.getElementById('alipay-publickey').value;
    } else if (provider === 'stripe') {
        data.public_key = document.getElementById('stripe-publickey').value;
        data.secret_key = document.getElementById('stripe-secretkey').value;
        data.webhook_secret = document.getElementById('stripe-webhook').value;
    }
    
    // 发送到后端保存
    fetch('/planner/subscription/save_payment_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, data })
    }).then(r => r.json()).then(response => {
        if (response.success) {
            alert('配置保存成功！');
        } else {
            alert('保存失败：' + (response.message || '未知错误'));
        }
    });
}

function deleteCoupon(code) {
    if (confirm('确定要删除这个优惠券吗？')) {
        fetch('/planner/subscription/delete_coupon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        }).then(r => r.json()).then(response => {
            if (response.success) {
                location.reload();
            }
        });
    }
}
</script>

<?php include 'footer.php'; ?>
