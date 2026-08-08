# MEMENTO Architecture（架构）

## 运行时边界

- Vite + React 19 + strict TypeScript；路由使用 React Router。
- `PersistentSceneShell` 位于路由 Overlay 外，只创建一个 R3F Canvas。路由变化只改变场景模式、相机状态和 Overlay，不重建 WebGL renderer。
- Canvas 支持 WebGL 不可用回退，并监听 `webglcontextlost` / `webglcontextrestored`；恢复按钮只重建渲染上下文，不影响本地数据。
- Archive、Settings、Memory Dive、Constellation Detail 和 Universe HUD 使用路由懒加载；Three、React 和数据依赖分包，避免非核心页面首屏加载全部代码。

## 数据层

- IndexedDB 数据库名为 `memento-db`，schema version 为 1。
- `src/data/repositories` 是唯一的数据写入边界；Zustand 只保存运行时状态，不作为持久化数据库。
- 启动时运行幂等维护：清理孤立资产、人物、地点、失效星座、过期导入任务和无效布局缓存，并修复仍有至少两段记忆的星座引用。
- 所有记忆 Bundle（Memory + 衍生 Asset + Place）在同一事务中写入；删除记忆会级联清理资产、星座引用和布局缓存。

## 导入与备份

- 导入流程在浏览器内完成图片验证、EXIF 读取、方向归一化、三档衍生图、主色提取和 IndexedDB 写入；批处理支持取消、失败隔离、重试和进度状态。
- Backup ZIP 只包含 personal 数据，写入每个文件的 SHA-256；恢复前校验路径、扩展名、ZIP 大小、条目数量、展开大小、JSON 结构、Asset 引用和设置枚举。
- 恢复在单个 IndexedDB 事务内提交：相同预览 checksum 跳过，冲突 ID 生成新 ID，星座按内容签名去重；事务失败不会留下半成品。

## 场景与性能

- TIME、PEOPLE、PLACE、EMOTION 使用确定性 `Memory[] + Relationship[] + viewportSeed → positions` 布局，布局缓存按 source/view/version 隔离。
- `LocalTextureManager` 管理 Blob URL、引用计数、LRU 和质量预算；Memory 删除、数据源切换和 Canvas 卸载都会释放纹理。
- `PerformanceGovernor` 在 auto 档位按帧率逐级调整 effective quality；手动档位不会被自动覆盖。LOD、关系线数量、DPR 和粒子数量随档位收敛。

## Memory Template System

- 模板系统复用现有 Universe 的单一 R3F Canvas、CameraControls 和音乐层，不创建第二个 renderer、相机或数据库。
- `src/memory/config` 是五套叙事模板的唯一注册表；每套模板通过连续 `TimelinePhase[]` 描述布局、镜头和阶段标签，启动时做 0..1 覆盖校验。
- `LayoutEngine` 以模板 seed、照片 ID 和布局策略生成确定性目标位姿；`TimelineEngine` 支持任意进度随机访问并输出照片变换与 CameraDirector 位姿。
- `MemoryTemplateLayer` 将照片作为真实 R3F 对象渲染，Hero 使用 preview LOD，其余照片使用 thumbnail LOD，并受现有 effective quality 预算限制。
- 播放优先使用现有音乐层的时间状态；无音乐时由 `FallbackPlaybackClock` 提供静音播放。`MemoryPlaybackCoordinator` 将唯一时钟映射到模板状态，暂停、Seek、Replay 和完成不会写入 IndexedDB。
- 模板会话是可退出的运行时状态；照片和元数据仍只来自现有 IndexedDB，退出后原 Universe 布局与导航恢复。

## 安全与隐私

- 记忆数据 P0 不接在线 AI、远程图片、远程字体或 CDN；音乐层是独立的可选本机连接器，不参与照片和记忆数据存储。
- `src/features/music/musicService.ts` 通过 `VITE_MUSIC_API_BASE_URL` 或本地设置连接 Mineradio 兼容服务，默认地址为 `http://127.0.0.1:3000`。登录、Cookie 持久化、平台适配和音频代理由本机服务负责。
- 浏览器只请求账号状态、歌单、歌曲元数据和播放地址；原始 Cookie 不写入 IndexedDB、localStorage，也不进入日志。服务未运行时保留本地音频播放，并显示可解释的失败状态。
- ZIP 路径拒绝遍历、绝对路径、未知目录、嵌套 ZIP 和可执行扩展名；恢复只接受 `personal` 数据。
- 用户可在 Settings 中请求持久化存储、导出备份或清空 personal 数据；Demo 数据与设备相册原文件隔离。
