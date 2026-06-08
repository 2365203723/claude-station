# Claude Station

一个 Electron 桌面应用——可视化地管理每个 Claude Code 项目的 MCP 服务器、Skills、Plugins 和配置片段,实现**项目之间的能力隔离**。

## 解决的问题

Claude Code 的 MCP/Skills/Plugins 默认会从全局注进所有项目。想要"这个项目只用这几样能力"？Claude Station 给你一个图形化装配台:从中央库拖拽到项目星球,预览 diff,一键 Apply。

## 功能

- **反向导入** — 启动即读取真实配置文件,自动发现已有项目及其能力
- **星球图谱** — 项目是液态玻璃星球,MCP 是轨道卫星,拖拽可移动
- **能力库** — 左侧栏按 MCP/Skills/Plugins/配置片段 分节,从库拖到星球即装配
- **Apply 流程** — 逐文件 diff 预览 → 确认 → 备份 → 写入真实配置
- **全局清理** — 把全局注入的 MCP 退役(逐项目显式装配后)
- **双主题** — 浅色/深色 Claude 暖色液态玻璃风格
- **撤销** — 悬停卫星出现 × 按钮;右侧详情面板也可撤销任意能力

## 开发

```bash
git clone git@github.com:2365203723/claude-station.git
cd claude-station
npm install
npm run dev      # 启动 Electron 开发模式
npm test         # 运行测试
npm run build    # 生产构建
```

## 技术栈

- **Electron** + **React** + **React Flow** (画布)
- **TypeScript** 全栈
- **Vitest** 测试
- 主进程:文件读写、diff、symlink、备份;纯函数核心 + 副作用壳

## 数据存储

所有数据在运行时自动读取和生成,**不捆绑任何预设配置**:

| 位置 | 内容 |
|------|------|
| `~/.claude.json` | Claude Code 配置(程序读写项目作用域) |
| `<project>/.mcp.json` | 项目 MCP 声明(程序写) |
| `<project>/.claude/skills/` | 项目 skill symlink(程序建) |
| `~/.claude-station/state.json` | 本程序的期望状态 |
| `~/.claude-station/library/` | 中央库(skills 源文件等) |
| `~/.claude-station/backups/` | 每次 Apply 前的备份 |

首次运行时自动扫描本机已装的 MCP/Skills/Plugins 并入库,**无需手动配置**。

## 架构

```
中央库(Library) → 期望状态(Desired State) → Apply → 真实配置文件
                  ↑ 拖拽只改这一层            (diff/备份/写入)
                  反向导入 ← 扫描真实配置文件
```

- 拖拽能力到项目只改"期望状态"(不碰真实文件)
- 点 Apply → 逐文件 diff 预览 → 确认 → 备份 → 写入
- 写入失败可从 `~/.claude-station/backups/` 回滚

## License

MIT
