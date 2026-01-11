<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait CouponTrait
{
    /**
     * 获取优惠券
     */
    protected function getCouponByCode($code)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        return $db->fetchRow($db->select()
            ->from($prefix . 'planner_coupons')
            ->where('code = ?', $code)
            ->limit(1));
    }

    /**
     * 验证优惠券有效性
     */
    protected function validateCoupon($coupon, $plan)
    {
        if (!$coupon) {
            return ['valid' => false, 'message' => '优惠券不存在'];
        }

        if ($coupon['status'] !== 'active') {
            return ['valid' => false, 'message' => '优惠券已失效'];
        }

        if ($coupon['plan'] && $coupon['plan'] !== $plan) {
            return ['valid' => false, 'message' => '优惠券不适用于此套餐'];
        }

        if ($coupon['valid_from'] && $coupon['valid_from'] > date('Y-m-d H:i:s')) {
            return ['valid' => false, 'message' => '优惠券尚未生效'];
        }

        if ($coupon['valid_until'] && $coupon['valid_until'] < date('Y-m-d H:i:s')) {
            return ['valid' => false, 'message' => '优惠券已过期'];
        }

        if ($coupon['max_uses'] && $coupon['used_count'] >= $coupon['max_uses']) {
            return ['valid' => false, 'message' => '优惠券已用完'];
        }

        return ['valid' => true];
    }

    /**
     * 计算优惠券折扣
     */
    protected function calculateCouponDiscount($coupon, $plan, $originalAmount)
    {
        if ($coupon['discount_type'] === 'percent') {
            return $originalAmount * ($coupon['discount_value'] / 100);
        } else {
            return $coupon['discount_value'];
        }
    }

    /**
     * 验证并计算折扣
     */
    protected function validateAndCalculateDiscount($couponCode, $plan, $originalAmount = 0)
    {
        $coupon = $this->getCouponByCode($couponCode);
        
        if (!$coupon) {
            return null;
        }

        $validation = $this->validateCoupon($coupon, $plan);
        
        if (!$validation['valid']) {
            return null;
        }

        return $this->calculateCouponDiscount($coupon, $plan, $originalAmount);
    }

    /**
     * 使用优惠券
     */
    protected function useCoupon($couponCode)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        $db->query($db->update($prefix . 'planner_coupons')
            ->where('code = ?', $couponCode)
            ->rows([
                'used_count' => new Typecho_Db_Expression('used_count + 1')
            ]));
    }

    /**
     * 创建优惠券
     */
    protected function createCoupon($data)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        $db->query($db->insert($prefix . 'planner_coupons')->rows([
            'code' => $data['code'],
            'plan' => $data['plan'] ?? null,
            'discount_type' => $data['discount_type'], // percent/fixed
            'discount_value' => $data['discount_value'],
            'max_uses' => $data['max_uses'] ?? null,
            'valid_from' => $data['valid_from'] ?? null,
            'valid_until' => $data['valid_until'] ?? null,
            'status' => 'active',
            'created_at' => date('Y-m-d H:i:s')
        ]));

        return ['success' => true];
    }

    /**
     * 更新优惠券
     */
    protected function updateCoupon($code, $data)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        $updateData = [];
        
        if (isset($data['status'])) $updateData['status'] = $data['status'];
        if (isset($data['max_uses'])) $updateData['max_uses'] = $data['max_uses'];
        if (isset($data['valid_until'])) $updateData['valid_until'] = $data['valid_until'];

        if (!empty($updateData)) {
            $db->query($db->update($prefix . 'planner_coupons')
                ->where('code = ?', $code)
                ->rows($updateData));
        }

        return ['success' => true];
    }

    /**
     * 获取优惠券列表
     */
    protected function getCouponList($page = 1, $pageSize = 20)
    {
        $db = Typecho_Db::get();
        $prefix = $db->getPrefix();

        $offset = ($page - 1) * $pageSize;

        $coupons = $db->fetchAll($db->select()
            ->from($prefix . 'planner_coupons')
            ->order('created_at', Typecho_Db::SORT_DESC)
            ->limit($pageSize)
            ->offset($offset));

        $total = $db->fetchObject($db->select(['COUNT(*)' => 'count'])
            ->from($prefix . 'planner_coupons'))->count;

        return [
            'coupons' => $coupons,
            'total' => (int)$total,
            'page' => (int)$page,
            'pageSize' => (int)$pageSize
        ];
    }
}
