---
name: impeccable-to-opendesign
description: >-
  把 Impeccable 设计文档桥接到 Open Design 桌面版 design system。运行 /impeccable init/shape/craft
  后，用此 skill 将品牌 token 同步到 Open Design GUI，使其出图使用正确的设计系统。
disable-model-invocation: true
compatibility:
  platform: [macOS]
  app: [Open Design.app]
---

# Impeccable → Open Design 桥接

在 Impeccable（设计产出端）和 Open Design（设计消费端）之间架桥：读入 Impeccable 的 PRODUCT.md + DESIGN.md，转换为 Open Design 桌面版能读的 metadata.json + DESIGN.md（9 段格式），写入 `~/Library/Application Support/Open Design/namespaces/{namespace}/data/design-systems/{brand}/`。

## 步骤 1：读入 Impeccable 产物

从项目根目录读取：

- **PRODUCT.md** — 提取 `## Register`、`## Platform`、`## Brand Personality`、`# 标题`
- **DESIGN.md** — 提取色彩、排印、间距、组件、动效等信息

如果 PRODUCT.md 不存在，从 DESIGN.md 的 `#` 标题推断品牌名，默认 `surface: "web"`。两文件都不存在 → 提示先 `/impeccable init`，中止。

> **完成标志**: PRODUCT.md 的标题、register、platform 已提取；DESIGN.md 各段已定位

## 步骤 2：推断品牌标识

从 `PRODUCT.md` 的 `# 标题` 得到品牌显示名，slug 化得到目录名：

```
"Fund Signal Workbench" → slug "fund-signal-workbench"
"# My Brand"           → slug "my-brand"
```

> **完成标志**: brandSlug 和 displayTitle 已确定

## 步骤 3：定位 Open Design 数据目录

从 `/Applications/Open Design.app/Contents/Resources/open-design-config.json` 读取 `namespace`，构造完整路径：

```
~/Library/Application Support/Open Design/namespaces/{namespace}/data/design-systems/{brandSlug}/
```

配置不存在时默认 `namespace: "release-stable"`。

> **完成标志**: 目标目录路径已构造但尚未创建/写入

## 步骤 4：检查冲突

目标目录已存在 → 读出当前 `metadata.json` 的 `title` 和 `updatedAt`，用 AskUserQuestion 确认是否覆盖。用户拒绝 → 中止。

> **完成标志**: 用户已同意覆盖，或目录不存在

## 步骤 5：桥接为 Open Design 格式

### 5.1 写 metadata.json

```json
{
  "title": "{displayTitle}",
  "category": "{register === 'product' ? 'Dashboard & Productivity' : 'Brand & Marketing'}",
  "surface": "{platform}",
  "status": "published",
  "artifactMode": "agent-managed",
  "createdAt": "{保留原值（覆盖时）或当前时间}",
  "updatedAt": "{当前 ISO 时间戳}",
  "provenance": { "companyBlurb": "{从 Brand Personality 提取}" }
}
```

覆盖时：保留原 `createdAt`、`projectId`，只更新其他字段。

### 5.2 写 DESIGN.md（9 段格式）

参考 `references/open-design-format.md` 的模板。按映射规则从 Impeccable 的 DESIGN.md + PRODUCT.md 提取内容填入各段：

| Impeccable 来源 | Open Design 段 |
|---|---|
| DESIGN.md Theme / 色彩策略 | 1. Visual Theme & 2. Color |
| DESIGN.md Typography | 3. Typography |
| DESIGN.md 间距 / 圆角 | 4. Spacing |
| DESIGN.md Layout Principles | 5. Layout & Composition |
| DESIGN.md Component Principles | 6. Components |
| DESIGN.md Motion | 7. Motion & Interaction |
| PRODUCT.md Brand Personality | 8. Voice & Brand |
| PRODUCT.md Anti-references + bans | 9. Anti-patterns |

颜色：Impeccable 使用 OKLCH 时，在 DESIGN.md prose 层保留 OKLCH；tokens.css 用 hex。从 OKLCH 近似转换 hex 使用 `color-mix()` 或工具。

> **完成标志**: metadata.json 和 DESIGN.md 内容已组装就绪未写入

## 步骤 6：写入

写入两个文件到目标目录：

```
{brandDir}/
├── metadata.json
└── DESIGN.md
```

> **完成标志**: 两个文件已写入磁盘

## 步骤 7：验证与报告

确认文件存在且内容完整。报告内容：

- 品牌名 → Open Design 标题
- 写入路径
- 覆盖/新建
- 下一步：重启 Open Design GUI 查看

## 高级选项

```
/impeccable-to-opendesign --namespace canary   # 自定义 namespace
/impeccable-to-opendesign --slug my-brand       # 自定义品牌 slug
```

## 错误处理

| 问题 | 处理 |
|---|---|
| PRODUCT.md + DESIGN.md 均不存在 | 提示 `/impeccable init`，中止 |
| Open Design.app 未安装 | 提示安装，退出 |
| open-design-config.json 读取失败 | 默认 `release-stable` |
| 品牌目录创建失败 | 报错路径和权限，中止 |
