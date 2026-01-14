# Planner Web 插件开发指南

## 概述

Planner Web 提供了一个灵活的插件系统，允许开发者扩展应用功能。插件可以：

- 添加自定义导入/导出格式（Excel、XER、MPP 等）
- 在工具栏添加自定义按钮
- 在右键菜单添加自定义项
- 监听和处理各种应用事件
- 执行自定义计算

## 快速开始

### 1. 创建插件文件

```typescript
// plugins/my-plugin.ts
import { Plugin, PluginAPI } from '../utils/pluginSystem';

const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: '插件描述',
  
  activate(api: PluginAPI) {
    // 插件激活时执行
    console.log('My plugin activated!');
  },
  
  deactivate() {
    // 插件停用时执行（可选）
    console.log('My plugin deactivated!');
  }
};

export default myPlugin;
```

### 2. 注册插件

```typescript
import { pluginManager } from '../utils/pluginSystem';
import myPlugin from './my-plugin';

// 注册插件
pluginManager.register(myPlugin);
```

## 插件 API

### UI API (`api.ui`)

```typescript
// 显示文件选择器
const file = await api.ui.showFilePicker({ accept: '.xlsx,.xls' });

// 显示提示框
await api.ui.showAlert('操作完成', '成功');

// 显示确认框
const confirmed = await api.ui.showConfirm('确定要删除吗？');

// 显示输入框
const value = await api.ui.showPrompt('请输入名称', '默认值');

// 显示 Toast 消息
api.ui.showToast('保存成功', 'success');
```

### 项目 API (`api.project`)

```typescript
// 获取项目数据
const data = api.project.getData();

// 设置项目数据
api.project.setData(newData);

// 导入作业
api.project.importActivities([
  { id: 'A1000', name: '新作业', duration: 5 }
]);

// 获取选中的 ID
const selectedIds = api.project.getSelectedIds();

// 重新计算进度
api.project.recalculate();
```

### 工具栏 API (`api.toolbar`)

```typescript
// 添加工具栏按钮
api.toolbar.addButton({
  id: 'my-button',
  icon: '📊',
  tooltip: '我的按钮',
  position: 'right',
  onClick: () => {
    console.log('Button clicked!');
  }
});

// 移除按钮
api.toolbar.removeButton('my-button');
```

### 钩子 API (`api.hooks`)

```typescript
// 监听数据导入事件
api.hooks.on('onDataImport', ({ data, format }) => {
  if (format === 'xlsx') {
    return parseExcel(data);
  }
});

// 监听作业创建事件
api.hooks.on('onActivityCreate', ({ activity }) => {
  console.log('New activity:', activity.name);
});

// 监听粘贴事件
api.hooks.on('onPaste', ({ text, target }) => {
  if (target === 'activity') {
    return parseClipboardData(text);
  }
});
```

### 存储 API (`api.storage`)

```typescript
// 保存数据
api.storage.set('myKey', { foo: 'bar' });

// 读取数据
const data = api.storage.get('myKey');

// 删除数据
api.storage.remove('myKey');
```

## 可用钩子

| 钩子名称 | 触发时机 | 参数 |
|---------|---------|------|
| `onDataImport` | 导入数据时 | `{ data, format }` |
| `onDataExport` | 导出数据时 | `{ data, format }` |
| `onActivityCreate` | 创建作业时 | `{ activity }` |
| `onActivityUpdate` | 更新作业时 | `{ activity, field, oldValue, newValue }` |
| `onActivityDelete` | 删除作业时 | `{ activityIds }` |
| `onScheduleCalculate` | 进度计算后 | `{ activities, calendars }` |
| `onToolbarRender` | 工具栏渲染时 | `{ position }` |
| `onContextMenu` | 右键菜单显示时 | `{ type, ids, x, y }` |
| `onProjectLoad` | 项目加载时 | `{ project }` |
| `onProjectSave` | 项目保存时 | `{ project }` |
| `onPaste` | 粘贴数据时 | `{ text, target }` |

## 示例插件

查看以下示例插件了解更多：

- `excel-import.ts` - Excel 导入插件
- `xer-import.ts` - P6 XER 导入插件
