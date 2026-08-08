# Memuniverse Memory Template System V1｜开源技术核验笔记

> 核验日期：2026-08-08  
> 范围：仅使用项目官方 GitHub 仓库、官方文档、源码与 package manifest。  
> 用途：供《Memuniverse Memory Template System V1 — Luan Execution Specification》收敛技术边界；不是新的产品需求。

## 1. 最终采用结论

| 来源 | V1 结论 | 实际用途 | 禁止用法 |
|---|---|---|---|
| Three.js CSS3D Periodic Table | 部分采用 | 抽取 `objects → targets → transform` 思路，以及 sphere / helix / grid 的目标位姿计算 | 不把 CSS3DRenderer、DOM 卡片样式、TrackballControls 或原 Demo UI 搬入产品 |
| Tone.js | **本仓库 V1 不采用** | 研究证明其能力足够；仅保留为未来“整体替换音频运行时”的候选 | 当前已有 HTMLAudioElement 播放、Seek 与 AnalyserNode；不得再增加第二时钟 |
| Meyda | P1 条件采用 | 少量音频特征的离线预分析或可替换的 Audio Reactive 增强 | P0 不安装；不把特征值包装成“节拍/段落/情绪识别” |
| React Three Fiber 9 | 采用 | React 内的主 Three.js Runtime、场景生命周期、帧循环和事件 | 不使用 v10 alpha；不在 `useFrame` 中 `setState` |
| Drei 10 | 选择性采用 | CameraControls、PerformanceMonitor、少量 Image / Html / Instances 能力 | 不把 Drei 当纹理管理器或完整 LOD 系统；不使用 v11 alpha |
| CSS3DRenderer | 核心路径拒绝 | 仅作为布局示例的上下文 | 不承担照片主渲染、Shader、粒子、LOD 或后处理 |

所有上述仓库均为 MIT License。作为 npm 依赖使用时保留依赖自带许可证；若复制或明显改写官方示例/源码，应在 `CREDITS.md` 记录仓库、源文件、MIT License 和修改范围，并保留必要版权许可文本。

---

## 2. Three.js CSS3D Periodic Table

### 已核验事实

- 官方示例把每个数据项变成一个 DOM 卡片，再包装成 `CSS3DObject`；卡片先放到随机三维位置。[官方示例源码](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_periodictable.html)
- 示例分别预计算 `table / sphere / helix / grid` 四组目标 `Object3D`，每个目标包含位置与朝向；布局切换时不修改数据，只替换目标位姿。
- Sphere 使用球坐标，Helix 使用圆柱坐标，Grid 由索引换算三维行列层；统一 `transform(targets, duration)` 对位置和旋转做指数缓动。
- 示例使用 `TWEEN` 和 `TrackballControls`；它们是该 Demo 的实现选择，不是布局算法成立的必要条件。
- `CSS3DRenderer` 的官方限制是：不能使用 Three.js 的材质系统、不能使用几何体，并且只支持浏览器与显示缩放为 100%。[CSS3DRenderer 官方文档](https://threejs.org/docs/pages/CSS3DRenderer.html)
- Three.js 仓库使用 MIT License；复制或修改 substantial portions 时须保留版权与许可声明。[Three.js License](https://github.com/mrdoob/three.js/blob/dev/LICENSE)

### 对 Memuniverse 可复用的模块

只复用并 TypeScript 化以下思想：

```ts
type LayoutTarget = {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  scale?: number
}

type LayoutGenerator = (
  memories: readonly MemoryNodeInput[],
  context: LayoutContext
) => readonly LayoutTarget[]
```

- `generateSphereTargets()`：用于环抱式记忆群。
- `generateHelixTargets()`：用于职业/成长时间螺旋。
- `generateGridTargets()`：用于调试、归档或降级布局；不是默认视觉。
- “同一批对象 + 多组 targets + 一个统一过渡器”的架构。

必须做的改造：

- 输入从元素周期表索引改为 `MemoryNodeInput`。
- 随机值必须使用模板 ID 派生的 deterministic seed（确定性种子），保证重播、Seek 和测试结果一致。
- 目标函数必须为纯函数，不读写 Scene，不创建 DOM。
- 位姿插值由现有 Playback Engine / R3F `useFrame` 执行；不要为了这段示例再引入第二套 TWEEN/GSAP 相机写入链路。
- 相机朝向与照片 billboard（始终朝向镜头）要由模板配置明确决定，不能机械复制示例中的 `lookAt`。

### 不采用的部分

- 不使用 `CSS3DRenderer` 作为照片节点渲染器。
- 不复制 `.element` 的青色发光样式、元素周期表数据和按钮 UI。
- 不使用一张照片一个 DOM 节点承载大规模场景。
- 不使用 Demo 的非确定性 `Math.random()` 动画时长。
- 不引入 `TrackballControls`；项目统一使用一套 Camera Controller。

### 结论

**采用布局数学与数据结构，重写运行时；拒绝 CSS3D 主渲染路径。** 这能保留经过验证的布局方法，同时避免 DOM 数量、缩放、材质、Shader 与统一 WebGL 后处理方面的硬限制。

---

## 3. Tone.js：不能成为 HTMLAudioElement 旁边的第二时钟

### 已核验事实

- Tone.js 是浏览器 Web Audio 框架，`Tone.getTransport()` 是可启动、暂停、停止和动态调整的全局时间轴；官方说明其调度回调会收到精确的音频上下文时间。[Tone.js 官方仓库](https://github.com/Tonejs/Tone.js)
- `Transport` 支持 `start / pause / stop / schedule / scheduleOnce / scheduleRepeat`，并公开可读写的 `seconds` 用于跳转。[Transport 源码](https://github.com/Tonejs/Tone.js/blob/dev/Tone/core/clock/Transport.ts)
- `Tone.Player` 支持从 buffer 内的 offset 开始、`seek()`、`sync()` 到 Transport；同步源会响应 Transport 的 start、pause、stop。[Player 源码](https://github.com/Tonejs/Tone.js/blob/dev/Tone/source/buffer/Player.ts) / [Source 同步源码](https://github.com/Tonejs/Tone.js/blob/dev/Tone/source/Source.ts)
- 浏览器首次启用声音必须来自 click/keydown 等用户手势，并在该事件内 `await Tone.start()`；提前调度可能静音或时间不正确。[Starting Audio](https://github.com/Tonejs/Tone.js#starting-audio)
- 官方 GitHub Releases 当前把 `15.1.22` 标为 Latest；`dev` manifest 已写入 `15.5.36`，因此实现时不能把开发分支版本当正式稳定版。[官方 Releases](https://github.com/Tonejs/Tone.js/releases) / [dev package manifest](https://github.com/Tonejs/Tone.js/blob/dev/package.json)
- 仓库在 2026-08-07 仍有提交，维护活跃。[核验时的 dev 提交](https://github.com/Tonejs/Tone.js/commit/d6e555b)
- License 为 MIT。[Tone.js License](https://github.com/Tonejs/Tone.js/blob/dev/LICENSE.md)

### 本仓库现状与时钟决策

当前项目已经有一个 `HTMLAudioElement`，负责本地/远程音频播放、暂停、Seek，并已接入 `AnalyserNode`。因此本仓库 V1 的结论不是“再引入 Tone 以增强时间轴”，而是：

**保留现有 HTMLAudioElement 为唯一 Playback Clock，V1 不安装 Tone.js。**

Tone Transport 不应和既有 `HTMLAudioElement.currentTime` 同时推进。两套可独立暂停、Seek、缓冲和恢复的时间源会产生漂移，并让 Camera、Layout、照片显隐、Cue 与进度条无法确定谁是权威。

Luan 必须先检查现有播放器，然后二选一：

#### 路径 A｜本仓库 V1 的强制路径

- 保留 `HTMLAudioElement`。
- `audio.currentTime` 是唯一 Source of Truth（唯一真值）。
- `requestAnimationFrame` / R3F `useFrame` 仅读取它并计算：

```ts
progress = clamp((audio.currentTime - cueStart) / cueDuration, 0, 1)
visualState = evaluateTimeline(progress)
```

- 不安装 Tone.js。
- 适用于 V1 只需要一首本地音乐的播放、暂停、Seek、结束事件和音量控制。

#### 路径 B｜未来版本候选，不属于本次执行范围

- 用 `Tone.Player + Tone.getTransport()` 替换旧音频运行时。
- Transport 是唯一 Playback Clock；不再读取另一个 `<audio>` 的 `currentTime` 驱动视觉。
- `player.sync().start(...)`，Camera、Layout、照片显隐和 UI 进度全部从同一个 `transport.seconds` 派生。
- Pause 使用 `transport.pause()` 后再 `start()`；Replay 才 `stop()`、归零并重新开始。
- Seek 后立即以纯函数 `evaluateTimeline(progress)` 重建当前画面，不依赖“之前是否触发过某个 setTimeout/cue”。

### React 实施约束

- Audio Runtime 是客户端单例，不能每个组件创建一份 Transport/Player。
- 初始化必须幂等，能承受 React Strict Mode 的开发期挂载—卸载—再挂载。
- Tone 对象、AudioNode 和 Transport 不进入可序列化 Zustand state；Store 只保留播放状态快照。
- 卸载或换歌时清除 schedule/event，`unsync()`、`dispose()` Player，并撤销 Blob Object URL。
- 音频加载失败时允许无声播放的 monotonic fallback clock（单调后备时钟），但后备时钟和音频时钟绝不能同时推进。
- 禁止 `setInterval`、CSS animation elapsed time、R3F clock 和音频 clock 各自管理一套 Cue。
- 锁精确稳定版本与 lockfile，不使用 `tone@next`。

### 结论

**能力评估：可用、MIT、维护活跃。仓库决策：V1 不采用。** 现有 HTMLAudioElement 已覆盖 V1 所需的播放、暂停、Seek、结束事件、音量与基础分析；加入 Tone 只会制造第二时钟和额外迁移成本。未来若出现样本级调度等明确需求，必须以“整体替换现有 Audio Runtime”的独立迁移任务引入 Tone，而不是并接。

---

## 4. Meyda：只进入 P1

### 已核验事实

- Meyda 支持 Web Audio 实时分析与 buffer/array 离线特征提取。[官方仓库](https://github.com/meyda/meyda)
- 官方特征包括 RMS、energy、ZCR、amplitude/power spectrum、spectral centroid、flux、rolloff、flatness、spread、loudness、MFCC 和 chroma 等。[Audio Features](https://meyda.js.org/audio-features)
- 实时方式通过 `createMeydaAnalyzer({ audioContext, source, bufferSize, featureExtractors, callback })` 接入 Web Audio。[官方实时分析指南](https://github.com/meyda/meyda/blob/main/docs/guides/online-web-audio.md)
- 当前实时 Analyzer 源码仍基于 `ScriptProcessorNode`，而不是 AudioWorklet。[meyda-wa.ts](https://github.com/meyda/meyda/blob/main/src/meyda-wa.ts)
- 官方最新稳定 Release 为 `v5.6.3`（2024-04-21）；核验时 main 的最后代码提交也停留在 2024-04-21，维护活跃度明显低于 Three/R3F/Tone。[Meyda Releases](https://github.com/meyda/meyda/releases) / [最后提交](https://github.com/meyda/meyda/commit/ecf2566)
- package manifest 已声明内置 TypeScript 类型，但部分入门文档仍写需 DefinitelyTyped，说明文档存在滞后风险。[package manifest](https://github.com/meyda/meyda/blob/main/package.json)
- License 为 MIT。[Meyda License](https://github.com/meyda/meyda/blob/main/LICENSE.md)

### 正确的产品边界

Meyda 输出的是声学特征，不直接输出可靠的：

- 节拍点；
- 歌曲段落；
- 情绪；
- 叙事高潮；
- 照片与音乐的语义对应关系。

因此它不能替代 Template Config 中人工定义的 Phase、Cue Point 和 Camera Direction。

### P1 条件采用方案

- P0 不安装 Meyda。P0 的简单音量响应优先用原生 `AnalyserNode` 或 Tone 已提供的 `Analyser / Meter`。
- P1 若要加入更细的音频反应，封装为可替换的 `AudioFeatureExtractor` adapter，不能散落 Meyda API。
- 优先在用户导入歌曲后做一次离线窗口分析，保存降采样、归一化后的 feature envelope；播放时只查表，避免每帧重复 FFT。
- 首批只允许 `rms`、`energy`、`spectralCentroid`、`spectralFlux`，并对异常值做 clamp、平滑和归一化。
- Audio Reactive 只影响粒子密度、光晕、轻微 scale 或背景呼吸，不能驱动模板结构、照片顺序或核心相机路径。
- 引入前必须验证 Chrome、Safari、iOS 和中低端设备；性能或恢复不稳定时保留 adapter 并关闭实现。

### 结论

**P1 条件采用，P0 拒绝。** 这既符合 V1 的最短可行路径，也避免让低价值的音乐可视化复杂度拖累模板系统的核心闭环。

---

## 5. React Three Fiber / Drei

### 版本与维护

- R3F 官方稳定版为 `v9.7.0`，2026-07-31 发布；v10 仍是 alpha。[R3F Releases](https://github.com/pmndrs/react-three-fiber/releases)
- Drei 官方稳定版为 `v10.7.8`，2026-08-05 发布；v11 仍是 alpha。[Drei Releases](https://github.com/pmndrs/drei/releases)
- R3F 9.7 manifest 的 peer 范围要求 React `>=19 <19.3`、Three `>=0.156`；Drei 主分支要求 Fiber 9、React 19、Three `>=0.159`。[R3F package manifest](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/package.json) / [Drei package manifest](https://github.com/pmndrs/drei/blob/master/package.json)
- R3F 与 Drei 均为 MIT。[R3F License](https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE) / [Drei License](https://github.com/pmndrs/drei/blob/master/LICENSE)

执行前必须读取现有 `package.json`：若项目仍为 React 18 + R3F 8，不得只为模板系统强制升级整站；应先验证兼容矩阵和回归成本。若使用新稳定矩阵，则锁定 React 19 + R3F 9.7.x + Drei 10.7.x + 兼容 Three.js 的精确版本，不安装 alpha。

### R3F 正确复用边界

- `Canvas`、`useThree`、`useFrame`、事件系统和 Suspense loader 作为主运行时。
- 播放中的高频 transform 直接在 `useFrame` 中以 delta 或统一 `progress` 修改 ref；官方明确反对在帧循环中 `setState`。[Performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
- 静止预览可使用 `frameloop="demand"`；播放时使用连续帧，或显式持续 `invalidate()`。官方说明对外部 mutation 必须触发 `invalidate()`。[Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- 缓存并复用 geometry/material/vector/quaternion；不在每帧创建大量临时对象，不靠频繁 mount/unmount 表达每个 Cue。
- WebGPU 在 R3F 官方文档中仍标注为进行中且并非完全兼容；V1 保持 WebGL。[Canvas 文档](https://r3f.docs.pmnd.rs/api/canvas)

### CameraControls

- Drei `CameraControls` 包装 `camera-controls`，内部已在 `useFrame` 中执行 `controls.update(delta)`，并处理 `invalidate()`、事件和 performance regress。[Drei CameraControls 源码](https://github.com/pmndrs/drei/blob/master/src/core/CameraControls.tsx)
- `setLookAt`、`lerpLookAt`、`fitToSphere` 等支持平滑过渡；带 transition 的方法返回 Promise。[camera-controls 官方仓库](https://github.com/yomotsu/camera-controls)
- 项目必须有唯一 Camera Ownership 状态机：
  - `explore`：允许用户控制；
  - `templatePlaying`：播放器控制，相机输入禁用；
  - `paused`：保持当前 pose，按产品规则决定是否允许轻微观察；
  - `seeking`：由 normalized progress 立即求值；
  - `returning`：回到进入模板前保存的 pose。
- 禁止 CameraControls、GSAP、React Spring 和自写 `camera.position` 循环同时写相机。

### Photo Layout、LOD 与纹理

- Drei `<Image>` 是带 auto-cover 的 shader 图片平面，适合聚焦层或数量有限的中近景照片。[Drei Image](https://drei.docs.pmnd.rs/abstractions/image)
- 不应为全部照片直接创建 `<Image>`。唯一纹理通常意味着独立材质/绘制调用；远景用 Points、低信息占位或纹理图集后的 InstancedMesh，中近景只保留预算内的可见照片平面。
- Drei `<Instances>` 能减少重复几何/材质的 draw call，但官方同时提示 declarative instances 有 CPU 开销；大量静态实例应直接用 `THREE.InstancedMesh`。[Drei Instances](https://drei.docs.pmnd.rs/performances/instances)
- `useTexture` 基于 `useLoader + TextureLoader`；`useLoader` 会按 URL 缓存共享资源，官方警告不要随意修改或释放复用资产。[useTexture](https://drei.docs.pmnd.rs/loaders/texture-use-texture) / [R3F Hooks](https://r3f.docs.pmnd.rs/api/hooks)
- IndexedDB Blob、Object URL 和多分辨率照片不能仅依赖 `useTexture`：必须保留项目自己的 ref-count、LRU、加载队列、`texture.dispose()` 与 `URL.revokeObjectURL()` 管理器。
- `<Preload all>` 不等于纹理下载完成、LOD 管理或缓存策略；Three r184+ 还存在官方 issue 报告其提前编译无效。当前实现仍调用同步 `gl.compile()`，因此 V1 必须有可观察的关键纹理 readiness gate，不能只放一个 `<Preload all />` 就开始播放。[Drei issue #2722](https://github.com/pmndrs/drei/issues/2722) / [Preload 源码](https://github.com/pmndrs/drei/blob/master/src/core/Preload.tsx)
- `<Html>` 只用于少量聚焦标签、辅助说明和可访问控件，不用于每个照片节点。

### 自适应性能

- Drei `PerformanceMonitor` 会依据多组 FPS 平均值触发 incline/decline/fallback，可用于调整 DPR、粒子数量、远景节点密度和后处理质量。[PerformanceMonitor](https://drei.docs.pmnd.rs/performances/performance-monitor)
- 自动降级必须是有限档位并带滞回，避免质量来回跳动；降级不能改变模板时长、照片顺序或 Cue 语义。
- 可见节点预算、纹理预算和 DPR 应由统一 Quality Profile 控制，而不是各组件自行判断设备。

### 结论

**采用稳定 R3F，选择性采用 Drei。** Drei 用于成熟的控制器和性能辅助；Memuniverse 自己拥有 Playback Engine、Camera Ownership、Layout Engine、Texture Manager 和 Template Config。开源库降低底层成本，但不定义产品叙事与视觉语言。

---

## 6. 给 Execution Specification 的强制技术决策

1. 当前仓库保留既有 `HTMLAudioElement` 为唯一权威时钟；V1 不安装 Tone.js。未来若迁移，HTMLAudioElement 与 Tone Transport 也只能二选一。
2. 所有视觉状态必须由 `evaluateTimeline(normalizedProgress)` 确定性求值，Seek 后可无历史重建。
3. CSS3D Periodic Table 只提供布局算法参考；运行时仍为 R3F/WebGL。
4. 使用稳定 R3F 9 / Drei 10；不采用 R3F 10、Drei 11 alpha 或 WebGPU。
5. Camera 只有一个写入者；模板播放期间 CameraControls 与用户输入的权限由状态机切换。
6. `<Image>`、`<Html>` 和 declarative `<Instances>` 只能在明确数量预算内使用。
7. 关键纹理以显式 readiness gate 验收；不得把 `<Preload all>` 当完成证明。
8. Meyda 不属于 P0；P1 也必须经 adapter、性能测试和产品价值门禁后才能启用。
9. 复制 Three.js 示例布局代码时更新 `CREDITS.md` 并保留 MIT 声明；不得复制示例 UI 或视觉样式。
10. 最终 `package.json` 与 lockfile 必须锁精确稳定版本，并在 README 记录经测试的浏览器与兼容矩阵。
