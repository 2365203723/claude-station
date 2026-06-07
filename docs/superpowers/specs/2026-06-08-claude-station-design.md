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
| MCP 密钥 | 非敏感写项目根 `.mcp.json`(可提交);带 token 的用 `${VAR}` 占位,真值写项目本地 `.env`(不提交) |

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
- 装配:写进项目。非敏感 server 写项目根 `.mcp.json`(可提交、随仓库走);
  带 token 的 server,token 不入库,改成 `${VAR}` 占位,真值写项目本地 `.env`(不提交)。
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
    "/Users/shawn/ecc": {
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
- **密钥不入库**:token 永远不进中央库;装配写 `${VAR}` 占位,真值进项目 `.env`。
- **`.env` 防提交**:写 `.env` 时确保项目 `.gitignore` 含 `.env`,没有则追加。
- **并发**:Apply 前检测文件 mtime,若 Claude 正在写(检测到变化)则提示稍后或重新导入,避免覆盖冲突。
- **漂移检测**:对比真实文件与 `lastApplied` 快照,不一致即标记漂移。

---

## 9. 测试策略

- **单元**:JSON 合并、diff 计算、占位符替换、symlink 装配、反向导入解析——纯函数,易测。
- **集成**:在临时目录造一套假 `~/.claude` 结构,跑"导入 → 拖拽 → Apply → 校验文件"全链路。
- **回归**:针对真实 `~/.claude.json` 的脱敏样本,确保合并不丢字段。
- 渲染层 UI 交互 v1 以手测为主,核心逻辑全部下沉到主进程纯函数以便自动化测试。

---

## 10. 实现分期建议(非承诺)

1. **M1 骨架**:Electron 壳 + 反向导入 + 只读展示现状(项目挂了啥),不写。
2. **M2 MCP 装配 + Apply**:diff/备份/写 `.mcp.json` + `.env`,含全局 6 个 MCP 迁移。
3. **M3 Skills + Plugins + 配置片段**。
4. **M4 Profile、漂移检测、回滚 UI 打磨**。
