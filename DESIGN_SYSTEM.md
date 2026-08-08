# MEMENTO Design System（实现记录）

本文档只记录当前代码已经使用的实现约束，不作为本阶段的视觉重设计任务书。

## 基础

- 颜色、字号、间距、圆角、层级和动效 token 位于 `tokens.css`，全局组件样式位于 `src/styles/globals.css`。
- 画布使用深色背景与低对比关系线；照片保留主色作为节点的局部识别线索。
- 页面 Overlay 使用语义化 `main`、`section`、`article`、`nav` 和 `dialog`，交互控件最小命中高度约 2.75rem。

## 状态

- Button：默认、hover、focus-visible、disabled、pressed 均有明确样式。
- Import：queued、running、done、failed、cancelled；错误通过 inline error / live region 呈现。
- Backup：collecting、hashing、packaging、restore inspect、restore commit；所有失败均保留可重试的状态反馈。
- WebGL：正常 Canvas、不可用 fallback、context lost 和恢复操作。

## 动效与可访问性

- `prefers-reduced-motion` 与 Settings 的 reduced motion 会降低转场和空间运动。
- 关键流程提供键盘导航、Escape 返回、明确 aria-label、dialog 焦点管理和 live region。
- 新组件应复用现有 token 与 action 类，避免引入独立颜色、字体或卡片体系。
