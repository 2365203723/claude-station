# Claude Station — 设计文档

> 工作代号 **Claude Station**(可改)。一个图形化的「项目 × 能力」装配台,
> 让每个 Claude Code 项目精确声明自己使用哪些 MCP、Skill、Plugin 与配置片段,
> 实现项目之间的能力隔离,消除全局能力对项目级的"污染"。

- 日期:2026-06-08
- 平台:macOS,Electron 桌面 App
- 状态:设计已确认,待写实现计划

---

## 1. 问题与目标

### 1.1 用户的真实痛点

用户希望每个项目之间相互独立、并行,全局用户级配置不干扰项目级。
经探查当前 `~/.claude` 实际状态后,澄清出一个关键事实:

Claude Code 的配置分两类机制:

- **覆盖型(settings)**:`项目 settings.local.json` > `项目 settings.json` >
  `用户全局 settings.json`。项目级本来就覆盖全局,**不存在"全局污染项目"的问题**。
- **叠加型(能力注入)**:MCP servers、Skills、Plugins、Hooks 这套"能力层"会
  **从全局漏进每个项目**,且 Claude Code 只提供"禁用"开关,没有干净的
  "这个项目只用这几样"的声明机制。**这才是真正的痛点。**

当前实测现状:

- `~/.claude.json` 顶层挂了 6 个 user-scope MCP(agentmemory、codegraph、context7、
  firecrawl、memory、sequential-thinking),**每个项目都被强制注入**。
- `~/.claude/skills/` 下 42 个 skill 全局可见,每个项目都加载。
- superpowers 等 plugin 是 user-scope,全项目生效。
- 全局定义了 15 类 hook,每个项目都跑。
- 已有 7 个项目在 `~/.claude.json` 的 `projects` 中被追踪,多数 local MCP 为 0,
  即全在吃这 6 个全局 MCP。

### 1.2 目标

做一个图形化装配台,核心价值不是管 settings,而是做一个可视化的
**「项目 × 能力」装配台**,让用户给每个项目精确声明"只挂这些能力",其余全部隔离掉。

### 1.3 已确认的关键决策

| 维度 | 决策 |
|------|------|
| 形态 | 配置装配台:把能力拖到项目上建立"启用"归属关系(非执行流编排) |
| 隔离哲学 | 中央库 + 按项目装配:能力定义集中存在工具自己的库,装配时才写进项目 |
| v1 范围 | MCP servers / Skills / Plugins / 项目配置文件 四类全做 |
| 平台 | Electron 桌面 App |
| 应用模型 | 暂存 + Apply:拖拽只改"期望状态",Apply 时先 diff 预览、备份、再写,可回滚 |
| MCP 密钥 | 按 `hasSecrets` 自动路由:不含密钥写项目根 `.mcp.json`(可提交);含 token 写 `~/.claude.json` 项目本地作用域(不进 git、官方推荐)。Claude Code 不读 `.env`,故弃用占位方案 |
| 视觉风格 | **硬约束**:高保真 Claude 风格(纸感暖底 + 陶土橙 + 衬线标题/无衬线正文)。浅色默认 + 深色双主题。详见第 11 节 |

### 1.4 非目标(YAGNI)

- 不做执行流编排(不是 n8n 的"先跑 A 再跑 B")。
- 不做 plugin 的真隔离(marketplace 装到全局缓存,技术上无法按项目隔离;只管启用层)。
- 不做 Claude Code 自身高频写入字段(lastCost、sessionId 等)的管理,工具只碰能力相关字段。
- v1 不做云同步、不做多机同步。

---

## 2. 整体架构:三层 + 期望状态

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  中央库      │ 取   │   期望状态        │ Apply │   真实配置文件    │
│ (Library)   │ ───→ │ (Desired State)  │ ───→  │ (真正生效的)      │
│             │      │  工具自己的图      │ ←──   │                 │
└─────────────┘      └──────────────────┘ 导入  └─────────────────┘
 MCP定义              每个项目挂了哪些库项      ~/.claude.json
 Skill源文件          (纯引用,可随便改)        <proj>/.mcp.json
 Plugin引用                                    <proj>/.claude/skills/
 配置片段/snippet      ↑ 拖拽只改这里           <proj>/.claude/settings.json
 Profile(打包)                                <proj>/CLAUDE.md
```

### 2.1 中央库(Library)

存在工具自己的目录 `~/.claude-station/`,与 Claude 的配置完全分开。

- 每个 MCP 是一个独立定义文件(命令 / 参数 / env / 密钥引用)。
- 每个 Skill 是一份源文件(或目录)。
- 每个 Plugin 是一个引用(marketplace + 名称 + 版本)。
- 配置片段(snippet):可复用的一段 CLAUDE.md、一组 hooks、一组 env。
- Profile:一组能力的打包,例如「Web 开发包 = firecrawl + exa + 3 个 skill」,一键套到项目。

### 2.2 期望状态(Desired State)

工具自己维护的一张图:每个项目"挂了哪些库项"。这只是**引用**,
拖拽只动这一层,不碰真实文件。存在 `~/.claude-station/state.json`。

### 2.3 Apply 流程

把期望状态编译成真实文件内容 → 先 diff 给用户看(逐文件)→ 备份要动的文件
→ 写入 → 校验。可回滚。

### 2.4 反向导入(关键)

工具第一次打开时**读真实文件反推**出当前期望状态——一打开就能显示每个项目
"现在实际挂了哪些能力",哪怕这些是用户以前手动配的。否则工具对存量项目无用。

真实文件被 Claude 或用户手动改动后,工具检测到"漂移(drift)"并提示重新导入。

---

## 3. 四类能力的落地机制

### 3.1 MCP servers

- 库存定义:命令、参数、env、密钥引用。
- 装配:写进项目,按 `hasSecrets` 自动路由。不含密钥的 server 写项目根 `.mcp.json`
  (可提交、随仓库走);含 token 的 server 写**项目本地作用域**——即 `~/.claude.json`
  里该项目条目下的 `mcpServers`(不进 git、保证生效)。token 不入中央库。
  > 注:Claude Code 只从启动时的 shell/进程环境展开 `.mcp.json` 的 `${VAR}`,**不会**
  > 自动读项目 `.env`。故原"`.mcp.json` 占位 + `.env` 真值"方案不可行,改用 local scope。
- **迁移**:把 `~/.claude.json` 顶层那 6 个 user-scope MCP 收进库,然后从顶层删除
  (这步才真正止住"全局注入")。删前自动备份 + 要用户确认。

### 3.2 Skills

- 库存源文件。
- 装配:**软链(symlink)** 进 `<项目>/.claude/skills/`,符合"中央库:一处定义、
  多处用",改一次全项目生效。
- 某项目想改出分叉时,提供"复制脱钩"操作:把软链换成独立副本。
- 迁移:42 个全局 skill 先收进库。

### 3.3 Plugins

- 装不了真隔离(marketplace 装到全局缓存)。工具管的是**启用层**:
  写每个项目 `settings.json` 的 `enabledPlugins`。
- plugin 安装本身仍走 Claude 原生 marketplace。

### 3.4 项目配置文件

- 库存可复用"片段":一段 CLAUDE.md、一组 hooks、一组 env。
- 装配:合成进 `<项目>/CLAUDE.md` 和 `<项目>/.claude/settings.json`。

---

## 4. 画布交互(UX)

- **左栏 = 库**:按 MCP / Skill / Plugin / 片段 / Profile 分组列出库项,可搜索。
- **中间 = 画布**:项目是大容器节点,能力是小节点。
  **把能力拖到项目上 = 建立"装配"连线**(写入期望状态,不碰真实文件)。
- 项目节点显示角标摘要:`3 MCP · 2 skill · 1 plugin`。
- 点项目 → 右侧详情面板:看挂了哪些能力、每项的 scope 开关、漂移状态、复制脱钩等操作。
- 顶栏 **Apply 按钮**带待改计数 → 点击弹 diff(逐文件 before/after)→ 确认 → 备份 + 写入 → 校验。
- Profile:把一组能力存成包,可一键套到某项目(等价于批量建立装配连线)。

### 4.1 状态可视化

- 每个装配连线 / 能力节点有状态:`已应用`、`待应用(期望已改)`、`漂移(真实文件与期望不符)`。
- 漂移时提示用户:重新导入(以真实为准)或重新 Apply(以期望为准)。

---

## 5. 迁移(首次启动向导)

1. 读真实文件反推现状:扫描 `~/.claude.json`(顶层 + projects)、`~/.mcp.json`、
   各项目 `.mcp.json` / `.claude/skills/` / `.claude/settings.json` / `CLAUDE.md`。
2. 把 6 个全局 user-scope MCP、42 个全局 skill 收进中央库(MCP 复制定义,skill 移动源文件到
   `~/.claude-station/library/skills/`)。
3. 生成"现状期望图"——每个已知项目当前实际挂了什么,直接可见可管。
4. 用户确认后,才执行**全局清理**——这是真正止住"全局注入"的一步,对 MCP 和 skill 对称处理:
   - 从 `~/.claude.json` 顶层移除 6 个 user-scope MCP;
   - 把 42 个 skill 从 `~/.claude/skills/` 移出(已在第 2 步进库),全局目录清空。
   清理前自动备份。整个全局清理是可选且需显式确认的——不强制;用户也可只迁移、不清理。

> 注:全局清理后,某项目要用某 skill,需通过装配(软链进该项目 `.claude/skills/`)显式声明。
> 这正是"中央库 + 按项目装配"的预期行为——把隐式全局变成显式按项目。

### 5.1 全局 MCP 清理的安全模型(M2.5,唯一不可逆操作)

从 `~/.claude.json` 顶层删除 user-scope MCP 是整个项目唯一不可逆的写操作,因此设硬前提:

- **"已落地"前提**:某个全局 MCP 只有在**已装配给至少一个项目、且该项目的
  `lastApplied` 快照里确实含它**(即已 Apply 到真实文件)时,才允许从顶层删除。
  这保证删完之后该能力仍有项目能用,绝不产生"被删了又没项目能用"的孤儿。
- **未落地的拒删 + 告警**:不满足前提的 MCP 不删,在清理预览里明确标注"未落地,跳过",
  并提示用户先把它装配到项目并 Apply。
- **逐项目对称**:清理只动顶层 `mcpServers`,删除给定 id;其余字段(projects、lastCost、
  其他未被清理的全局 MCP)一字不动——与 `mergeLocalScope` 同样的结构化纪律。
- **写前备份 + 显式确认**:复用 `backupFiles` 把 `~/.claude.json` 备份到带时间戳目录;
  清理需用户在预览(哪些可删、哪些跳过)后显式确认。可选、不强制。
- **幂等**:已不在顶层的 id 视为已清理,重复执行无副作用。

> 范围:M2.5 只做 MCP 的全局清理。skill 的全局清理(从 `~/.claude/skills/` 移出)
> 留待后续 skill 装配里程碑,机制对称但不在本期。

---

## 6. 技术栈与进程模型

- **Electron + React + React Flow**(拖拽画布的事实标准库)。
- **主进程**:文件读写、备份、diff 计算、symlink、JSON 合并/校验。所有碰真实文件的操作都在这。
- **渲染进程**:画布与面板 UI,通过 IPC 调主进程。
- **持久化**:
  - 期望状态:`~/.claude-station/state.json`
  - 中央库:`~/.claude-station/library/`(mcp/、skills/、snippets/、profiles/)
  - 备份:`~/.claude-station/backups/<时间戳>/`

---

## 7. 数据模型(state.json 概要)

```jsonc
{
  "version": 1,
  "library": {
    "mcp":     { "<id>": { "name", "command", "args", "env", "secretRefs": ["FIRECRAWL_API_KEY"] } },
    "skills":  { "<id>": { "name", "sourcePath" } },
    "plugins": { "<id>": { "marketplace", "name", "version" } },
    "snippets":{ "<id>": { "kind": "claudemd|hooks|env", "content" } }
  },
  "profiles": { "<id>": { "name", "items": ["mcp:firecrawl", "skill:graphify"] } },
  "projects": {
    "/Users/example/my-project": {
      "assigned": ["mcp:firecrawl", "skill:graphify", "plugin:superpowers"],
      "lastApplied": { /* 上次 Apply 的快照,用于算 diff 和检测漂移 */ }
    }
  }
}
```

---

## 8. 错误处理与安全

- **写前必备份**:任何真实文件写入前,先复制到 `backups/<时间戳>/`,保留可回滚入口。
- **JSON 安全合并**:改 `~/.claude.json` / `settings.json` 时只动能力相关字段,
  保留其余字段(尤其 Claude 高频写的 lastCost、sessionId 等),用结构化合并而非整体覆盖。
- **密钥不入库**:token 永远不进中央库;含密钥的 server 装配到 `~/.claude.json`
  项目本地作用域(不进 git),字面 token 只存在那里。
- **不依赖 `.env`**:Claude Code 不会从项目 `.env` 展开 `.mcp.json` 的 `${VAR}`,
  故不走 `.env`;`.mcp.json` 只承载不含密钥的 server。
- **并发**:Apply 前检测文件 mtime,若 Claude 正在写(检测到变化)则提示稍后或重新导入,避免覆盖冲突。
- **漂移检测**:对比真实文件与 `lastApplied` 快照,不一致即标记漂移。

---

## 9. 测试策略

- **单元**:JSON 合并、diff 计算、密钥路由(hasSecrets 分流)、symlink 装配、反向导入解析——纯函数,易测。
- **集成**:在临时目录造一套假 `~/.claude` 结构,跑"导入 → 拖拽 → Apply → 校验文件"全链路。
- **回归**:针对真实 `~/.claude.json` 的脱敏样本,确保合并不丢字段。
- 渲染层 UI 交互 v1 以手测为主,核心逻辑全部下沉到主进程纯函数以便自动化测试。

---

## 10. 实现分期建议(非承诺)

1. **M1 骨架**:Electron 壳 + 反向导入 + 只读展示现状(项目挂了啥),不写。
2. **M2 MCP 装配 + Apply**:diff/备份/按 `hasSecrets` 写 `.mcp.json` 或 `~/.claude.json` 项目本地作用域,含全局 6 个 MCP 迁移。
3. **M3 Skills + Plugins + 配置片段**。
4. **M4 Profile、漂移检测、回滚 UI 打磨**。

---

## 11. 视觉设计语言(硬约束:高保真 Claude 风格)

整体气质:**"墨落纸上"的克制编辑感**——纸感暖色底、大留白、细暖灰描边、
极轻阴影、衬线标题配干净无衬线正文、单一陶土橙强调色。**禁止**冷蓝科技风、
重阴影、霓虹高饱和、紧凑信息密度。

### 11.1 双主题(浅色默认 + 深色)

用 CSS 变量实现运行时切换;所有颜色经语义 token,不在组件里写死色值。

**浅色(默认,claude.ai 招牌外观)**

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-canvas` | `#F5F4EE` (cream/ivory) | 画布底 |
| `--bg-surface` | `#FBFAF7` | 卡片/面板纸面 |
| `--bg-rail` | `#EFEDE4` | 左栏库区 |
| `--accent` | `#D97757` (陶土橙) | 主强调、Apply 按钮、主连线 |
| `--accent-hover` | `#C2654A` | 强调 hover |
| `--text-primary` | `#2B2A27` (近黑墨) | 标题/正文 |
| `--text-muted` | `#6B6862` | 次要文字/角标 |
| `--border` | `#E0DDD2` (暖灰) | 细描边 |
| `--shadow` | `0 1px 3px rgba(60,56,48,.08)` | 极轻阴影 |

**深色**

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-canvas` | `#262421` (暖炭) | 画布底 |
| `--bg-surface` | `#302D29` | 卡片/面板 |
| `--bg-rail` | `#211F1C` | 左栏库区 |
| `--accent` | `#E08A6B` (陶土橙提亮) | 主强调 |
| `--accent-hover` | `#EDA084` | 强调 hover |
| `--text-primary` | `#EDE9E0` (暖白) | 标题/正文 |
| `--text-muted` | `#9A958B` | 次要文字 |
| `--border` | `#3E3A34` (暖灰) | 细描边 |
| `--shadow` | `0 1px 3px rgba(0,0,0,.3)` | 极轻阴影 |

**语义状态色**(两主题各取暖调变体):

| 状态 | 浅色 | 深色 | 用途 |
|------|------|------|------|
| 已应用 | `#5B7553` (柔橄榄绿) | `#7E9874` | 装配已生效 |
| 待应用 | `#C2965A` (暖琥珀) | `#D9AE6E` | 期望已改未 Apply |
| 漂移/冲突 | `#B5543A` (锈红) | `#D17354` | 真实与期望不符 |

### 11.2 字体(免费替代,非 Anthropic 授权字)

> Anthropic 原字 Styrene(无衬线)/ Tiempos(衬线)是授权字体,不能直接用。
> 选视觉接近的开源字,实现时用 `@fontsource` 本地打包(不走 CDN、不联网)。

| 角色 | 选用 | 近似目标 |
|------|------|----------|
| 衬线标题(项目名、面板标题、大标题) | **Source Serif 4** | Tiempos |
| 无衬线正文(UI、按钮、说明) | **Inter** | Styrene |
| 等宽(diff、命令、token 占位) | **JetBrains Mono** | 代码块 |

### 11.3 形态规范

- **圆角**:卡片 `12px`,chip/按钮 `8px`,输入 `6px`。
- **描边**:统一 `1px solid var(--border)`,不用粗边、不用双线。
- **阴影**:仅 `--shadow` 一档,hover 时极轻抬升;禁止多层重阴影。
- **间距**:基准 `8px` 栅格,卡片内 padding `16–20px`,大留白优先于塞满。
- **动效**:克制。hover/拖拽用 `150–200ms ease` 过渡;无弹跳、无炫光。

### 11.4 画布元素落地

- **画布底**:`--bg-canvas` + 暖灰点阵网格(点用 `--border` 色,低透明度)。
- **项目节点**:纸卡片(`--bg-surface` + 细描边 + `--shadow`),标题用衬线字,
  下方角标 `3 MCP · 2 skill · 1 plugin` 用 `--text-muted`。
- **能力节点 / chip**:小药丸,按类型左侧一道色条(MCP/Skill/Plugin/片段 各一暖调)。
- **装配连线**:细曲线;`已应用`走 `--text-muted`,`待应用`走待应用色,`漂移`走锈红。
- **左栏库**:`--bg-rail`,分组标题衬线字,库项是可拖的小 chip。
- **Apply 按钮**:陶土橙实底(`--accent`),右上角待改计数用小圆点角标。
- **diff 模态**:纸面卡片,等宽字,增删行用语义状态色的低饱和底色(绿/锈红)标注。
