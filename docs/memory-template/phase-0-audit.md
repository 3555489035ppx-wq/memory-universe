# [Phase 0｜Repository Audit]

审计日期：2026-08-08  
审计范围：Memuniverse 现有桌面 Web App 基线、Memory Template System V1 接入边界  
执行规则：本阶段只读审计；不修改 `src/`、`package.json`、构建配置、测试或现有产品交互。

## 结论先行

现有 Memuniverse 基线可以承载模板系统：它已经拥有单一 R3F Canvas、统一 CameraControls、照片纹理生命周期管理、IndexedDB 数据边界、HTMLAudioElement + AnalyserNode 音频链路，以及可复用的星空与照片节点渲染路径。模板系统不需要新建 Canvas、第二套相机、第二个数据库或第二个播放时钟。

Phase 0 的审计交付物已经完成，但暂不满足进入 Phase 1 的前置条件：

1. 当前 `test:e2e` 有 1 个既有 Flow A 阻断失败，原因是收拢状态下的“钉住导航”按钮覆盖了“下一段记忆”按钮的点击区域。
2. 当前目录没有 `.git`，无法提供可提交的 baseline 与逐 Phase 回滚点。
3. 以上两项在本阶段只记录，不在 Phase 0 修复。

因此建议：先确认本地 Git 基线方案，再把 Flow A 覆盖问题作为进入模板开发前的独立 preflight 修复，修复后重新跑完整回归，再进入 Phase 1。

## 1. 运行基线

| 项目 | 结果 |
| --- | --- |
| Node | `v24.14.0`，满足 `package.json` 的 `>=20.19.0` |
| package manager 声明 | `pnpm@11.9.0` |
| 本次执行器 | `pnpm 11.16.0`（工作区提供的 fallback runner） |
| framework | React `19.2.8`、React DOM `19.2.8` |
| 3D | Three `0.185.0`、R3F `9.7.0`、Drei `10.7.7` |
| router | React Router DOM `7.18.2` |
| data | `idb 8.0.3`，IndexedDB `memento-db` |
| audio | 原生 `HTMLAudioElement` + `AnalyserNode` |
| viewport | Desktop，审计截图为当前浏览器 viewport `1280 × 720` |

## 2. 基线命令

### `pnpm run check`

结果：通过，约 40.83 秒。

- ESLint：通过
- TypeScript：通过
- Vitest：20 个 test files、63 个 tests 全部通过
- Production build：通过，Vite 转换 745 modules
- CSS：约 133.53 kB（gzip 21.67 kB）
- Three 主 chunk：约 733.36 kB（gzip 189.63 kB）
- Three runtime chunk：约 388.90 kB

### `pnpm run test:e2e`

结果：失败，3/4 通过，约 72.48 秒。

- `backup.spec.ts`：通过
- `import.spec.ts`：通过
- `release.spec.ts`：通过
- `universe.spec.ts` Flow A：失败

失败位置：`e2e/universe.spec.ts:63`，点击 `下一段记忆` 时超时。Playwright 日志显示目标按钮本身可见且可用，但其点击区域被以下按钮拦截：

```text
<button title="钉住导航" aria-label="钉住记忆导航" class="keyboard-navigator__reveal">钉</button>
```

这属于现有 Universe HUD 的层级/命中区域回归，不是模板代码造成的失败；进入后续 Phase 前应单独修复并回归。

### 浏览器控制台

审计浏览 Entry、Universe、播放器展开、Memory Dive、Archive 五个状态时，仅记录到一个既有警告：

```text
THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.
```

本阶段未发现新增 error；该警告不阻断当前构建，但可在后续工程整理阶段统一处理。

## 3. 目录与变更边界审计

### Git 与异常文件

- 当前目录不是 Git repository：不存在 `.git`。
- 根目录存在一个 0 字节异常文件：`({c`。本阶段未删除。
- 其余 `.cache`、`node_modules` 内的零字节文件属于工具缓存范围，不作为产品文件处理。
- 因无 Git，无法可靠列出“未跟踪文件”或生成 diff；进入 Phase 1 前必须建立可恢复 baseline。

### 现有架构归属

| 责任 | 当前 owner | 审计结论 |
| --- | --- | --- |
| 应用壳层、路由层、唯一 Canvas 挂载 | `src/app/AppShell.tsx`、`src/app/router.tsx`、`src/scene/PersistentSceneShell.tsx` | 模板入口应挂在现有 route overlay / HUD，不新增 Canvas |
| 星空、照片、关系线、性能调度 | `src/scene/UniverseScene.tsx`、`MemoryLODRenderer.tsx`、`RelationshipLines.tsx`、`PerformanceGovernor.tsx` | 复用现有空间、照片与性能路径 |
| 相机唯一写入链 | `src/scene/CameraRig.tsx`、`src/scene/camera/CameraStateMachine.ts` | 模板导演只能通过现有 camera state/pose 入口接入 |
| 照片纹理与 LOD | `src/scene/textures/LocalTextureManager.ts`、`useManagedTexture.ts`、`src/scene/lod/lodPolicy.ts` | 模板层不能自行创建/释放 Blob URL 或另造纹理缓存 |
| 记忆数据与持久化 | `src/domain/memory.ts`、`src/data/repositories/*`、IndexedDB repositories | Template session 只保存可序列化状态，不复制数据库边界 |
| 导入、备份、恢复 | `src/features/import/*`、`src/engine/backup/*` | 模板只消费已解析的真实照片与 metadata |
| 音乐、播放时钟、频谱 | `src/features/music/MusicExperience.tsx`、`src/stores/musicStore.ts`、`musicLibrary.ts` | P0 继续使用现有 HTMLAudioElement；不引入 Tone.js/Meyda |
| 视觉 token 与全局样式 | `tokens.css`、`src/styles/tokens.css`、`src/styles/globals.css`、`typography.css`、`motion.css` | GlassButton/模板 HUD 扩展现有 token，不重写既有页面 |

### 当前模板实现状态

在 `src/` 中没有 `MemoryTemplate`、`TemplateLayout`、`TimelineEngine` 或模板 session 运行时实现。现有 `template` 命中仅为 CSS grid/template-area 属性，不是功能实现。因此 Phase 1 以后需要新增模板域模块，但要保持与上述 owner 的单向适配关系。

## 4. 桌面手工体验与截图证据

以下证据来自 production preview 的桌面浏览器状态，文件均为本 Phase 新增的审计证据，不是产品资源：

- [Entry](./phase-0-entry.png)：星空首页、完整 `Memuniverse` 标题、`记忆宇宙`、点击入口。
- [Universe](./phase-0-universe.png)：个人数据源、视图切换、照片空间、右侧记忆导航、底部播放器。
- [播放器展开](./phase-0-player.png)：播放器展开后的进度、音量与折叠状态。
- [Memory Dive](./phase-0-memory-dive.png)：演示记忆的照片 hero、标题、时间与返回入口。
- [Archive](./phase-0-archive.png)：个人记忆档案、搜索/筛选/排序、8 段真实本地记忆。

手工检查结论：五个入口均可打开，照片/星空/播放器/档案结构可见；未观察到第二 Canvas 或页面级错误。Flow A 的按钮命中冲突在自动化回归中复现，因此不能把当前 Universe 交互宣布为完全稳定。

## 5. 模板系统的最小侵入接入方案

本方案仅作为下一阶段输入，Phase 0 不执行代码修改。

### Phase 1–3：基础组件与 token

- 在现有 `tokens.css` 体系上增加 GlassButton 所需的少量 surface/state token。
- 新增真实 CSS class 与可访问状态，不安装 Tailwind，不复制外部 UI 页面。
- 复用现有按钮、dialog、focus-visible、reduced-motion 约定，避免全站替换。

### Phase 4：模板域、配置与入口

- 新增 `MemoryTemplateId`、`TemplateLayoutId`、`TimelinePhase`、`MemoryTemplateConfig`、`MemoryTemplateSession`、`PlaybackStatus` 等可序列化域类型。
- 新增 registry/config/store/launcher/preview shell；P0 仅开放《那年夏天》，“Love / Breakup / University / Career”保持不可进入，不做假按钮。
- Template Preview 使用现有 Universe route overlay 和唯一 Canvas，初始状态只消费真实记忆照片。

### Phase 5–18：P0 运行时

- layout、director、timeline、single playback clock、pause/resume/replay/seek、性能与回归逐 Phase 接入。
- `CameraRig` 继续保持唯一相机写入者；`MusicExperience` 继续保持唯一音频时钟；`LocalTextureManager` 继续保持照片资源边界。
- 不添加 CSS3DRenderer、第二 Three renderer、Tone.js、P0 Meyda、商业歌曲资产或 slideshow 逻辑。

### 现有 Flow A preflight

在 Phase 1 前先修复 `keyboard-navigator__reveal` 对 `下一段记忆` 的 pointer-events/z-index/布局命中冲突，并只跑相关 E2E + `pnpm run check` 进行确认。这个修复必须单独记录，不能与模板基础组件混在同一个不可回滚变更中。

## 6. 风险与验收门禁

1. **P1：Flow A 点击阻断**：会影响模板前后导航与“选择→连接”的回归可信度。
2. **P1：无 Git baseline**：无法在每 Phase 独立 commit/patch，也无法安全回退。
3. **P2：Three.Clock 弃用警告**：不影响当前功能，但后续应在独立工程整理阶段处理。
4. **P2：Three chunk 体积**：已有产物较大，模板系统不得重复打包 Three 或引入重型音频运行时。
5. **产品边界**：P0 只做《那年夏天》，其他模板必须等 P0、性能和完整回归稳定后再开放。

## 7. Git / 备份 / 回滚方案

推荐方案：在进入 Phase 1 前由用户确认后，初始化本地 Git：

1. 完善 `.gitignore`，不联网、不添加 remote、不 push。
2. 提交当前未修改的 baseline。
3. 建立 `feature/memory-template-v1` 分支。
4. 每个 Phase 独立 commit；每个 Phase 报告列出新增/修改文件与验证命令。
5. 回滚只撤销该 Phase 列出的 patch；禁止 `git reset --hard`、覆盖整个目录或删除用户文件。

如果不允许初始化 Git，替代方案是在工作区外创建只读 baseline 副本，并在每个 Phase 保存文件清单与 patch；但该方案可追溯性与回滚可靠性较低，不推荐作为作品集级工程基线。

## 8. Phase 0 验收

- [x] 规格与开源备注已读取并按 Phase 0 边界执行。
- [x] 根目录、关键文件、`.git`、异常零字节文件已审计。
- [x] `package.json`、依赖矩阵、脚本与现有架构 owner 已核对。
- [x] `pnpm run check` 已复现并通过。
- [x] `pnpm run test:e2e` 已复现，失败项、失败文本与证据已记录。
- [x] Entry / Universe / 播放器 / Memory Dive / Archive 桌面截图已保存。
- [x] 最小侵入接入方案、风险、Git/备份回滚方案已写明。
- [ ] 进入 Phase 1：等待用户确认 Git/备份方案，并先处理已解释的 Flow A 阻断。

## 下一步前置确认

请确认是否允许我在 Phase 1 前初始化本地 Git 基线（不联网、不 push）。确认后我会先单独修复 Flow A 的导航命中冲突、重新验证完整 baseline，再按规格进入 Phase 1；在此之前不修改产品代码。
