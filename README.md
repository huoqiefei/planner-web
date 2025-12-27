# Planner Web 二次开发手册

本文档旨在为开发者提供 `Planner Web` 项目的架构说明、开发规范及扩展指南。本项目是一个基于 Web 的专业项目管理工具，支持关键路径法 (CPM) 排程、甘特图展示及云端存储。

## 1. 项目简介

Planner Web 是一个轻量级但功能强大的网页版 P6/Project 替代方案。

*   **核心功能**: WBS 分解、作业管理、逻辑关系 (FS/SS/FF/SF)、关键路径计算 (CPM)、资源管理、直方图、云端保存/加载。
*   **适用场景**: 工程项目管理、教学演示、个人进度规划。

## 2. 技术栈

### 前端 (Frontend)
*   **框架**: React 18 + TypeScript
*   **构建工具**: Vite
*   **样式**: Tailwind CSS
*   **图标**: SVG (内联)
*   **PDF 生成**: html2canvas + jspdf

### 后端 (Backend - 可选)
*   **平台**: Typecho (作为宿主 CMS)
*   **插件**: PlannerAuth (自定义 Typecho 插件)
*   **语言**: PHP
*   **数据库**: MySQL (通过 Typecho Db 类访问)

## 3. 目录结构

```text
planner-web/
├── components/          # UI 组件库
│   ├── CombinedView.tsx # 核心视图：作业列表 + 甘特图
│   ├── GanttChart.tsx   # 甘特图绘制逻辑 (SVG)
│   ├── ActivityTable.tsx# 作业列表表格
│   ├── MenuBar.tsx      # 顶部菜单栏
│   └── ...
├── hooks/               # 自定义 React Hooks
│   └── usePermissions.ts# 权限控制 Hook
├── services/            # 业务逻辑层
│   ├── scheduler.ts     # CPM 排程算法核心
│   ├── authService.ts   # 后端 API 通信
│   └── geminiService.ts # AI 辅助功能 (可选)
├── typecho-plugin/      # 后端插件代码
│   └── PlannerAuth/     # 插件源码
├── utils/               # 工具函数
│   └── i18n.ts          # 国际化字典
├── App.tsx              # 应用入口及全局状态管理
├── types.ts             # TypeScript 类型定义
└── index.css            # 全局样式及 Tailwind 指令
```

## 4. 核心架构说明

### 4.1 数据流
项目采用 **单向数据流**。
*   `App.tsx` 持有全局状态 `projectData` (包含 activities, resources, calendars 等)。
*   通过 Props 将数据传递给 `CombinedView`，再分发给 `ActivityTable` 和 `GanttChart`。
*   修改操作（如添加作业、排程）在 `App.tsx` 中定义处理函数，传递给子组件调用。

### 4.2 排程引擎 (`services/scheduler.ts`)
这是项目的核心算法文件。
*   `calculateSchedule(activities, ...)`: 接收作业列表，执行正推 (Forward Pass) 和逆推 (Backward Pass) 计算。
*   **输出**: 更新后的作业列表（包含 ES, EF, LS, LF, Total Float, Free Float）。

### 4.3 权限系统
*   **角色**: `trial` (试用), `licensed` (标准), `premium` (专业), `admin` (管理员).
*   **控制**: `hooks/usePermissions.ts` 定义了各功能的权限限制。
*   **后端**: PHP 插件中通过 `UserTrait.php` 验证用户角色。

## 5. 开发规范

### 5.1 命名规范

*   **文件与组件**: 使用 **PascalCase**。
    *   例: `ActivityTable.tsx`, `UserProfile.tsx`
*   **变量与函数**: 使用 **camelCase**。
    *   例: `calculateSchedule`, `activeRow`
*   **常量**: 使用 **UPPER_SNAKE_CASE**。
    *   例: `DEFAULT_ROW_HEIGHT`, `API_BASE_URL`
*   **接口与类型**: 使用 **PascalCase**，尽量在 `types.ts` 中统一定义。
    *   例: `interface Activity`, `type ViewMode`

### 5.2 编码风格

*   **TypeScript**: 必须定义明确的类型，避免使用 `any`。
*   **样式**: 优先使用 **Tailwind CSS** 类名。仅在必须使用复杂选择器或打印样式时修改 `index.css`。
*   **注释**: 核心算法及复杂逻辑必须添加注释。

### 5.3 国际化 (I18n)

所有用户可见的文本必须提取到 `utils/i18n.ts`。

**添加新文本步骤**:
1.  打开 `utils/i18n.ts`。
2.  在 `en` 对象中添加英文键值对。
3.  在 `zh` 对象中添加对应的中文翻译。
4.  组件中使用: `const { t } = useTranslation(lang);` -> `t('NewKey')`。

## 6. 二次开发示例

### 示例 1: 在作业列表中添加新列

假设我们要给作业添加一个 "Cost" (成本) 字段。

1.  **修改类型定义 (`types.ts`)**:
    ```typescript
    export interface Activity {
        // ... 原有字段
        cost?: number; // 新增字段
    }
    ```

2.  **更新组件 (`components/ActivityTable.tsx`)**:
    在表头渲染部分添加：
    ```tsx
    {visibleColumns.includes('cost') && (
        <div className="p6-header-cell w-24">Cost</div>
    )}
    ```
    在行渲染部分添加：
    ```tsx
    {visibleColumns.includes('cost') && (
        <div className="p6-cell w-24">
            {activity.cost || 0}
        </div>
    )}
    ```

3.  **更新国际化 (`utils/i18n.ts`)**:
    ```typescript
    en: { Cost: 'Cost' },
    zh: { Cost: '成本' }
    ```

### 示例 2: 添加新的菜单项

1.  **修改 `components/MenuBar.tsx`**:
    在 `menus` 对象中添加新项：
    ```typescript
    [t('Tools')]: [
        { label: t('CostAnalysis'), action: 'analyze_cost' }
    ]
    ```

2.  **处理动作 (`App.tsx`)**:
    在 `handleMenuAction` 函数中添加分支：
    ```typescript
    case 'analyze_cost':
        performCostAnalysis();
        break;
    ```

## 7. 后端插件开发 (Typecho Plugin)

后端代码位于 `typecho-plugin/PlannerAuth/`。

*   **路由注册**: `Plugin.php` 中的 `activate` 方法。
*   **API 处理**: `Action.php` 是主要入口，通过 `action()` 方法分发请求。
*   **业务逻辑**: 使用 Trait 分离逻辑。
    *   `ProjectTrait.php`: 处理项目保存、加载、列表查询。
    *   `AuthTrait.php`: 处理登录、注册。

**示例：添加一个新的 API 接口**

1.  在 `Action.php` 的 `action()` 方法中添加 `case`:
    ```php
    case 'get_server_time':
        $this->responseJSON(['time' => date('Y-m-d H:i:s')]);
        break;
    ```
2.  前端调用: `authService.ts` 中添加方法访问 `?action=get_server_time`。

## 8. 构建与部署

### 8.1 本地开发
```bash
npm install
npm run dev
```

### 8.2 生产构建
```bash
npm run build
```
构建产物将输出到 `dist` 目录。

### 8.3 部署
1.  将 `dist` 目录下的静态文件部署到 Web 服务器（Nginx/Apache）。
2.  将 `typecho-plugin/PlannerAuth` 文件夹上传到 Typecho 的 `usr/plugins/` 目录。
3.  在 Typecho 后台启用插件，并设置 "前端地址" 为静态文件的访问 URL。

---
**注意**: 本项目开发过程中请严格遵守以上规范，保持代码整洁与可维护性。
