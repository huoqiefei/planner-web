#!/bin/bash

# Planner Web 订阅功能快速部署脚本
# 使用方法：bash setup-subscription.sh

set -e

echo "========================================"
echo "  Planner Web 订阅功能快速部署脚本"
echo "========================================"
echo ""

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查必要的工具
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}错误: 未找到 $1，请先安装${NC}"
        exit 1
    fi
}

check_command mysql
check_command composer

# 数据库配置（请根据实际情况修改）
DB_HOST="localhost"
DB_NAME="typecho"
DB_USER="root"
DB_PASS=""

echo -e "${YELLOW}请输入数据库配置：${NC}"
read -p "数据库主机 [默认: $DB_HOST]: " input_host
DB_HOST=${input_host:-$DB_HOST}

read -p "数据库名称 [默认: $DB_NAME]: " input_name
DB_NAME=${input_name:-$DB_NAME}

read -p "数据库用户 [默认: $DB_USER]: " input_user
DB_USER=${input_user:-$DB_USER}

read -s -p "数据库密码: " input_pass
DB_PASS=$input_pass
echo ""

# 1. 执行数据库迁移
echo ""
echo -e "${GREEN}[1/5] 执行数据库迁移...${NC}"
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < typecho-plugin/PlannerAuth/database_subscription.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 数据库迁移成功${NC}"
else
    echo -e "${RED}✗ 数据库迁移失败${NC}"
    exit 1
fi

# 2. 检查文件是否存在
echo ""
echo -e "${GREEN}[2/5] 检查订阅功能文件...${NC}"

files=(
    "services/subscriptionService.ts"
    "components/SubscriptionModal.tsx"
    "typecho-plugin/PlannerAuth/Traits/SubscriptionTrait.php"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}✗ 缺少文件: $file${NC}"
    fi
done

# 3. 配置环境变量
echo ""
echo -e "${GREEN}[3/5] 配置环境变量...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.subscription" ]; then
        cp .env.subscription .env
        echo -e "${GREEN}✓ 已创建 .env 文件${NC}"
    else
        echo -e "${RED}✗ 未找到 .env.subscription 模板${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ .env 文件已存在，请手动检查配置${NC}"
fi

# 4. 后端集成说明
echo ""
echo -e "${GREEN}[4/5] 后端集成步骤${NC}"
echo "请按照以下步骤完成后端集成："
echo ""
echo "1. 打开 typecho-plugin/PlannerAuth/Action.php"
echo "2. 添加以下代码："
echo "   require_once 'Traits/SubscriptionTrait.php';"
echo ""
echo "3. 在类定义中添加："
echo "   use SubscriptionTrait;"
echo ""
echo "4. 在 action() 方法中添加订阅相关的 case 分支"
echo ""
echo "5. 在 Plugin.php 中添加支付回调路由"
echo ""
read -p "完成后按 Enter 继续..."

# 5. 前端集成说明
echo ""
echo -e "${GREEN}[5/5] 前端集成步骤${NC}"
echo "请按照以下步骤完成前端集成："
echo ""
echo "1. 打开 components/Modals.tsx"
echo "2. 添加：import { SubscriptionModal } from './SubscriptionModal';"
echo "3. 在 switch (activeModal) 中添加：case 'subscription': return <SubscriptionModal />;"
echo ""
echo "4. 打开 components/AccountSettingsModal.tsx"
echo "5. 添加订阅管理按钮（参考集成指南）"
echo ""
read -p "完成后按 Enter 继续..."

# 完成
echo ""
echo "========================================"
echo -e "${GREEN}✓ 订阅功能部署完成！${NC}"
echo "========================================"
echo ""
echo "后续步骤："
echo "1. 配置支付平台密钥（微信支付/支付宝/Stripe）"
echo "2. 测试支付功能"
echo "3. 设置订阅价格和权限"
echo ""
echo "详细文档：subscription-integration-guide.md"
echo ""
