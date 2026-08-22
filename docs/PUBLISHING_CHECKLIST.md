# GitHub 与部署发布清单

## 发布前

- [ ] `pnpm install --frozen-lockfile` 可完成。
- [ ] `pnpm run lint` 通过。
- [ ] `pnpm run typecheck` 通过。
- [ ] `pnpm test` 通过。
- [ ] `pnpm run build` 通过。
- [ ] `/universe?source=demo&demo=high-school` 可直接体验。
- [ ] Demo 图片全部来自 `public/demo/`，不依赖外部图片 URL。
- [ ] `public/demo/demo-asset-credits.json` 与 `CREDITS.md` 同步。
- [ ] Demo 音轨是本地 WAV，不上传商业歌曲或账号会话。

## 安全检查

```powershell
rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!dist/**' --glob '!.playwright-cli/**' --glob '!.codex-artifacts/**' --glob '!qa-*.png' "(sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|AIza|access_token|refresh_token|cookie\s*=|password\s*=)" .
```

确认以下内容不进入仓库：

- `.env`、Token、API Key、Cookie、二维码登录会话。
- 个人照片、个人录屏、个人 IndexedDB 导出 ZIP。
- `.codex-*`、`.playwright-cli/`、`qa-*.png`、`artifacts/`、构建日志。

## GitHub 仓库建议

- 仓库名：`memory-universe`。
- Description：`AI-powered emotional memory experience platform combining AI, 3D and multimedia.`
- 默认分支：`main`。
- README 提供产品案例叙事、流程图、截图、Demo 地址和本地运行方式。
- Actions 仅执行安装、lint、typecheck、test、build，不读取账号凭据。

## Vercel 部署

1. 在 Vercel 导入 GitHub 仓库。
2. Framework 选择 Vite，Install Command 使用 `pnpm install --frozen-lockfile`，Build Command 使用 `pnpm run build`。
3. 保留仓库中的 `vercel.json`，保证 `/universe`、`/archive`、`/settings` 等深层路由回退到 `index.html`。
4. 不配置音乐账号 Cookie。公开 Demo 使用本地音轨；远程音乐连接器仍由使用者在自己电脑运行。
5. 发布后检查首页、Demo、档案、隐私页和刷新深层路由。

## Cloudflare Pages 部署

1. 连接同一 GitHub 仓库。
2. Build command：`pnpm run build`。
3. Output directory：`dist`。
4. 配置 SPA fallback，让未知路径返回 `index.html`。
5. 发布后检查 `/universe?source=demo&demo=high-school` 和静态 Demo 资源的 200 响应。

## GitHub Pages 自动 Demo

仓库包含 `.github/workflows/pages.yml`。推送到 `main` 后，Actions 会执行生产构建并发布 `dist`：

1. 确认仓库 Pages 的 Source 使用 GitHub Actions。
2. 等待 `Deploy Memory Universe Demo` 工作流完成。
3. 地址格式为 `https://<GitHub 用户名>.github.io/<仓库名>/`。
4. Demo 入口为 `/universe?source=demo&demo=high-school`。

工作流通过 `VITE_BASE_PATH` 注入仓库子路径，不会影响 Vercel 或 Cloudflare 根域名部署。

## 发布后验收

- [ ] 无登录即可打开 Demo。
- [ ] 96 张图片不依赖当前浏览器的 IndexedDB。
- [ ] 不支持 WebGL 的浏览器进入兼容浏览模式。
- [ ] 首次播放、暂停、结束、再看一遍均只需符合浏览器自动播放规则的一次用户操作。
- [ ] 个人导入数据不会出现在 Demo 路由。
- [ ] README 的 Demo 地址可访问。
