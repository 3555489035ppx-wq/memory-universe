# Memuniverse Memory Template System V1｜发布回归报告

日期：2026-08-08
范围：桌面端 Web App；不新增移动端专属实现。

## 交付内容

- 五套可真实选择的模板：`high-school`《那年夏天》、`love`《与你有关》、`breakup`《未寄出的信》、`university`《我们的明天》、`career`《向前》；会话支持 photo order、phase 与 layout override，且不修改注册表。
- 六类确定性布局策略：散点、轨道、心形、破碎心、星系、螺旋；输入由模板 seed 与照片 ID 派生，不使用 `Math.random()`。
- 单一 R3F Canvas、现有 CameraControls、现有音乐播放器与统一 PlaybackClock；无第二 renderer、第二相机、第二数据库或商业音频资产。
- Preview → 播放 → 暂停/继续 → Seek → 完成 → Replay → Exit 状态链路；无本地音乐时自动使用静音 fallback clock。
- Hero 照片使用 preview LOD，其余照片使用 thumbnail LOD；可见数量服从现有 effective quality 预算，照片不足不会复制补齐。

## 自动化验证

以下命令在当前工作树全部通过：

| 检查 | 结果 |
| --- | --- |
| `pnpm run lint` | 通过 |
| `pnpm run typecheck` | 通过 |
| `pnpm run test` | 27 个测试文件，75 个测试通过 |
| `pnpm run build` | Production Build 通过，772 modules |
| `pnpm run test:e2e` | 5/5 通过：Flow A、Flow B、真实导入、Production Preview、模板播放 |

模板 E2E 还验证了：无外部请求、Preview 元信息、音乐选择入口、开始/暂停/继续、75% 随机 Seek、退出后恢复模板入口，并捕获 page error/console error。

## 数据与回滚边界

模板会话只存在 Zustand 运行时；照片、EXIF、衍生 Blob 和用户编辑仍走现有 IndexedDB 与 Backup ZIP 闭环。退出模板不会改写个人数据。若要回滚本次模板改动，保留基线提交 `7bf3b29`（Flow A 导航修复）及其之前的 `099360b` 初始化快照，撤销本报告所列新增文件和 Universe 接入即可。

## 已知边界

- 音乐服务不可用时仍可静音观看；远程歌单不是模板播放的自动化前置条件。
- 模板 UI 是一个克制的玻璃控制面，不替换现有 Archive、Settings、导入、Backup 或 Universe 信息架构。
- 未提交商业歌曲、封面、歌词、API Key 或远程图片。
