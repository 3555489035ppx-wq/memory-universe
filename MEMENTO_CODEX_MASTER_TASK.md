# MEMENTO｜空间记忆宇宙

## 给 Codex 的最终工程实施任务书

> 文档版本：1.0  
> 生成日期：2026-08-04  
> 执行目标：从当前空项目开始，完成一个可运行、可测试、可静态部署、可公开放入作品集的 Local First（本地优先）中文 Web 产品。  
> 上游依据：原始 112 节产品母规范、`OPEN_SOURCE_RESEARCH.md`、`CREDITS.md`。  
> 本文是实施时的唯一主任务书；若与母规范存在工程细节冲突，以本文的收敛决策为准，但不得改变 MEMENTO 的核心产品语义。

---

# 0. 你的角色、工作方式与停止条件

你是本项目的主工程与产品实现负责人。你的任务不是生成概念 Demo、几张漂亮页面或一个 3D 星点效果，而是完成 MEMENTO 的真实核心闭环。

必须按以下方式自主推进：

1. 先阅读根目录中的 `AGENTS.md`、本文、`OPEN_SOURCE_RESEARCH.md`、`CREDITS.md`；若文件不存在，记录缺失但继续执行。
2. 先检查当前目录，不覆盖用户已有文件，不重写无关内容。
3. 建立实施计划，但不要就母规范中已经明确的事项反复询问用户。
4. 按“基础设施 → 数据闭环 → 核心空间体验 → 管理能力 → 性能与测试 → 文档与部署”的顺序完成。
5. 每完成一个阶段立即运行对应检查；发现问题必须修复后再继续。
6. 允许为了实现细节做合理判断，但不得把产品改成相册、Dashboard（仪表盘）、社交 Feed、星空壁纸或传统详情页。
7. 不得用假按钮、固定成功结果、内存数据、伪 AI 文案或无法恢复的临时状态冒充完成。
8. 不得把 P1 视觉增强置于 P0 数据与交互闭环之前。
9. 最终必须执行完整 lint、类型检查、单元测试、端到端测试和生产构建；失败即不算完成。
10. 只有当本文的 P0 验收全部通过、无阻断错误、文档与版权记录齐全时，才能声明完成。

遇到不影响核心方向的细节缺口，采用最简单、可靠、可维护、可验证的方案并记录在 `ARCHITECTURE.md`。只有遇到不可逆操作、缺少必须由用户提供的资产或重大范围冲突时才暂停询问。

---

# 1. 产品定义

## 1.1 一句话定位

MEMENTO 不是帮助用户“找到一张照片”，而是让用户通过时间、人物、地点、情绪和关系，重新进入一段记忆。

## 1.2 目标用户与场景

目标用户是希望重新理解个人照片关系、而不满足于相册时间流的人。核心场景：

- 初次访问者通过本地演示宇宙在一分钟内理解产品价值；
- 用户导入自己的照片，在浏览器本地生成可探索的记忆空间；
- 用户从一段记忆通过 Memory Echo（记忆回声）连续进入相关记忆；
- 用户切换 TIME / PEOPLE / PLACE / EMOTION 四种观察方式；
- 用户编辑元数据、建立 Constellation（记忆星座）、备份并恢复自己的数据。

## 1.3 核心闭环

```text
导入或进入 Demo
  → 记忆形成空间结构
  → Hover / Focus 看见关系
  → Memory Dive 进入一段记忆
  → Memory Echo 进入下一段相关记忆
  → 编辑或连接为星座
  → IndexedDB 持久化
  → ZIP 备份与恢复
```

## 1.4 AI 边界

P0 不接任何大模型、视觉模型、云端人脸识别或外部 AI API。产品价值来自透明、可解释、可编辑的 Relationship Engine（关系引擎），不使用“AI 分析”“智能推荐”等虚假表述。

人物、地点、情绪与标签由 EXIF 或用户输入提供。Relationship Engine 的每个结果必须能显示原因，例如“同一个人”“时间相近”“相同地点”，用户编辑元数据后关系必须重新计算。

## 1.5 作品集价值

最终项目必须能够清楚讲述：

- 为什么普通时间线不足以表达记忆；
- Local First 如何成为隐私与体验决策，而不是口号；
- 四种布局如何让同一批内容产生不同理解；
- Relationship Engine 如何透明计算并驱动空间、推荐与动效；
- 持续 3D Scene、图片 LOD、纹理回收和本地数据库如何共同保障真实产品体验；
- 哪些开源底层模块被合规复用，哪些产品逻辑坚持自研。

---

# 2. 不可变产品原则

以下约束优先级最高：

1. 所有用户可见文案使用中文；品牌名 `MEMENTO` 可保留英文。
2. Memory is Spatial：核心体验必须发生在连续空间中，不是把网格相册套上星空背景。
3. Relationship First：关系决定距离、可见度、连线、Echo 排序与局部聚拢。
4. Direct Manipulation：用户通过拖拽、滚动、点击、长按或 Shift 多选直接操纵记忆。
5. Local First：照片处理、数据保存、关系计算、备份恢复全部在浏览器完成。
6. No Fake AI：没有真实 AI 就不出现 AI 声明。
7. Persistent Scene：路由变化不能销毁主 WebGL Canvas；镜头转场必须在同一空间连续发生。
8. 内容驱动视觉：照片是主角；背景、粒子、发光、后期效果只能辅助空间层级。
9. 克制而有辨识度：黑、象牙白、灰与照片衍生色为主，拒绝紫蓝 AI 渐变、赛博朋克、玻璃卡片墙、巨大 Hero、机器人和星星图标。
10. 功能必须真实：刷新后数据仍在，错误有中文反馈，备份可恢复，按钮均有结果。

---

# 3. 范围、优先级与明确不做

## 3.1 P0：本次必须完成

- `/` 双入口与本地导入入口；
- `/universe` 持续 3D 宇宙、四视图、Time Collapse；
- `/memory/:id` Memory Dive、Memory Echo、返回宇宙；
- `/constellation/:id` 创建、查看、编辑星座；
- `/archive` 搜索、筛选、排序、编辑、删除、导入；
- `/settings` 质量、动态、备份、恢复、清空本地数据、隐私说明；
- 至少 60 条、使用本地合法资产的 Demo 记忆；
- 照片导入、EXIF、三档派生图、主色、IndexedDB 持久化；
- Relationship Engine 和四种自有布局逻辑；
- LOD、Texture Manager、性能自动降级；
- Reduced Motion（减少动态）和基础键盘可访问性；
- 单元测试、端到端测试、生产构建；
- README 与产品、设计、架构、隐私、版权文档。

## 3.2 P1：P0 全部通过后才允许实现

- 单个、许可证独立核验通过的图片 Shader 转场；
- 极轻景深、暗角、颗粒等后期效果；
- 关闭为默认的环境音或声音反馈；
- 备份包含原图选项；
- 更复杂的星座编辑动效；
- 对浏览器原生不支持格式的轻量本地解码。

P1 失败必须可完全关闭，不能破坏 P0。

## 3.3 本次不做

- 登录、账号、云同步、服务端、数据库服务、远程存储；
- 分享链接、社交关系、评论、点赞、公开社区；
- 人脸识别、反向地理编码、地图 API；
- 在线 AI、API Key、环境变量依赖；
- 视频、Live Photo、复杂 RAW 处理；
- 多人协作；
- 整个 Fork 现成照片产品或复制完整 UI；
- 真实中国地图或 Google Map；
- WebXR、WASD 游戏控制；
- 超过 150 个同时活跃 3D 节点的无限扩展承诺。

---

# 4. 技术基线与依赖策略

## 4.1 工程基线

使用：

- Vite + React 19 + TypeScript（strict）；
- React Router；
- Three.js + React Three Fiber（R3F）+ Drei；
- Zustand 仅管理运行时和 UI 状态；
- IndexedDB + `idb` 管理持久化领域数据与 Blob；
- CSS Modules 或项目统一的原生 CSS 分层；不要引入大型 UI 框架；
- GSAP 仅用于 UI、布局插值进度和 Shader uniform；镜头由 camera-controls 独占；
- Vitest + Testing Library；
- Playwright；
- ESLint + Prettier。

当前经研究验证的首选兼容基线：

| 包 | 首选稳定版本 | 备注 |
|---|---:|---|
| `three` | `0.185.0` | 升级前必须重新核验后期处理兼容性 |
| `@react-three/fiber` | `9.7.0` | React 19 |
| `@react-three/drei` | `10.7.7` | 不用 v11 alpha |
| `camera-controls` | `3.1.2` | 由 Drei wrapper 接入 |
| `d3-force-3d` | `3.0.6` | 仅坐标求解；本地维护窄类型 |
| `exifreader` | `4.41.3` | 先通过 fixture / Worker / bundle 门禁 |
| `pica` | `10.0.2` | 单例、有限并发 |
| `fast-average-color` | `9.5.2` | 对 micro 或小画布取色 |
| `idb` | `8.0.3` | 唯一 IndexedDB wrapper |
| `fflate` | `0.8.3` | 唯一 ZIP 引擎 |
| `gsap` | `3.15.0` | 按官方标准许可调用，不复制源码 |

安装前在同一天核验 peer dependencies 和稳定 Release。如果注册表版本已变化，选择一组互相兼容的稳定版本，不使用 `latest` 浮动、不使用 alpha/beta；在 `ARCHITECTURE.md` 记录偏离原因，并提交 lockfile。

`@react-three/postprocessing@3.0.4` + `postprocessing@6.39.4` 只属于 P1。若 Three 升至 r186 或更高，未重新核验前不得安装这组版本。

## 4.2 依赖约束

- 不引入 Tailwind、MUI、Ant Design、shadcn 整套组件、Dexie、JSZip、3d-force-graph、three-forcegraph、tldraw、Immich 代码。
- 不允许 CDN、运行时远程脚本、远程字体、远程图片或远程 Worker。
- 只从包的 ESM export 导入需要能力；避免 `import *` 扩大 bundle。
- 所有动态 import 必须有本地错误回退。
- 不允许 `any` 扩散；第三方无类型包在 adapter 层定义最小接口。
- 不复制 camera-controls、Pica、ExifReader、idb、fflate 的核心源码；直接依赖更可靠。

## 4.3 开源复用合同

实际技术来源以 `OPEN_SOURCE_RESEARCH.md` 为依据：

1. Drei：精选 `Image`、`CameraControls`、`PerformanceMonitor`、`Instances` / `Points`。
2. camera-controls：执行 `setLookAt` / `fitTo*`，不拥有产品状态。
3. d3-force-3d：只在 Worker 或预计算阶段输出坐标。
4. ExifReader：未修改依赖，通过 `MetadataAdapter` 归一化；保留 MPL-2.0 义务。
5. Pica：生成本地派生图。
6. Fast Average Color：提取一个稳定主色。
7. idb：IndexedDB wrapper。
8. fflate：流式备份恢复。

可复制 MIT / ISC / Zlib 小模块，但必须：

- 固定上游仓库与 commit；
- 只复制解决具体问题的最小文件或片段；
- 保留版权与许可证头；
- 在 `CREDITS.md` 写出上游文件、项目内文件、修改内容；
- 将许可证文本放入 `THIRD_PARTY_LICENSES/`；
- 不复制 Demo 视觉、文案、照片、字体、HDR、Logo、商标或商业资产。

GSAP 不是 MIT 源码来源，只能作为依赖使用。tldraw、AGPL 完整照片产品不进入实现。gl-transitions 仅可在 P1 逐文件核验许可证后复制一个克制的 MIT Shader。

---

# 5. 路由与持续场景架构

必须实现以下路由：

```text
/                         Entry Scene（入口）
/universe                 记忆宇宙
/memory/:id               Memory Dive
/constellation/:id        星座详情
/archive                  记忆档案
/settings                 设置与数据
```

应用结构必须保证 Canvas 不随路由卸载：

```text
App
└─ AppShell
   ├─ PersistentSceneShell
   │  ├─ Canvas（唯一 WebGL Canvas）
   │  ├─ SceneRouterBridge
   │  ├─ UniverseScene
   │  ├─ CameraRig
   │  ├─ LayoutTransitionController
   │  ├─ MemoryLODRenderer
   │  └─ SceneEffects
   ├─ RouteOverlays
   │  ├─ EntryOverlay
   │  ├─ UniverseHUD
   │  ├─ MemoryDiveOverlay
   │  ├─ ConstellationOverlay
   │  ├─ ArchivePage
   │  └─ SettingsPage
   ├─ ImportTray
   ├─ ToastRegion
   └─ AccessibleLiveRegion
```

规则：

- `Canvas` 位于 `<Routes>` 外；route 只改变 scene mode 和 overlay。
- 直接打开 `/memory/:id` 时先 hydrate 数据，再把相机置于可解释初始姿态；不播放从不存在位置开始的长飞行动画。
- 浏览器 Back/Forward 必须同步场景状态；场景返回也必须更新 route。
- Archive 和 Settings 可覆盖 Canvas，但不能建立第二个 WebGL renderer。
- 页面间不得使用整页白闪、硬刷新或卸载所有纹理来伪装转场。

---

# 6. 目录与文件责任

按以下结构创建。允许为测试补充同目录文件，但不得随意建立重叠架构。

```text
/
├─ public/
│  ├─ demo/photos/                 # 已核验许可证的本地 Demo 照片
│  └─ demo/demo-memories.json
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ AppShell.tsx
│  │  ├─ router.tsx
│  │  └─ bootstrap.ts
│  ├─ domain/
│  │  ├─ memory.ts
│  │  ├─ person.ts
│  │  ├─ place.ts
│  │  ├─ constellation.ts
│  │  ├─ relationship.ts
│  │  ├─ settings.ts
│  │  └─ backup.ts
│  ├─ data/
│  │  ├─ db.ts
│  │  ├─ schema.ts
│  │  ├─ migrations.ts
│  │  ├─ repositories/
│  │  ├─ demoRepository.ts
│  │  └─ quota.ts
│  ├─ engine/
│  │  ├─ relationship/
│  │  │  ├─ scoreRelationship.ts
│  │  │  ├─ buildRelationshipGraph.ts
│  │  │  └─ explainRelationship.ts
│  │  ├─ layout/
│  │  │  ├─ timeLayout.ts
│  │  │  ├─ peopleLayout.ts
│  │  │  ├─ placeLayout.ts
│  │  │  ├─ emotionLayout.ts
│  │  │  ├─ constellationLayout.ts
│  │  │  ├─ layout.worker.ts
│  │  │  └─ layoutCache.ts
│  │  ├─ camera/
│  │  │  ├─ cameraMachine.ts
│  │  │  ├─ cameraPoseStack.ts
│  │  │  └─ cameraTimings.ts
│  │  ├─ texture/
│  │  │  ├─ LocalTextureManager.ts
│  │  │  ├─ textureBudget.ts
│  │  │  └─ variantSelector.ts
│  │  ├─ import/
│  │  │  ├─ importPipeline.ts
│  │  │  ├─ validateImage.ts
│  │  │  ├─ MetadataAdapter.ts
│  │  │  ├─ normalizeOrientation.ts
│  │  │  ├─ deriveImages.ts
│  │  │  ├─ extractDominantColor.ts
│  │  │  └─ image.worker.ts
│  │  └─ backup/
│  │     ├─ exportBackup.ts
│  │     ├─ validateBackup.ts
│  │     ├─ restoreBackup.ts
│  │     └─ backup.worker.ts
│  ├─ scene/
│  │  ├─ PersistentSceneShell.tsx
│  │  ├─ UniverseScene.tsx
│  │  ├─ CameraRig.tsx
│  │  ├─ MemoryLODRenderer.tsx
│  │  ├─ MemoryNode.tsx
│  │  ├─ RelationshipLines.tsx
│  │  ├─ TimeCollapse.tsx
│  │  └─ effects/
│  ├─ features/
│  │  ├─ entry/
│  │  ├─ universe/
│  │  ├─ memory-dive/
│  │  ├─ constellation/
│  │  ├─ archive/
│  │  ├─ settings/
│  │  └─ import/
│  ├─ stores/
│  │  ├─ sceneStore.ts
│  │  ├─ uiStore.ts
│  │  ├─ selectionStore.ts
│  │  └─ settingsStore.ts
│  ├─ styles/
│  │  ├─ tokens.css
│  │  ├─ globals.css
│  │  ├─ typography.css
│  │  └─ motion.css
│  ├─ test/
│  │  ├─ fixtures/
│  │  └─ setup.ts
│  └─ main.tsx
├─ e2e/
├─ THIRD_PARTY_LICENSES/
├─ OPEN_SOURCE_RESEARCH.md
├─ CREDITS.md
├─ PRODUCT.md
├─ DESIGN_SYSTEM.md
├─ ARCHITECTURE.md
├─ PRIVACY.md
├─ README.md
└─ vercel.json
```

模块边界：

- `domain` 不依赖 React、Three、IndexedDB 或第三方解析器；
- `engine` 接受纯数据并输出可测试结果；
- `data` 负责持久化与事务，不让组件直接操作 object store；
- `scene` 只渲染已归一化数据和引擎输出；
- `features` 负责用户流程与中文 UI；
- Blob、Texture、ImageBitmap 和 Object URL 的生命周期只能由 data/import/texture 层管理。

---

# 7. 领域模型与数据约束

## 7.1 Memory

```ts
type MemorySource = 'demo' | 'personal';
type DateSource = 'exif' | 'file' | 'manual' | 'unknown';
type Mood = 'happy' | 'calm' | 'nostalgic' | 'excited' | 'chaotic' | 'lonely' | null;

interface Memory {
  id: string;
  source: MemorySource;
  title: string;
  description: string;
  capturedAt: string | null;       // ISO 8601；时区不明时保留本地语义
  capturedAtMs: number | null;
  dateSource: DateSource;
  personIds: string[];
  placeId: string | null;
  mood: Mood;
  tags: string[];
  dominantColor: DominantColor;
  assetKeys: {
    micro: string;
    thumbnail: string;
    preview: string;
    original?: string;
  };
  width: number;
  height: number;
  orientationApplied: boolean;
  cameraModel?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}
```

不得把浏览器临时 `File`、Blob URL 或 object URL 保存为 `originalFileReference`。需要保留原图时，将 Blob 存入 `assets`，Memory 只保存资产键。刷新后所有引用必须仍有效。

## 7.2 Person、Place、Constellation

```ts
interface Person {
  id: string;
  source: MemorySource;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface Place {
  id: string;
  source: MemorySource;
  name: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

interface Constellation {
  id: string;
  source: MemorySource;
  name: string;
  description: string;
  memoryIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

Demo 与个人数据都可以创建星座，但必须用 `source` 分区。Demo 不得污染个人记忆列表。

## 7.3 Relationship

```ts
type RelationshipReason =
  | 'shared-person'
  | 'same-place'
  | 'within-24h'
  | 'within-7d'
  | 'same-mood'
  | 'shared-tags'
  | 'similar-color';

interface Relationship {
  sourceId: string;
  targetId: string;
  score: number;                   // 0..1
  reasons: Array<{
    type: RelationshipReason;
    contribution: number;
    label: string;                 // 中文解释
  }>;
  engineVersion: number;
}
```

关系是可重建的派生数据，不是唯一事实来源。允许缓存，但 Memory 编辑后必须使相关缓存失效。

## 7.4 Settings

```ts
interface Settings {
  quality: 'auto' | 'high' | 'medium' | 'low';
  motion: 'full' | 'reduced';
  includeOriginalsInBackup: boolean;
  lastUniverseMode: 'demo' | 'personal';
  schemaVersion: number;
}
```

系统 `prefers-reduced-motion` 优先级不得低于用户设置；任一要求减少动态，就使用 reduced 行为。

---

# 8. IndexedDB 与持久化

数据库名：`memento-db`。使用 `idb` 和显式 `DBSchema`，首版 schema version 从 `1` 开始。

Stores：

| Store | Key | 必要索引 / 用途 |
|---|---|---|
| `memories` | `id` | `by-source`、`by-captured-at`、`by-place`、multiEntry `by-people`、`by-mood` |
| `assets` | `key` | `by-memory`、`by-variant`；值含 Blob、MIME、尺寸、校验和 |
| `people` | `id` | `by-source`、`by-name` |
| `places` | `id` | `by-source`、`by-name` |
| `constellations` | `id` | `by-source`、`by-updated-at` |
| `settings` | `key` | 单例设置及数据库元信息 |
| `importJobs` | `id` | 中断恢复、错误统计 |
| `layoutCache` | `[source+view+version]` | 稳定坐标缓存，不是事实数据 |

要求：

- Repository API 是组件访问数据的唯一入口；
- 导入一个 Memory 的 metadata 与 assets 使用同一逻辑事务边界；失败必须清理已写入孤儿 Blob；
- 删除 Memory 必须级联删除资产、星座引用与相关缓存；
- 启动时清理孤儿资产和过期 import job；
- 处理 `blocked`、`versionchange`、配额不足、隐私模式限制和事务失败；
- 通过 `navigator.storage.estimate()` 提前显示容量风险，但不承诺永久存储；
- 若支持 `navigator.storage.persist()`，只能在用户导入后以解释性操作申请，不在首次进入时打扰；
- migration 必须是可测试的纯升级步骤，不能删除未知旧数据；
- Zustand 不保存 Blob，也不复制整份数据库；只保存当前查询结果、id、scene mode 和短期 UI 状态。

---

# 9. Demo 数据与资产

必须提供至少 60 条可完整探索的本地 Demo Memory，覆盖：

- 至少 4 个年份、12 个月份或多段显著时间区间；
- 至少 8 个人物；
- 至少 8 个地点；
- 六种情绪均有合理分布；
- 每条有标题，至少 30 条有描述；
- 有足够重叠形成强、中、弱关系；
- 至少 3 个预置星座，且用户仍能新建 Demo 星座。

资产要求：

- 运行时全部来自 `public/demo`，断网仍可用；
- 优先使用用户拥有或明确 Public Domain / CC0、允许再分发的照片；
- 不得把“网页上能看到”误当作可打包再分发；
- 每张照片记录作者、原始 URL、许可证、下载日期与是否修改；
- 字体、图标、纹理、HDR、音频也要单独核验；
- 不确定许可证的资产不得进入仓库；
- 不允许用同一张图复制 60 条记录假装完整数据。

如果当前工作区没有合法的 60 张 Demo 照片，在具备联网研究能力时，只从官方 Public Domain / CC0 来源受控获取并逐项登记；不得批量抓取搜索结果、社交平台图片或许可证不明素材。若无法合法取得，先完成数据结构与可替换 manifest，并把资产缺口明确标为唯一阻断项。工程和测试可暂用项目内自制 fixture，但最终视觉验收不能把测试 fixture 当成正式 Demo。

---

# 10. 照片导入与图片处理

## 10.1 用户流程

入口和 Archive 均提供“导入照片”。支持拖拽和文件选择。流程：

```text
选择 File[]
  → 校验类型 / 数量 / 大小
  → 显示待导入列表与本地处理说明
  → 逐项执行导入 Pipeline
  → 每项显示读取 / 处理中 / 已完成 / 失败
  → 完成后进入个人 Universe
  → 刷新后仍存在
```

默认接受浏览器可解码的 JPEG、PNG、WebP、AVIF。默认保护常量为单批最多 100 个文件、单文件最多 100MB、解码后最多 8000 万像素；超过时逐项拒绝并解释，不得尝试分配超大 Canvas。保护值集中在 `importLimits.ts`，测试覆盖边界。HEIC/HEIF 先尝试元数据读取，但只有浏览器能成功解码像素时才导入。无法解码时显示：

> 当前浏览器暂时无法直接读取这张 HEIC 照片。建议先转换为 JPG 或 PNG 后再导入。

不得假装 HEIC 支持。单文件失败不能中断整个批次。

## 10.2 Pipeline

```text
File[]
  → validateImage
  → MetadataAdapter（只取所需 tags；失败降级）
  → createImageBitmap / 浏览器解码
  → 应用 EXIF orientation，形成正规化 source
  → Pica singleton + 有限并发
       ├─ preview：长边 1600，必要时不放大小图
       ├─ thumbnail：长边 512
       └─ micro：长边 64
  → 从 micro 提取主色
  → 写入 assets + Memory
  → 更新关系和布局缓存
```

变体建议输出 WebP；若浏览器编码失败则回退 JPEG，透明 PNG 必须保留透明或转为带明确底色的 WebP，不产生黑底。图片已经很小时不放大。

建议质量：preview 0.84、thumbnail 0.80、micro 0.72；实现后用真实照片核验观感和大小，可微调并记录。

## 10.3 MetadataAdapter

ExifReader 只读取：`DateTimeOriginal`、其他可用拍摄时间、Orientation、GPSLatitude、GPSLongitude、Model，以及必要尺寸信息。输出统一类型：

```ts
interface NormalizedMetadata {
  capturedAt: string | null;
  capturedAtMs: number | null;
  dateSource: DateSource;
  orientation: number | null;
  latitude: number | null;
  longitude: number | null;
  cameraModel: string | null;
}
```

要求：

- EXIF 是不可信二进制；设置单文件超时、异常捕获和尺寸保护；
- 无 EXIF 时回退文件修改时间，但标记 `dateSource: 'file'`；
- 时间无时区时不得擅自转换成 UTC 后改变日期；
- GPS 是敏感数据；只保存在本地，导出时在界面明确说明；
- 先用真实横图、竖图、无 EXIF、损坏 EXIF、PNG、WebP、HEIC fixture 验证；
- 如果 ExifReader 的真实 fixture、Worker 或 production bundle 失败，保持同一接口切换 `exifr@7.1.3`，并记录决策；不得同时让两种输出进入领域层。

## 10.4 主色

主色只来自已正规化的小尺寸像素。保存 RGB、HSL、相对亮度和算法版本。主色用于节点底色、微弱光晕、背景呼吸和颜色相似度，不直接映射情绪，也不能覆盖照片本身。

## 10.5 任务调度与资源释放

- 图片处理默认并发 2；高性能设备最多 3，移动端 1；
- 支持 AbortSignal；用户取消后不再写库；
- 每项及时 `ImageBitmap.close()`、撤销 object URL、释放 canvas；
- 显示真实进度，不用无限假进度条；
- 批次结束显示成功数、失败数和每个失败原因；
- 文件过大时提供明确中文说明，不崩溃；限制值放在常量并有测试，不散落在组件。

---

# 11. Relationship Engine

## 11.1 分数公式

对每一对 Memory 计算：

| 关系 | 贡献 |
|---|---:|
| 至少一个共同人物 | `+0.35` |
| 相同地点 | `+0.25` |
| 时间差不超过 24 小时 | `+0.20` |
| 时间差超过 24 小时且不超过 7 天 | `+0.10` |
| 相同非空情绪 | `+0.10` |
| 标签相似 | `Jaccard(tags) × 0.10` |
| 主色相似 | `colorSimilarity × 0.10` |

最终 `score = clamp(sum, 0, 1)`。

收敛规则：

- 24 小时与 7 天两个时间档位互斥，不能累计；
- 多个共同人物仍只加一次 `0.35`；
- 相同地点优先比较同一 `placeId`；若都只有 GPS，则 1km 内视为相同地点；
- 空情绪不匹配；
- 标签先 trim、转小写、去重；
- 颜色相似度使用项目内可测试的 OKLab 或等效感知距离归一化，不能简单比较十六进制字符串；
- 只记录非零 reasons；中文 reason 必须自然；
- 引擎输出必须对输入顺序稳定，使用稳定 id 排序；
- `engineVersion` 改变时清除缓存并重算。

## 11.2 图构建

- Demo 与 personal 不跨源建立关系；
- 默认只保留每个节点最高的 6 条关系，并包含分数超过阈值的强关系；
- 阈值和 topK 集中配置；
- 避免重复无向边；
- 关系分数影响空间目标距离、连线透明度、Focus 时相关节点亮度和 Echo 排序；
- 不能让低分大量连线制造蜘蛛网；
- 编辑 Memory 后只重算受影响节点及其边，随后更新布局。

## 11.3 Echo 排序

Memory Echo 展示 3–6 个候选。先按关系分数降序，再保证原因多样性，避免全部都是同一种关系。当前探索路径中的最近 2 个 Memory 降权，减少 A ↔ B 循环；若候选不足再放宽。

UI 显示简短解释，例如：

- 同一个人 · 林夏
- 同一地点 · 上海
- 相隔 3 小时
- 同一种情绪 · 怀念
- 2 个共同标签

---

# 12. 四种空间布局

所有布局输入与输出必须是纯数据：`Memory[] + Relationship[] + viewportSeed → Record<id, Vec3>`。同一输入得到稳定结果；布局可在 Worker 中预计算并缓存。

## 12.1 TIME

TIME 是默认视图，使用 Memory River（记忆河流），不强行套 force graph。

- 过去映射到更深的 z；现在更靠近相机；
- 年/月形成连续缓曲线；
- 同一天或 24 小时内形成局部簇；
- 缺失日期的 Memory 放在独立、可解释的“时间未标记”支流；
- 曲线必须确定性生成，避免刷新后位置跳变。

## 12.2 PEOPLE

- Person 是 Hub，不做自动人脸识别；
- Memory 围绕关联人物形成轨道；
- 多人物 Memory 位于相关 Hub 的重心之间；
- 共同 Memory 越多，Hub 视觉权重越高，但不变成巨型球；
- 无人物标签的 Memory 进入克制的“未标记人物”区域；
- 点击 Hub 聚焦相关记忆，再次退出恢复全局。

## 12.3 PLACE

PLACE 是“情绪地理”，不是地图。

- place 先形成 anchor；
- anchor 距离主要由跨地点 Memory 关系决定，不按真实公里数直接布局；
- GPS 只帮助归一为地点或初始弱位置，不绘制真实地图；
- 无地点信息进入“地点未标记”区域；
- UI 必须解释：这里呈现的是记忆之间的距离，不是地理距离。

## 12.4 EMOTION

固定情绪：快乐、平静、怀念、兴奋、混乱、孤独。情绪不使用幼稚的一对一颜色编码。

情绪主要影响：

- 节点漂移速度；
- 局部雾密度；
- 粒子活动度；
- 曝光和转场节奏的轻微变化；
- anchor 的空间密度与 motion 参数。

颜色仍来自照片。无情绪信息进入“情绪未标记”区域。

## 12.5 d3-force-3d 边界

PEOPLE / PLACE / EMOTION / Constellation 可将 `d3-force-3d` 用作坐标求解器：

- 输入只包含稳定 id、关系 link、view anchor 和碰撞半径；
- 按 id 稳定排序，显式初始坐标与 layout version；
- 使用 `stop()` + 固定次数 `tick()` 预计算；
- 60–150 个节点放 Worker，不能每帧无限模拟；
- simulation 结束后冻结 target positions；
- force simulation、GSAP 和 R3F frame loop 不能同时写同一节点位置。

## 12.6 视图切换

TIME / PEOPLE / PLACE / EMOTION 切换时：

1. 计算并冻结新 target；
2. 以 650–1000ms 插值同一批节点；
3. 保持选中 Memory 的视觉连续性；
4. 关系线跟随节点更新；
5. 中途再次切换时从当前插值状态可取消并转向新目标；
6. 不清空、重建或闪烁整个 Scene；
7. Reduced Motion 使用 180–260ms 短淡入和最小位移。

---

# 13. 3D Scene、LOD 与纹理

## 13.1 视觉基础

- Perspective Camera，FOV 默认 52，允许范围 48–55；
- 背景接近黑色但不是纯黑，可有极轻雾、颗粒和空间尘埃；
- 不使用银河、星球、霓虹网格、蓝紫云雾或模板化星空；
- 背景效果永远低于照片对比度；
- 默认只绘制必要关系线，线细、透明、缓慢出现；
- 节点比例尊重照片长宽比，不统一裁成卡片。

## 13.2 四级 LOD

| 层级 | 表现 | 纹理 |
|---|---|---|
| Far | 点、微小平面或主色光点 | 无纹理或 micro |
| Medium | 可辨识小图 | micro |
| Near | 清晰照片节点 | thumbnail |
| Focus | Dive / 当前目标 | preview |

使用距离加滞回区间，避免相机边界处来回抖动。Far 尽量使用 `Points` 或 `InstancedMesh`；最多同时维持约 30–50 个完整 thumbnail/preview Texture。场景上限约 150 节点，超出时按可见性与关系裁剪，不承诺无限画布。

## 13.3 LocalTextureManager

必须自建并至少维护：

```ts
interface TextureRecord {
  assetKey: string;
  variant: 'micro' | 'thumbnail' | 'preview';
  state: 'idle' | 'queued' | 'loading' | 'ready' | 'error';
  texture?: THREE.Texture;
  bitmap?: ImageBitmap;
  objectUrl?: string;
  refCount: number;
  lastUsed: number;
  byteEstimate: number;
  retryCount: number;
}
```

必须有：

- 受限加载队列；
- 当前焦点和相机移动方向优先级；
- LRU；
- 引用计数；
- 失败退避与最多一次自动重试；
- 质量档位 byte budget；
- `texture.dispose()`；
- `ImageBitmap.close()`；
- object URL revoke；
- Memory 删除、数据源切换和 Canvas 销毁时的释放路径。

不要把大量动态 Blob URL 直接交给 `useTexture` 全局缓存。Drei `Image` 接收受控 Texture。`<Preload />` 不作为纹理管理或不卡顿保证。

## 13.4 性能档位

- `auto`：根据 DPR、设备内存、帧率和 PerformanceMonitor 动态选择；
- `high`：较高 DPR、更多 near texture、轻后期；
- `medium`：默认平衡；
- `low`：DPR 上限 1、减少粒子/连线、低纹理预算、关闭后期。

自动降级必须有滞回与冷却时间，不能每秒高低跳变。用户手动选择后不自动覆盖。

---

# 14. Camera State Machine

唯一 camera writer 是 `CameraStateMachine`，camera-controls 只执行命令。GSAP、OrbitControls、组件 `useFrame` 不得直接同时写 `camera.position`、target 或 FOV。

状态：

```ts
type CameraState =
  | 'idle'
  | 'navigating'
  | 'focusing'
  | 'diving'
  | 'inside-memory'
  | 'echoing'
  | 'returning'
  | 'reduced-transition';
```

`CameraPoseStack` 保存：

```ts
interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  near: number;
  far: number;
  view: UniverseView;
  focusedMemoryId: string | null;
}
```

交互：

- 鼠标移动只有极轻 Parallax；
- 拖拽改变观察角度，限制 pitch，不能翻转；
- 滚轮前后移动，有边界与惯性；
- 触屏单指旋转/平移、双指缩放，防误触；
- 不以 WASD 为主要控制；
- 任何镜头 Promise 可取消；中断后状态与 route 必须一致；
- 禁止突然改变 FOV、高速无限旋转、shake 和反复 zoom；
- 每次运动都有明确目标、方向、缓动和退出路径。

---

# 15. 核心交互

## 15.1 Entry Scene

首屏文案：

```text
MEMENTO
你的记忆，从来不是一条时间线。

探索演示宇宙
创建我的记忆宇宙
```

背景预示空间照片，但不能把完整 Universe 当壁纸。两个入口权重清晰：

- “探索演示宇宙”立即进入本地 Demo；
- “创建我的记忆宇宙”打开导入流程；
- 如果已有个人数据，补充“继续我的记忆宇宙”；
- 入口动画必须短，不能阻止用户操作。

## 15.2 Universe HUD

HUD 围绕全屏 Canvas，包含：

- 左上：MEMENTO 和当前数据源；
- 顶部或右上：TIME / PEOPLE / PLACE / EMOTION；
- 右上或角落：Archive、Settings；
- 底部：时间范围控制、当前节点数量、必要操作提示；
- 导入入口在 personal empty state 和 Archive 中明确存在；
- 不做传统常驻左侧栏和多层卡片导航。

## 15.3 Hover 与 Focus

Hover 160–220ms：

- 目标 scale 增加 5%–10%；
- 无关节点降低 opacity；
- 相关节点保持；
- 高价值关系线逐渐出现；
- 只显示日期、地点、标题，不堆编辑/删除/分享按钮；
- UI 示例：`2025.07.18 · 上海`、`雨后的上海`。

点击或明确停留进入 Focus：高关系节点轻微靠近，强度随 score 增加；不是所有节点冲向目标。再次点击目标触发 Dive。

键盘用户可通过 Tab/方向键遍历可见 Memory，Enter Focus/Dive，Esc 退出。

## 15.4 Memory Dive

这是 P0 标志性交互。不得打开 Modal 或跳转到传统详情页。

完整动态 800–1200ms：

```text
锁定目标
  → 周围节点退开并轻微虚化
  → 相机朝目标移动
  → 目标照片放大
  → 背景形成克制景深
  → 进入 Memory Dive Scene
```

Desktop 照片占视口 45%–65%。日期、地点、标题、描述在照片周围形成排版，而不是卡片容器。周围保留 3–6 个 Echo 候选。

进入后 route 为 `/memory/:id`。Dive 过程中重复点击被忽略或安全取消，不能创建多个并行动画。

## 15.5 Memory Echo

选择关联 Memory：

```text
当前照片向后退
  → 当前关系线显现
  → Camera 沿关系方向移动
  → 下一张照片进入中心
  → route 更新为 /memory/:nextId
```

时长 700–1100ms。允许连续 Memory → Memory → Memory 探索。显示关联原因；保存探索路径以减少循环。中途 Esc 返回进入 Dive 前的 Universe pose，不是跳到网页顶部。

## 15.6 返回 Universe

Esc 和“返回记忆宇宙”均触发反向空间运动，并恢复进入 Dive 前的 view、相机姿态和大致焦点。完成后 route 更新为 `/universe`。浏览器 Back 也必须触发等价状态同步。

## 15.7 Constellation

- Shift 点击（桌面）或长按（触屏）进入多选；
- 选择 2 个以上 Memory 显示：`已选择 N 段记忆` 与 `连接为星座`；
- 选中节点重新构图，其他节点退去，连线依次绘制；
- 输入名称，描述可选；空名称不能保存；
- 保存写入 IndexedDB 并进入 `/constellation/:id`；
- 详情可 Dive 任意 Memory，可编辑名称/描述、加入/移除 Memory；
- 删除星座只删除关系集合，不删除 Memory。

## 15.8 Time Collapse

底部范围控制从最早到最晚日期。调整范围时范围外节点渐隐、范围内节点靠拢。特殊 Collapse Mode：

```text
节点向中心压缩
  → 成为克制的小型发光体
  → 显示“展开记忆”
  → 节点从中心重新展开到当前 view 目标
```

时长 1000–1500ms。不能使用爆炸粒子或白屏闪光。缺失日期的 Memory 不因范围滑块被永久隐藏，需有明确处理。

---

# 16. Archive 与编辑

Archive 是唯一相对传统的高效率管理页面，但仍保持黑色基底、照片主导和克制工具条。

必须实现：

- 搜索标题、描述、标签、人物、地点；
- 筛选全部、人物、地点、情绪、星座；
- 按拍摄时间、导入时间、最近编辑排序；
- 响应式照片 Grid，使用 thumbnail；
- 导入、编辑、删除；
- 删除需二次确认并说明无法从应用恢复，取消不改变数据；
- Empty State 提供导入与 Demo 入口。

编辑使用 360–420px 右侧面板，仅用于 Archive 等管理场景。字段：标题、日期、地点、人物、情绪、标签、描述。要求：

- 关闭未保存面板时提示；
- 支持创建人物和地点；
- 编辑保存后重新计算相关关系和布局；
- 删除人物/地点时不能产生悬空 id；
- 表单错误中文显示；
- Universe 不随意弹出编辑侧栏。

---

# 17. Settings、隐私、备份与恢复

## 17.1 设置项

- 显示质量：自动 / 高 / 中 / 低；
- 动态：完整 / 减少动态；
- 数据：导出记忆 / 导入备份 / 清除本地数据；
- 隐私说明：

> MEMENTO 默认在浏览器中处理和保存你的照片。除非你主动导出文件，否则照片不会由本产品上传到服务器。

不得使用“绝对安全”“永远不会泄露”等承诺。

## 17.2 备份格式

输出 `memento-backup.zip`，结构：

```text
manifest.json
metadata.json
people.json
places.json
constellations.json
settings.json
assets/
  micro/
  thumbnails/
  previews/
  originals/        # P1 或用户明确选择时
```

`manifest.json` 必含：format、schemaVersion、appVersion、createdAt、sourceCounts、assetCounts、是否含原图、每个文件路径/字节/sha256。

使用 fflate streaming API：JPEG/WebP/AVIF 等已压缩图片使用 pass-through / level 0；不得对照片集使用 `zipSync()` 在主线程一次性生成。显示真实导出进度，可取消，失败不生成假成功文件。

## 17.3 恢复

恢复流程：

1. 读取 ZIP 中央目录并做初步限制；默认拒绝大于 1GB 的 ZIP、超过 10,000 个 entry、单 entry 解压后超过 250MB、预计总解压体积超过 2GB；常量集中配置并测试；
2. 路径规范化，拒绝绝对路径、`..`、嵌套 ZIP 和未知执行文件；
3. 校验 entry 数、单项大小、总解压大小、manifest、schemaVersion 和 sha256；
4. 在 staging 数据结构中解析所有 JSON；
5. 展示将恢复的数量和冲突策略；
6. 用户确认后在受控事务中写入；
7. 任一必需步骤失败则回滚，不留下半恢复状态；
8. 成功后重新 hydrate、重算关系并进入 Universe；刷新后仍存在。

默认只导出与恢复 personal 数据，不重复打包内置 Demo。默认冲突策略：相同 id 但 checksum 不同则生成新 id 并修正引用；相同 checksum 可跳过重复。不要静默覆盖现有用户内容。

## 17.4 清除数据

这是破坏性操作，必须二次确认，并要求用户输入界面提供的短确认词。只清除 personal 数据、个人资产与个人星座；默认保留内置 Demo。操作后清理纹理和 Blob 引用，并回到 personal Empty State。

---

# 18. Visual System（视觉系统）

## 18.1 Design Tokens

在 `tokens.css` 建立语义变量，不在组件散写随机颜色、字号和时长。

基础方向：

- `--color-void`：近黑背景；
- `--color-ink`：象牙白正文；
- `--color-muted`：中灰说明；
- `--color-line`：低透明关系线；
- `--color-danger`：克制错误色；
- Photo-derived accent：来自当前照片主色，限制饱和度与亮度后使用。

禁止默认紫蓝渐变、纯霓虹、发光胶囊按钮、玻璃拟态卡片墙。危险操作仍要有足够辨识度，不为“克制”牺牲可用性。

## 18.2 Typography

- 使用系统中文字体栈或可合法自托管、许可证清晰的字体；不远程加载 Google Fonts；
- 标题、元数据、正文、控制标签层级明确；
- 中文正文合理行高，不使用大段全大写英文；
- 数字和日期可使用更紧凑的等宽或 tabular number；
- 不用巨大 Hero 文案遮住空间；
- 不把每段文字装进圆角卡片。

## 18.3 Layout

- 主要 UI 沿视口边缘分布，中间让给照片和空间；
- 采用清晰网格与节奏，不用传统 SaaS sidebar + cards；
- Desktop、tablet、mobile 均有明确层级；
- Mobile 允许减少同时可见节点和 HUD，但核心闭环完整；
- Archive 可以使用 Grid，Universe 不可以退化为 Grid。

## 18.4 图标与控件

- 使用轻量、统一线性图标或自制 SVG；记录图标许可证；
- 图标必须有可访问名称或文字；
- 交互命中区域至少 44×44 CSS px；
- 焦点样式清楚，不只依赖 hover；
- Cursor 仅在桌面提供轻提示，不做夸张跟随光球。

---

# 19. Motion Language（动态语言）

所有动态归于四类：

- Attraction：相关记忆靠近；
- Repulsion：无关内容退开；
- Expansion：进入具体记忆；
- Collapse：多个记忆聚合。

时序：

| 场景 | 时长 |
|---|---:|
| Micro Hover | 160–220ms |
| UI Transition | 220–320ms |
| Memory Focus | 300–450ms |
| Universe Relayout | 650–1000ms |
| Memory Dive | 800–1200ms |
| Echo Travel | 700–1100ms |
| Time Collapse | 1000–1500ms |

关键词：惯性、重量、深度、漂移。优先 cubic / power / expo 类缓动，避免所有动画统一 `300ms ease`，避免弹簧玩具感。

Reduced Motion：

- 禁止高速镜头飞行；
- Dive/Echo 改为 180–300ms fade + 小幅 scale；
- 降低或关闭粒子、Parallax、景深；
- 视图重排减少位移并缩短；
- Time Collapse 保留功能，以淡入淡出表达聚合；
- 所有信息、选择、返回、编辑和备份功能仍完整。

---

# 20. 状态、错误与边界

每个异步功能必须至少有 idle、working、success、partial failure、failure、cancelled 状态。

需要处理并以中文反馈：

- WebGL 不可用：提供兼容说明与 Archive 入口，不显示崩溃黑屏；
- 图片无法读取、格式不支持、文件过大；
- EXIF 缺失或损坏：继续导入并说明可手动补充；
- IndexedDB 不可用、写入失败、配额不足、升级被其他标签页阻塞；
- 纹理加载失败：显示主色占位并允许重试；
- ZIP 损坏、版本不兼容、校验失败、空间不足；
- route id 不存在：中文空状态并可返回 Universe；
- Demo 资产缺失：不无限 loading；
- 网络断开：产品核心功能不受影响；
- 多次快速点击、视图切换、Back、Esc：状态机不乱序；
- 删除当前 Dive Memory：安全退出并更新 route。

禁止把 exception 文本、堆栈、`Uncaught Error` 直接展示给用户。开发环境可记录详细错误，生产界面显示可行动的中文信息。

空状态固定方向：

```text
这里还没有记忆。
导入几张照片，MEMENTO 会把它们重新组织成一个可以探索的空间。

导入照片
探索演示宇宙
```

---

# 21. Accessibility 与 Responsive

- 语义按钮、表单 label、对话确认、错误关联；
- 可见 focus ring；
- Tab 顺序与视觉顺序一致；
- Esc 行为可预测；
- 重要场景变化通过 `aria-live` 简短播报；
- Canvas 旁提供当前聚焦 Memory 的可访问文字和可操作候选，不让核心操作只有精确鼠标拾取；
- 对比度达到 WCAG AA 的合理目标；
- 不用颜色作为唯一关系/状态信息；
- 支持 `prefers-reduced-motion`；
- 支持 360px 宽移动端，无横向溢出；
- 移动端降低粒子、DPR、纹理并发与同时可见节点，但仍可进入 Universe、Dive、Echo、编辑、创建星座和备份；
- 触摸长按多选必须防止误触和页面菜单冲突，并提供显式“选择”按钮作为替代。

---

# 22. 性能预算与验收

目标设备上：

- 常规 Desktop 60–80 Demo 节点目标 45–60 FPS；
- 低端设备可降级到稳定约 30 FPS，但不能交互失效；
- 30 分钟连续浏览不出现持续增长的 Texture/Object URL/Blob 引用；
- 主线程不执行长时间同步 ZIP、批量图片缩放或无限 force tick；
- 初次进入不一次加载所有 preview；
- 同时完整 thumbnail/preview 约 30–50；
- 视图切换期间帧率短暂下降可接受，但不长时间冻结；
- production bundle 不包含未使用的大型库和 Demo 工具；
- 断网刷新已加载静态部署页面后，如无 Service Worker 缓存承诺可以失败，但运行中的所有核心数据操作不得依赖网络。若实现 PWA 缓存，必须有更新策略和测试，不能顺手增加半成品 Service Worker。

用 PerformanceMonitor 和自有开发统计面板在开发模式观察：FPS、active nodes、loaded textures、estimated texture bytes、queue length。生产默认不显示调试面板。

---

# 23. 自动化测试

## 23.1 单元测试（Vitest）

必须覆盖：

1. Relationship 分数组合、互斥时间档、clamp、空字段、稳定排序；
2. tag Jaccard、颜色相似度、GPS 1km 判断；
3. Echo topK、多样性、最近路径降权；
4. TIME 布局确定性与缺失日期；
5. 其余布局输入稳定和无 NaN；
6. Camera state transition 与取消；
7. LOD hysteresis、预算与 LRU 回收；
8. MetadataAdapter 真实 fixture：横竖、无 EXIF、损坏 EXIF、PNG/WebP/HEIC 降级；
9. 图片变体尺寸、orientation、MIME 回退；
10. IndexedDB migration、Repository CRUD、删除级联、事务失败；
11. Backup manifest、路径清洗、checksum、版本拒绝、冲突策略；
12. 中文错误映射。

## 23.2 组件测试

- Entry 两入口；
- Import 状态与部分失败；
- Archive 筛选/编辑/删除确认；
- Constellation 名称校验；
- Settings 切换与清空确认；
- Reduced Motion 分支；
- 404 memory/constellation 状态。

## 23.3 E2E（Playwright）

至少覆盖：

### Flow A：Demo 完整体验

```text
打开 /
→ 点击“探索演示宇宙”
→ 进入 /universe
→ Hover / Focus 一个 Memory
→ Dive 到 /memory/:id
→ 选择一个 Echo 到下一段 Memory
→ Esc 返回 /universe
→ 依次切换 PEOPLE / PLACE / EMOTION / TIME
→ 调整时间范围并完成 Collapse / Expand
→ 选择多个 Memory 创建星座
→ 进入并编辑星座
→ 刷新后星座仍存在
```

### Flow B：个人数据闭环

```text
打开 /
→ 选择“创建我的记忆宇宙”
→ 导入测试图片
→ 进入 personal Universe
→ 刷新后记忆仍存在
→ Archive 编辑人物、地点、情绪、标题
→ Universe 中关系与布局发生可验证变化
→ 导出备份
→ 清除 personal 数据
→ 导入备份
→ Memory、People、Place、Constellation、Settings 与 preview 恢复
→ 再次刷新仍存在
```

另测：

- 部分坏图片不阻断其他图片；
- Unsupported HEIC 中文提示；
- Reduced Motion；
- Browser Back/Forward 与 route/scene 同步；
- 360px viewport；
- 无外部网络请求；
- 控制台无未处理错误和 React warning。

WebGL E2E 不要只依赖像素级脆弱截图；优先通过可访问状态、route、DOM overlay、store debug hook（仅测试构建）和关键截图结合验证。

## 23.4 必须存在的 scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "typecheck": "tsc -b --pretty false",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "check": "npm run lint && npm run typecheck && npm run test && npm run build"
}
```

可按最终 TS 配置微调 `tsc` 参数，但语义必须保留。

---

# 24. 实施顺序与阶段门禁

不要一次写完所有代码再测试。按以下阶段执行，每阶段完成后更新计划并通过门禁。

## Phase 1｜工程与设计基础

- 初始化 Vite React TS；
- 锁定兼容依赖与 lockfile；
- 建路由、AppShell、唯一 Canvas；
- tokens、全局排版、基础错误边界；
- 建文档骨架和 CREDITS 维护流程。

门禁：开发页可打开；路由不重建 Canvas；lint/typecheck/build 通过。

## Phase 2｜领域与本地数据

- 实现 types、DBSchema、repositories、migration；
- 实现 Demo repository 与 personal 分区；
- 实现 Relationship Engine 与布局纯函数；
- 先写核心单元测试。

门禁：刷新持久化、删除级联、关系计算与布局稳定性测试通过。

## Phase 3｜导入闭环

- MetadataAdapter、orientation、Pica 变体、主色；
- Import UI、进度、取消、部分失败；
- 资源释放与配额错误。

门禁：真实 fixture 导入，刷新可见，坏文件不阻断，生产 build 不加载 CDN。

## Phase 4｜核心空间体验

- TIME Scene、Memory Node、LOD、Texture Manager；
- Camera state machine；
- Hover、Focus、Dive、Echo、返回；
- PEOPLE / PLACE / EMOTION 与连续 relayout；
- Time Collapse。

门禁：Flow A 到 Echo/返回/四视图可跑；无双 camera writer；长时间纹理观察无明显泄漏。

## Phase 5｜管理闭环

- Archive 搜索筛选编辑删除；
- Constellation 创建与编辑；
- Settings、质量、Reduced Motion；
- Backup / Restore / Clear。

门禁：Flow B 完整通过；数据清除与恢复没有半状态。

## Phase 6｜Responsive、可访问性与视觉打磨

- desktop/tablet/mobile；
- 键盘、live region、focus；
- 视觉层级、中文排版、动效时序；
- 性能自动降级；
- 仅在 P0 稳定后考虑 P1 后期效果。

门禁：360px 可用、Reduced Motion 完整、性能预算达标、无模板化 AI 视觉。

## Phase 7｜生产验收

- 完整测试；
- 检查控制台与网络请求；
- 审计许可证和 Demo 资产；
- 完成文档、vercel SPA rewrite、生产 build；
- 用 Flow A / B 手工再走一遍并修复问题。

门禁：第 26 节所有完成定义通过。

---

# 25. 文档与版权交付

## README.md

必须包含：产品一句话、核心体验、截图/GIF 占位说明、技术栈、本地运行、测试、生产构建、静态部署、浏览器支持、隐私边界、数据备份、开源来源入口、已知限制。

## PRODUCT.md

包含：问题、目标用户、核心场景、价值主张、核心闭环、四视图语义、为什么不用 AI、P0/P1、被否定方案、成功指标。

## DESIGN_SYSTEM.md

包含：品牌性格、颜色 token、Typography、布局、节点视觉、关系线、四类 motion、时序、Reduced Motion、响应式、禁止事项。

## ARCHITECTURE.md

包含：Persistent Scene、路由同步、数据流、DB schema/migration、Relationship Engine、布局 Worker、Camera 状态机、Import Pipeline、Texture 生命周期、Backup 安全边界、版本矩阵与关键取舍。

## PRIVACY.md

用清晰中文说明：本地处理、IndexedDB、GPS/EXIF、导出文件、浏览器存储可能被清理、无账号/云同步、用户如何删除数据、项目不做绝对安全承诺。

## CREDITS.md

研究候选不等于实际来源。每个真实依赖/复制/修改/明显参考和资产都必须记录：

- 项目与仓库；
- 精确版本或 commit；
- 用途；
- 使用方式；
- 上游文件与项目内文件；
- License 与 Copyright / Attribution；
- 修改内容；
- 资产是否另行记录。

同步维护 `THIRD_PARTY_LICENSES/`。ExifReader 未修改依赖也需记录 MPL-2.0 和准确版本源码获取地址。GSAP 记录官方 Standard License，不描述为 MIT 开源。

## 静态部署

- `npm run build` 只生成静态 `dist/`，不要求常驻 Node Server、后端函数或环境变量；
- `vercel.json` 为 React Router 配置 SPA fallback，使 `/memory/:id` 等深层链接直接打开时仍进入 `index.html`；
- 静态 assets 必须保持正常命中，不能被错误 rewrite 成 HTML；
- 部署前用本地 production preview 验证所有深层 route；
- 未得到用户明确授权时，只交付可部署配置，不代替用户登录外部平台或发布；
- README 同时说明任意支持 SPA fallback 的静态托管方式，不把产品锁死在 Vercel。

---

# 26. 最终验收与完成定义

## 26.1 Product

- 新用户在 3–5 秒内知道这是与个人记忆有关的产品；
- 新用户在 30 秒内可完成“进入 Demo → 点击 Memory → 看见关联 Memory”；
- 用户在一分钟内理解“通过关系重新进入记忆”；
- Demo 与个人导入两条主流程均完整；
- Memory Echo 是可连续使用的核心能力；
- 四视图不仅改标签，而是真正重组同一批记忆；
- Relationship Engine 透明、可解释、可因编辑更新；
- 没有假 AI、假按钮或仅视觉演示。

## 26.2 UX

- 用户始终知道当前数据源、视图、焦点和退出方式；
- Dive、Echo、返回、Back/Forward 状态一致；
- 导入有真实进度和部分失败；
- 删除、清空、恢复不会误伤；
- Empty、Loading、Error、Reduced Motion、Mobile 均可完成核心流程。

## 26.3 UI 与视觉

- 第一眼不是 Dashboard、相册 Grid 或普通星空；
- 照片是视觉中心；
- 黑/象牙白/灰与照片衍生色形成稳定系统；
- 中文排版成熟；
- 没有紫蓝 AI 渐变、巨大圆角卡片、玻璃拟态、发光按钮、机器人或无意义粒子爆炸；
- Motion 能被解释为 Attraction / Repulsion / Expansion / Collapse。

## 26.4 Engineering

- 唯一 Canvas、唯一 camera writer；
- strict TypeScript，无未解释 `any`；
- IndexedDB versioned schema 与 migration；
- Blob、Texture、ImageBitmap、Object URL 有释放路径；
- 没有运行时远程 API、CDN、远程字体和远程图片；
- Backup 校验、事务恢复与冲突策略可用；
- lint、typecheck、unit、E2E、build 全部通过；
- 控制台无未处理错误、明显 warning；
- 静态部署可打开深层 route。

## 26.5 Portfolio 与 Career

- README 和产品文档能让招聘者 30 秒理解价值；
- 能展示产品决策、AI 边界、UX、视觉、前端、Local First、数据与性能能力；
- 有可解释的开源复用和版权治理；
- 有真实 Flow A / B 证据，而不只有美图；
- 关键决策、失败与取舍有记录，不在 Case Study 阶段临时编故事。

## 26.6 最终命令

在交付前运行并修复到通过：

```text
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

然后用 production preview 手工走完 Flow A 与 Flow B，检查 Desktop、360px Mobile、Reduced Motion、刷新、Back/Forward、控制台、网络面板和 IndexedDB。

最后进行两轮主动修复，而不是只写审查报告：

1. 分别以 Product Designer、Digital Art Director、Typography Designer、Motion Designer 的视角检查中文层级、留白、卡片数量、灰度、照片主色、Glow、景深、相机和动效重量；发现问题直接修复。
2. 以 Senior Frontend Engineer 的视角检查 bundle、memory leak、texture disposal、error boundary、IndexedDB、async race、重复逻辑、responsive、accessibility 与 build；发现问题直接修复并重跑测试。

确认能够稳定录制以下作品集镜头：Entry、进入 Universe、Hover、Dive、Echo、四视图切换、Constellation、Time Collapse、真实照片导入、Archive 管理。

---

# 27. 禁止的“完成方式”

出现下列任一项都不能声明完成：

- 只有首页或静态 3D 星点；
- 点击照片打开 Modal 或传统详情卡片；
- 四视图只是换标题或颜色；
- Echo 只是一个“下一张”按钮且不依赖关系；
- 导入只生成 object URL，刷新即消失；
- Backup 只有按钮没有可恢复 ZIP；
- Demo 使用远程图片、随机占位或许可证不明资产；
- 为一个小能力搬入完整大型仓库；
- 复制其他产品完整 UI、品牌、文案或商业素材；
- 用 Postprocessing、粒子和 glow 掩盖缺失的数据闭环；
- 用 `setTimeout` 假装处理进度；
- 测试被 skip、改成永远通过或只测静态渲染；
- 生产构建仍请求 API、CDN、远程 Worker；
- 发生错误时只打印 console；
- 声称“全部完成”但没有实际运行 Flow A / B。

---

# 28. 最终执行指令

现在开始执行，不再把本文改写成另一份泛化方案。先检查工作区与既有文件，创建计划，然后按 Phase 1–7 实施。

每个阶段：

```text
实现
→ 运行门禁
→ 检查实际交互
→ 修复根因
→ 更新文档和 CREDITS
→ 再进入下一阶段
```

最终交付必须是：

- Complete Product（完整产品）；
- Complete Experience（完整体验）；
- Complete Interaction（完整交互）；
- Complete Data Loop（完整数据闭环）；
- Complete Visual Identity（完整视觉识别）；
- Complete Motion Language（完整动态语言）；
- Complete Deployment Capability（完整部署能力）。

核心判断始终只有一句：

> MEMENTO 不是让用户找到一张照片，而是让用户重新进入一段记忆。
