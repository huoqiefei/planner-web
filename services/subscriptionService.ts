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
  /**
   * 获取订阅计划列表
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${authService.baseUrl}/subscription_plans?token=${user.token}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
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

    const response = await fetch(`${authService.baseUrl}/subscription_info?token=${user.token}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });

    if (!response.ok) throw new Error('Failed to load subscription');
    return await response.json();
  },

  /**
   * 创建支付订单
   */
  async createOrder(plan: 'licensed' | 'premium', paymentProvider: 'wechat' | 'alipay' | 'stripe'): Promise<{
    order_no: string;
    payment_url?: string;
    qr_code?: string;
  }> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${authService.baseUrl}/subscription_create_order?token=${user.token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({ plan, payment_provider: paymentProvider })
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

    const response = await fetch(`${authService.baseUrl}/subscription_order_status?order_no=${orderNo}&token=${user.token}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });

    if (!response.ok) throw new Error('Failed to check order status');
    return await response.json();
  },

  /**
   * 取消订阅
   */
  async cancelSubscription(): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${authService.baseUrl}/subscription_cancel?token=${user.token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      }
    });

    if (!response.ok) throw new Error('Failed to cancel subscription');
  },

  /**
   * 续费订阅
   */
  async renewSubscription(): Promise<{ end_date: string }> {
    const user = authService.getCurrentUser();
    if (!user?.token) throw new Error('Not authenticated');

    const response = await fetch(`${authService.baseUrl}/subscription_renew?token=${user.token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      }
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

    const response = await fetch(`${authService.baseUrl}/subscription_orders?token=${user.token}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });

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
