# Open Design 桌面版 Design System 格式

## 文件清单

```
design-systems/{brandSlug}/
├── metadata.json    # 元数据
└── DESIGN.md        # 9 段格式设计散文
```

## metadata.json

```json
{
  "title": "品牌显示名称",
  "category": "Dashboard & Productivity",
  "surface": "web | ios | android",
  "status": "published",
  "artifactMode": "agent-managed",
  "createdAt": "ISO 时间戳",
  "updatedAt": "ISO 时间戳",
  "provenance": {
    "companyBlurb": "品牌摘要"
  },
  "projectId": "UUID"
}
```

## DESIGN.md — 9 段格式模板

### 标题 + 头部元数据

```markdown
# {品牌名}

> Category: {分类}
> Surface: {web | ios | android}

{品牌摘要}
```

### 段 1：Visual Theme & Atmosphere

描述视觉情绪、产品上下文、整体感觉。包含：
- Visual style（如 dark, high-contrast, minimal）
- Color stance（restrained / committed / full palette / drenched）
- Design intent（一句话）

### 段 2：Color

用表格列出所有颜色 token：

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | 强调色值 | Primary interactive, links |
| `--success` | 值 | Buy 信号 |
| `--warn` | 值 | Hold 信号 |
| `--danger` | 值 | Sell 信号 |
| ... | ... | ... |

要求：
- 强调色用于 CTA 和交互状态
- 语义色（success/warn/danger）使用形状 + 色彩双重编码

### 段 3：Typography

- 字族：字体栈
- 字号：从 xs 到 xxxxl 的阶梯
- 字重列表
- 行高、字间距、行宽限制

### 段 4：Spacing

- 基准单位（4px / 8px）
- 间距阶梯和命名
- 圆角值
- 段落纵向间距

### 段 5：Layout & Composition

- 页面结构（如 sidebar + main）
- 导航模式
- 信息层级
- 响应式行为

### 段 6：Components

- 按钮（风格、变体、状态）
- 输入框
- 数据表格
- 信号 badge
- 其他关键组件

### 段 7：Motion & Interaction

- 过渡时长
- 缓动函数
- 交互状态（hover, focus-visible, active, disabled, loading）
- prefers-reduced-motion 处理

### 段 8：Voice & Brand

- 语气（如 concise, confident, technical）
- 术语规范
- 文案风格
- 大小写规则

### 段 9：Anti-patterns

禁止的视觉和交互模式。用正面替代方案描述而非单纯禁止。例如：
- 不要装饰性渐变 → 使用纯色强调
- 不要玻璃拟态 → 使用扁平表面 + 清晰边框
