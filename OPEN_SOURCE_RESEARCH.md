# MEMENTO 开源技术研究与复用决策

> 核验日期：2026-08-04  
> 核验范围：GitHub 仓库主页、默认分支源码、根许可证、默认分支最近 commit、GitHub Release、仓库内 `package.json` 与官方 README。  
> 目标架构：Vite + React + TypeScript + Three.js + React Three Fiber（R3F），单一持续存在的 Canvas，纯浏览器 Local-first（本地优先），无运行时远程 API。
> 使用场景：个人实验、公开作品集、GitHub 仓库与可公开访问的静态部署。个人实验允许更积极地复制和改写宽松许可证代码，但公开分发时仍需履行许可证与素材授权义务。

> 说明：本报告是工程与开源合规研究，不构成法律意见。真正锁定依赖或复制源码时，仍应以对应版本的完整许可证原文为准。

## 1. 结论先行

MEMENTO 不应寻找或 Fork 一个“现成 3D 相册”。检索到的成熟项目分别擅长图布局、镜头、图片处理、存储和压缩，但没有一个仓库同时满足 MEMENTO 的产品逻辑、持续 R3F 场景、四视图重排、Memory Dive、Local-first 和中文视觉体系。

正确组合是：

```text
MEMENTO 自有产品与视觉层
  ├─ Relationship Engine：关系规则、四视图语义、Echo 排序（自研）
  ├─ Spatial Renderer：Three.js + R3F；Drei 只取必要 helper
  ├─ Layout Solver：d3-force-3d 只解算坐标
  ├─ Camera State Machine：MEMENTO 管状态，camera-controls 执行动作
  ├─ Import Pipeline：ExifReader → Pica → 主色提取 → idb
  ├─ Texture Manager：MEMENTO 自建 LOD、引用计数、LRU、并发和 dispose
  └─ Backup：fflate + MEMENTO 自有 BackupManifest / 校验 / 恢复事务
```

### 最终建议的 8 个实际技术来源

| 技术来源 | 使用方式 | 明确边界 |
|---|---|---|
| [pmndrs/drei](https://github.com/pmndrs/drei) | 安装依赖，精选 `Image`、`CameraControls`、`PerformanceMonitor`、`Instances` / `Points` | 不复制 demo、环境资产或整套 helper；`Preload` 不作为纹理管理或性能正确性的前提 |
| [yomotsu/camera-controls](https://github.com/yomotsu/camera-controls) | 由 Drei wrapper 接入其平滑镜头 API | 它只执行 motion；Dive / Echo / back 的状态机与 pose stack 属于 MEMENTO |
| [vasturiano/d3-force-3d](https://github.com/vasturiano/d3-force-3d) | 优先安装依赖；若 Worker 化确需改动，可复制少量 MIT 模块并重构，只输出 3D 坐标 | 不采用默认图视觉；关系权重、视图 anchor、稳定节点排序与 seed 属于 MEMENTO |
| [mattiasw/ExifReader](https://github.com/mattiasw/ExifReader) | 作为未修改依赖，经 `MetadataAdapter` 只读取所需 tags | 不让原始 tag object 泄漏到领域模型；保留 MPL notice 与准确版本源码链接；不直接修改上游文件 |
| [nodeca/pica](https://github.com/nodeca/pica) | 单例 resizer + 本地 Worker，生成 1024/512/64 变体 | Orientation、任务队列、失败恢复、文件策略属于 MEMENTO |
| [fast-average-color/fast-average-color](https://github.com/fast-average-color/fast-average-color) | 对小尺寸本地变体提取一个稳定主色 | 色彩归一化、相似度、UI 使用上限属于 MEMENTO；不把颜色等同情绪 |
| [jakearchibald/idb](https://github.com/jakearchibald/idb) | 唯一 IndexedDB wrapper | Schema、迁移、Blob 生命周期、配额与事务边界属于 MEMENTO；不再并用 Dexie |
| [101arrowz/fflate](https://github.com/101arrowz/fflate) | 流式 ZIP/Unzip，图片走 pass-through | Manifest、路径清洗、Zip Bomb 限制、校验和、重复 ID 策略属于 MEMENTO |

Three.js 与 R3F 是母任务书已确定的基础运行时，仍须记录许可证并锁定版本，但不计入上述“新增复用模块”8 项。`react-postprocessing` / `postprocessing` 只列为 P1 视觉打磨候选，不应成为 P0 前置条件。

### 对“可以复制的代码就复制”的执行方式

本项目不追求“全部原创底层代码”。复用按成本从低到高排序：

1. **直接依赖**：解析器、压缩器、数据库 wrapper、相机控制器等复杂且持续维护的底层库，优先锁版本调用，避免把上游维护责任搬进项目。
2. **复制并重构小模块**：MIT / ISC / Zlib 等允许时，可复制具体算法、Shader、Worker adapter 或示例片段，改成 MEMENTO 的 TypeScript 接口；保留原版权/许可和修改说明。
3. **只参考方法**：完整 renderer、完整产品、复杂框架或许可证不适合公开部署的项目，只提炼架构，不复制代码、UI 或资产。

优先考虑直接复制的候选是：`d3-force-3d` 的必要 force 模块、Three.js examples 中与 Points / InstancedMesh 直接相关的最小片段，以及 Fast Average Color 的单一取色算法。`camera-controls`、Pica、EXIF parser、`idb`、fflate 不建议整段复制，因为直接依赖更小、更可靠。

### 明确不采用的方向

- 不嵌入 `3d-force-graph` 或 `three-forcegraph` 作为正式宇宙：它们会带来自己的对象管理、通用图视觉或 renderer/control 假设，妨碍 MEMENTO 的 LOD、纹理和持续相机状态。
- 不复制任何完整 3D Gallery UI。高质量且许可证清晰的独立 R3F 空间照片图库并未出现；最可靠路径是 Drei `Image` / Three primitives + MEMENTO 自有布局。
- 不用 `hover-effect` 的完整类：它自己创建 WebGL renderer，Three 版本老，和持续 Canvas 冲突。仅可在 MIT 记录下参考其双纹理位移思想。
- 不用 `browser-image-compression` 作为主图像管线：默认 Worker `libURL` 可指向 CDN，维护停滞，且“一次压到某尺寸/体积”不等于 MEMENTO 的三档派生图。
- 不把母任务书中建议的 exifr 直接视为最终答案：它的稳定版与默认分支都停留在 2021 年。优先验证仍在活跃维护的 ExifReader；exifr 保留为 MIT、轻量 fallback。
- 不并用 Dexie 与 `idb`。MEMENTO P0 的 stores、indexes、migrations、transactions 可以由 `idb` 明确实现；引入第二层响应式数据库抽象收益不足。
- 不把 Immich 代码混入项目：它是 AGPL 的 server-first 完整产品，架构与许可证都不适合作为 browser-only React 模块。

## 2. 研究方法与决策门槛

Star 只用于发现候选，不参与最终“采用”结论。每个仓库必须同时通过以下判断：

1. 是否直接解决 MEMENTO 的底层问题，而非仅展示相似视觉；
2. 是否能以小模块、明确 API 或算法边界接入；
3. 是否兼容 React / TypeScript / Three / R3F 与静态部署；
4. 默认分支、稳定 Release、peer dependencies 是否仍可用；
5. 根许可证是否清楚允许使用、修改和再分发；
6. 需要保留何种 notice / attribution；
7. demo 图片、字体、HDR、模型等资产是否拥有独立授权；
8. 引入的运行时依赖、GPU 成本和维护面是否小于自己实现的成本。

维护状态统一按“默认分支最近 commit”判断；只有 GitHub Release 可核验时才列 Release。仓库 `updated_at` 会被 issue、star 或非默认分支活动改变，不能替代源码维护证据。

## 3. 版本兼容建议

在真正安装前，以同一天的稳定 Release 做一次 peer matrix 验证。当前可行的基线是：

- Three.js [`r185 / 0.185.0`](https://github.com/mrdoob/three.js/releases/tag/r185)；
- R3F [`v9.7.0`](https://github.com/pmndrs/react-three-fiber/releases/tag/v9.7.0)，其当前 [`packages/fiber/package.json`](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/package.json) 要求 React `>=19 <19.3`、Three `>=0.156`；
- Drei [`v10.7.7`](https://github.com/pmndrs/drei/releases/tag/v10.7.7)，该 tag 的 [`package.json`](https://github.com/pmndrs/drei/blob/v10.7.7/package.json) 要求 React 19、R3F 9、Three `>=0.159`；
- `@react-three/postprocessing` 如启用，先固定 [`v3.0.4`](https://github.com/pmndrs/react-postprocessing/releases/tag/v3.0.4)，不要直接跟随 main；
- `postprocessing@6.39.4` 的 [`package.json`](https://github.com/pmndrs/postprocessing/blob/v6.39.4/package.json) 将 Three 限定在 `>=0.168 <0.186`，与 r185 兼容，但升级 r186 前必须重新核验。

不使用 `latest` 浮动安装；把上述矩阵、lockfile 与构建测试一起提交。

---

## 4. 候选逐项评估（20 个）

## 4.1 Three.js

- **项目 / 仓库**：[mrdoob/three.js](https://github.com/mrdoob/three.js)
- **核心能力**：WebGL/WebGPU 场景图、相机、纹理、LOD、实例化、Points、Shader 与资源生命周期。
- **技术 / 兼容性**：JavaScript ESM；当前 [`package.json`](https://github.com/mrdoob/three.js/blob/dev/package.json) 为 `0.185.0`、无运行时依赖。R3F 直接建立在它之上。
- **License**：[MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE)。复制或分发实质性源码时保留版权与许可文本。
- **维护状态**：**非常活跃**。默认分支最近 [commit，2026-08-03](https://github.com/mrdoob/three.js/commit/7cda7e710d884827fc73ff1a3aa63270846513d7)；最近稳定 [r185，2026-07-01](https://github.com/mrdoob/three.js/releases/tag/r185)。
- **MEMENTO 对应功能**：四级 Memory LOD、远景节点实例化、图片纹理、关系线、粒子、Fog、GPU 资源释放。
- **可直接使用的模块 / API**：[`LOD`](https://github.com/mrdoob/three.js/blob/dev/src/objects/LOD.js)（含 hysteresis）、[`InstancedMesh`](https://github.com/mrdoob/three.js/blob/dev/src/objects/InstancedMesh.js)、[`TextureLoader`](https://github.com/mrdoob/three.js/blob/dev/src/loaders/TextureLoader.js)、[`ImageBitmapLoader`](https://github.com/mrdoob/three.js/blob/dev/src/loaders/ImageBitmapLoader.js)、[`Cache`](https://github.com/mrdoob/three.js/blob/dev/src/loaders/Cache.js)。粒子方法可参考官方 [`webgl_points_sprites`](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_points_sprites.html) 与 instancing examples。
- **不建议复制**：整个 editor、完整 examples 页面、示例模型/HDR/字体/纹理、示例默认视觉。
- **风险**：Three `LOD` 只切对象，不管理图片 Blob、纹理预算、加载并发或 LRU；`Cache` 也不是业务级 Texture Manager。`ImageBitmap` 的 `close()`、Texture `dispose()` 与 Object URL `revokeObjectURL()` 必须由 MEMENTO 统一处理。
- **结论**：**采用（基础运行时）**。调用正式 API；如复制 examples 片段，单独记录来源和资产许可。

## 4.2 React Three Fiber

- **项目 / 仓库**：[pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber)
- **核心能力**：把 Three 场景、事件、渲染循环和资源生命周期纳入 React renderer。
- **技术 / 兼容性**：TypeScript、React reconciler、Zustand；v9.7.0 的 peer matrix 见 [`packages/fiber/package.json`](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/package.json)。
- **License**：[MIT](https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE)。
- **维护状态**：**非常活跃**。默认分支最近 [commit，2026-07-31](https://github.com/pmndrs/react-three-fiber/commit/0a107412ac64667b1908422e859447952f57feef)，同日发布 [v9.7.0](https://github.com/pmndrs/react-three-fiber/releases/tag/v9.7.0)。
- **MEMENTO 对应功能**：Persistent Scene Shell、统一 `<Canvas>`、节点 pointer 事件、TIME / PEOPLE / PLACE / EMOTION 仅重排而不销毁 renderer。
- **可直接使用的模块 / API**：`Canvas`、`useFrame`、`useThree`、`useLoader`、`invalidate`；生命周期可查 [`renderer.tsx`](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/core/renderer.tsx)，on-demand loop 可查 [`loop.ts`](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/core/loop.ts)，事件模型可查 [`events.ts`](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/core/events.ts)。
- **不建议复制**：reconciler、renderer、内部 store；直接依赖库。
- **风险**：不要用 React setState 逐帧更新几十个节点；高频坐标写 Three object、typed array 或 instance matrix。Canvas 必须只创建一次。
- **结论**：**采用（P0 架构）**。

## 4.3 Drei

- **项目 / 仓库**：[pmndrs/drei](https://github.com/pmndrs/drei)
- **核心能力**：R3F 的相机、Image shader、纹理、instances、points、预加载与性能 helper。
- **技术 / 兼容性**：React + TS/TSX + R3F；稳定 tag [`v10.7.7 package.json`](https://github.com/pmndrs/drei/blob/v10.7.7/package.json) 的 peer 是 React 19、R3F 9、Three `>=0.159`。包内依赖面较广，必须依靠 ESM tree-shaking 并只导入所需 exports。
- **License**：[MIT](https://github.com/pmndrs/drei/blob/master/LICENSE)。
- **维护状态**：**维护中**。默认分支最近 [commit，2026-01-30](https://github.com/pmndrs/drei/commit/c9d3d0dc9473f026c83965a7eb8c7f7a1a1bf0ae)；最近稳定 [v10.7.7，2025-11-13](https://github.com/pmndrs/drei/releases/tag/v10.7.7)，另有 v11 alpha，不应在 P0 使用 alpha。
- **MEMENTO 对应功能**：空间照片平面、镜头控制、预加载、GPU 自适应、LOD / instances / point primitives。
- **可直接使用的模块 / API**：[`Image.tsx`](https://github.com/pmndrs/drei/blob/master/src/core/Image.tsx)（可传受控 `texture`，含 aspect/zoom/grayscale shader）、[`CameraControls.tsx`](https://github.com/pmndrs/drei/blob/master/src/core/CameraControls.tsx)、[`Detailed.tsx`](https://github.com/pmndrs/drei/blob/master/src/core/Detailed.tsx)、[`Instances.tsx`](https://github.com/pmndrs/drei/blob/master/src/core/Instances.tsx)、[`Points.tsx`](https://github.com/pmndrs/drei/blob/master/src/core/Points.tsx)、[`Preload.tsx`](https://github.com/pmndrs/drei/blob/master/src/core/Preload.tsx)、[`PerformanceMonitor.tsx`](https://github.com/pmndrs/drei/blob/master/src/core/PerformanceMonitor.tsx)。
- **不建议复制**：demo 视觉、Environment presets、HDR、字体、Sparkles 默认风格，以及和 MEMENTO 无关的 MediaPipe/HLS/BVH helper。
- **风险**：`Detailed` 不等于图片 LOD pipeline；纹理 hook 的全局缓存也不等于可回收的本地 Blob LRU。动态本地照片应由自建 Texture Manager 生成受控 Texture，再传给 `Image`。此外，Drei 已有关于 Three r184+ 下 [`Preload` 无法可靠预编译场景的未关闭问题 #2722](https://github.com/pmndrs/drei/issues/2722)，所以不能把 `<Preload />` 当作消除首次渲染卡顿的保证。
- **结论**：**采用（精选 API）**，不复制整库。

## 4.4 camera-controls

- **项目 / 仓库**：[yomotsu/camera-controls](https://github.com/yomotsu/camera-controls)
- **核心能力**：平滑相机转场、聚焦、边界、输入映射、状态保存和 Promise 化连续 motion。
- **技术 / 兼容性**：TypeScript + Three.js，零运行时依赖，Three 是 peer；见 [`package.json`](https://github.com/yomotsu/camera-controls/blob/dev/package.json)。Drei 的 `CameraControls` 正式包装它。
- **License**：[MIT](https://github.com/yomotsu/camera-controls/blob/dev/LICENSE)。
- **维护状态**：**维护中**。默认分支最近 [commit，2026-02-02](https://github.com/yomotsu/camera-controls/commit/c51601107e266097edf6a9caa57bfa9eaa77427c)；最近稳定 [v3.1.2，2025-11-17](https://github.com/yomotsu/camera-controls/releases/tag/v3.1.2)。
- **MEMENTO 对应功能**：Memory Dive、Echo 跳转、返回原位、移动端 pan/dolly 限制、Reduced Motion。
- **可直接使用的模块 / API**：核心实现 [`src/CameraControls.ts`](https://github.com/yomotsu/camera-controls/blob/dev/src/CameraControls.ts)；使用 `setLookAt`、`moveTo`、`dollyTo`、`fitToBox`、`fitToSphere`、`smoothTime`、`rest` 事件。API 和 await transition 见官方 [readme](https://github.com/yomotsu/camera-controls/blob/dev/readme.md)。
- **不建议复制**：完整源码与 examples 资产；不要照搬默认交互参数。
- **风险**：GSAP、OrbitControls 与 camera-controls 不能同时写 camera transform。`saveState/reset` 只有单快照，不足以描述多级 Dive；需要 MEMENTO 自建 `CameraPoseStack` 和可中断状态机。
- **结论**：**采用**，优先通过 Drei wrapper 接入。

## 4.5 d3-force-3d

- **项目 / 仓库**：[vasturiano/d3-force-3d](https://github.com/vasturiano/d3-force-3d)
- **核心能力**：1D/2D/3D 力导向求解，含 link、many-body、collision、center、radial、x/y/z forces。
- **技术 / 兼容性**：JavaScript ESM；v3.0.6 依赖 d3 binarytree/dispatch/octree/quadtree/timer，见 [`package.json`](https://github.com/vasturiano/d3-force-3d/blob/master/package.json)。渲染无关，可直接输出坐标给 R3F；上游 package manifest 当前未声明 TypeScript types，MEMENTO 应在 adapter 层维护窄类型，而不是让 `any` 扩散。
- **License**：[MIT](https://github.com/vasturiano/d3-force-3d/blob/master/LICENSE)。
- **维护状态**：**成熟、低频维护**。未归档；默认分支最近 [commit，2025-04-09](https://github.com/vasturiano/d3-force-3d/commit/263b3bfc37578e541a7d7e59dbb32d026d66fa38)，无 GitHub Release 对象。
- **MEMENTO 对应功能**：PEOPLE / PLACE / EMOTION 空间重排、Constellation、关系聚拢。
- **可直接使用的模块 / API**：[`simulation.js`](https://github.com/vasturiano/d3-force-3d/blob/master/src/simulation.js)、[`link.js`](https://github.com/vasturiano/d3-force-3d/blob/master/src/link.js)、[`manyBody.js`](https://github.com/vasturiano/d3-force-3d/blob/master/src/manyBody.js)、[`collide.js`](https://github.com/vasturiano/d3-force-3d/blob/master/src/collide.js)、[`radial.js`](https://github.com/vasturiano/d3-force-3d/blob/master/src/radial.js)。官方 README 明确允许手动 `stop()` + `tick()`，适合预计算或 Worker。
- **不建议复制**：默认随机初始位置、默认 charge/link 参数、完整 README demo。
- **风险**：库默认随机源是固定 seed，但稳定结果仍依赖节点排序与初始坐标；导入顺序变化会改变布局。实现时应先按 memory id 稳定排序、显式保存 seed/布局版本并缓存稳定坐标。60–80 节点可预计算，规模增长后转 Worker / 分帧。Relationship Score 和四视图 anchor 仍必须自研。
- **结论**：**采用（坐标求解器）**。

## 4.6 three-forcegraph

- **项目 / 仓库**：[vasturiano/three-forcegraph](https://github.com/vasturiano/three-forcegraph)
- **核心能力**：把 force graph 封装成一个 Three `Object3D`，允许自定义 node object、link 和 D3/ngraph engine。
- **技术 / 兼容性**：JavaScript ESM + TypeScript declarations；v1.43.4 依赖 `d3-force-3d`、Kapsule、ngraph、data mapping 等，见 [`package.json`](https://github.com/vasturiano/three-forcegraph/blob/master/package.json)。可作为 `<primitive>` 放进 R3F，但内部对象生命周期仍独立。
- **License**：[MIT](https://github.com/vasturiano/three-forcegraph/blob/master/LICENSE)。
- **维护状态**：**活跃**。默认分支最近 [commit，2026-04-16](https://github.com/vasturiano/three-forcegraph/commit/325e7b82b53ddde646591a5a4b774d60262154c0)，无 GitHub Release 对象。
- **MEMENTO 对应功能**：快速验证图坐标、custom node、动态 link 和 force API。
- **可直接参考的模块 / API**：[`src/three-forcegraph.js`](https://github.com/vasturiano/three-forcegraph/blob/master/src/three-forcegraph.js)、[`src/index.d.ts`](https://github.com/vasturiano/three-forcegraph/blob/master/src/index.d.ts)、`graphData`、`nodeThreeObject`、`d3Force`、`tickFrame`、`refresh`。
- **不建议复制**：整个 Kapsule/object renderer、默认球节点、颜色映射、通用图交互。
- **风险**：它的内部 graph-to-object mapping 会和 MEMENTO 的 React component tree、四级图片 LOD、texture reference count、selection state 重叠；引入的依赖明显多于只用 `d3-force-3d`。
- **结论**：**不采用为正式依赖**；仅用于原型/API 对照。

## 4.7 3d-force-graph

- **项目 / 仓库**：[vasturiano/3d-force-graph](https://github.com/vasturiano/3d-force-graph)
- **核心能力**：完整 Three.js 3D force graph，含 renderer、controls、节点/连线、粒子、camera focus、postprocessing hook。
- **技术 / 兼容性**：JavaScript ESM；v1.80.0 依赖 Three、`three-forcegraph`、`three-render-objects`、Kapsule，见 [`package.json`](https://github.com/vasturiano/3d-force-graph/blob/master/package.json)。
- **License**：[MIT](https://github.com/vasturiano/3d-force-graph/blob/master/LICENSE)。
- **维护状态**：**活跃**。默认分支最近 [commit，2026-04-05](https://github.com/vasturiano/3d-force-graph/commit/957c1831157416e88ea9faf8e6a4edfe7b545858)，无 GitHub Release 对象。
- **MEMENTO 对应功能**：关系图快速原型、点击聚焦、方向粒子、局部高亮。
- **可直接参考的模块 / API**：[`src/3d-force-graph.js`](https://github.com/vasturiano/3d-force-graph/blob/master/src/3d-force-graph.js)、[`click-to-focus`](https://github.com/vasturiano/3d-force-graph/tree/master/example/click-to-focus)、[`img-nodes`](https://github.com/vasturiano/3d-force-graph/tree/master/example/img-nodes)、`cameraPosition(position, lookAt, transitionMs)`、`zoomToFit`、`d3Force`。
- **不建议复制**：完整 renderer、controls、默认星空图视觉、demo UI 与示例数据。
- **风险**：它拥有自己的 renderer/camera/controls，与 MEMENTO 的持续 R3F Canvas 直接冲突；即使 Three peer 区间兼容，也会形成双生命周期。默认视觉会把作品退化为“通用 3D 网络图”。
- **结论**：**仅参考，不进入主链**。

## 4.8 react-postprocessing

- **项目 / 仓库**：[pmndrs/react-postprocessing](https://github.com/pmndrs/react-postprocessing)
- **核心能力**：把 `postprocessing` 封装为 R3F components，包含 EffectComposer、selection、Bloom、DOF、Vignette 与自定义 effect wrapper。
- **技术 / 兼容性**：TypeScript + React + R3F；稳定 v3.0.4 的 [`package.json`](https://github.com/pmndrs/react-postprocessing/blob/v3.0.4/package.json) 与 React 19 / R3F 9 / Three `>=0.156` 兼容；main 已更严格，不能用 main 代替稳定版判断。
- **License**：[MIT](https://github.com/pmndrs/react-postprocessing/blob/master/LICENSE)。
- **维护状态**：**活跃**。默认分支最近 [commit，2026-08-02](https://github.com/pmndrs/react-postprocessing/commit/40a3ce6ef3ec1a9526fef9af7c8993dd8e0e922f)；最近稳定 [v3.0.4，2025-02-20](https://github.com/pmndrs/react-postprocessing/releases/tag/v3.0.4)。
- **MEMENTO 对应功能**：克制 Bloom、Depth of Field、Vignette、focus selection、自定义屏幕级 Dive / Time Collapse transition。
- **可直接使用的模块 / API**：[`EffectComposer.tsx`](https://github.com/pmndrs/react-postprocessing/blob/master/src/EffectComposer.tsx)、[`Selection.tsx`](https://github.com/pmndrs/react-postprocessing/blob/master/src/Selection.tsx)、[`wrapEffect.tsx`](https://github.com/pmndrs/react-postprocessing/blob/master/src/wrapEffect.tsx)、[`Bloom.tsx`](https://github.com/pmndrs/react-postprocessing/blob/master/src/effects/Bloom.tsx)、[`DepthOfField.tsx`](https://github.com/pmndrs/react-postprocessing/blob/master/src/effects/DepthOfField.tsx)。
- **不建议复制**：Glitch、强 Chromatic Aberration、ShockWave、Pixelation 等与 MEMENTO 视觉原则冲突的效果。
- **风险**：增加 fill-rate 和 framebuffer 成本；移动端需关闭/降分辨率。它解决全屏 pass，不解决图片节点粒子变形。
- **结论**：**P1 条件采用**；P0 不依赖它成立。

## 4.9 postprocessing

- **项目 / 仓库**：[pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)
- **核心能力**：Three.js 后处理基础设施，可合并 effects，并提供自定义 `Effect` / `EffectPass` / GLSL 结构。
- **技术 / 兼容性**：JavaScript ESM、Three、GLSL；v6.39.4 零运行时依赖、Three peer `>=0.168 <0.186`，见 [`package.json`](https://github.com/pmndrs/postprocessing/blob/v6.39.4/package.json)。
- **License**：[Zlib](https://github.com/pmndrs/postprocessing/blob/main/LICENSE.md)。不得歪曲原作者；修改源码需明确标记；源码分发不得移除 notice。
- **维护状态**：**活跃**。默认分支最近 [commit，2026-07-27](https://github.com/pmndrs/postprocessing/commit/703a17523c8d52045dadfdb228aaab5fb1888edc)，同日发布 [v6.39.4](https://github.com/pmndrs/postprocessing/releases/tag/v6.39.4)。
- **MEMENTO 对应功能**：自定义屏幕 shader transition、Bloom、Bokeh、TextureEffect、selected outline。
- **可直接使用的模块 / API**：[`Effect.js`](https://github.com/pmndrs/postprocessing/blob/main/src/effects/Effect.js)、[`BloomEffect.js`](https://github.com/pmndrs/postprocessing/blob/main/src/effects/BloomEffect.js)、[`BokehEffect.js`](https://github.com/pmndrs/postprocessing/blob/main/src/effects/BokehEffect.js)、[`TextureEffect.js`](https://github.com/pmndrs/postprocessing/blob/main/src/effects/TextureEffect.js)、[`passes`](https://github.com/pmndrs/postprocessing/tree/main/src/passes)。
- **不建议复制**：完整 effect catalogue、demo 资产、强故障/色差/镜头扭曲视觉。
- **风险**：r186 会越过当前 peer 上界；自定义 shader 必须处理 color space、resolution、WebGL feature 与 reduced-motion fallback。
- **结论**：**P1 条件采用**，通常作为 `react-postprocessing` 底层依赖，不复制整套源码。

## 4.10 hover-effect

- **项目 / 仓库**：[robin-dela/hover-effect](https://github.com/robin-dela/hover-effect)
- **核心能力**：用 displacement texture 在两张图片间做 fragment-shader 过渡。
- **技术 / 兼容性**：JavaScript；v1.2.0 直接依赖 `three ^0.149.0` 与 GSAP，见 [`package.json`](https://github.com/robin-dela/hover-effect/blob/master/package.json)。其类内部创建独立 `WebGLRenderer`。
- **License**：[MIT](https://github.com/robin-dela/hover-effect/blob/master/LICENSE)。
- **维护状态**：**停滞**。默认分支最近 [commit，2023-06-27](https://github.com/robin-dela/hover-effect/commit/1938cbff22a0379c5c5f17355550961374e7754c)，无 GitHub Release 对象。
- **MEMENTO 对应功能**：可作为 Memory Echo 双纹理位移、导入图片吸附或 Dive 转场的 shader 思路参考。
- **可参考的具体代码**：[`src/hover-effect.js`](https://github.com/robin-dela/hover-effect/blob/master/src/hover-effect.js) 中 `texture1` / `texture2` / `disp` / `dispFactor` uniforms 与 fragment mix。
- **不建议复制**：完整类、renderer、loader、事件与 demo 图片/位移贴图。
- **风险**：Three 版本落后于 r185；独立 renderer 与 Persistent Canvas 冲突；依赖外部 displacement asset；只做 hover，并不表达 MEMENTO 的产品状态。
- **结论**：**不采用依赖；仅在保留 MIT 记录时参考 shader 思想**。最终 shader 应在 MEMENTO 自有 R3F material / postprocessing Effect 内重写。

## 4.11 exifr

- **项目 / 仓库**：[MikeKovarik/exifr](https://github.com/MikeKovarik/exifr)
- **核心能力**：浏览器/Node 解析 JPEG、TIFF、HEIC/AVIF、PNG 的 EXIF/TIFF/GPS/XMP，并提供方向、GPS、缩略图高层 API。
- **技术 / 兼容性**：JavaScript ESM/UMD + TypeScript declarations；v7.1.3 无运行时依赖，见 [`package.json`](https://github.com/MikeKovarik/exifr/blob/master/package.json)。
- **License**：[MIT](https://github.com/MikeKovarik/exifr/blob/master/LICENSE)。
- **维护状态**：**明显休眠，但库成熟**。默认分支最近 [commit，2021-08-05](https://github.com/MikeKovarik/exifr/commit/6cbf6e921688faf7723e1f2e0b9e672d1f0aa21c)，最近 [v7.1.3，2021-08-05](https://github.com/MikeKovarik/exifr/releases/tag/v7.1.3)。
- **MEMENTO 对应功能**：DateTimeOriginal、GPS、Orientation、Camera Model，为 TIME / PLACE 和 import normalization 提供输入。
- **可直接使用的模块 / API**：`parse(file, ['DateTimeOriginal','Orientation','Model',...])`、`gps(file)`、`orientation(file)` / `rotation(file)`；README 建议浏览器用 lite/mini 或按 `pick` 缩小读取面，见 [官方 README](https://github.com/MikeKovarik/exifr/blob/master/README.md)。源码入口包括 [`src/bundles/lite.mjs`](https://github.com/MikeKovarik/exifr/blob/master/src/bundles/lite.mjs)、[`src/highlevel/gps.mjs`](https://github.com/MikeKovarik/exifr/blob/master/src/highlevel/gps.mjs)、[`src/highlevel/orientation.mjs`](https://github.com/MikeKovarik/exifr/blob/master/src/highlevel/orientation.mjs)、[`BlobReader.mjs`](https://github.com/MikeKovarik/exifr/blob/master/src/file-readers/BlobReader.mjs)。
- **不建议复制**：整个 parser、构建产物、示例图片；不要把原始 EXIF object 作为 Memory schema。
- **风险**：休眠意味着新格式/畸形输入风险由项目承担；EXIF 是不可信二进制；时区常缺失；GPS 属敏感信息。需尺寸/超时限制、fixture tests、错误降级和导出时移除 GPS 选项。
- **结论**：**不作为首选；保留为 MIT fallback**。只有 ExifReader 的真实 fixture、Worker 或 bundle 验证失败时，才锁 `7.1.3` 并通过同一 `MetadataAdapter` 切换。

## 4.12 browser-image-compression

- **项目 / 仓库**：[Donaldcwl/browser-image-compression](https://github.com/Donaldcwl/browser-image-compression)
- **核心能力**：按 `maxSizeMB` / `maxWidthOrHeight` 在 Canvas/Worker 中压缩图片，支持进度、AbortSignal 与可选 EXIF copy。
- **技术 / 兼容性**：JavaScript ESM/UMD + declarations；v2.0.2 依赖 `uzip`，见 [`package.json`](https://github.com/Donaldcwl/browser-image-compression/blob/master/package.json)。
- **License**：[MIT](https://github.com/Donaldcwl/browser-image-compression/blob/master/LICENSE)。
- **维护状态**：**低迷**。默认分支最近 [commit，2023-03-06](https://github.com/Donaldcwl/browser-image-compression/commit/d933bc8e483a9853ed2b57338e035e8c45e40dc7)，最近 [v2.0.2，2023-03-06](https://github.com/Donaldcwl/browser-image-compression/releases/tag/v2.0.2)。
- **MEMENTO 对应功能**：导入时生成较小图片、进度与取消。
- **可直接参考的模块 / API**：`imageCompression(file, options)`、[`lib/image-compression.js`](https://github.com/Donaldcwl/browser-image-compression/blob/master/lib/image-compression.js)、[`lib/web-worker.js`](https://github.com/Donaldcwl/browser-image-compression/blob/master/lib/web-worker.js)、[`copyExifWithoutOrientation.js`](https://github.com/Donaldcwl/browser-image-compression/blob/master/lib/copyExifWithoutOrientation.js)。
- **不建议复制**：`dist/`、examples、coverage、vendored [`UPNG.js`](https://github.com/Donaldcwl/browser-image-compression/blob/master/lib/UPNG.js)。
- **风险**：官方 README 的 `libURL` 默认值指向 jsDelivr，若 `useWebWorker: true` 且不覆盖会产生运行时远程依赖，违反 MEMENTO；见 [README options/CSP 说明](https://github.com/Donaldcwl/browser-image-compression/blob/master/README.md)。维护停滞、旧 `uzip`、OffscreenCanvas/WebP 差异也需审计。`preserveExif` 可能重新带回 GPS。
- **结论**：**不采用**。Pica 更适合明确生成三档尺寸，Worker 可完全本地打包。

## 4.13 Pica

- **项目 / 仓库**：[nodeca/pica](https://github.com/nodeca/pica)
- **核心能力**：浏览器高质量图片 resize，自动选择 Worker / WebAssembly / JS，支持 tile、取消、toBlob 与 split worker build。
- **技术 / 兼容性**：TypeScript source、ESM/CJS；v10.0.2 运行时依赖 `glur`、`multimath`，见 [`package.json`](https://github.com/nodeca/pica/blob/master/package.json)。
- **License**：[MIT](https://github.com/nodeca/pica/blob/master/LICENSE)。
- **维护状态**：**活跃**。默认分支最近 [commit，2026-06-26](https://github.com/nodeca/pica/commit/60c713882f4b8262fff8146fd1b137bf6e2d1c9b)，无 GitHub Release 对象；当前版本由仓库 package manifest 核验。
- **MEMENTO 对应功能**：生成 1024 Preview、512 Thumbnail、64 Micro；降低 IndexedDB、解码和 GPU 纹理压力。
- **可直接使用的模块 / API**：`resize(from, to, {filter:'mks2013'})`、`toBlob()`、单例 worker pool；官方 [README](https://github.com/nodeca/pica/blob/master/README.md) 说明 full build 内联 Worker，split build 可用 `new URL('pica/dist/pica_worker.js', import.meta.url)` 完全本地加载。核心为 [`src/pica_main.ts`](https://github.com/nodeca/pica/blob/master/src/pica_main.ts)、[`src/pica_worker.ts`](https://github.com/nodeca/pica/blob/master/src/pica_worker.ts)、[`src/tiler.ts`](https://github.com/nodeca/pica/blob/master/src/tiler.ts)。
- **不建议复制**：WASM/C 卷积实现、demo UI；直接依赖包。
- **风险**：Pica 不负责 EXIF orientation 或完整 File pipeline；README 明确提示 JPEG rotation 与 iOS Canvas memory limit。需在 resize 前按 `MetadataAdapter` 输出的 orientation 正规化，限制并发并复用单实例。专业色彩/gamma 仍有 Canvas 限制。
- **结论**：**采用**，替代 browser-image-compression。

## 4.14 Fast Average Color

- **项目 / 仓库**：[fast-average-color/fast-average-color](https://github.com/fast-average-color/fast-average-color)
- **核心能力**：从图片、Canvas、ImageBitmap 等提取 average 或 dominant color，提供 simple/sqrt/dominant 算法。
- **技术 / 兼容性**：TypeScript、ESM；v9.5.2 无运行时依赖，见 [`package.json`](https://github.com/fast-average-color/fast-average-color/blob/master/package.json)。
- **License**：[MIT](https://github.com/fast-average-color/fast-average-color/blob/master/LICENSE)。
- **维护状态**：**活跃**。默认分支最近 [commit，2026-04-05](https://github.com/fast-average-color/fast-average-color/commit/10a079bba97986fa10ec8654f2348e8aacded89f)，同日发布 [v9.5.2](https://github.com/fast-average-color/fast-average-color/releases/tag/v9.5.2)。
- **MEMENTO 对应功能**：照片主色、节点微光、关系相似度的一项弱特征、Dive 背景过渡输入。
- **可直接使用的模块 / API**：`getColorAsync` / `getColorFromArray4`；[`src/algorithm/dominant.ts`](https://github.com/fast-average-color/fast-average-color/blob/master/src/algorithm/dominant.ts)、[`simple.ts`](https://github.com/fast-average-color/fast-average-color/blob/master/src/algorithm/simple.ts)、[`sqrt.ts`](https://github.com/fast-average-color/fast-average-color/blob/master/src/algorithm/sqrt.ts)。API 与 cleanup 见 [README](https://github.com/fast-average-color/fast-average-color/blob/master/README.md)。
- **不建议复制**：demo 和示例图片；直接依赖小模块。
- **风险**：dominant/average 的结果受透明像素、白边和采样范围影响；算法或参数变化会改变 Relationship Score。应只处理 64/256px 本地变体，固定算法版本，并把结果持久化。
- **结论**：**采用**。它比完整 palette/OKLCH 管线更符合 P0 的单主色需求。

## 4.15 Color Thief

- **项目 / 仓库**：[lokesh/color-thief](https://github.com/lokesh/color-thief)
- **核心能力**：主色、palette、semantic swatches、progressive extraction、OKLCH / P3、Worker-friendly ImageBitmap。
- **技术 / 兼容性**：TypeScript ESM/CJS，v3.5.0 无强制运行时依赖；Node 的 `sharp` 是 optional peer，browser export 独立，见 [`package.json`](https://github.com/lokesh/color-thief/blob/master/package.json)。
- **License**：[MIT](https://github.com/lokesh/color-thief/blob/master/LICENSE)。
- **维护状态**：**非常活跃**。默认分支最近 [commit，2026-08-03](https://github.com/lokesh/color-thief/commit/a19bce8570322ca619df1f3cae6e0d6efd446639)，最近 [v3.5.0，2026-08-02](https://github.com/lokesh/color-thief/releases/tag/v3.5.0)。
- **MEMENTO 对应功能**：未来若需要多色 palette、感知均匀相似度或语义色板，可升级使用。
- **可直接使用的模块 / API**：`getColor`、`getPalette`、`getSwatches`、`getPaletteProgressive`；[`src/api.ts`](https://github.com/lokesh/color-thief/blob/master/src/api.ts)、[`src/quantizers/mmcq.ts`](https://github.com/lokesh/color-thief/blob/master/src/quantizers/mmcq.ts)、[`src/loaders/browser.ts`](https://github.com/lokesh/color-thief/blob/master/src/loaders/browser.ts)。Worker 用法见 [README](https://github.com/lokesh/color-thief/blob/master/README.md)。
- **不建议复制**：完整量化/WASM、CLI、demo assets；使用包 API。
- **风险**：P0 只需要一个主色；引入 palette、OKLCH、swatches 会扩大数据模型和参数面。主线程同步量化大图仍会卡顿。
- **结论**：**P1 备选，不与 Fast Average Color 并用**。当用户研究证明 palette 有产品价值时再替换 adapter。

## 4.16 idb

- **项目 / 仓库**：[jakearchibald/idb](https://github.com/jakearchibald/idb)
- **核心能力**：对原生 IndexedDB 的 Promise / TypeScript 薄封装，提供 typed schema、upgrade、事务、快捷 CRUD 与 async iterators。
- **技术 / 兼容性**：TypeScript ESM/CJS；v8.0.3 无运行时依赖，见 [`package.json`](https://github.com/jakearchibald/idb/blob/main/package.json)。面向现代 Chrome/Edge/Firefox/Safari。
- **License**：[ISC](https://github.com/jakearchibald/idb/blob/main/LICENSE)。分发时保留版权、许可与免责声明。
- **维护状态**：**稳定、低频维护**。默认分支最近 [commit，2025-05-07](https://github.com/jakearchibald/idb/commit/77dd8bebf3669bbce9628e470a021ff63eb4acaf)；无 GitHub Release 对象，当前 tag/package 为 [`v8.0.3`](https://github.com/jakearchibald/idb/tree/v8.0.3)。
- **MEMENTO 对应功能**：Memories、assets/blobs、people、places、constellations、settings、import jobs 的 schema、migration 与事务。
- **可直接使用的模块 / API**：`openDB<Schema>()`、`upgrade`、`blocked`、`blocking`、`terminated`、`tx.done`、async iterators；[`src/entry.ts`](https://github.com/jakearchibald/idb/blob/main/src/entry.ts)、[`database-extras.ts`](https://github.com/jakearchibald/idb/blob/main/src/database-extras.ts)、[`async-iterators.ts`](https://github.com/jakearchibald/idb/blob/main/src/async-iterators.ts)。
- **不建议复制**：内部 Proxy/wrap 实现；直接依赖包。
- **风险**：README 明确警告：事务开始后 `await` 非 IDB 异步操作会导致事务自动关闭；图像处理必须在事务外完成，再用短事务原子写入。配额、持久化授权和跨版本 migration 仍需产品层处理。
- **结论**：**采用，作为唯一 IndexedDB wrapper**。

## 4.17 Dexie.js

- **项目 / 仓库**：[dexie/Dexie.js](https://github.com/dexie/Dexie.js)
- **核心能力**：更高层 IndexedDB ORM-like wrapper，含 schema version、bulk、query、liveQuery、React hooks 与 add-ons。
- **技术 / 兼容性**：TypeScript/JavaScript ESM；v4.4.4 本体无运行时依赖，见 [`package.json`](https://github.com/dexie/Dexie.js/blob/master/package.json)。
- **License**：[Apache-2.0](https://github.com/dexie/Dexie.js/blob/master/LICENSE)，并有 [`NOTICE`](https://github.com/dexie/Dexie.js/blob/master/NOTICE)。采用或复制时保留 License/NOTICE，并标明修改；还需分别核验 add-ons。
- **维护状态**：**活跃**。默认分支最近 [commit，2026-06-16](https://github.com/dexie/Dexie.js/commit/962052f7b4e15493a3a76644482d5e1ae1fd4677)，同日发布 [v4.4.4](https://github.com/dexie/Dexie.js/releases/tag/v4.4.4)。
- **MEMENTO 对应功能**：复杂 indexed query、bulkPut、liveQuery、schema migration；[`dexie-export-import`](https://github.com/dexie/Dexie.js/tree/master/addons/dexie-export-import) 可参考导出策略。
- **可直接使用的模块 / API**：`db.version().stores()`、`transaction()`、`bulkPut()`、`liveQuery()`；源码见 [`src/classes/dexie`](https://github.com/dexie/Dexie.js/tree/master/src/classes/dexie)、[`src/live-query`](https://github.com/dexie/Dexie.js/tree/master/src/live-query)。
- **不建议复制**：整个 monorepo、Dexie Cloud、Syncable/Observable、与 MVP 无关 add-ons。
- **风险**：比 `idb` 更大、更有框架性；Cloud 文档容易把产品带向账号/同步；Apache NOTICE 管理比 ISC 多一步。若同时用 idb 会制造两套事务与类型模型。
- **结论**：**当前不采用，作为扩展备选**。只有 archive 查询/迁移/实时订阅显著复杂到自有 data layer 难维护时，才整体切换；不能并用。

## 4.18 fflate

- **项目 / 仓库**：[101arrowz/fflate](https://github.com/101arrowz/fflate)
- **核心能力**：纯 JS/TS DEFLATE/GZIP/Zlib/ZIP，含 async Worker、多文件并行和 streaming Zip/Unzip。
- **技术 / 兼容性**：TypeScript、Browser/Node、无运行时依赖；v0.8.3，见 [`package.json`](https://github.com/101arrowz/fflate/blob/master/package.json)。官方 README 说明基础包约 8kB，并支持 tree-shaking。
- **License**：[MIT](https://github.com/101arrowz/fflate/blob/master/LICENSE)。
- **维护状态**：**活跃**。默认分支最近 [commit，2026-05-16](https://github.com/101arrowz/fflate/commit/dcb3714a6c25db3a2748641019c5277413d09714)，最近 [v0.8.3，2026-05-16](https://github.com/101arrowz/fflate/releases/tag/v0.8.3)。
- **MEMENTO 对应功能**：本地 ZIP backup / restore、大型照片逐条写入、Worker 解压。
- **可直接使用的模块 / API**：小包 `zip` / `unzip`；大包 `Zip`、`AsyncZipDeflate`、`ZipPassThrough`、`Unzip`、`AsyncUnzipInflate`；统一源码 [`src/index.ts`](https://github.com/101arrowz/fflate/blob/master/src/index.ts)，用法见 [README](https://github.com/101arrowz/fflate/blob/master/README.md)。
- **不建议复制**：压缩算法源码、demo；直接依赖并只 import 所需 API。
- **风险**：不要对照片集使用 `zipSync()`；JPEG/WebP/AVIF 已压缩，应 `ZipPassThrough` / level 0。恢复必须限制 entry count、单文件/总解压尺寸、嵌套深度和路径；校验 schema/checksum，防 Zip Slip / Zip Bomb。
- **结论**：**采用，唯一 ZIP 引擎**。

## 4.19 JSZip

- **项目 / 仓库**：[Stuk/jszip](https://github.com/Stuk/jszip)
- **核心能力**：浏览器/Node 创建、读取和编辑 ZIP，API 简单。
- **技术 / 兼容性**：JavaScript + TypeScript declarations；v3.10.1 依赖 `pako`、`readable-stream`、`lie`、`setimmediate`，见 [`package.json`](https://github.com/Stuk/jszip/blob/main/package.json)。
- **License**：[MIT OR GPL-3.0 双许可](https://github.com/Stuk/jszip/blob/main/LICENSE.markdown)。若使用须在记录中明确选择 MIT，并保留 MIT 文本。
- **维护状态**：**有限维护**。默认分支最近 [commit，2025-03-28](https://github.com/Stuk/jszip/commit/643714aa770afd8fe1df6cfc7e2bde945bb0ef64)；无 GitHub Release 对象，最近 package tag 为 [`v3.10.1`](https://github.com/Stuk/jszip/tree/v3.10.1)。
- **MEMENTO 对应功能**：`file()` / `folder()` / `generateAsync({type:'blob'})` / `loadAsync()` 可完成小型备份。
- **可直接参考的模块 / API**：[`lib/object.js`](https://github.com/Stuk/jszip/blob/main/lib/object.js)、[`lib/load.js`](https://github.com/Stuk/jszip/blob/main/lib/load.js)、[`lib/generate/ZipFileWorker.js`](https://github.com/Stuk/jszip/blob/main/lib/generate/ZipFileWorker.js)、[README](https://github.com/Stuk/jszip/blob/main/README.markdown)。
- **不建议复制**：内部压缩/stream 体系、dist、文档站；不与 fflate 并用。
- **风险**：依赖和安装面明显大于 fflate；`generateAsync` 通常需要在内存中形成结果，照片集峰值风险更高；功能发布较久。
- **结论**：**不采用**，fflate 更适合 MEMENTO 的大 Blob 和流式边界。

## 4.20 Immich

- **项目 / 仓库**：[immich-app/immich](https://github.com/immich-app/immich)
- **核心能力**：自托管照片备份、timeline、缩略图、EXIF、搜索、相册和任务队列。
- **技术 / 兼容性**：TypeScript monorepo；Web 为 SvelteKit，server 为 Node/Nest/Postgres/Redis，mobile 为 Flutter。官方 [`architecture.mdx`](https://github.com/immich-app/immich/blob/main/docs/docs/developer/architecture.mdx) 明确是 traditional client-server，而不是 browser-only local-first。
- **License**：[AGPL-3.0](https://github.com/immich-app/immich/blob/main/LICENSE)。复制代码形成衍生作品并向网络用户提供服务会带来强 copyleft 源码提供义务；除非 MEMENTO 明确整体接受 AGPL，不应混入代码。
- **维护状态**：**非常活跃**。默认分支最近 [commit，2026-08-03](https://github.com/immich-app/immich/commit/29e7ea5302bc3f6ed1eb845706cc77cb34f40048)，最近 [v3.1.0，2026-07-29](https://github.com/immich-app/immich/releases/tag/v3.1.0)。
- **MEMENTO 对应功能**：只参考导入任务分层、派生缩略图、缓存、失败恢复、不可变原图等工程原则。
- **可参考但不可复制的模块**：[`timeline-manager`](https://github.com/immich-app/immich/tree/main/web/src/lib/managers/timeline-manager)、[`AssetCacheManager.svelte.ts`](https://github.com/immich-app/immich/blob/main/web/src/lib/managers/AssetCacheManager.svelte.ts)、[`metadata.service.ts`](https://github.com/immich-app/immich/blob/main/server/src/services/metadata.service.ts)、[`database-backup.service.ts`](https://github.com/immich-app/immich/blob/main/server/src/services/database-backup.service.ts)。
- **不建议复制**：任何源码、UI、IA、Logo、字体、图标、截图、示例媒体；不搬 server stack。
- **风险**：AGPL；技术栈不同；产品是 server-first cloud replacement，不是纯浏览器 local-first。其完整产品视觉和功能组合也不属于可复用底层模块。
- **结论**：**只做架构对照，不采用代码或资产**。

## 4.A 补充核验：明确搜索但未进入 20 个深评候选的项目

以下项目用于补齐 GSAP、Shader、Infinite Canvas、Timeline、Local-first Photo 与 EXIF 维护性检查。它们因与上面候选重叠，或已经存在明确的许可证/架构淘汰理由，不计入“20 个深评候选”。

### GSAP

- **仓库 / 技术**：[greensock/GSAP](https://github.com/greensock/GSAP)，JavaScript 动画与 timeline；当前 package 为 `3.15.0`。
- **License / 维护**：package manifest 声明 [Standard “no charge” license](https://gsap.com/standard-license/)，不是 MIT / Apache 类开源许可证；默认分支最近 [commit，2026-04-13](https://github.com/greensock/GSAP/commit/13e2b790546426a1a2e0e9b409f3f8dc6d6611f2)。官方 README 说明可免费商用，但仍受该标准许可约束。
- **MEMENTO 对应 / 可用部分**：作为已确定基础依赖，调用 `gsap.timeline()`、`to()`、`context()` 编排 UI、节点 morph 进度和 Shader uniform。
- **不复制 / 风险**：不复制或改写 GSAP 核心源码，不把它再分发为动画工具；也不能与 camera-controls 同时写 `camera.position` / target。
- **结论**：**依赖调用，不能作为可复制的开源源码来源**。

### gl-transitions

- **仓库 / 技术**：[gl-transitions/gl-transitions](https://github.com/gl-transitions/gl-transitions)，GLSL 图片转场集合。
- **License / 维护**：根仓库为 [MIT](https://github.com/gl-transitions/gl-transitions/blob/master/LICENSE)，默认分支最近 [commit，2026-06-22](https://github.com/gl-transitions/gl-transitions/commit/902218a1b63773ac0d0d9f491951da3392365bfe)；但根许可证明确要求继续检查每个 shader 文件头的独立作者与许可证。
- **MEMENTO 对应 / 可复制部分**：可按文件复制并改写 [`fade.glsl`](https://github.com/gl-transitions/gl-transitions/blob/master/transitions/fade.glsl)、[`dissolve.glsl`](https://github.com/gl-transitions/gl-transitions/blob/master/transitions/dissolve.glsl) 或 [`displacement.glsl`](https://github.com/gl-transitions/gl-transitions/blob/master/transitions/displacement.glsl)，保留原文件头，并适配为 R3F material / postprocessing Effect。
- **不复制 / 风险**：Glitch、RGB split、TV static、强 burn 等与 MEMENTO 视觉规范冲突；不要批量搬入整个 shader catalogue，也不要把位移贴图等示例资产视为自动获批。
- **结论**：**P1 条件采用单个 MIT shader；P0 不依赖**。

### ExifReader

- **仓库 / 技术**：[mattiasw/ExifReader](https://github.com/mattiasw/ExifReader)，JavaScript + TypeScript declarations，支持 Browser `File`、JPEG / PNG / HEIC / AVIF / WebP 与 tag filtering。
- **License / 维护**：[MPL-2.0](https://github.com/mattiasw/ExifReader/blob/main/LICENSE)；默认分支最近 [commit，2026-07-31](https://github.com/mattiasw/ExifReader/commit/45aab45234748fb95f7775ff13e2ada3924adc44)，最近 [v4.41.3，2026-07-18](https://github.com/mattiasw/ExifReader/releases/tag/v4.41.3)，维护明显强于 exifr。
- **MEMENTO 对应 / 可用部分**：[`src/exif-reader.js`](https://github.com/mattiasw/ExifReader/blob/main/src/exif-reader.js) 暴露的 `ExifReader.load(file, { includeTags, expanded })`、GPS 计算结果与部分读取策略；类型来自 [`exif-reader.d.ts`](https://github.com/mattiasw/ExifReader/blob/main/exif-reader.d.ts)，统一包在 `MetadataAdapter` 后。
- **不复制 / 风险**：优先使用未修改依赖；若复制或修改其上游文件，修改后的 Covered Files 需继续按 MPL-2.0 提供源代码和 notice。输出结构也比 exifr 更复杂，必须 normalize。
- **结论**：**推荐采用，但设强制验证门**。锁版本前先跑真实 JPEG / HEIC / PNG fixture、bundle 和 Worker 测试；若失败，再由同一 adapter 切换到 exifr。

### tldraw

- **仓库 / 技术**：[tldraw/tldraw](https://github.com/tldraw/tldraw)，React + TypeScript Infinite Canvas SDK；默认分支最近 [commit，2026-08-03](https://github.com/tldraw/tldraw/commit/a5e2d601668434a78d086296a70165b06bb694c9)，最近 [v5.2.5，2026-07-15](https://github.com/tldraw/tldraw/releases/tag/v5.2.5)。
- **License**：当前 [tldraw license](https://github.com/tldraw/tldraw/blob/main/LICENSE.md) 明确禁止在没有相应 trial / commercial license 的 Production Environment 使用，并包含 License Key / watermark enforcement。
- **MEMENTO 对应 / 可参考部分**：只可研究 pan / zoom、viewport、selection 与大画布交互方法。
- **不复制 / 风险**：不复制 SDK、editor、UI、图标或交互实现；2D 白板 renderer 也与持续 R3F Canvas 冲突。
- **结论**：**不采用**。MEMENTO 需要的是 3D spatial navigation，不是嵌入一个白板产品。

### vis-timeline

- **仓库 / 技术**：[visjs/vis-timeline](https://github.com/visjs/vis-timeline)，JavaScript DOM Timeline / 2D Graph；默认分支最近 [commit，2026-08-01](https://github.com/visjs/vis-timeline/commit/acaf0cf70e37d64364ff87bf1c441658fd2ae3a6)，最近 [v8.5.2，2026-07-15](https://github.com/visjs/vis-timeline/releases/tag/v8.5.2)。
- **License**：[MIT OR Apache-2.0](https://github.com/visjs/vis-timeline/blob/master/LICENSE.md)。
- **MEMENTO 对应 / 可参考部分**：窗口缩放、时间范围与密度处理方法可作 TIME View 的研究参照。
- **不复制 / 风险**：不要嵌入其 DOM timeline、默认 UI 或 item model；它无法让同一批 R3F Memory nodes 在空间中连续 morph，会形成第二套交互层。
- **结论**：**不采用代码**。TIME View 坐标与 Time Collapse 属于 MEMENTO 自有产品逻辑。

### Ente

- **仓库 / 技术**：[ente/ente](https://github.com/ente/ente)，隐私照片产品 monorepo，主要客户端为 Dart；默认分支最近 [commit，2026-08-03](https://github.com/ente/ente/commit/87c505c0b55e8833e76f388c4cc57326f056a273)，2026-08-03 仍有 release。
- **License**：[AGPL-3.0](https://github.com/ente/ente/blob/main/LICENSE)。
- **MEMENTO 对应 / 可参考部分**：Local-first / privacy-first 的产品表达、导入可靠性、备份与恢复心智模型。
- **不复制 / 风险**：不复制产品源码、UI、品牌或媒体资产；技术栈不同，AGPL 网络分发义务也会改变 MEMENTO 的许可证选择。
- **结论**：**仅做产品与隐私架构参考**。

---

## 5. 建议的真实集成边界

## 5.1 导入与图片处理

```text
File[]
  → validate type / size / count
  → ExifReader（只读取需要 tags；失败不阻断导入）
  → 按 orientation 画入正规化 source canvas
  → Pica singleton（有限并发）
       ├─ preview 1024–1600
       ├─ thumbnail 512
       └─ micro 64
  → Fast Average Color（micro 或 256px 输入）
  → 领域模型 normalization
  → idb 短事务原子写入 metadata + blobs
```

关键限制：

- 图像 decode/resize/color extraction 在 IDB transaction 外完成；事务内只做确定的读写。
- 导入任务必须有 `queued / parsing / resizing / extracting / saving / done / failed / cancelled` 状态。
- 原文件不可变；EXIF 规范化结果与派生图分开存。默认不把 EXIF 重新写入派生图，避免 GPS 泄露。
- 并发以设备内存/GPU 档位控制，不能对 60 张大图 `Promise.all`。

## 5.2 IndexedDB 数据边界

建议 stores：

```text
memories        主领域记录与可查询索引
assets          original / preview / thumbnail / micro Blob + dimensions + mime + checksum
people          人物
places          手动地点与坐标
constellations  用户建立的星座
relationships   可重算的边与 reason snapshot（或按规模只存缓存版本）
importJobs       可恢复导入状态
settings         图形质量、reduced motion、schema/app flags
```

`idb` 负责安全调用 IndexedDB；MEMENTO 自己负责：

- `DBSchema` 类型；
- 单调递增 migration；
- `blocked` / `blocking` / `terminated` UI；
- `navigator.storage.persist()` 请求与配额提示；
- checksum 去重、删除级联和 orphan cleanup；
- Blob → Texture 的临时 URL / bitmap 生命周期。

## 5.3 3D、布局、LOD 与纹理

- `d3-force-3d` 输入只包含 node id、link 和 view-specific anchors；它不能读 UI/store，也不能决定关系。
- TIME view 不应强行套 force graph；按时间曲线/river 生成确定 target coordinates。PEOPLE / PLACE / EMOTION 可使用不同 force/anchor 配方。
- 切视图时先冻结新 target positions，再由 MEMENTO motion system 插值；不要同时让 force simulation 与 GSAP / frame loop 写同一 position。
- 四档 LOD 建议由自有调度器管理：far point/solid color → micro → thumbnail → focused preview。Three `LOD` 可做可见性参考，但纹理加载/释放必须独立。
- `LocalTextureManager` 至少维护 `{assetId, variant, state, texture, refCount, lastUsed, byteEstimate}`，含并发队列、LRU、失败重试、`texture.dispose()`、`ImageBitmap.close()`、Object URL revoke。
- Drei `Image` 传受控 Texture；不要让大量动态 Blob URL 永久留在 `useTexture` 全局缓存。

## 5.4 Camera 与 shader

- 唯一 camera writer 是 `CameraStateMachine`。camera-controls 执行 `setLookAt` / `fitTo*`，GSAP 只编排 UI、shader uniform 或不冲突的 scene 参数。
- 每次 Dive 存完整 pose `{position,target,fov,near,far,view}`；Echo 先更新 pose stack，再启动可取消 transition；route 只反映状态，不销毁 Canvas。
- 粒子/图片转场没有发现可以原样采用、同时满足持续 R3F Canvas、现代 Three、许可证和 MEMENTO 语义的成熟组件。P0 应基于 Three `Points` / `BufferGeometry` / ShaderMaterial 自研最小 transition；`hover-effect` 只提供双纹理 displacement 参考。
- postprocessing 是增强层。Reduced Motion 或低性能档必须回退为短 crossfade/position interpolation，不可阻断流程。

## 5.5 Backup / Restore

建议 ZIP 结构：

```text
memento-backup/
  manifest.json       schemaVersion、appVersion、createdAt、counts、checksums、privacy flags
  database.json       领域记录，不内嵌大 Blob
  assets/<id>/original.<ext>
  assets/<id>/preview.<ext>
  assets/<id>/thumbnail.<ext>
  assets/<id>/micro.<ext>
```

- 照片使用 `ZipPassThrough`，JSON 可 Deflate；避免无收益地二次压 JPEG/WebP/AVIF。
- Restore 先只读并验证 manifest、版本、路径、条目数、声明尺寸、checksum，再进入 staging stores；全部成功才提交/切换。
- 拒绝绝对路径、`..`、反斜杠混淆、重复规范化路径、超出总大小/文件数/单文件上限的包。
- 明确定义 `replace / merge`；默认不静默覆盖同 ID。
- 失败后旧数据库仍可用；不能边解压边破坏现有数据。

## 6. `CREDITS.md` 与许可证执行要求

项目已建立 `CREDITS.md` 作为实际来源账本；当前处于研究阶段，所以候选项目不会被误写成“已经使用”。开始安装依赖、复制算法或改写 Shader 后，每项至少记录：

```markdown
## Project name
- Repository:
- Version / commit:
- License:
- Used as: dependency | copied module | modified source | architecture reference only
- MEMENTO files affected:
- Modifications:
- Required notice location:
- Assets copied: none | list each asset and its separate license
```

执行规则：

1. **依赖调用也记录版本与仓库**；lockfile 是可复现证据，但不能代替 CREDITS。
2. **MIT / ISC**：复制或分发实质性源码时保留原版权、许可和免责声明。建议在 `third-party-licenses/` 保存对应文本，并在改写文件头注明来源/修改。
3. **Zlib**：不得声称原创；修改源码必须清楚标明，不移除 notice。
4. **Apache-2.0**：若未来采用 Dexie，保留 LICENSE、适用 NOTICE，并标明改动；不要只写一行“Apache”。
5. **AGPL**：Immich 仅研究，不复制代码；`CREDITS.md` 可写 `architecture reference only; no code or assets copied`。
6. 代码仓库许可证**不自动覆盖** demo 图片、字体、HDR、3D 模型、Logo、商标或文档。每个资产单独核验；不确定就不带入。
7. 不复制完整 UI、中文文案、页面组合或视觉资产。MEMENTO 的产品架构、关系规则、四视图、Dive、Echo、Constellation、Time Collapse、Typography、Color、Motion 必须是自有设计。

## 7. 实施前的最终检查清单

- [ ] 锁定 Three/R3F/Drei/camera-controls/postprocessing 版本矩阵并跑 production build。
- [ ] 用真实相机样本验证 ExifReader：横竖方向、缺时间、无 GPS、畸形 EXIF、HEIC/PNG 可降级；同一 adapter 下保留 exifr fallback 对照。
- [ ] Pica Worker 仅从本地 bundle 加载；无 CDN / remote URL。
- [ ] 生成的三档变体尺寸、方向、MIME、质量和峰值内存通过测试。
- [ ] 主色算法参数与版本落库；修改算法有 migration/recompute 策略。
- [ ] idb migration、blocked connection、事务失败、配额不足、刷新恢复通过测试。
- [ ] Texture Manager 对每个对象 URL、ImageBitmap、Texture 有明确释放路径。
- [ ] fflate 使用流式 API；Restore 有路径、体积、数量、checksum 与原子回滚保护。
- [ ] `CREDITS.md`、第三方许可证文本、无外部资产误用检查通过。
- [ ] 没有因采用开源模块而改变 MEMENTO 的核心产品语义或视觉语言。

## 8. 最终决策

这次研究的价值不是“找到一个现成 MEMENTO”，而是把已验证的底层能力放在正确边界内：

- 图布局只解算坐标；
- 镜头库只执行运动；
- 图片库只做解析、resize、取色；
- IndexedDB wrapper 只负责可靠存取；
- ZIP 库只负责压缩格式；
- 产品关系、空间语义、交互状态、视觉与作品集表达仍由 MEMENTO 自己完成。

按此组合，可以避免重复造轮子，同时避免把项目做成通用图表、旧 Three demo、Server-first 相册或换皮开源产品。

---

## 9. 音乐层补充研究与接入决策

> 核验日期：2026-08-05。目标不是复制一整套播放器，而是为 MEMENTO 找到可维护、可解释的本机连接边界。

### 候选项目

| 项目 | 结论 | 关键原因 |
|---|---|---|
| [listen1/listen1](https://github.com/listen1/listen1) / [listen1/listen1-api](https://github.com/listen1/listen1-api) | 只参考架构 | MIT；统一搜索、歌单、歌词和播放地址的抽象适合作为 Provider Adapter 参考，但项目整体不是 MEMENTO 的前端依赖。 |
| [sansenjian/qq-music-api](https://github.com/sansenjian/qq-music-api) | 只做 QQ 适配器参考 | TypeScript/Koa、支持 QQ 登录和歌单；README 明确提示仅供学习研究，接口依赖平台行为，不能把它伪装成稳定官方 SDK。 |
| [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) | 不新增依赖 | 仓库已归档，且版权保护和维护状态都不适合作为新的浏览器运行时依赖。 |
| [GitHub-ZC/wp_MusicApi](https://github.com/GitHub-ZC/wp_MusicApi) | 不采用 | 虽支持多平台，但 Cookie / 公共服务边界和“仅供学习研究”的限制不适合 MEMENTO 的隐私模型。 |
| [qier222/YesPlayMusic](https://github.com/qier222/YesPlayMusic) | 只参考交互 | 可参考 NetEase 登录、播放队列等桌面播放器信息架构，不复制其 UI、品牌、接口或资源。 |

### 最终方案

MEMENTO 采用自有的轻量前端 `musicService` 适配层，默认连接已经在用户电脑上运行的 Mineradio 服务：

```text
MusicLibraryPopover
  → MusicLoginDialog / Provider Tabs
  → musicService（状态、二维码、歌单、歌曲、播放地址）
  → http://127.0.0.1:3000（Mineradio 本机服务）
  → MusicStore queue + MusicExperience audio
```

浏览器不保存原始 Cookie，也不直接把音乐平台网页嵌入 MEMENTO。网易云在普通浏览器中使用本机服务提供的二维码；QQ 音乐需要桌面登录桥接或用户主动导入 Cookie。这样既保持了真实登录与真实歌单，又不把跨域登录、平台协议和账号凭据硬塞进静态前端。

### 对产品的影响

- P0 是“登录 → 读取真实歌单 → 选择歌曲 → 按需获取播放地址 → 播放 / 下一首”的闭环；歌词、搜索、推荐和跨平台合并队列暂不进入第一版。
- Mineradio 未运行时，界面必须显示连接失败并保留本地音频，不显示假歌单、不假装登录成功。
- 远程音频不打包进仓库；播放权限、地区限制和版权由平台与用户自己的本机连接器负责。
