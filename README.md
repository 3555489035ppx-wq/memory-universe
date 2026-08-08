# Memuniverse｜记忆宇宙

Memuniverse 是一个 Local First（本地优先）的中文 Web 产品：照片在当前浏览器内解析、生成衍生图并保存到 IndexedDB，用户可以沿着时间、人物、地点、情绪和关系重新进入一段记忆。

## 工程状态

v1.0.0 工程交付版本。核心导入、IndexedDB 持久化、记忆编辑、星座关系、备份导出/恢复、错误状态和生产预览已完成桌面端回归。

## 本地运行

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

默认开发端口为 `5173`，生产预览可用 `http://127.0.0.1:4173` 访问。

## 质量检查

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run test:e2e
pnpm run build
```

`pnpm run test:e2e` 会先构建并启动 Vite Production Preview，再运行桌面 Chromium 流程。

## 已验证的核心闭环

- Flow A：进入 Demo → 60 段记忆加载 → TIME/PEOPLE/PLACE/EMOTION 切换 → 时间折叠 → Focus/Dive/Echo → 多选记忆 → 创建并编辑星座 → 刷新恢复。
- Flow B：真实浏览器图片导入 → IndexedDB 保存 → Archive 编辑 → Backup 导出 → 清空个人数据 → 校验并恢复 → 刷新恢复编辑结果。
- 导入失败不会污染成功数据；JPEG/PNG/WebP/AVIF、EXIF 日期与方向、缩略图/预览图和本地 Blob 均有测试覆盖。

## 数据与隐私

Memuniverse 的记忆核心不依赖在线 API、远程图片、远程字体或 CDN。照片、EXIF/GPS（如浏览器可读）及衍生 Blob 默认只留在当前浏览器。音乐层可选连接本机运行的 Mineradio 兼容服务，以读取网易云音乐 / QQ 音乐账号和歌单；原始 Cookie 不进入记忆宇宙的浏览器存储。清除个人数据不可逆，建议定期从 Settings 导出 ZIP 备份。详见 [PRIVACY.md](PRIVACY.md)。

## 音乐层（可选）

启动 Mineradio 后，在 `/universe`、`/archive` 或 `/settings` 顶部打开“音乐层”，即可管理本地音频、网易云音乐和 QQ 音乐连接。默认服务地址为 `http://127.0.0.1:3000`，也可以在登录窗口的“连接设置”中修改。网易云音乐支持二维码登录；QQ 音乐在普通浏览器中使用 Cookie 导入，在具备 `window.desktopWindow` 桥接的桌面环境中可打开官方登录窗口。音乐服务不可用时，本地音频播放仍然可用。

## 静态部署

项目包含 `vercel.json` 的深层路由回退配置，可直接用于 Vercel 等静态托管。部署前请运行 `pnpm run build`，并用 `pnpm preview` 检查 `/universe`、`/memory/:id`、`/constellation/:id`、`/archive` 与 `/settings` 深层路由。

## 浏览器支持与限制

推荐最新 Chromium、Firefox 或 Safari。需要 IndexedDB、Canvas、Web Crypto、File API 和 WebP/AVIF 解码能力；不支持 WebGL 时仍可进入 Archive 管理本地数据。浏览器清理站点数据、隐私模式限制或存储压力可能导致本地数据丢失，备份是唯一可靠的跨设备迁移方式。

## 目录说明

- `src/data`：IndexedDB schema、迁移、Repository 与启动维护。
- `src/engine/import`：图片验证、EXIF、方向归一化、衍生图与导入队列。
- `src/engine/backup`：ZIP 导出、路径/大小策略、校验和、事务恢复。
- `src/engine/layout`、`src/scene`：确定性布局、持久 Canvas、LOD、纹理生命周期和性能档位。
- `e2e`：Production Preview 下的导入、探索、编辑、备份恢复和桌面端回归。
