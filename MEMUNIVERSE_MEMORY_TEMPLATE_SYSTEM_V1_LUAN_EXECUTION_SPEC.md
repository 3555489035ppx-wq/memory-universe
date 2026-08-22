# Memuniverse Memory Template System V1

## Luan Execution Specification（完整执行规格书）

> 规格版本：1.0  
> 编制日期：2026-08-08  
> 执行对象：Luan  
> 产品阶段：Progressive Enhancement（渐进增强）  
> P0 唯一完整模板：《那年夏天》  
> 本文件只规定实施，不授权一次性执行所有 Phase。每个 Phase 必须单独运行、验证、汇报并确认稳定后再进入下一 Phase。

---

# A. Executive Summary

Memuniverse 已经是一个可运行的 Local First（本地优先）空间记忆产品。本阶段不是重新设计产品，而是在现有 Universe、照片导入、3D 场景、音乐播放器和信息架构之上新增六个能力：

1. Liquid Glass Design System（液态玻璃设计系统）；
2. Memory Template System（记忆模板系统）；
3. Memory Playback Engine（记忆播放引擎）；
4. 3D Layout Engine（三维布局引擎）；
5. Camera Director（镜头导演）；
6. Music Timeline（音乐时间轴）。

最终体验不是 Slideshow（幻灯片），而是：照片作为真实 3D Scene Object，随可寻址 Timeline 在空间中改变位置、旋转、比例、透明度与亮度；音乐提供时间，Camera 提供观看视角，Layout 提供记忆结构，Liquid Glass 只提供控制界面。

P0 只把《那年夏天》完整做到可展示水平，用它验证：

```text
模板选择
→ Preview
→ 本地音乐或静音 fallback
→ Cinematic Mode
→ Scattered → 三层 Memory Orbit
→ Hero Graduation Memory
→ Outro Pull Back
→ Pause / Resume / Replay / Seek
→ 返回原 Universe
```

Love、Breakup、University、Career 只有在 P0、性能与回归测试全部稳定后才按 Phase 19–22加入。

---

# B. Non-negotiable Constraints

## B1. 不得改变的产品边界

- 不重做首页、导航、上传、Archive、Settings、Universe 主体或 IA；
- 不删除或降级现有照片导入、关系视图、Memory Dive、Constellation、备份、音乐与本地数据能力；
- 不创建第二个 R3F Canvas、第二个 WebGL renderer、第二套照片数据库或第二个相机控制器；
- 不把模板做成照片依次切换的 Slideshow；
- 不把模板做成静态心形照片墙；
- 不引入登录、AI API、OpenAI API、Spotify API、网易云 API 或 Secret；
- 模板核心在离线、本地照片和本地音频条件下可工作；
- 不提交母任务书提到的商业歌曲、封面、歌词或音频片段；
- 不用远程歌曲作为自动化测试前置条件；
- 不让 Luan自行决定产品逻辑、镜头节奏、布局公式、状态机或视觉强度；
- 不为符合建议目录而搬迁当前成熟目录；
- 不安装 Tailwind 或 shadcn；当前项目没有这两者，强行引入会制造双样式体系；
- 不同时引入 Tone.js、Motion、GSAP、Meyda 等多个大型运行时；
- 不让主要 Story Timeline 依赖 `setTimeout`、累积 delta 或必须从头播放才能得到正确状态；
- 不用 `Math.random()` 生成布局；
- 不复制真实照片作为占位来补足模板数量；
- 不新建额外星空或大量粒子层；复用现有 Universe 背景；
- 不把全站变成毛玻璃卡片集合；照片始终是第一视觉主体。

## B2. 原子执行规则

每个 Phase 必须遵循：

```text
读取当前状态
→ 只改本 Phase 允许文件
→ 运行 TypeScript / lint / unit / build
→ 运行页面
→ 检查 Console
→ 手工验证本 Phase
→ 回归现有核心流程
→ 汇报文件、依赖、结果、风险
→ 确认稳定后进入下一 Phase
```

以下任一出现时禁止继续：

- TypeScript error；
- lint error；
- unit test 失败；
- production build 失败；
- 未处理 Runtime error；
- WebGL context crash；
- 现有上传、导航、Universe、音乐、Archive 或 Settings 失效；
- 本 Phase 核心手工验收未通过。

## B3. 回滚与版本纪律

当前目录在 2026-08-08 审计时没有 `.git`。Luan 在 Phase 0 只能报告该事实，不得删除文件。进入 Phase 1 前必须采取一种可恢复方案：

1. 首选：用户确认后初始化本地 Git，完善 `.gitignore`，提交未修改的 baseline，再建立 `feature/memory-template-v1`；不连接远程、不 push；
2. 若不允许初始化 Git：在工作区外创建只读 baseline 副本，并在每个 Phase 保存文件清单与 patch。

每 Phase 一个独立 commit 或 patch。禁止用 `git reset --hard`、覆盖整个目录或删除用户文件作为回滚。回滚只撤销该 Phase 列出的新增与修改。

---

# C. Existing Repository Audit Instructions

## C1. 已确认基线

Luan 在 Phase 0 必须重新核对，下表是 Sol 在 2026-08-08 的只读审计结果，不可直接假设永远不变：

| 项目 | 当前结果 |
|---|---|
| Package manager | `pnpm@11.9.0` |
| Runtime | Node `>=20.19.0` |
| Framework | Vite `7.2.4` + React `19.2.8` + strict TypeScript `5.9.3` |
| Router | `react-router-dom@7.18.2` |
| 3D | Three `0.185.0`、R3F `9.7.0`、Drei `10.7.7` |
| Camera | `camera-controls@3.1.2`，由 `src/scene/CameraRig.tsx` 独占 |
| State | Zustand `5.0.14` |
| CSS | 原生 CSS；`src/styles/tokens.css` 导入根目录 `tokens.css`；无 Tailwind/shadcn |
| Canvas | `PersistentSceneShell` 在 route overlay 外，唯一持续 Canvas |
| Photos | `MemoryNode` + `MemoryLODRenderer` + `LocalTextureManager` |
| Music | `MusicExperience.tsx` 内唯一 `<audio>`，支持本地 Object URL、play/pause/seek/volume |
| Audio meter | 已有 Web Audio `AnalyserNode`，仅用于播放控制台的峰值与动态控制读数 |
| Music source | `public/music/` 系统音乐库或浏览器上传；不连接第三方账号或本机服务 |
| Tests | Vitest + Playwright |
| Baseline check | `pnpm run check` 通过；20 个测试文件、63 个测试通过；build 成功 |
| Git | 当前不是 Git repository |

当前 production build 的 Three 相关 chunks 较大，因此新增依赖必须谨慎；不能为了 Timeline 再复制 Three 或播放器运行时。

## C2. Phase 0 必须输出

Phase 0 只读检查并生成一份报告，至少写明：

- 实际 `package.json`、lockfile、Node/pnpm 版本；
- `pnpm run check` 与 `pnpm run test:e2e` 当前结果；
- 当前未提交/未知文件清单；
- `AppShell`、router、Persistent Canvas、UniverseScene、CameraRig 的实际所有权；
- `MemoryNode`、TextureManager、LOD 的现状；
- `MusicExperience`、musicStore、Web Audio 音频表的现状；
- tokens 与全局 CSS 入口；
- 现有可复用组件与避免修改的高风险文件；
- Desktop 手工截图：Entry、Universe、播放器展开、Memory Dive、Archive；
- “最小侵入式实施方案”；
- Git/备份回滚方案。

如果审计结果与本文不同，Luan只允许调整文件路径和 adapter，不允许自行改变产品逻辑。重大架构冲突必须暂停汇报。

---

# D. Architecture

## D1. 单一运行时原则

```text
AppShell
├─ PersistentSceneShell                 # 保留唯一 Canvas
│  ├─ UniverseScene                     # 复用现有星空与性能治理
│  │  ├─ Existing Universe Layer        # idle 时正常显示
│  │  └─ MemoryTemplateLayer            # preview/playing 时接管选中照片
│  └─ CameraRig                         # 唯一 Camera writer
├─ RouteOverlays
│  └─ UniverseHUD
│     ├─ Existing controls
│     └─ TemplateLauncher / Preview HUD
├─ MusicExperience                      # 保留唯一 audio element
├─ ImportTray / ToastRegion / others
└─ MemoryPlaybackCoordinator            # 协调状态，不渲染第二 Canvas
```

模板播放不得新建路由页面。使用现有 `/universe`，只增加 query：

```text
/universe?source=demo&template=high-school
/universe?source=personal&template=high-school
```

规则：

- query 只保存被选模板，不保存播放进度；
- 刷新带 template query 时进入 `preview-loading → preview-ready`，不得自动播放；
- 浏览器自动播放限制下，只有用户点击“开始回忆”后才能调用 audio play；
- 退出模板时移除 `template` query，恢复进入前的 Universe view、camera pose、focus 与 selection；
- Back/Forward 必须保持 URL 与模板状态一致；
- Playback 中不创建 route history entry per progress。

## D2. 模块所有权

| 模块 | 唯一职责 | 禁止职责 |
|---|---|---|
| `MemoryTemplateConfig` | 序列化模板定义 | 读 React store、写 Three 对象 |
| `PhotoSelection` | 从真实 Memory 决定演出照片与 Hero | 复制照片、调用 AI |
| `LayoutEngine` | 给定 seed 和照片角色，输出确定性 layout | 动画、音频、React |
| `TimelineEngine` | `evaluateState(progress)` 随机访问状态 | `setTimeout`、保存 Three refs |
| `PlaybackClock` | 唯一时间来源与命令接口 | 直接改 Camera/Layout |
| `CameraDirector` | progress → camera pose | 自己创建 controls/Canvas |
| `AudioReactiveAdapter` | 读取现有分析值，输出微动态 | 决定故事大阶段 |
| `MemoryTemplateStore` | 粗粒度状态机与 session | 每帧写 16×完整 transform |
| `MemoryTemplateLayer` | 在 R3F 中应用 snapshot | 计算产品规则 |
| `CameraRig` | 应用 Explore 或 Playback camera pose | 从 UI组件直接接受任意写入 |
| `MusicExperience` | 唯一音频元素、用户播放控件 | 成为第二个 Timeline 引擎 |

## D3. 每帧数据流

```text
HTMLAudioElement.currentTime 或 FallbackClock
  → PlaybackClock.getSnapshot()
  → storyProgress 0..1
  → TimelineEngine.evaluateState(progress, config, preparedLayouts)
       ├─ photoSnapshots[id]
       ├─ cameraPose
       ├─ sceneSnapshot
       └─ uiSnapshot
  → MemoryTemplateLayer 应用 Photo snapshot
  → CameraRig 应用 Camera pose
  → AudioReactiveAdapter 只叠加微量 scale/glow/particle
```

`useFrame` 可每帧读取 clock 和计算 snapshot，但不得每帧把完整 snapshot 写进 Zustand 触发 React render。Zustand 只以不高于 10Hz 更新 UI progress。

## D4. 关键架构决策：不让 Tone.js 成为 P0 第二时钟

母任务书把 Tone.js 作为目标 Timeline，但当前项目已经有唯一 `HTMLAudioElement`，并实现本地文件、远程可选源、seek、volume 和 Web Audio analyser。若再让 `Tone.Transport` 独立推进，会产生两个可暂停、可 seek、可结束的时钟。

因此 V1 唯一方案是：

- `HTMLAudioElement.currentTime` 是有音乐时的 master clock；
- 自研小型 `FallbackClock` 是无音乐或音乐加载失败时的 master clock；
- 二者实现同一 `PlaybackClock` interface；
- Tone.js 不进入 P0 依赖；
- 若未来确需多轨调度、音频片段编排，再把 Tone.js 实现为该 interface 的新 adapter，不能改变 TimelineEngine。

这不是删减音乐同步，而是避免双时钟并最大化复用当前实现。

---

# E. Dependency Strategy

## E1. 本阶段新增依赖

P0 只允许新增：

```text
class-variance-authority
```

用途：Glass component variants。安装时锁定当日稳定版本并更新 `pnpm-lock.yaml`。如果审计发现项目已有等价、成熟 variant helper，则复用现有方案，不重复安装。

## E2. 继续复用

- `three`：Vector3、Quaternion、MathUtils、CatmullRomCurve3（若 Camera track 确有必要）；
- `@react-three/fiber`：唯一 R3F runtime、`useFrame`；
- `@react-three/drei`：现有 CameraControls 与性能能力；
- `camera-controls`：唯一相机执行器；
- Zustand：新增独立 template store；
- 现有 LocalTextureManager、LOD、settings、toast、selection、musicStore；
- Web Audio Analyser：仅作为播放器音频表的读数源，不向场景提供音乐特征。

## E3. V1 不新增

- Tailwind / shadcn；
- Tone.js；
- Meyda；
- GSAP / Motion / Framer Motion；
- 第二套 Camera control；
- 3D gallery、3d-force-graph 或额外星空库。

CSS Transition 负责 Glass UI；R3F `useFrame` + 纯函数 snapshot 负责 Scene；camera-controls 只负责 Explore 操作和 Camera 写入。这样没有第三个动画所有者。

---

# F. GitHub Reuse Strategy

完整的官方仓库、源码、Release 与 License 核验记录见 [`MEMUNIVERSE_TEMPLATE_OPEN_SOURCE_NOTES.md`](./MEMUNIVERSE_TEMPLATE_OPEN_SOURCE_NOTES.md)。Luan 在安装或复制前必须先读该文件；若版本已变化，重新核验稳定版本，但不得自行改变本节的产品边界。

## F1. Three.js CSS3D Periodic Table

允许参考的只有架构思想：

```text
Objects[]
TargetsByLayout{}
transform(targets, duration)
```

在 Memuniverse 中转换为：

```text
MemoryPhotoRuntime[]
PreparedLayouts{scattered, orbit, heart, brokenHeart, galaxy, helix}
evaluateState(progress)
```

不得复制 CSS3DRenderer、DOM 卡片视觉、Table/Sphere/Helix/Grid UI 或 tween demo。项目是现有 R3F WebGL Scene，复用目标布局思想即可。

## F2. R3F / Drei / camera-controls

- 继续通过现有依赖使用，不复制仓库示例资产；
- 不新增第二个 `<Canvas>`；
- 不把 Drei `<Preload />` 当作动态 Blob 纹理生命周期管理器；
- 不用 `Float` 自动运动覆盖 Timeline；
- CameraDirector 只计算 pose，CameraRig 是唯一写入者。

## F3. Tone.js

记录为“研究后不在 V1 采用”。原因：当前 `<audio>` 已是产品播放器；Tone Transport 不是该 media element 的天然同步时钟，接入会扩大重构和 drift 风险。未来多轨需求才考虑 adapter。

## F4. Meyda

记录为 P2 可选，不在 V1 采用。现有 AnalyserNode 已提供 energy、bass、mid、treble、beat，足够完成 ±1.5% 微动态。不要为了“专业音频分析”增加无用户价值依赖。

## F5. 版权记录

- 新增 CVA 或任何复制片段后立即更新 `CREDITS.md`；
- 复制上游代码必须固定 commit、保留 license header、写明修改；
- 商业歌曲只在配置中写“设计参考元数据”，不含音频、封面、歌词、波形或下载链接；
- Demo 和公开部署必须在无这些歌曲时仍可用；
- 不把研究仓库视觉、素材、品牌或 UI 带入项目。

---

# G. Liquid Glass Design System

## G1. 视觉优先级

固定层级：

1. Photo / Hero Memory；
2. 3D Memory Structure；
3. Liquid Glass Controls；
4. Star / Particle；
5. 辅助文字。

玻璃不是主题背景，不给标题套玻璃框，不把 Universe 变成 Dashboard。

## G2. Token 集成

在根 `tokens.css` 保留现有 token，并补齐统一别名：

```css
--glass-bg: oklch(86% 0.006 250 / 0.06);
--glass-bg-strong: oklch(88% 0.006 250 / 0.10);
--glass-bg-subtle: oklch(82% 0.006 250 / 0.035);
--glass-border: oklch(96% 0.006 250 / 0.16);
--glass-border-strong: oklch(100% 0.006 250 / 0.24);
--glass-highlight: oklch(100% 0 0 / 0.14);
--glass-highlight-hover: oklch(100% 0 0 / 0.22);
--glass-shadow-color: oklch(0% 0 0 / 0.32);
--glass-blur: 18px;
--glass-saturation: 145%;
--glass-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
--glass-duration: 220ms;
```

现有 `--glass-surface`、`--glass-edge` 等不删除；新组件可使用新 token，旧组件在 Phase 3 渐进映射。

强度：

| 强度 | 背景 alpha | border alpha | blur | 用途 |
|---|---:|---:|---:|---|
| strong | 0.08–0.10 | 0.20–0.24 | 20–24px | 开始回忆、重新播放、确认 |
| medium | 0.055–0.075 | 0.14–0.20 | 16–20px | 播放器、tabs、模板切换 |
| subtle | 0.03–0.05 | 0.10–0.15 | 14–18px | tooltip、chip、状态 |

不得出现彩虹边、蓝色 glow、紫边、大面积 cyan、背景 alpha 超过 0.12 或 blur 超过 28px。

## G3. Motion

- Hover：`translateY(-2px) scale(1.015)`，220ms；
- Active：`translateY(0) scale(0.98)`，90ms；
- Specular sweep：400–650ms，只在明确 hover 触发一次；
- Inner reflection：默认 opacity 0.62，hover 0.90；
- pointer highlight：CSS 变量 `--mouse-x` / `--mouse-y`，最大 alpha 0.10；
- disabled：opacity 0.45，不响应 lift/sweep；
- Reduced Motion：无 sweep、无 lift，只改变 border/background；
- JS 不每帧计算 blur；pointer move 只更新 CSS variables，不写 React state。

## G4. Accessibility

- `focus-visible` outline 至少 2px，offset 3px；
- 触控命中区至少 44×44px；
- disabled 使用原生属性；
- 所有图标按钮有中文 `aria-label`；
- GlassTabs 支持 Left/Right/Home/End；
- GlassModal 管理 focus、Esc 和返回焦点；
- Tooltip 同时支持 hover 与 keyboard focus；
- 玻璃透明度不能降低文字到 WCAG AA 以下。

---

# H. GlassButton Source Integration

用户提供的 GlassButton 是结构基线，但其 class 包含 Tailwind utilities，而当前仓库没有 Tailwind。Luan 必须保留组件结构与 CVA 思路，同时将 utilities 改为本项目真实 CSS class，不能安装 Tailwind 来让示例跑起来。

目标文件：`src/components/ui/glass-button.tsx`。

必须保留：

- `forwardRef<HTMLButtonElement>`；
- `size: default | sm | lg | icon`；
- `contentClassName`；
- `.glass-button-wrap`、`.glass-button`、`.glass-button-text`、`.glass-button-shadow` 四层；
- 原生 button props；
- focus、disabled、reduced-motion。

必须修正：

- `text-base`、`px-6`、`rounded-full` 等替换为 `.glass-button--size-*` 与真实 CSS；
- `className` 只作用于 wrapper，`buttonClassName` 可作为新可选 prop；
- wrapper 不冒充 button，不加 tabIndex/role；
- 合并调用方 `onPointerMove`、`onPointerLeave`，不能覆盖；
- pointer move 用 wrapper bounds 计算 0–100%，写入 `--mouse-x/y`；
- pointer leave 恢复 `30% 0%`；
- disabled 时不更新高光；
- 不把 `all: unset` 放在 wrapper，只放 button。

验收参数：

```text
default padding: 14px 24px
sm: 10px 16px
lg: 16px 32px
icon: 40×40px
border radius: 999px
hover lift: -2px
hover scale: 1.015
active scale: 0.98
default reflection opacity: 0.62
hover reflection opacity: 0.90
sweep duration: 520ms
```

Luan 应以以下自包含版本为起点，只允许修正类型、项目 `cn` helper 路径和测试发现的问题，不得改回 Tailwind utilities：

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

function cn(...inputs: Array<string | undefined | null | false>): string {
  return inputs.filter(Boolean).join(' ');
}

const glassButtonVariants = cva('glass-button', {
  variants: {
    size: {
      default: 'glass-button--size-default',
      sm: 'glass-button--size-sm',
      lg: 'glass-button--size-lg',
      icon: 'glass-button--size-icon',
    },
    strength: {
      strong: 'glass-button--strong',
      medium: 'glass-button--medium',
      subtle: 'glass-button--subtle',
    },
  },
  defaultVariants: { size: 'default', strength: 'medium' },
});

const glassButtonTextVariants = cva('glass-button-text', {
  variants: {
    size: {
      default: 'glass-button-text--default',
      sm: 'glass-button-text--sm',
      lg: 'glass-button-text--lg',
      icon: 'glass-button-text--icon',
    },
  },
  defaultVariants: { size: 'default' },
});

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
  buttonClassName?: string;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      buttonClassName,
      contentClassName,
      children,
      size,
      strength,
      disabled,
      onPointerMove,
      onPointerLeave,
      ...props
    },
    ref,
  ) => {
    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
      onPointerMove?.(event);
      if (disabled || event.defaultPrevented) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
      event.currentTarget.style.setProperty('--mouse-x', `${String(x)}%`);
      event.currentTarget.style.setProperty('--mouse-y', `${String(y)}%`);
    };

    const handlePointerLeave = (event: React.PointerEvent<HTMLButtonElement>): void => {
      onPointerLeave?.(event);
      event.currentTarget.style.setProperty('--mouse-x', '30%');
      event.currentTarget.style.setProperty('--mouse-y', '0%');
    };

    return (
      <div className={cn('glass-button-wrap', className)}>
        <button
          ref={ref}
          className={cn(glassButtonVariants({ size, strength }), buttonClassName)}
          disabled={disabled}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          {...props}
        >
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>
            {children}
          </span>
        </button>
        <span className="glass-button-shadow" aria-hidden="true" />
      </div>
    );
  },
);

GlassButton.displayName = 'GlassButton';
```

CSS selector责任固定：

- `.glass-button`：`all: unset`、布局、surface、border、blur、transition；
- `.glass-button::before`：以 `--mouse-x/y` 为中心的低透明 radial highlight；
- `.glass-button::after`：specular sweep；
- `.glass-button-shadow`：底部柔和投影；
- `.glass-button--size-*`：只管字号/最小尺寸；
- `.glass-button-text--*`：只管padding与line-height；icon无额外padding；
- `.glass-button--strong/medium/subtle`：只映射token强度；
- `:hover:not(:disabled)`、`:active:not(:disabled)`、`:focus-visible`、`:disabled`、Reduced Motion必须分别存在。

---

# I. Glass Component Family

## I1. GlassPanel

Props：`strength`、`as`、`interactive`、标准 HTML attrs。只提供表面，不强制 padding/layout。Template Preview 使用 medium，确认操作区域可使用 strong。不可把标题自动放入 panel。

## I2. GlassChip

用于模板类别、照片数量、状态；高度 28–32px。若可点击必须是 button；纯状态为 span。选中态通过 border/文本与微弱背景区分，不用蓝紫填充。

## I3. GlassTabs

受控 value/onValueChange。使用 `role=tablist/tab/tabpanel`，roving tabindex 与方向键。模板切换可用，现有 Universe 四视图只在 Phase 3 迁移 skin，不改 `setView` 逻辑。

## I4. GlassPlayer

只提供 UI 结构与 skin，不拥有音频元素和时钟。由现有 MusicExperience 注入 play/pause、progress、duration、seek、volume。Template playback 不创建第二个播放器。

## I5. GlassModal

用原生 `<dialog>` 或当前项目已有可访问 modal pattern；只用于真正需要阻断的确认。Template Preview 不是 modal，必须是 Floating HUD。

## I6. GlassTooltip

默认延迟 320ms，退出 100ms；支持 focus；Reduced Motion 无位移。仅用于图标说明，不承载关键操作信息。

---

# J. Existing UI Migration

Phase 3 只迁移 skin：

| 现有区域 | 允许变化 | 禁止变化 |
|---|---|---|
| `edge-action` | 使用 medium glass surface | 位置、链接、文案 |
| Universe `view-switcher` | GlassTabs 视觉 | 四视图逻辑、顺序 |
| Music console | GlassPlayer skin | audio 元素、播放逻辑、系统音乐库与上传边界 |
| Music library trigger | GlassButton/Chip 视觉 | 系统音乐库与浏览器上传行为 |
| Template controls | 新建 Glass family | 占据画面中央的大卡片 |

Archive、Settings、Import、Memory Dive 不在 P0 Phase 3 全量迁移。只修复因 token 变化产生的视觉回归。

---

# K. Memory Data Model

## K1. Template config

```ts
type MemoryTemplateId =
  | 'high-school'
  | 'love'
  | 'breakup'
  | 'university'
  | 'career';

type TemplateLayoutId =
  | 'scattered'
  | 'memoryOrbit'
  | 'heart'
  | 'brokenHeart'
  | 'galaxy'
  | 'helix';

interface TimelinePhase {
  id: string;
  start: number;
  end: number;
  easing: 'linear' | 'soft' | 'cinematic' | 'emphasis';
  fromLayout?: TemplateLayoutId;
  toLayout?: TemplateLayoutId;
  cameraTrack: string;
  visibilityRule?: string;
  heroRule?: string;
}

interface MemoryTemplateConfig {
  id: MemoryTemplateId;
  name: string;
  subtitle: string;
  categoryLabel: string;
  primaryLayout: TemplateLayoutId;
  recommendedPhotoCount: number;
  minimumPhotoCount: number;
  maximumPerformancePhotoCount: number;
  fallbackDurationSeconds: number;
  phases: TimelinePhase[];
  layoutPreset: string;
  cameraPreset: string;
  audioReactivePreset: string;
  uiPreset: 'cinematic-dark';
  songReferences: Array<{ title: string; artist: string; role: 'default' | 'alternate' }>;
  copy: { intro?: string; outro?: string };
}
```

所有 config 为纯序列化对象。不得在 config 中保存 React component、Three object、function 或 Blob URL。

## K2. Session

```ts
type PlaybackStatus =
  | 'idle'
  | 'preview-loading'
  | 'preview-ready'
  | 'starting'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'ended'
  | 'exiting'
  | 'error';

interface MemoryTemplateSession {
  templateId: MemoryTemplateId | null;
  source: 'demo' | 'personal';
  photoIds: string[];
  heroPhotoId: string | null;
  seed: number;
  status: PlaybackStatus;
  progress: number;
  durationSeconds: number;
  audioMode: 'local' | 'fallback-silent';
  errorCode: string | null;
}
```

禁止用 `isPlaying/isPaused/isSeeking/isEnded` 多个 boolean 代替状态机。

## K3. Runtime snapshot

```ts
interface MemoryPhotoSnapshot {
  memoryId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  opacity: number;
  brightness: number;
  glow: number;
  renderOrder: number;
}

interface TemplateFrameSnapshot {
  progress: number;
  photos: Record<string, MemoryPhotoSnapshot>;
  camera: CameraPose;
  orbitVelocity: number;
  particleIntensity: number;
  heroPhotoId: string | null;
  showOutroCopy: boolean;
}
```

snapshot 是引擎输出，不落 IndexedDB，不以 60fps 写 Zustand。

每个已挂载 `MemoryPhoto` 的 R3F ref 可以维护以下非序列化 runtime 值：`currentPosition`、`currentRotation`、`currentScale`、`currentOpacity` 与对应的 snapshot target。它们只用于把当前帧应用到 Three object，不能成为另一个产品状态源；Seek 时直接以新 snapshot target 覆盖，Pause 时保持，Replay 时归到 progress 0。

## K4. Photo selection

选择算法必须确定性且只使用真实照片：

1. 如果 `selectionStore.selectedIds.length >= 2`，按选择顺序使用，最后选中者为 Hero；
2. Demo high-school 可配置固定 16 个 memory id 与固定 Hero；
3. Personal 未多选时：按 `capturedAtMs ?? createdAt` 排序，对全量做等距采样，最多取 recommended count；最后一张作为 Hero；
4. 少于推荐数时全部使用，最少 2 张即可播放；
5. 多于 30 张不同时进入核心演出；剩余 Memory 留在 Universe；
6. 图片失败后跳过，若剩余至少 2 张继续；少于 2 张则返回 Preview 并提示；
7. 不复制、镜像或生成照片来补数量。

---

# L. MemoryPhoto Specification

新增 `src/memory/scene/MemoryPhoto.tsx`，仅供模板 layer 使用。不得替换或破坏现有 `src/scene/MemoryNode.tsx`。

数据来源：传入现有 `Memory`、当前 `MemoryPhotoSnapshot` 和交互 mode。不得使用长期 `src` URL；通过 `memory.assetKeys` 与现有 `useManagedTexture` 读取。

纹理策略：

- Preview：thumbnail；
- Playback 普通照片：thumbnail；
- Hero 在进入 0.70 前预取 preview；
- loading 时使用 dominantColor plane；
- 单图失败变为跳过状态，不 crash Canvas；
- layer 卸载时引用计数归还现有 TextureManager。

几何与材质：

- 保留照片 aspect ratio；
- 正反两面，避免 Fly Through 背面消失；
- 圆角如果现有 shader 无低成本实现，V1 使用极轻直角/边缘遮罩，不新增复杂 SDF shader；
- 边框 1px 视觉等效、alpha 0.10–0.18；
- shadow/glow 只用一层低透明 behind-plane 或材质参数；
- normal scale 基准 0.82；Hero 目标 1.25–1.35；
- 默认 rotation jitter：X ±6°、Y ±12°、Z ±3°；
- `toneMapped=false` 延续现有照片策略，但必须肉眼检查曝光。

Explore/Preview hover：scale 1 → 1.05，220ms；rotation 向 Camera 收敛 20%–30%；brightness 最大 +0.06；相邻照片最多后退 0.12 world unit。Playback 状态禁用 pointer hover 和 selection，避免覆盖 Timeline。

---

# M. Layout Engine

## M1. 接口

```ts
interface PreparedTemplateLayouts {
  seed: number;
  photoIds: string[];
  heroPhotoId: string;
  layouts: Record<TemplateLayoutId, Record<string, TransformTarget>>;
}

interface TransformTarget {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}
```

`prepareLayouts(session, memories, config)` 只在 session/photoIds/seed 改变时运行。每帧不重新生成目标布局。

## M2. Seeded random

- 使用稳定字符串 hash（FNV-1a 32-bit 或等效）生成 seed；
- PRNG 使用 `mulberry32` 或等效小型确定算法；
- seed 输入包含 template id + source + 排序后的 memory id；
- 同一 session 刷新后目标位置一致；
- 测试禁止 snapshot 出现 NaN/Infinity。

## M3. Morph

`mixTransform(a, b, t)`：position/scale 线性插值，rotation 使用 shortest-angle interpolation。默认 easing 使用 cubic-bezier 近似 `(0.2, 0.8, 0.2, 1)` 的纯函数。Formation 可有 5%–8% overshoot，但必须由确定性 curve 计算，不能 spring 累积。

---

# N. Scattered Layout

所有照片位于相机可理解的三维云中：

```text
x ∈ [-6.2, 6.2]
y ∈ [-3.4, 3.4]
z ∈ [-4.0, 2.5]
min projected separation ≈ 1.15 world unit
rotation X ±6° / Y ±12° / Z ±3°
```

生成顺序按稳定 photo id。最多 24 次 rejection sampling 避免重叠，失败则使用黄金角备用分布。Hero 在 scattered 状态不可提前居中，位置在后 35% depth，opacity 初始 0。

---

# O. Memory Orbit

三层椭圆 Orbit，不是平面圆：

| Layer | radiusX | radiusY | zBase | depthAmount | 建议照片 |
|---|---:|---:|---:|---:|---:|
| Outer | 6.2 | 3.3 | -1.8 | 1.35 | 6–8 |
| Middle | 4.5 | 2.35 | -0.2 | 1.05 | 4–6 |
| Inner | 2.8 | 1.45 | 0.9 | 0.72 | 2–4 |

计算：

```text
angle = layerOffset + index / layerCount × 2π
x = radiusX × cos(angle)
y = radiusY × sin(angle)
z = zBase + sin(angle × 2 + seedPhase) × depthAmount
```

加入最大 0.18 world unit seeded jitter。照片面朝 Orbit tangent 后再朝 Camera 收敛 35%，不要全部 billboard。Hero 独立位于 `[0, 0.15, 1.6]`，直到高潮前不可见。

数量适配：

- 2–5 张：单层 orbit + Hero；
- 6–10 张：Outer + Inner；
- 11–30 张：三层；
- 每层至少 2 张，不复制照片。

Orbit angular movement 必须由 progress 的解析函数得到，例如 `angleOffset(progress)`，不能每帧 `angle += delta`；Pause/Seek/Replay 才能精确。

---

# P. 3D Heart

使用参数心形曲线：

```text
xRaw = 16 sin³(t)
yRaw = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)
x = xRaw × 0.34
y = yRaw × 0.28 - 0.4
zLayer ∈ [-1.25, 0, 1.25]
```

按 index 在 Front/Middle/Back 三层轮换，再加 z jitter ±0.18。不同层 t offset 0、0.08、-0.08，避免从斜角看像一张薄纸。照片 rotation 以 heart tangent 为基础，Y 再朝 Camera 收敛 30%。Hero 位于 heart 中央 `[0, -0.25, 1.9]`。

不是 emoji；不使用红色填充、爱心图标或二维 DOM 排版。

---

# Q. Broken Heart

复用完整 Heart layout。分离参数 `separation 0..1`：

- 按 heart x 正负归为 left/right；中心 x=0 节点按稳定 index 交替；
- x offset：left `-4.2 × separation`，right `+4.2 × separation`；
- y offset 最大 ±0.35 seeded；
- z offset 最大 ±0.7；
- rotation Y：left `-8° × separation`，right `+8° × separation`；
- opacity 最低 0.72，不做消失爆炸；
- 中央空隙从 progress 0.50 后才出现。

禁止碎玻璃、红色闪烁、爆炸、粒子冲击。情绪来自距离、速度差、静止与中央空白。

---

# R. Multi-Orbit Galaxy

三条生活线：Learning、Friends、Life。分类规则：

1. config 可为 Demo 提供 memoryId → lane；
2. Personal 先按 tags 的透明词表分类；
3. 无匹配按稳定 round-robin 分配；
4. 不使用 AI。

三条 orbit 共享中心但轴向不同：

| Lane | radius | axis rotation | z center |
|---|---:|---|---:|
| Learning | 4.2 | X 18° / Z -12° | -0.8 |
| Friends | 5.5 | Y 22° / Z 14° | 0 |
| Life | 6.8 | X -16° / Y -18° | -1.6 |

0–25% 混杂，25–50% 三轨形成，50–75% 完整共存并允许 Camera 穿过 Friends 轨，75–100% Pull Back 显示完整 Galaxy System。

---

# S. Helix Timeline

按时间排序，缺时间用 createdAt；同时间按 id 稳定排序：

```text
angle = index × 0.82 + seedPhase
x = 3.6 × cos(angle)
z = 3.6 × sin(angle) - 1.0
y = -4.8 + normalizedIndex × 10.5
```

Milestone 由 config mapping、用户选择的 Hero 或 tags 透明规则决定；普通照片 scale 0.82，Milestone 1.0–1.15（只比普通大 15%–30%）。结尾 camera 继续向上，看见更高处 helix 淡入黑暗；不表达“职业结束”。

---

# T. Timeline Engine

## T1. 随机访问

核心 API：

```ts
evaluateState(
  progress: number,
  context: TimelineContext,
): TemplateFrameSnapshot
```

同一输入必须得到同一输出。调用顺序：`0.2 → 0.75 → 0.4` 仍分别正确。禁止依赖上一帧状态才知道当前 layout。

## T2. phase evaluation

```text
local = clamp((progress - phase.start) / (phase.end - phase.start), 0, 1)
eased = applyEasing(phase.easing, local)
snapshot = interpolate(phase.from, phase.to, eased)
```

边界：progress clamp 0–1；phase 必须连续、无重叠歧义；最后 phase.end 必须为 1。开发环境遇到非法 config 直接抛可读错误，生产显示 fallback toast 并退出 preview。

## T3. 状态机

允许转换：

```text
idle → preview-loading
preview-loading → preview-ready | error | idle
preview-ready → starting | idle
starting → playing | error | preview-ready
playing → paused | seeking | ended | exiting | error
paused → playing | seeking | exiting
seeking → playing | paused | ended | error
ended → starting(replay) | exiting
exiting → idle
error → preview-ready | idle
```

非法 transition 在开发环境记录 warning，不能静默形成矛盾状态。

---

# U. Song Cue System

V1 的模板 canonical timeline 使用 0–1，不硬编码歌曲秒数。Song reference 只是设计元数据。

预留：

```ts
interface SongCueMap {
  trackKey: string;
  introEnd: number;
  vocalStart: number;
  firstRise: number;
  mainClimax: number;
  outroStart: number;
  duration: number;
}
```

如果未来某首用户本地文件通过显式选择绑定 cue map，使用 piecewise linear mapping 把 audio seconds 映射为 story progress。V1 不通过文件名猜歌曲、不读取歌词、不提交商业歌曲 cue 数据作为必须依赖。无 cue map 时 `progress = currentTime / duration`。

---

# V. Audio System

## V1. PlaybackClock

```ts
interface PlaybackClockSnapshot {
  state: 'idle' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';
  currentTime: number;
  duration: number;
}

interface PlaybackClock {
  load(options: { fallbackDuration: number }): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  reset(): void;
  getSnapshot(): PlaybackClockSnapshot;
  dispose(): void;
}
```

`MediaElementPlaybackClock` 绑定现有 MusicExperience 的 audio element；`FallbackPlaybackClock` 用 `performance.now()`，支持 pause/resume/seek，不用多个 setTimeout。

## V2. 同步规则

- 有音频：直接在 R3F frame 读取 `audio.currentTime`，不依赖低频 `timeupdate`；
- UI progress 仍可节流写 music/template store；
- Pause 先 pause clock，再固定当前 snapshot；
- Resume 从同一 seconds 继续；
- Seek 先进入 `seeking`，设置 clock seconds，立即 evaluate 目标 progress；
- Replay 重置 clock、session、photo snapshot、camera pose、orbit analytic offset、Hero 和 UI；
- ended 时保持 final snapshot，不把 currentTime 自动清零；只有 Replay 才归零；
- 退出模板不停止用户在进入模板前主动播放的非模板音乐，除非该 session 接管了同一 local track；实现时保存 ownership 标记。

## V3. 本地音频 UX

Preview 提供“选择本地音乐”。不显示或下载默认歌曲。未选音乐时“开始回忆”仍可用，使用 fallback 65s 静音 Timeline，并显示一次：

> 未选择音乐，将以静音模式播放。你仍可以完整预览记忆动画。

音频加载失败：

> 音乐暂时无法播放，仍可预览记忆动画。

失败后用户可重试本地文件或继续静音，不 crash、不阻断模板。

---

# W. Music Playback Boundary

音乐只提供模板播放所需的时间轴，以及播放器中的峰值与动态控制读数。模板阶段、照片转场、Camera、粒子速度和颜色全部由确定性的模板配置与场景状态控制，不读取音乐情绪、氛围、节奏或频谱特征。

系统音乐和浏览器上传都使用同一条 `HTMLAudioElement` 播放链路；音频表只服务于播放器控制台，不向 Universe 场景暴露音乐特征值。

---

# X. Camera Director

`CameraDirector` 是纯函数：`progress + preset + layoutBounds → CameraPose`。它不持有 Camera ref，不调用 Three renderer。

CameraRig 集成规则：

- Explore/Preview：现有 camera-controls 可操作；
- starting：保存当前 Explore pose；
- playing/paused/seeking/ended：controls disabled，由 CameraRig 每帧应用 CameraDirector pose；
- seeking 拖动时直接 set pose；释放后最多 180ms settle；
- exiting：恢复保存 pose，完成后 controls enabled；
- CameraRig 仍是唯一 writer；不得新增另一个 `makeDefault` controls；
- Pause 后 pose 不漂移；
- Reduced Motion 仅用 2–3 个低位移 keyframe，禁用 fly-through。

允许动作：Slow Dolly、Pull Back、Gentle Orbit、Focus、Fly Through、Parallax。禁止 shake、roll、大幅 FOV 变化、高速旋转、游戏冲刺。

High-school camera keyframes：

| progress | position | target | fov | 意图 |
|---:|---|---|---:|---|
| 0.00 | `[0,0.4,14]` | `[0,0,-1]` | 52 | 远处观察苏醒 |
| 0.10 | `[0.2,0.4,11.8]` | `[0,0,-1]` | 51 | 缓慢接近校园 |
| 0.28 | `[-2.1,0.7,8.9]` | `[0.8,0,-0.8]` | 50 | 进入人物层 |
| 0.48 | `[1.7,0.3,7.6]` | `[0,-0.1,-0.5]` | 49 | 穿行后准备聚合 |
| 0.70 | `[0,0.25,9.0]` | `[0,0,-0.4]` | 49 | 观察完整 Orbit |
| 0.78 | `[0,0.15,6.0]` | `[0,0.15,1.6]` | 48 | Hero 聚焦 |
| 0.88 | `[0,0.3,7.4]` | `[0,0.1,0.8]` | 49 | Hero 回归结构 |
| 1.00 | `[0,1.4,18]` | `[0,0,-1.2]` | 52 | 整体成为小星系 |

关键帧间用 cinematic easing；避免 Catmull-Rom overshoot 穿过照片。若使用 curve，必须做相机碰撞/最近距离测试。

---

# Y. Cinematic Mode

## Y1. Preview HUD

Floating HUD，不是中央大卡片：

```text
那年夏天
高中回忆 · Memory Template
16 段记忆 · 约 01:05

[开始回忆]
[选择本地音乐]
返回模板    查看结构
```

标题无玻璃容器；Controls 使用 strong/medium glass。Preview 时选中照片显示 scattered 结构，非选中 Universe 节点 opacity 0.08–0.16，不完全销毁。

## Y2. Start transition

| 时间 | UI/Scene |
|---:|---|
| 0–120ms | GlassButton active compression：scale 0.98 |
| 120–400ms | button highlight 收缩，shadow opacity 减少 35% |
| 400–900ms | Preview HUD opacity 1→0、scale 1→0.96、filter blur 0→8px |
| 900ms | 状态 `starting → playing`，CameraDirector 接管 |

关键纹理未 ready 时不进入 starting；Button 显示“正在准备照片…”，保留取消/返回。

## Y3. Playback HUD

- 顶部 edge nav opacity 0.24，pointer 靠近顶部恢复 1；3s 无操作退回；
- 底部保留 GlassPlayer；
- 左下显示模板名/类别，不超过两行；
- 右下只显示暂停/继续与退出演示；
- playback 禁用照片 hover、多选、View switch、Archive route action；
- Esc 第一次暂停并显示退出确认，第二次/确认后退出；
- ended 显示“重新播放”“退出演示”，不自动循环。

---

# Z. High School Complete Specification

## Z1. Config

```text
id: high-school
name: 那年夏天
subtitle/category: 高中回忆
recommended: 16
minimum: 2
maximum performance: 30
fallback duration: 65s
primary layout: memoryOrbit
emotion ratio: 青春 40 / 怀念 30 / 温暖 20 / 轻微遗憾 10
default reference: 愿与愁 — 林俊杰
alternate reference: 特别的人 — 方大同
outro copy: 有些夏天，后来只存在于记忆里。
```

歌曲仅参考，outro copy 为 config，可被设为空，不能硬编码到 Engine。

## Z2. Photo roles（16 张默认）

- Awakening 环境照 2；
- Campus 4；
- People 5；
- Formation/Climax supporting 4；
- Hero graduation 1。

Personal 无语义标签时按时间等距分配 stage，不猜照片内容；Hero 为最后选择或最后采样照片。

当前 Demo 的 high-school 固定 mapping，不留给 Luan临场选择：

```text
Awakening: demo-memory-054, demo-memory-013
Campus:    demo-memory-012, demo-memory-006, demo-memory-017, demo-memory-041
People:    demo-memory-018, demo-memory-024, demo-memory-030, demo-memory-034, demo-memory-038
Support:   demo-memory-015, demo-memory-035, demo-memory-043, demo-memory-059
Hero:      demo-memory-047
```

如果审计时这些 id 不存在，按标题查找同一条 Memory；仍不存在才使用 K4 确定性采样并在 Phase 报告中记录。

## Z3. 六阶段 Timeline

### A｜Memory Awakening `0.00–0.10`

- 2 张环境照 opacity 0→0.58；其余 0；
- scattered positions，scale 0.72→0.82；
- star parallax 只增加 4%；
- camera 14→11.8 z；
- 无 Hero。

### B｜Campus `0.10–0.28`

- Campus 照依次出现，stagger 只由 normalized progress 计算；
- scattered → outer orbit 30%；
- opacity 达 0.82–0.92；
- camera 向左侧进入结构。

### C｜People `0.28–0.48`

- People 照出现；
- middle/inner orbit 从 0→45%；
- outer orbit 30→62%；
- camera 穿过两张照片之间，最近距离 ≥1.2 world unit；
- 照片之间不发生明显穿插。

### D｜Formation `0.48–0.70`

- 所有非 Hero 照片 scattered → complete orbit；
- layout blend 使用 cinematic curve；
- 允许 5%–8% 解析式 overshoot，在 0.66 前回到 1；
- opacity 0.92–1；
- 这是第一核心 Wow Moment；关闭音乐也能理解“记忆聚合”。

### E｜Graduation / Climax `0.70–0.88`

- Hero 从 z=-3.2、opacity 0、scale 0.7 进入 `[0,0.15,1.6]`；
- Hero scale 1.25–1.35，brightness +0.08；
- 普通照片 scale ×0.86、brightness -0.06、opacity ≥0.72；
- camera 在 0.78 达到 Hero focus；
- orbit 保持非常慢的 analytic rotation。

### F｜Outro `0.88–1.00`

- orbit angular velocity 平滑降至 0；
- Hero scale 回到 0.96 并融入结构；
- camera pull back 到完整小星系；
- config 有 outro copy 时在 0.94 后出现，opacity 0→1；
- 不黑屏；final snapshot 持续到用户 replay/exit。

---

# AA. Love Specification

名称《与你有关》；推荐 16；fallback 70s；layout `heart`。

```text
0.00–0.15  scattered
0.15–0.35  left/right paths 靠近
0.35–0.55  paths 交叉，heart 形成 45%
0.55–0.78  完整 3D heart
0.78–0.92  Hero couple memory 中央出现
0.92–1.00  heart 保持，整体 scale 1→1.015→1
```

不散开结束。Camera 先看到两条路径，再从偏转 18°–24° 角度验证 heart 厚度，Hero 时回到中心但保留 z depth。默认歌曲只为《我们俩》—郭顶，alternate《Always Online》—林俊杰的文本参考。

当前 Demo 默认 photo ids：`001,002,009,010,017,018,023,024,025,026,029,030,041,042,047,048`（完整 id 使用 `demo-memory-` 前缀）；Hero `demo-memory-018`。缺失时使用确定性采样。

---

# AB. Breakup Specification

名称《后来》；复用 Heart prepared layout 与 formation，不建第二套 heart engine。

```text
0.00–0.25  正常关系形成
0.25–0.50  完整 3D heart，必须停留可识别
0.50–0.65  2%–5% subtle misalignment，中央小缝
0.65–0.82  separation 0→0.65
0.82–0.94  separation 0.65→1，两侧速度略不同
0.94–1.00  camera 停在两组中间，中央为空
```

无 explosion、碎玻璃、红色主导或高频粒子。默认《我怀念的》—孙燕姿，alternate《恋人》—李荣浩，仅文本参考。

Demo 复用 Love 的同一组照片与 Hero，使“先完整后分离”具有连续语义；不得重新随机选一组。

---

# AC. University Specification

名称《我们的明天》；推荐 18–24；layout `galaxy`。

```text
0.00–0.25  Learning/Friends/Life 混杂
0.25–0.50  三 orbit 分离形成
0.50–0.75  三轨共存，camera 穿过 Friends 轨
0.75–0.90  完整 Galaxy System
0.90–1.00  pull back 看见大学阶段整体
```

结尾不聚焦单张 Hero，Hero 可作为其中一个较亮 Milestone，但整个 Galaxy 才是主角。默认《我们的明天》—鹿晗，alternate《后来的我们》—五月天，仅文本参考。

当前 Demo 默认 photo ids：`006,012,013,017,019,020,031,032,034,035,038,041,043,047,054,059,011,057`；lane 按 config 固定6/6/6分配。缺失时再使用透明 tags/round-robin。

---

# AD. Career Specification

名称《向前》；推荐 16–24；layout `helix`。

```text
0.00–0.20  helix 低处起点
0.20–0.45  camera 沿 helix 上升
0.45–0.70  高度差和节奏增加
0.70–0.90  Milestone scale +15%–30%
0.90–1.00  camera 继续向上，前方 helix 进入黑暗
```

结尾表达“还有前方”，不能像职业生涯结束。默认《走马》—陈粒，alternate《天黑黑》—孙燕姿，仅文本参考。

当前 Demo 默认 photo ids：`004,012,020,028,032,034,036,039,044,047,049,053,054,055,059,060`；Milestone `012,034,047,054`。缺失时按时间采样，最后一张为弱Milestone。

---

# AE. Error Handling

| 错误 | 用户行为 | Engine 行为 |
|---|---|---|
| 模板 id 不存在 | Toast“这个模板暂时无法打开” | 清 query，回 idle |
| 照片少于 2 张 | Preview 提示至少需要 2 张 | 不创建 session |
| 单图 texture 失败 | 跳过并提示数量 | 重建 selected ids；≥2 继续 |
| Hero texture 失败 | 自动选择最后一个可用 photo | 更新 session，不 crash |
| 关键 texture 未 ready | Start 显示 loading | 不进入 starting |
| 音乐格式不支持 | Toast + 静音播放选项 | 切 FallbackClock |
| audio play 被浏览器阻止 | 提示再次点击 | 回 preview-ready |
| 播放中 audio error | Toast | 从当前 progress 切 fallback clock 继续 |
| seek 到非法值 | 无错误曝光 | clamp 0..duration |
| config phase 非法 | 中文错误 + 退出 | 开发抛详细 validation error |
| CameraDirector 返回 NaN | 立即 pause + 退出选项 | 使用上一安全 pose |
| WebGL context lost | 使用现有 fallback | session pause，恢复后 seek 回 progress |
| 用户退出 | 恢复 Universe | dispose session refs，不删除 Memory |

所有错误写入既有 ToastRegion；禁止 alert、裸 stack、Canvas crash 或无限 loading。

---

# AF. Performance

- 目标：16–30 张照片，Desktop medium quality 接近 60fps；
- 模板普通照片使用 512 thumbnail，Hero 使用 1600 preview；
- 不把 5000×4000 原图直接上传 GPU；
- 只预加载 selected thumbnail + Hero preview，不预加载全 Universe preview；
- session 开始后隐藏现有 MemoryLODRenderer 的重复照片，避免同一照片双 draw；
- 复用现有 LocalTextureManager、PerformanceGovernor、adaptive DPR 与 starfield；
- 低档：DPR 1、关闭 reactive sparkle、普通照片最大 16；
- 中档：DPR ≤1.5、最大 24；
- 高档：DPR ≤2、最大 30；
- 每帧不 new `Vector3`/数组给所有照片；复用 mutable refs 或 typed buffer；
- `TimelineEngine.evaluateState` 目标 CPU <2ms/frame（16 张、常规 Desktop）；
- UI progress 更新 ≤10Hz；
- pointer highlight 不用 React state；
- 退出时释放 template-specific geometry/material/ref，不清空用户仍在 Universe 使用的共享 texture；
- 连续 Replay 10 次后 texture count、material count 不持续上升；
- 不为模板新建第二套星空或数万粒子。

性能记录至少包含：FPS、draw calls、triangles、texture count、estimated texture bytes、evaluate cost。开发 debug 显示，production 隐藏。

---

# AG. Accessibility

- Preview/Playback HUD 使用语义 button、heading、status；
- Start loading 使用 `aria-busy`；
- 状态变化通过现有 live region 播报，不每帧播 progress；
- Space 播放/暂停；Left/Right Seek ±5s；Esc 暂停/退出；R 在 ended 时 Replay；
- Playback 中不可用 controls 使用 disabled，不只 opacity；
- progress range 有 current/duration label；
- focus 不进入隐藏到 opacity 0.24 的导航；隐藏时 `inert` 或禁用 tab；
- Reduced Motion 仍能完整 Preview、Play、Pause、Seek、Replay、Exit；
- 360px 不溢出，controls 可点；完整 Cinematic 重点仍是 Desktop；
- 无音乐与音频失败不阻断视觉叙事；
- 不只用颜色区分 playing/paused/error。

---

# AH. Testing

## AH1. Unit

必须新增：

- seeded random 相同输入稳定；
- scattered bounds、无 NaN、基本间距；
- orbit 层数/深度/数量适配；
- heart 三层 z depth；
- broken heart separation 单调且无 explosion；
- galaxy lane deterministic；
- helix 时间排序和 milestone scale；
- config phase 连续性与 0..1；
- Timeline `0.2→0.75→0.4` 随机访问正确；
- evaluate at exact boundaries 0/.10/.28/.48/.70/.88/1；
- Playback state machine 合法/非法 transition；
- FallbackClock pause/resume/seek/replay；
- photo selection 少量/过量/失败/hero fallback；
- Camera pose 全部 finite、FOV 安全；
- Reduced Motion snapshot；
- AudioReactive clamps。

## AH2. Component

- GlassButton size、disabled、pointer CSS variables、用户 handler 合并；
- GlassTabs keyboard；
- GlassModal focus；
- Template Preview loading/ready/error/silent；
- PlaybackOverlay playing/paused/ended；
- Replay reset；
- URL query hydrate；
- 原 MusicExperience 未被 GlassPlayer skin 破坏。

## AH3. E2E

新增 `e2e/memory-template-high-school.spec.ts`：

```text
进入 /universe?source=demo
→ 打开模板
→ 选择《那年夏天》
→ Preview 显示实际照片数/时长
→ 静音开始
→ progress 到 .10/.28/.48/.70/.88/1
→ 检查 phase/hero/camera 可观测 debug state
→ Pause：progress 不再推进
→ Resume：继续
→ Seek 20%→75%：立即进入 75% phase
→ Replay：progress=0、hero reset、camera reset
→ Exit：恢复 Universe controls
→ Archive/Import/Memory Dive 仍可进入
```

测试不提交歌曲。使用可注入 `FakePlaybackClock`，由测试命令推进 progress。Debug state 仅 `DEV`/test 暴露，production build 不显示控件和全局数据。

## AH4. 视觉 checkpoint

High-school 截图：0.05、0.20、0.38、0.60、0.78、0.94、1.00。肉眼必须理解：苏醒→校园→人物→聚合→Hero→拉远。关闭音乐仍成立。

---

# AI. Regression

每 Phase 至少验证：

1. Entry 可进入；
2. Demo/Personal Universe 可切换；
3. TIME/PEOPLE/PLACE/EMOTION 可切换；
4. Memory hover/focus/dive/echo/return；
5. 本地照片导入与刷新持久化；
6. Archive 可打开；
7. Settings 可打开；
8. 本地音乐选择、play/pause/seek；
9. 可选本机音乐服务不因模板改动被删除；
10. Backup 既有测试；
11. Reduced Motion；
12. Console 无新 error/warning；
13. production build。

Phase 18 运行全部 Playwright。前面 Phase 可跑最相关 E2E + release smoke，但不得只跑单元测试。

---

# AJ. Atomic Development Phases

以下每个 Phase 都必须使用固定输出格式。文件路径以当前仓库为准；审计发现同职责文件已存在时，优先扩展，不并建重复模块。

## Phase 0｜Repository Audit

**目标：** 建立真实、可复现 baseline 和最小侵入方案；不实现功能。

**允许修改：** 只可新增 `docs/memory-template/phase-0-audit.md`；若用户要求零文件变化，则报告只发在阶段回复中。

**禁止修改：** `src/`、`public/`、package、lockfile、config、CSS、测试和已有文档。

**新增文件：** 可选 `docs/memory-template/phase-0-audit.md`。

**修改文件：** 无。

**新增依赖：** 无。

**执行步骤：**

1. 列出根目录和关键文件，确认是否存在 `.git`、未跟踪文件与异常零字节文件；不删除。
2. 读取 package/scripts、Vite/TS/ESLint/Playwright 配置。
3. 画出 AppShell、route overlay、PersistentSceneShell、UniverseScene、CameraRig 所有权。
4. 检查 MemoryNode、LOD、LocalTextureManager、PerformanceGovernor。
5. 检查 musicStore、MusicExperience、系统音乐库、唯一 `<audio>` 与音频表。
6. 检查 `tokens.css`、globals import 链和现有 glass token。
7. 运行 `pnpm run check`；运行 `pnpm run test:e2e`；记录命令、耗时、失败文本。
8. 启动页面，截图 Entry、Universe、播放器、Memory Dive、Archive。
9. 写最小侵入文件清单、风险和回滚建议。

**关键数据结构：** 只记录现有结构，不设计新结构。

**关键交互：** 手工走 Entry→Universe→Memory Dive→Back；本地音乐选择→play→seek→pause。

**视觉参数：** 不改视觉，只记录 Desktop viewport 和截图尺寸。

**错误处理：** 环境找不到 Node 时先定位实际 runtime；区分环境失败与项目失败。不得通过改代码绕过 baseline test。

**测试命令：** `pnpm run check`、`pnpm run test:e2e`。

**手工测试：** 当前产品主路径和 Console/Network。

**验收标准：** 报告回答 C2 全部问题；baseline 结果可复现；明确 Git/备份方案；没有产品文件变化。

**回滚方法：** 删除本 Phase 唯一新增 audit 文档；若无文件则无需回滚。

**下一阶段前置条件：** 用户确认 baseline、回滚方案和最小侵入方案；现有阻断错误已解释。

## Phase 1｜Liquid Glass Foundation：GlassButton

**目标：** 在独立开发 Lab 中完成可复用 GlassButton，不替换全站按钮。

**允许修改：** package/lockfile、UI component、glass CSS、DEV-only route、CREDITS。

**禁止修改：** Entry、Universe 布局、MusicExperience 逻辑、Camera、Scene、Archive/Settings skin。

**新增文件：**

- `src/components/ui/glass-button.tsx`
- `src/styles/glass.css`
- `src/features/dev/GlassLab.tsx`
- `src/components/ui/glass-button.test.tsx`

**修改文件：** `package.json`、`pnpm-lock.yaml`、`src/styles/globals.css`（只加 glass.css import）、`src/app/router.tsx`（DEV-only Lab）、`CREDITS.md`。

**新增依赖：** `class-variance-authority`，锁稳定版本。

**执行步骤：**

1. 安装 CVA，记录许可证。
2. 按 H 节适配用户原始组件，移除无效 Tailwind utility。
3. 在 glass.css 实现 strong/medium/subtle、pointer highlight、edge refraction、reflection、sweep、compression。
4. 创建 Lab 展示四种 size、三种 strength、disabled、长中文、icon、键盘 focus、暗背景。
5. DEV 环境添加 `/dev/glass`；production route 不存在且组件不进入公开导航。
6. 写 pointer、disabled、handler merge、keyboard 测试。

**关键数据结构：** `GlassButtonProps` 增加 `strength`、`buttonClassName`，其余标准 button props透传。

**关键交互：** hover、active、focus-visible、disabled、pointer variable、Reduced Motion。

**视觉参数：** 严格使用 G/H 节数值；最大 lift -2px、scale 1.015、sweep 520ms。

**错误处理：** 不支持 `color-mix`/backdrop-filter 时使用半透明 neutral background 与 border fallback，按钮仍可读可点。

**测试命令：** `pnpm exec vitest run src/components/ui/glass-button.test.tsx`，然后 `pnpm run check`。

**手工测试：** Chrome/Edge 中鼠标跟随、键盘、disabled、Reduced Motion；production build 验证 `/dev/glass` 不公开。

**验收标准：** Lab 独立稳定；无蓝紫 glow；组件不依赖 Tailwind；全站现有 UI 未变化。

**回滚方法：** 撤销本 Phase 文件和 CVA dependency/lockfile entry；不触碰其他业务代码。

**下一阶段前置条件：** GlassButton unit/build/视觉验收通过。

## Phase 2｜Glass Component Family

**目标：** 建立统一 Panel、Chip、Tabs、Player、Modal、Tooltip 和 token，不迁移业务。

**允许修改：** `src/components/ui`、glass.css、tokens、GlassLab、测试、CREDITS/Design System。

**禁止修改：** 业务功能、路由、Universe/Camera/Music logic。

**新增文件：** `glass-panel.tsx`、`glass-chip.tsx`、`glass-tabs.tsx`、`glass-player.tsx`、`glass-modal.tsx`、`glass-tooltip.tsx` 及对应测试。

**修改文件：** `tokens.css`、`src/styles/glass.css`、`GlassLab.tsx`、`DESIGN_SYSTEM.md`、`CREDITS.md`。

**新增依赖：** 无；不装 Radix/shadcn。

**执行步骤：**

1. 将 G2 token 加入根 tokens，保留现有变量。
2. 逐个实现 I1–I6；无业务逻辑。
3. Tabs 实现 roving tabindex；Modal 实现 focus restore；Tooltip 实现 hover/focus。
4. Lab 增加三强度、长中文、窄 viewport、错误/disabled states。
5. 测试语义与键盘。

**关键数据结构：** 统一 `GlassStrength = 'strong'|'medium'|'subtle'`；每组件公开最小 props，不建立通用设计系统框架。

**关键交互：** Tabs 方向键、Modal Esc、Tooltip focus、Player controls slot。

**视觉参数：** G2 强度表；所有组件使用同一 border/highlight/blur，不各自创造色彩。

**错误处理：** Modal 无 JS 时内容仍在 DOM 可读；Tooltip 不承载唯一信息。

**测试命令：** 相关 Vitest + `pnpm run check`。

**手工测试：** Lab Desktop/360px、Tab 顺序、Reduced Motion、200% zoom。

**验收标准：** 组件家族视觉一致、可访问、无业务回归、无新大型依赖。

**回滚方法：** 只撤销 Phase 2 files/token additions；保留已验收 GlassButton。

**下一阶段前置条件：** Component tests、visual Lab、build 通过。

## Phase 3｜Existing UI Skin Migration

**目标：** 将指定现有控件渐进迁移到 Glass skin，位置、IA、逻辑零变化。

**允许修改：** AppShell edge action、Universe view switcher、MusicExperience/Popover markup 的 skin wrapper、相关 CSS和测试。

**禁止修改：** route、文案、音频控制、provider service、Universe view state、上传/Archive/Settings 布局。

**新增文件：** 如需要只加局部 snapshot/component test；不新增替代播放器。

**修改文件：** `AppShell.tsx`、`UniverseHUD.tsx`、`MusicExperience.tsx`、`MusicLibraryPopover.tsx`、glass/global CSS、相关测试。

**新增依赖：** 无。

**执行步骤：**

1. 逐区域建立 before screenshot。
2. Edge action 使用 medium GlassButton skin，链接行为不变。
3. View switcher 使用 GlassTabs 语义，继续调用原 `setView`。
4. Music console 使用 GlassPlayer surface，保留唯一 audioRef 和所有 handlers。
5. Music library trigger 使用 medium glass；popover 内容不全量重构。
6. 每迁移一个区域立即回归交互。

**关键数据结构：** 不改 scene/music store schema。

**关键交互：** 所有原 click/seek/volume/tab/provider 行为完全一致。

**视觉参数：** medium glass；照片/Universe 对比度高于控件；播放器高度不得增加超过 8px。

**错误处理：** 系统音频加载失败时仍保留清晰错误与浏览器上传入口。

**测试命令：** musicStore/component tests、Universe E2E smoke、`pnpm run check`。

**手工测试：** 四视图；播放器选择本地音乐、play/pause/seek/volume；music library 打开关闭；360px。

**验收标准：** 仅 skin 改变；所有坐标/导航/逻辑无回归；界面不是满屏玻璃卡片。

**回滚方法：** 逐组件恢复原 markup/class，保留 Glass family。

**下一阶段前置条件：** 原音乐和 Universe 功能完全通过。

## Phase 4｜MemoryTemplateConfig 与 Preview Shell

**目标：** 建立五套纯配置、template store、选择入口与 Preview HUD；不实现 3D模板动画。

**允许修改：** 新 `src/memory` config/types/store/UI；UniverseHUD 增加模板入口；router query sync；文档。

**禁止修改：** MemoryNode、CameraRig、Music logic、布局 engine、现有路由结构。

**新增文件：**

- `src/memory/types.ts`
- `src/memory/config/{high-school,love,breakup,university,career}.ts`
- `src/memory/config/index.ts`
- `src/memory/config/validateTemplateConfig.ts`
- `src/stores/memoryTemplateStore.ts`
- `src/memory/ui/TemplateLauncher.tsx`
- `src/memory/ui/TemplatePreview.tsx`
- config/store/component tests

**修改文件：** `UniverseHUD.tsx`、scene navigation/query bridge（最小）、CSS、`ARCHITECTURE.md`、`PRODUCT.md`。

**新增依赖：** 无。

**执行步骤：**

1. 实现 K1/K2 types 与 config validator。
2. 写五个 config，P0 只将 high-school 标记 `available: true`；开发阶段其余不显示为可点击假按钮。最终 Phase22 后全部 active。
3. 实现 deterministic photo selection，先只用于显示 count/hero 预览。
4. 在 UniverseHUD 增加一个“记忆模板” medium control；不移位现有四视图。
5. 选择模板写 query 并进入 preview state；刷新 query 可 hydrate。
6. Preview HUD 展示真实数量、fallback 时长、歌曲仅文本参考、本地音乐选择入口占位事件。
7. “返回模板”清 query 并恢复原状态；“查看结构”本 Phase 显示静态说明/selected ids，不冒充 3D动画。

**关键数据结构：** K1/K2；store actions 必须由 reducer-like transition 控制。

**关键交互：** open launcher、select high-school、back、reload query、Esc 关闭。

**视觉参数：** Floating HUD；标题无 panel；Controls 使用 strong/medium；最大宽度 420px，但不居中遮挡 Universe。

**错误处理：** 不存在 template query 清理并 toast；照片少于2张说明原因；config validation error 不进入 Preview。

**测试命令：** config/store/UI tests + `pnpm run check`。

**手工测试：** Demo/Personal、query reload、Back/Forward、无照片/1张/60张。

**验收标准：** 五套 config 存在；P0 只有高中入口真实可用；没有 3D 假播放；现有 Universe 布局未变。

**回滚方法：** 移除 template query/UI/store/config，恢复 UniverseHUD 单一改动。

**下一阶段前置条件：** config validation、query、photo selection、Preview UI 通过。

## Phase 5｜MemoryPhoto 单对象

**目标：** 在模板 layer 中渲染一张真实 3D照片，验证纹理、transform、hover 和释放。

**允许修改：** 新 template scene layer、UniverseScene 条件挂载、现有 texture hook 只读复用。

**禁止修改：** 现有 MemoryNode/LOD 行为、CameraRig、Timeline、音乐。

**新增文件：** `src/memory/scene/MemoryPhoto.tsx`、`MemoryTemplateLayer.tsx`、对应 test/story debug state。

**修改文件：** `UniverseScene.tsx`（增加 layer mount）、可能的 `useSceneLayout` adapter、CSS仅HUD。

**新增依赖：** 无。

**执行步骤：**

1. 从 session 选第一张 Memory；通过现有 assetKeys/useManagedTexture 加载 thumbnail。
2. 用 L 节参数建立正反面 3D plane。
3. Preview 状态将现有同一照片节点隐藏/弱化，避免 double draw。
4. 实现 Explore-only hover；playing 标志暂时由 debug toggle 模拟并禁用 hover。
5. 切换/退出 session，验证 texture refcount 回收。

**关键数据结构：** `MemoryPhotoSnapshot` 先用固定 transform。

**关键交互：** Preview hover；进入 mock playback 后 hover无效；退出恢复 existing node。

**视觉参数：** scale .82、rotation 范围、hover 1.05、brightness +.06。

**错误处理：** texture fail 使用 dominantColor；不能 throw到Canvas。

**测试命令：** MemoryPhoto tests、TextureManager existing tests、`pnpm run check`。

**手工测试：** Demo/personal单图、前后面、hover、退出、重复进入10次。

**验收标准：** 真正 R3F 3D object；非 DOM card；无纹理泄漏；原 MemoryNode 未回归。

**回滚方法：** 移除 layer mount 与新增文件；不改现有节点。

**下一阶段前置条件：** 单图生命周期和视觉通过。

## Phase 6｜Scattered Layout

**目标：** 2–30张模板照片以固定 seed 形成可复现 scattered layout。

**允许修改：** 新 layout engine/seed utilities/template layer/debug。

**禁止修改：** 现有四视图布局、Camera、Music、Timeline。

**新增文件：** `src/memory/engine/seededRandom.ts`、`src/memory/engine/LayoutEngine.ts`、`src/memory/layouts/scattered.ts` 及 tests。

**修改文件：** `MemoryTemplateLayer.tsx`、DEV debug UI。

**新增依赖：** 无。

**执行步骤：**

1. 实现 FNV seed + deterministic PRNG。
2. 实现 N 节 bounds、rejection sampling 与黄金角 fallback。
3. `prepareLayouts` memoize；session变更才重算。
4. Template layer 渲染实际 photo count。
5. Debug 显示 seed、count、bounds；production 隐藏。

**关键数据结构：** `PreparedTemplateLayouts`、`TransformTarget`。

**关键交互：** “查看结构”进入 scattered preview；退出恢复 Universe。

**视觉参数：** N 节 exact bounds/rotation；不让照片全部正对 camera。

**错误处理：** invalid dimension/id 过滤；少于2不进入；所有 output finite。

**测试命令：** layout unit + `pnpm run check`。

**手工测试：** 2/6/16/30张；刷新布局一致；360px 不 crash。

**验收标准：** 同输入精确稳定；基本不重叠；没有 Math.random；现有 layout tests继续通过。

**回滚方法：** 移除 scattered/engine 与 template layer调用。

**下一阶段前置条件：** bounds、determinism、finite tests通过。

## Phase 7｜Memory Orbit 与 Layout Debug

**目标：** 实现三层 orbit，并允许 DEV 在 Scattered/Orbit 间稳定 Morph。

**允许修改：** template layouts/layer/debug、snapshot interpolation。

**禁止修改：** Camera、Audio、业务路由、现有 Universe layout。

**新增文件：** `src/memory/layouts/memory-orbit.ts`、`src/memory/engine/interpolateTransform.ts`、`src/memory/ui/DebugTemplateControls.tsx` 及 tests。

**修改文件：** `LayoutEngine.ts`、`MemoryTemplateLayer.tsx`、DEV route/lab。

**新增依赖：** 无。

**执行步骤：**

1. 实现 O 节数量适配与公式。
2. Hero 独立 target；Preview debug 可控制 hero visibility。
3. 实现 shortest-angle transform interpolation。
4. DEV controls：Scattered、Orbit、progress 0–1、seed；仅 DEV。
5. 650–1000ms Morph，重复切换可从当前 progress转向，不重建 textures。

**关键数据结构：** prepared layouts 同时含 scattered/orbit。

**关键交互：** Debug buttons、slider；生产 Preview 无 Debug。

**视觉参数：** O 节三层半径/z-depth；5%–8% overshoot只作 debug可选，本 Phase默认无 overshoot。

**错误处理：** 2–5张单层、6–10双层；空 layer 不除零。

**测试命令：** orbit/interpolation tests + check。

**手工测试：** 16张斜角观察确认厚度；快速反复切换；texture count不增长。

**验收标准：** 明确三层Z depth；Morph连续；生产无debug；同seed稳定。

**回滚方法：** 移除 orbit/debug，保留 scattered。

**下一阶段前置条件：** Morph视觉、数量适配、回归通过。

## Phase 8｜CameraDirector（无音乐）

**目标：** 用手动 progress 驱动 High-school Camera，建立 Explore/Playback ownership与恢复。

**允许修改：** 新 CameraDirector、CameraRig adapter、template store/session pose、debug。

**禁止修改：** CameraStateMachine 现有 Dive语义、第二 controls、音乐。

**新增文件：** `src/memory/engine/CameraDirector.ts`、camera preset/test。

**修改文件：** `CameraRig.tsx`、memoryTemplateStore、Debug controls。

**新增依赖：** 无。

**执行步骤：**

1. 实现 X 节纯函数和 high-school keyframes。
2. CameraRig 在 template playback flag 下成为 pose adapter；仍唯一 writer。
3. 进入 mock playback 保存 Explore pose，禁用 controls。
4. progress slider 驱动 camera；暂停 slider时 pose稳定。
5. Exit恢复 pose与controls。
6. Reduced Motion用安全简化keyframes。

**关键数据结构：** `CameraPose`沿用现有类型；新增 preset不可复制Camera对象。

**关键交互：** Preview可探索；Playback不可拖Camera；Exit恢复。

**视觉参数：** X 节 keyframes，FOV 48–52，最近照片距离≥1.2。

**错误处理：** non-finite pose使用lastSafePose并pause；controls ref未ready不开始。

**测试命令：** CameraDirector/CameraStateMachine tests + check。

**手工测试：** slider往返、快速Exit、Dive回归、Reduced Motion、防眩晕。

**验收标准：** 唯一Camera writer；所有progress可随机访问；退出精确恢复；无Camera跳变。

**回滚方法：** 撤销CameraRig template分支与新director，不动原machine。

**下一阶段前置条件：** Camera随机访问和恢复通过。

## Phase 9｜Local Audio Adapter

**目标：** 将现有唯一 `<audio>` 暴露为受控 PlaybackClock adapter，不引入 Timeline。

**允许修改：** MusicExperience内部adapter绑定、memory audio adapter、musicStore最小事件。

**禁止修改：** 创建第二audio element、引入第三方账号连接、安装Tone、改变现有播放器UX。

**新增文件：** `src/memory/engine/PlaybackClock.ts`、`MediaElementPlaybackClock.ts`、`FallbackPlaybackClock.ts` 及 tests。

**修改文件：** `MusicExperience.tsx`（注册/注销现有audio）、memoryTemplateStore；必要时musicStore增加只读ended事件。

**新增依赖：** 无。

**执行步骤：**

1. 定义 V1 interface。
2. 创建 clock registry/context，绑定唯一 audio element，不把HTMLElement放Zustand。
3. 实现 fallback clock的play/pause/seek/reset/dispose。
4. Preview“选择本地音乐”复用现有 file picker event。
5. 验证现有音乐播放完全不变。

**关键数据结构：** `PlaybackClockSnapshot`；session记录audio ownership。

**关键交互：** 选择本地文件、adapter ready、静音fallback选择。

**视觉参数：** 只用已有GlassPlayer；无新增音乐面板。

**错误处理：** audio不可用切fallback；autoplay rejection回preview-ready。

**测试命令：** clock tests、musicStore tests、MusicExperience component tests、check。

**手工测试：** system/upload file play/pause/seek；Object URL切换释放。

**验收标准：** 只有一个audio；clock命令正确；系统音乐库与上传流程不回归。

**回滚方法：** 移除clock注册，不改原音频handlers结果。

**下一阶段前置条件：** Media/Fallback两种clock都通过。

## Phase 10｜Single Playback Clock Hardening（明确不引入 Tone.js）

**目标：** 建立稳定单时钟、漂移和ownership规则，为 Timeline提供唯一时间。

**允许修改：** PlaybackClock、coordinator、测试、架构文档。

**禁止修改：** 安装Tone、视觉Timeline、Camera keyframe、模板布局。

**新增文件：** `src/memory/engine/MemoryPlaybackCoordinator.ts`、clock integration tests。

**修改文件：** PlaybackClock files、memoryTemplateStore、`ARCHITECTURE.md`、`CREDITS.md`研究结论。

**新增依赖：** 无。

**执行步骤：**

1. 明确 media currentTime为音乐模式真相；fallback performance time为静音真相。
2. coordinator提供start/pause/resume/seek/replay/exit，所有命令原子更新状态机。
3. ended保持duration/final state；不自动归零。
4. UI progress节流≤10Hz；R3F可每帧getSnapshot。
5. audio mid-play error从相同normalized progress切fallback。
6. 写双时钟不存在的结构测试/文档。

**关键数据结构：** coordinator持有clock/session token，旧async结果不能覆盖新session。

**关键交互：** command sequence；重复点击被去重；快速退出取消pending load。

**视觉参数：** 无视觉新增。

**错误处理：** race、stale promise、ended、duration=0、seek before metadata。

**测试命令：** coordinator/clock tests + check。

**手工测试：** start时快速back、load中换音乐、播放中音频错误、静音fallback。

**验收标准：** 所有命令只有一个master clock；没有drift/two-player；架构文档明确Tone不采用原因。

**回滚方法：** 回到Phase9 adapter；不影响原MusicExperience。

**下一阶段前置条件：** race/ownership/ended tests通过。

## Phase 11｜TimelineEngine Foundation

**目标：** 实现纯函数 `evaluateState(progress)`，先只支持 Scattered↔Orbit和Camera。

**允许修改：** 新Timeline引擎/config validation/template layer/coordinator。

**禁止修改：** High-school全部叙事细节、音乐视觉联动、其他模板。

**新增文件：** `src/memory/engine/TimelineEngine.ts`、`easing.ts`、`validateTimeline.ts` 及 tests。

**修改文件：** `MemoryTemplateLayer.tsx`、CameraRig adapter、coordinator、high-school config最小phase fixture。

**新增依赖：** 无。

**执行步骤：**

1. 实现T节phase定位/local/easing/interpolate。
2. 输出完整TemplateFrameSnapshot，初期scene/ui字段为安全默认。
3. R3F useFrame从clock读progress并evaluate；不写全snapshot到store。
4. Debug slider调用同一API，不建第二逻辑。
5. 验证随机访问0.2→0.75→0.4与边界。

**关键数据结构：** TimelineContext、TemplateFrameSnapshot、phase validator。

**关键交互：** clock播放和slider seek均驱动同一evaluate。

**视觉参数：** default cinematic easing `(0.2,0.8,0.2,1)`纯函数近似；无spring。

**错误处理：** 非法phase、missing layout、non-finite输出，生产toast+安全退出。

**测试命令：** Timeline unit + camera/layout tests + check。

**手工测试：** slider随机跳转；play/pause；FPS debug；现有Scene回归。

**验收标准：** seek无需从头模拟；每帧无React render风暴；Scattered↔Orbit/Camera同步。

**回滚方法：** 移除Timeline hookup，回到Phase10 clock + Phase7 manual layout。

**下一阶段前置条件：** random-access、phase validation、同步通过。

## Phase 12｜《那年夏天》六阶段 Timeline

**目标：** 完整实现 Z 节六阶段叙事，关闭音乐也能理解故事结构。

**允许修改：** high-school config、Timeline rules、template layer、Camera preset、Preview/Playback copy、tests。

**禁止修改：** 其他四模板实现、音乐视觉联动、现有 Universe布局、Archive/Import。

**新增文件：** `src/memory/templates/highSchoolTimeline.ts`（若 config 无法清晰承载纯数据）、phase fixture/visual tests。

**修改文件：** high-school config、TimelineEngine adapter、MemoryTemplateLayer、Camera preset、PlaybackOverlay。

**新增依赖：** 无。

**执行步骤：**

1. 将16张照片分配 Awakening/Campus/People/Formation/Climax/Hero，少量照片按Z2规则缩放。
2. 实现0/.10/.28/.48/.70/.88/1 exact phase边界。
3. 所有 stagger由 `localProgress` 和 photo order解析计算。
4. 实现Formation 5%–8%解析式 overshoot，确保seek可重建。
5. Hero在0.70前不可见，0.78附近聚焦，0.88后回归。
6. Outro保留final snapshot与可配置文案，不黑屏。
7. 将Camera keyframe与photo/layout snapshot同一次evaluate输出。
8. 增加phase label到DEV debug state，production隐藏。

**关键数据结构：** high-school photo roles、phase-specific visibility/hero rules必须由config/纯函数描述，不在React中散落if。

**关键交互：** Preview→silent start→完整65s；Debug可直接定位七个checkpoint。

**视觉参数：** 严格使用Z3和X keyframes；普通照片opacity不低于.72（高潮弱化时）；Hero scale 1.25–1.35。

**错误处理：** Hero失败自动换最后可用；阶段照片为空时重分配，不除零或留整段黑场。

**测试命令：** highSchoolTimeline/Timeline/Camera/Layout tests + `pnpm run check`。

**手工测试：** 2/6/16/30张；关闭音乐完整观看；checkpoint截图；防穿模、防眩晕。

**验收标准：** 肉眼明确看到“苏醒→校园→人物→聚合→Hero→拉远”；final不是黑屏；随机seek任意phase正确。

**回滚方法：** 回到Phase11 generic two-layout timeline；保留基础engine。

**下一阶段前置条件：** 六阶段视觉与unit/checkpoint全部通过。

## Phase 13｜Pause / Resume / Replay

**目标：** 三个控制同时管理Audio、Timeline、Camera、Layout、Hero和UI。

**允许修改：** coordinator、state machine、PlaybackOverlay/GlassPlayer、tests。

**禁止修改：** layout公式、Camera keyframes、现有非模板播放器行为。

**新增文件：** `src/memory/ui/PlaybackOverlay.tsx`、`ReplayControls.tsx`、integration tests。

**修改文件：** coordinator/store、AppShell或UniverseHUD的template overlay mount、MusicExperience的控制桥。

**新增依赖：** 无。

**执行步骤：**

1. Pause：先clock.pause，再状态playing→paused；frame保持同一snapshot。
2. Resume：paused→playing；不重新prepare layouts、不重置camera。
3. Replay：ended/paused允许；clock reset、progress0、session token更新、snapshot0、camera0、Hero隐藏、UI starting→playing。
4. Keyboard Space映射pause/resume；ended时R replay。
5. 防双击：starting期间所有start/replay按钮disabled。
6. 写连续10次pause/resume和3次replay测试。

**关键数据结构：** 单一PlaybackStatus；session token防旧promise。

**关键交互：** GlassPlayer、Space、Replay、Exit。

**视觉参数：** Pause UI 220ms淡入；播放画面不退回Preview；Replay start使用900ms转场但不重复载纹理。

**错误处理：** pause在loading/ended安全no-op；resume若audio失效切fallback；replay失败回ended并toast。

**测试命令：** coordinator/state/UI tests + check。

**手工测试：** 每个phase暂停；切tab后回来；结束后Replay；音频/静音两种。

**验收标准：** 音乐停照片/Camera完全停；Resume同一点继续；Replay所有状态归零且无资源增长。

**回滚方法：** 移除PlaybackOverlay新增控制，保留Timeline只读播放原型。

**下一阶段前置条件：** pause/resume/replay集成验收通过。

## Phase 14｜Seek + evaluateState(progress)

**目标：** 用户20%→75%直接恢复到75%正确Scene，无逐帧追赶。

**允许修改：** progress control、coordinator seek、Timeline/Camera应用、tests/debug。

**禁止修改：** phase语义、音频文件、layout生成。

**新增文件：** seek integration tests；必要时 `src/memory/engine/seekPolicy.ts`。

**修改文件：** GlassPlayer progress、PlaybackOverlay、coordinator、template store throttle。

**新增依赖：** 无。

**执行步骤：**

1. pointer down记录seek前是playing还是paused，进入seeking。
2. dragging时clock.seek + evaluate目标progress；Camera直接set pose；UI≤30Hz，Scene frame实时。
3. pointer up恢复原playing/paused；Camera最多180ms settle。
4. keyboard Left/Right ±5s使用同一seek action。
5. ended从进度向前seek后进入paused，用户明确Play才继续。
6. 测试0、1、20→75、75→20和phase边界。

**关键数据结构：** `resumeAfterSeek: 'playing'|'paused'`只存在coordinator内部，不新增冲突boolean到global store。

**关键交互：** range拖动、键盘、暂停态seek、结束态seek。

**视觉参数：** 拖动期间无长Morph；目标状态150ms以内可见；Reduced Motion直接切换。

**错误处理：** duration0禁用；NaN clamp；audio seek exception保持原位置并toast。

**测试命令：** Timeline random-access、seek integration、E2E局部、check。

**手工测试：** 快速来回拖；phase边界；播放/暂停/结束三态。

**验收标准：** 20→75后Hero/Orbit/Camera均符合75%；不播放中间55%；音画currentTime一致。

**回滚方法：** 禁用template seek UI，恢复Phase13 controls；不删除evaluateState。

**下一阶段前置条件：** Seek核心验收通过，这是P0强门禁。

## Phase 15｜High-school Visual Polish

**目标：** 在不改变架构与IA的前提下把高中模板达到作品集展示质量。

**允许修改：** High-school数值、材质细节、Template HUD排版、glass强度、camera安全微调、文档截图。

**禁止修改：** Engine public API、状态机、现有页面重设计、添加后期大效果。

**新增文件：** `docs/audit/memory-template-high-school/`截图与说明；可选visual checklist。

**修改文件：** high-school preset/config、MemoryPhoto材质、template CSS、DESIGN_SYSTEM。

**新增依赖：** 无。

**执行步骤：**

1. 按AH4输出七张同viewport截图。
2. 检查照片层级、重叠、Hero、Z-depth、Glass遮挡、中文层级。
3. 只调整集中preset数值，不在组件散写magic number。
4. 分别以Product/Art Direction/Typography/Motion视角检查并直接修复。
5. 对比Reduced Motion和medium/low quality。

**关键数据结构：** 所有调参留在preset/config/token。

**关键交互：** Start、Pause、Seek、Replay、Exit视觉状态。

**视觉参数：** Photo-first；glass alpha≤.10；Glow克制；无蓝紫AI视觉；文字不遮Hero。

**错误处理：** 低性能关闭可选reflection/glow仍保持层级。

**测试命令：** check + high-school E2E + screenshot tests（若稳定）。

**手工测试：** 1920×1080、1440×900、1366×768、360×800；Medium/Low/Reduced。

**验收标准：** 关闭音乐仍像有导演的叙事；不是照片摆形状；截图可用于作品集；原品牌一致。

**回滚方法：** 恢复Phase14 preset快照；不回滚engine。

**下一阶段前置条件：** 视觉审查无阻断，P0核心视觉冻结。

## Phase 16｜音频视觉联动（已取消）

**决策：** 不再使用音频 analyser 驱动照片、粒子、Camera、颜色或转场。音乐只作为播放时间轴与播放器音频表输入。

**允许修改：** 播放器状态、音频表和本地音乐库；不得把音乐特征暴露给 Universe 场景。

**禁止修改：** phase、Camera路径、触发布局、安装Meyda、粒子爆炸。

**新增文件：** 无；不创建 `AudioReactiveAdapter`。

**修改文件：** MemoryTemplateLayer、MemoryPhoto、现有star layer只增加受clamp的template multiplier（如必要）。

**新增依赖：** 无。

**执行步骤：**

1. 保留 HTMLAudioElement 作为唯一播放时钟。
2. 保留音频表的峰值与动态控制读数，仅用于播放器控制台。
3. 不创建 reactive snapshot，不向 Timeline 或 Universe 传递音乐特征。
4. 用系统音频、浏览器上传和播放失败状态做确定性测试。

**关键数据结构：** `MusicAudioMeter`，只保存播放器读数。

**关键交互：** 音乐播放、暂停、Seek 和上传由播放器自身控制；场景不随音频特征变化。

**视觉参数：** 场景视觉参数由模板与场景状态固定决定，不接受音频参数。

**错误处理：** AudioContext不可用时保留基础 HTMLAudioElement 播放，不阻断音乐库或场景。

**测试命令：** music tests、template tests、check。

**手工测试：** 安静/强节奏本地测试音频；关闭音乐；Reduced Motion；性能观察。

**验收标准：** 关闭reactive后故事完全相同；开启只增加呼吸感，不像音乐可视化器。

**回滚方法：** feature flag设0并移除adapter调用；不影响Timeline。

**下一阶段前置条件：** clamp、Reduced Motion、视觉克制通过。

## Phase 17｜Performance & Resource Lifecycle

**目标：** 16–30张Desktop稳定展示，Replay/Exit无GPU与Object URL泄漏。

**允许修改：** template render optimization、preload queue、memo、DPR/performance policy、debug metrics。

**禁止修改：** 以删除核心阶段换FPS、牺牲照片清晰度给星星、重写TextureManager。

**新增文件：** `src/memory/engine/templatePerformancePolicy.ts`及tests；性能报告。

**修改文件：** MemoryTemplateLayer/Photo、PerformanceGovernor adapter、LocalTextureManager只在必要且有test时小改。

**新增依赖：** 无。

**执行步骤：**

1. 建立16/24/30张profile和draw call/texture baseline。
2. 确保prepare layouts memo、frame内对象复用、UI progress节流。
3. 只预载selected thumbnail+Hero preview。
4. 不重复渲染selected base nodes；非selected Universe弱化且低LOD。
5. 设置low/medium/high数量上限和DPR。
6. 连续Replay10次、enter/exit10次记录renderer.info/texture manager。
7. 记录evaluate p95目标<2ms。

**关键数据结构：** performance policy集中配置，不散落设备判断。

**关键交互：** 质量切换、auto降级不打断playback/seek。

**视觉参数：** 优先保Hero清晰，先降particle/DPR/非Hero数量。

**错误处理：** 超预算自动降级一次并toast不打扰；不每秒来回档位。

**测试命令：** performance policy、TextureManager、check、high-school E2E。

**手工测试：** DevTools performance、medium laptop、30张、10次Replay、context restore。

**验收标准：** 接近60fps目标；无持续资源增长；照片清晰度优先；Canvas不freeze。

**回滚方法：** 恢复Phase16 rendering，保留测量报告；不删除已有性能治理。

**下一阶段前置条件：** 性能与lifecycle验收通过。

## Phase 18｜P0 Regression & Release Gate

**目标：** 冻结《那年夏天》P0，完整回归现有产品。

**允许修改：** 测试、缺陷修复、文档、CREDITS；不得新增功能。

**禁止修改：** Love/Breakup/University/Career实现、架构重构、视觉新探索。

**新增文件：** `e2e/memory-template-high-school.spec.ts`、P0 release report。

**修改文件：** 相关tests、README、ARCHITECTURE、DESIGN_SYSTEM、PRODUCT、CREDITS、CHANGELOG。

**新增依赖：** 无。

**执行步骤：**

1. 运行全部unit/check/E2E。
2. 手工走AI节12项回归。
3. 走完整P0流程：Preview→Start→Pause→Resume→Seek→End→Replay→Exit。
4. 测音频失败、图片失败、少照片、过多照片、Reduced Motion、Low quality。
5. 检查production无debug、无商业歌曲资产、无远程模板依赖。
6. 修复所有阻断并重跑。

**关键数据结构：** 不新增；验证public API稳定。

**关键交互：** 全流程与现有产品回归。

**视觉参数：** 七checkpoint与四viewport。

**错误处理：** 逐项触发AE表。

**测试命令：** `pnpm run lint`、`pnpm run typecheck`、`pnpm run test`、`pnpm run test:e2e`、`pnpm run build`。

**手工测试：** P0 DoD 23项 + AI回归。

**验收标准：** AL1全部通过；无阻断；P0报告有证据；才可开始Phase19。

**回滚方法：** 缺陷按所属Phase最小回滚；不得整体回退现有产品。

**下一阶段前置条件：** 用户确认P0稳定和展示质量。

## Phase 19｜Love：《与你有关》

**目标：** 在既有Engine上新增3D Heart模板，不修改P0引擎语义。

**允许修改：** heart layout、love config/camera/timeline、tests/preview copy。

**禁止修改：** 重写Layout/Timeline/Clock、二维emoji、P0 high-school逻辑。

**新增文件：** `src/memory/layouts/heart.ts`、`src/memory/templates/loveTimeline.ts`及tests。

**修改文件：** love config、LayoutEngine registry、CameraDirector presets、template availability。

**新增依赖：** 无。

**执行步骤：**

1. 实现 P 节三层 Heart 和数量适配。
2. 把 heart 注册进 LayoutEngine，不修改现有 scattered/orbit。
3. 实现 AA timeline 和 Love Camera preset。
4. 用 18°–24° 偏转 Camera 明确展示 z 厚度。
5. 实现中央 Hero 和 final 轻呼吸解析函数。
6. 增加随机 seek、Replay 与 E2E 分支。

**关键数据结构：** 复用PreparedLayouts/TemplateFrameSnapshot；只增加layout/preset id。

**关键交互：** 选择Love→Preview→完整播放→seek/replay/exit。

**视觉参数：** z层[-1.25,0,1.25]；final整体scale最大1.015；无红色爱心UI。

**错误处理：** 少照片自适应三层为双/单层，但至少保持z厚度；Hero失败fallback。

**测试命令：** heart/love/Timeline tests、check、相关E2E。

**手工测试：** 6/16/30张，正面与斜角，Reduced Motion。

**验收标准：** 明显3D Heart、不是平面墙；P0与原产品回归全通过。

**回滚方法：** 移除heart registry/love availability，保留通用Engine。

**下一阶段前置条件：** Love完整稳定。

## Phase 20｜Breakup：《后来》

**目标：** 最大复用Heart，以距离/空白完成Broken Heart叙事。

**允许修改：** broken-heart transform、breakup config/timeline/camera、tests。

**禁止修改：** 复制Heart engine、爆炸/碎玻璃/红色效果、改Love。

**新增文件：** `src/memory/layouts/broken-heart.ts`、`src/memory/templates/breakupTimeline.ts`及tests。

**修改文件：** breakup config、LayoutEngine registry、Camera presets、availability。

**新增依赖：** 无。

**执行步骤：**

1. 从同一个 heart prepared target 派生 Q 节 separation。
2. 确保 0.25–0.50 保持完整 Heart，可被肉眼明确识别。
3. 实现 0.50 后的 subtle misalignment 和解析式速度差。
4. 实现左右 separation 与 final 中央 Camera。
5. 验证任意 seek 到 0.50/.65/.82/.94/1 均正确。
6. 增加 Replay、Reduced Motion 和 E2E。

**关键数据结构：** `separation`为Timeline snapshot参数，不存逐帧状态。

**关键交互：** 播放/seek到完整、裂开、final空白；Replay恢复完整初始。

**视觉参数：** max split±4.2；rotation±8°；opacity≥.72；无粒子冲击。

**错误处理：** 节点x=0稳定交替；少照片仍左右均有节点。

**测试命令：** brokenHeart/breakup tests、check、E2E。

**手工测试：** 6/16/30张，重点0.50/.65/.82/.94/1。

**验收标准：** 先完整再破裂；情绪来自空白；其他模板零回归。

**回滚方法：** 移除brokenHeart registry/config availability。

**下一阶段前置条件：** Breakup视觉和回归通过。

## Phase 21｜University：《我们的明天》

**目标：** 实现Learning/Friends/Life三轨Galaxy，不是High-school Orbit换皮。

**允许修改：** galaxy layout、透明分类词表、university timeline/camera/tests。

**禁止修改：** AI分类、真实用户数据写回、重写Orbit、修改现有People View。

**新增文件：** `src/memory/layouts/galaxy.ts`、`src/memory/templates/universityTimeline.ts`、`src/memory/config/universityLaneRules.ts`及tests。

**修改文件：** university config、registry、camera presets、availability。

**新增依赖：** 无。

**执行步骤：**

1. 实现 R 节三个不同轴向的 orbit。
2. 实现 Demo 固定 mapping。
3. 实现 Personal 透明 tags 词表和 deterministic round-robin fallback。
4. 实现 AC timeline 与 University Camera preset。
5. Camera 穿 Friends 轨并验证与照片最近距离 ≥1.2 world unit。
6. Final pull back 显示完整 Galaxy System。
7. 增加 seek/replay/少照片/空 lane/E2E 测试。

**关键数据结构：** lane assignment是session派生数据，不修改Memory tags。

**关键交互：** Preview可查看三类数量；播放/seek/replay。

**视觉参数：** R节半径/轴；final没有单张巨大Hero。

**错误处理：** 某lane为空时按稳定规则从最大lane移动一张；2–5张降为双/单轨并提示实际结构。

**测试命令：** galaxy/lane/university tests、check、E2E。

**手工测试：** 有tags/无tags、6/18/30张、斜角与pullback。

**验收标准：** 三条生活线肉眼可区分；整体Galaxy是结尾主角；无AI假分类。

**回滚方法：** 移除galaxy registry/config availability。

**下一阶段前置条件：** University稳定和全回归通过。

## Phase 22｜Career：《向前》与 V1 Final Gate

**目标：** 实现时间Helix与Milestone，并完成五模板V1总验收。

**允许修改：** helix layout、career timeline/camera/config、最终tests/docs/credits。

**禁止修改：** 大规模重构、未要求DIY Editor、在线API、商业音频。

**新增文件：** `src/memory/layouts/helix.ts`、`src/memory/templates/careerTimeline.ts`及tests、V1 release report。

**修改文件：** career config、registry、camera presets、五模板availability、README/PRODUCT/DESIGN_SYSTEM/ARCHITECTURE/CREDITS/CHANGELOG。

**新增依赖：** 无。

**执行步骤：**

1. 实现S节时间排序Helix与milestone规则。
2. 实现AD timeline和继续向上的结尾。
3. 启用五模板入口，确认无disabled假卡片。
4. 为五模板分别走Preview/Play/Pause/Seek/Replay/Exit。
5. 运行全部tests/E2E/build；检查debug与版权资产。
6. 输出五模板checkpoint、性能、错误、回归与已知限制。
7. DEV `DebugTemplateControls` 最终必须可切换 Scattered / Orbit / Heart / BrokenHeart / Galaxy / Helix，并有 0–1 Timeline slider；production build全部隐藏。

**关键数据结构：** milestone roles配置化，为未来DIY保留session override；不开发Editor。

**关键交互：** 五模板完整入口和播放器控制。

**视觉参数：** S/AD；Milestone +15%–30%；前方helix进入黑暗但仍可见延续。

**错误处理：** 无日期按createdAt/id稳定；无milestone选择最后一张为弱milestone。

**测试命令：** 全量lint/typecheck/unit/E2E/build。

**手工测试：** 五模板、所有quality、Reduced Motion、360px、audio/silent、少/多照片、10次Replay。

**验收标准：** AL全部通过；五模板有不同叙事结构；P0和原产品无回归；公开仓库无歌曲资产/API依赖。

**回滚方法：** 只关闭Career availability并移除helix registry；若最终文档错误单独修复，不回滚其他稳定模板。

**下一阶段前置条件：** 本 Phase 即 V1 Final Gate；通过后才可规划DIY Editor或Song Cue V2。

---

# AK. File-Level Instructions

## AK1. 建议最终新增文件

```text
src/components/ui/
├─ glass-button.tsx
├─ glass-panel.tsx
├─ glass-chip.tsx
├─ glass-tabs.tsx
├─ glass-player.tsx
├─ glass-modal.tsx
└─ glass-tooltip.tsx

src/memory/
├─ types.ts
├─ config/
│  ├─ high-school.ts
│  ├─ love.ts
│  ├─ breakup.ts
│  ├─ university.ts
│  ├─ career.ts
│  ├─ universityLaneRules.ts
│  ├─ validateTemplateConfig.ts
│  └─ index.ts
├─ engine/
│  ├─ seededRandom.ts
│  ├─ LayoutEngine.ts
│  ├─ interpolateTransform.ts
│  ├─ TimelineEngine.ts
│  ├─ easing.ts
│  ├─ validateTimeline.ts
│  ├─ CameraDirector.ts
│  ├─ PlaybackClock.ts
│  ├─ MediaElementPlaybackClock.ts
│  ├─ FallbackPlaybackClock.ts
│  ├─ MemoryPlaybackCoordinator.ts
│  ├─ AudioReactiveAdapter.ts
│  └─ templatePerformancePolicy.ts
├─ layouts/
│  ├─ scattered.ts
│  ├─ memory-orbit.ts
│  ├─ heart.ts
│  ├─ broken-heart.ts
│  ├─ galaxy.ts
│  └─ helix.ts
├─ templates/
│  ├─ highSchoolTimeline.ts
│  ├─ loveTimeline.ts
│  ├─ breakupTimeline.ts
│  ├─ universityTimeline.ts
│  └─ careerTimeline.ts
├─ scene/
│  ├─ MemoryPhoto.tsx
│  └─ MemoryTemplateLayer.tsx
└─ ui/
   ├─ TemplateLauncher.tsx
   ├─ TemplatePreview.tsx
   ├─ PlaybackOverlay.tsx
   ├─ ReplayControls.tsx
   └─ DebugTemplateControls.tsx

src/stores/memoryTemplateStore.ts
src/styles/glass.css
e2e/memory-template-high-school.spec.ts
docs/memory-template/
```

测试与实现同目录，命名 `.test.ts(x)`。如果职责可以自然合并，允许减少小文件，但禁止把 Layout、Timeline、Camera、Clock 全塞进一个巨型文件。

## AK2. 必须最小修改的现有文件

| 文件 | 允许修改 |
|---|---|
| `package.json` / lockfile | 仅CVA和必要scripts；不加Tone/Meyda/Tailwind |
| `tokens.css` | Glass aliases与motion tokens |
| `src/styles/globals.css` | import glass.css与少量业务布局；不要继续堆大量组件视觉 |
| `src/app/router.tsx` | DEV-only GlassLab；template不加新主route |
| `src/app/AppShell.tsx` | mount协调overlay；不改变IA |
| `src/features/universe/UniverseHUD.tsx` | 增加TemplateLauncher；保留四视图 |
| `src/scene/UniverseScene.tsx` | mount template layer、弱化existing layer；复用starfield |
| `src/scene/CameraRig.tsx` | template playback pose adapter；保持唯一writer |
| `src/features/music/MusicExperience.tsx` | 注册现有audio给clock；GlassPlayer skin；不创建第二audio |
| `src/stores/musicStore.ts` | 仅必要粗粒度事件；不存HTMLElement/每帧snapshot |
| `src/scene/textures/*` | 原则上不改；只有真实lifecycle bug且有test才改 |
| docs/CREDITS | 每Phase同步关键决策、依赖与版权 |

## AK3. 不得修改或不得重写

- 不重写 `MemoryNode.tsx`；模板用独立MemoryPhoto并共享texture基础；
- 不重写现有Relationship/四视图layout；
- 不改变IndexedDB schema，V1 template session不持久化；
- 不重新引入第三方账号连接、本机连接器或二维码授权；
- 不改Demo照片或添加歌曲资产；
- 不删除现有E2E以让新测试通过；
- 不改package name或全站MEMENTO/Memuniverse命名，本阶段只保证新用户文案统一使用Memuniverse。

## AK4. Future DIY 扩展点

V1 不建编辑器，但以下必须保持可覆盖：

```ts
interface TemplateSessionOverrides {
  photoIds?: string[];
  heroPhotoId?: string;
  photoOrder?: string[];
  phaseOverrides?: Partial<Record<string, Partial<TimelinePhase>>>;
  layoutPreset?: string;
  cameraPreset?: string;
  songCueMap?: SongCueMap;
}
```

Engine 接受 overrides 后重新 prepare；UI V1 不暴露复杂参数。禁止把用户未来可调内容写死在React component。

---

# AL. Definition of Done

## AL1. 《那年夏天》P0 DoD

- [ ] 点击高中模板仍在现有 `/universe`，Preview正常；
- [ ] Preview显示名称、类别、真实照片数量、预计时长；
- [ ] Glass“开始回忆”有loading/disabled/focus/reduced states；
- [ ] 可选择本地音乐；无音乐可静音完整播放；
- [ ] 音乐或fallback clock是唯一时间源；
- [ ] 照片是真正R3F 3D对象；
- [ ] Scattered→三层Memory Orbit可运行；
- [ ] 斜角可见明确Z depth；
- [ ] CameraDirector接管且CameraRig仍唯一writer；
- [ ] Hero graduation photo正常；
- [ ] Outro pull back后完整结构保留，不黑屏；
- [ ] Pause同时暂停Audio、Timeline、Camera、Layout；
- [ ] Resume从同一状态继续；
- [ ] Replay重置Camera、Photo transforms、Orbit、Hero、UI和clock；
- [ ] Seek 20%→75%立即恢复正确视觉；
- [ ] 照片不足不复制，照片过多不全上GPU；
- [ ] 音乐/单图失败可降级；
- [ ] Reduced Motion功能完整；
- [ ] Liquid Glass没有蓝紫AI风格且不遮照片；
- [ ] 原导航、上传、Universe、Dive、Archive、Settings、音乐、Backup未破坏；
- [ ] 16–30张Desktop达到可展示性能；
- [ ] Console无未处理错误/严重warning；
- [ ] lint/typecheck/unit/E2E/build全部通过。

任何一项失败，P0不得宣布完成，也不得进入Phase19。

## AL2. V1 五模板 DoD

- [ ] 五模板均可真实选择、Preview、播放、暂停、Seek、Replay、Exit；
- [ ] High-school是三层Memory Orbit；
- [ ] Love是有厚度的3D Heart，结尾保持完整；
- [ ] Breakup先完整再分离，中央空白明确，无爆炸；
- [ ] University是Learning/Friends/Life三轨Galaxy，不是高中换皮；
- [ ] Career是按时间上升的Helix，结尾表达仍有前方；
- [ ] 所有layout、timeline、camera、photo order均配置化；
- [ ] 没有散落的 `if(template === ...)` 业务分支；registry/strategy负责选择实现；
- [ ] 所有模板使用同一Clock、TimelineEngine、CameraRig、MemoryPhoto和GlassPlayer；
- [ ] 商业歌曲未进入仓库、build和deployment；
- [ ] 不需要API Key/Secret/本地服务即可体验模板；
- [ ] Debug controls不在production显示；
- [ ] CREDITS和架构/设计文档已更新；
- [ ] 全量自动化和现有产品回归通过。

## AL3. Luan 每阶段汇报格式

Luan 每个Phase结束只能按以下格式报告，不得只说“完成”：

```text
[Phase X｜名称]

新增文件：
- ...

修改文件：
- ...

新增/移除依赖：
- ...

执行命令与结果：
- lint:
- typecheck:
- unit:
- e2e/smoke:
- build:

手工测试：
- viewport/browser:
- 操作路径:
- 结果:

成功项：
- ...

失败项：
- 无 / ...

Console / Network：
- ...

视觉证据：
- screenshot path / description

风险与遗留：
- ...

回滚点：
- commit / patch / files

下一阶段是否满足前置条件：
- 是 / 否
- 证据：...
```

## AL4. 最终工程命令

```text
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:e2e
pnpm run build
```

随后运行 production preview，检查五模板、Desktop/360px、Reduced Motion、音频/静音、刷新、Back/Forward、Console、Network、GPU resources。

---

# 最终执行原则

Luan 不要一次性执行本文。先做 Phase 0，只报告审计结果和最小侵入方案；确认稳定后再进入 Phase 1。

始终使用以下关系判断实现是否正确：

```text
照片 = 记忆主体
3D Shape = 记忆结构
Music = 情绪时间
Camera = 观看视角
Timeline = 导演
Liquid Glass = 控制界面
Universe = 整个产品世界
```

Memuniverse 模板不是把照片摆成一个形状，而是让照片随着时间，在三维空间里重新经历一次这段人生。
