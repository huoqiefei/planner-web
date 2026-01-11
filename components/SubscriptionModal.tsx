import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';
import { subscriptionService, SubscriptionPlan, SubscriptionInfo, PaymentOrder } from '../services/subscriptionService';
import { authService } from '../services/authService';

export const SubscriptionModal: React.FC = () => {
  const { t } = useTranslation('zh');
  const { user, setActiveModal, setModalData } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<'licensed' | 'premium' | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'wechat' | 'alipay' | 'stripe'>('wechat');
  const [orderData, setOrderData] = useState<{ order_no: string; qr_code?: string } | null>(null);
  const [checkingOrder, setCheckingOrder] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subInfo, plansData, ordersData] = await Promise.all([
        subscriptionService.getSubscription(),
        subscriptionService.getPlans(),
        subscriptionService.getOrderHistory().catch(() => [])
      ]);

      setSubscription(subInfo);
      setPlans(plansData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      setModalData({ msg: 'Failed to load subscription data', title: 'Error' });
      setActiveModal('alert');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (plan: 'licensed' | 'premium') => {
    try {
      setSelectedPlan(plan);
      const result = await subscriptionService.createOrder(plan, paymentProvider);
      setOrderData(result);

      if (result.payment_url) {
        window.open(result.payment_url, '_blank');
      }

      if (result.qr_code) {
        startOrderCheck(result.order_no);
      }
    } catch (error: any) {
      console.error('Failed to create order:', error);
      setModalData({ msg: error.message || 'Failed to create order', title: 'Error' });
      setActiveModal('alert');
    }
  };

  const startOrderCheck = (orderNo: string) => {
    setCheckingOrder(true);
    const interval = setInterval(async () => {
      try {
        const result = await subscriptionService.checkOrderStatus(orderNo);
        if (result.status === 'paid') {
          clearInterval(interval);
          setCheckingOrder(false);
          setOrderData(null);
          await loadData();
          setModalData({ msg: '订阅成功！', title: 'Success' });
          setActiveModal('alert');
          await authService.refreshUser();
        } else if (result.status === 'failed') {
          clearInterval(interval);
          setCheckingOrder(false);
          setModalData({ msg: '支付失败', title: 'Error' });
          setActiveModal('alert');
        }
      } catch (error) {
        console.error('Failed to check order status:', error);
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(interval);
      setCheckingOrder(false);
    }, 300000);
  };

  const handleCancelSubscription = async () => {
    if (!confirm('确定要取消订阅吗？')) return;

    try {
      await subscriptionService.cancelSubscription();
      await loadData();
      setModalData({ msg: '订阅已取消', title: 'Success' });
      setActiveModal('alert');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  const handleRenewSubscription = async () => {
    try {
      await subscriptionService.renewSubscription();
      await loadData();
      setModalData({ msg: '续费成功！', title: 'Success' });
      setActiveModal('alert');
    } catch (error) {
      console.error('Failed to renew subscription:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">订阅管理</h2>

      {subscription && (
        <div className={`p-4 rounded-lg mb-6 ${subscription.status === 'active' ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                当前状态: {subscriptionService.formatSubscriptionStatus(subscription.status, subscription.end_date, 'zh')}
              </h3>
              {subscription.plan && (
                <p className="text-gray-600">当前计划: {subscription.plan === 'licensed' ? '标准版' : '专业版'}</p>
              )}
              {subscription.end_date && subscription.status === 'active' && (
                <p className="text-gray-600">到期时间: {new Date(subscription.end_date).toLocaleDateString('zh-CN')}</p>
              )}
            </div>
            {subscription.status === 'active' && (
              <button
                onClick={handleCancelSubscription}
                className="px-4 py-2 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
              >
                取消订阅
              </button>
            )}
            {subscription.status === 'expired' && subscription.plan && (
              <button
                onClick={handleRenewSubscription}
                className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
              >
                立即续费
              </button>
            )}
          </div>
        </div>
      )}

      {!orderData ? (
        <>
          <h3 className="text-xl font-semibold mb-4">选择订阅计划</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 rounded-lg border-2 ${selectedPlan === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} cursor-pointer hover:border-blue-300 transition-colors`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <h4 className="text-xl font-bold mb-2">{plan.name}</h4>
                <p className="text-3xl font-bold text-blue-600 mb-4">¥{plan.price}<span className="text-sm text-gray-500">/月</span></p>
                <ul className="space-y-2 mb-4">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-gray-600">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                {selectedPlan === plan.id && (
                  <div className="space-y-3">
                    <select
                      value={paymentProvider}
                      onChange={(e) => setPaymentProvider(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="wechat">微信支付</option>
                      <option value="alipay">支付宝</option>
                      <option value="stripe">信用卡 (Stripe)</option>
                    </select>
                    <button
                      onClick={() => handleCreateOrder(plan.id)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      立即订阅
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {orders.length > 0 && (
            <>
              <h3 className="text-xl font-semibold mb-4">订单历史</h3>
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">订单号</th>
                      <th className="px-4 py-2 text-left">计划</th>
                      <th className="px-4 py-2 text-left">金额</th>
                      <th className="px-4 py-2 text-left">状态</th>
                      <th className="px-4 py-2 text-left">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-t">
                        <td className="px-4 py-2">{order.order_no}</td>
                        <td className="px-4 py-2">{order.plan === 'licensed' ? '标准版' : '专业版'}</td>
                        <td className="px-4 py-2">¥{order.amount}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.status === 'paid' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status === 'paid' ? '已支付' : order.status === 'pending' ? '待支付' : '失败'}
                          </span>
                        </td>
                        <td className="px-4 py-2">{new Date(order.created_at).toLocaleDateString('zh-CN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-4">请扫码支付</h3>
          {orderData.qr_code && (
            <div className="flex justify-center mb-4">
              <img src={orderData.qr_code} alt="Payment QR Code" className="w-64 h-64" />
            </div>
          )}
          <p className="text-gray-600 mb-4">订单号: {orderData.order_no}</p>
          {checkingOrder && (
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span>正在检查支付状态...</span>
            </div>
          )}
          <button
            onClick={() => setOrderData(null)}
            className="mt-4 px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
          >
            返回
          </button>
        </div>
      )}
    </div>
  );
};
