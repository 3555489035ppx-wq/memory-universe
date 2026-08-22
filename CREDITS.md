# MEMENTO Credits

最后更新：2026-08-04

本文件记录已经进入 MEMENTO 构建产物的第三方依赖与 Demo 素材。候选项目只出现在 `OPEN_SOURCE_RESEARCH.md` 中时，不代表被复制或集成。

## 运行时依赖

依赖版本以 `package.json` 与 `pnpm-lock.yaml` 为准；这里只记录用途和常见许可证入口，升级后需要重新核验上游声明。

| 项目                                   | 用途                              | 许可证入口                                                                                |
| -------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| React / React DOM / React Router DOM   | UI、路由与懒加载                  | 各自 npm 包与上游仓库的 MIT 声明                                                          |
| Three.js                               | 3D 场景、材质与纹理               | [three.js LICENSE](https://github.com/mrdoob/three.js/blob/dev/LICENSE)                   |
| @react-three/fiber / @react-three/drei | React Three.js 渲染桥接与相机控制 | 各自仓库的 MIT 声明                                                                       |
| camera-controls                        | 相机控制                          | [camera-controls LICENSE](https://github.com/yomotsu/camera-controls/blob/master/LICENSE) |
| idb                                    | IndexedDB 类型化访问              | [idb LICENSE](https://github.com/jakearchibald/idb/blob/main/LICENSE)                     |
| fflate                                 | ZIP 导出与恢复                    | [fflate LICENSE](https://github.com/101arrowz/fflate/blob/master/LICENSE)                 |
| exifreader                             | EXIF/GPS 元数据读取               | [exifreader LICENSE](https://github.com/mattiasw/ExifReader/blob/master/LICENSE)          |
| pica / fast-average-color              | 浏览器端缩放与主色提取            | 各自仓库的 MIT 声明                                                                       |
| Zustand                                | 运行时状态                        | [Zustand LICENSE](https://github.com/pmndrs/zustand/blob/main/LICENSE)                    |
| class-variance-authority                 | GlassButton 尺寸与强度 variants    | [class-variance-authority LICENSE](https://github.com/joe-bell/cva/blob/main/packages/class-variance-authority/LICENSE) |

完整依赖清单和锁定版本请以 `package.json` 为准；项目没有复制这些依赖的源代码。

## Demo 照片

Demo 使用 96 张本地化的 CC0 图片。图片通过 Openverse 与 GitHub CC0 摄影素材人工筛选后下载、裁剪为 `micro` / `thumbnail` / `preview` 三档，并随静态构建发布；运行时不请求原始远程地址。

- 机器可读的逐图来源、作者、提供方、原始页面、许可证和下载日期：`public/demo/demo-asset-credits.json`
- 本地 Demo 数据：`public/demo/demo-memories.json`
- 人工核对图集：`docs/assets/demo-contact-sheet.jpg`
- 许可证：每条记录均标记为 CC0，并保留其原始页面和 Openverse ID，复核时以机器可读记录为准。

## 维护规则

1. 安装或升级依赖时记录准确版本、用途和许可证入口。
2. 复制或改写源码、Shader、算法或示例时记录上游文件、固定 commit、对应 MEMENTO 文件和修改说明。
3. 代码许可证不自动覆盖照片、字体、图标、模型、HDR、音频等资产；每类资产单独核验。
4. 任何素材替换都必须同步更新 `demo-asset-credits.json`，不得只更新展示图或文档。

## 2026-08-09 演示照片扩充

- 演示宇宙由 60 张扩充为 96 张本地化照片；新增的 36 张只用于演示数据，不会混入用户的个人记忆。
- 新增照片来自 [gianni-rosato/gb82-image-set](https://github.com/gianni-rosato/gb82-image-set) 的 `png` 摄影子集，其中 16 张是项目内对 CC0 源图做的镜像、色彩和构图变体。
- GB82 仓库声明全部图像采用 [CC0 1.0](https://github.com/gianni-rosato/gb82-image-set/blob/main/LICENSE)。项目排除了其中的屏幕内容和渲染图，只使用摄影内容。
- 每张照片的本地路径、GitHub 原始地址与许可证记录均保存在 `public/demo/demo-asset-credits.json`。
- 高中回忆 Demo 的默认音乐 `public/music/high-school/te-bie-de-ren-fang-datong.mp3` 是用户声明拥有分发权的自有音频，随 Demo 同源发布。
- `public/music/high-school/memento-ambience.wav` 是项目内按固定种子生成的本地音轨。

## Demo 音乐

- `public/music/high-school/` 内的音频由用户提供并声明为本人演唱、拥有发布权；Demo 只随站点发布这些本地文件，不保存账号、Cookie、歌词或第三方平台会话。
- 用户可以在“音乐层 → 系统音乐库”中直接选择播放，也可以上传自己的 MP3 / WAV。

## Memory Template System

模板布局使用 Three.js CSS3D Periodic Table 官方示例中“同一批对象、多组目标位姿、统一插值”的数学思路，并在 `src/memory/layouts` 中以 TypeScript 纯函数重写为 WebGL/R3F 运行时；没有复制 CSS3DRenderer、DOM 卡片、示例素材或示例 UI。研究来源、MIT 许可与不采用范围记录在 `MEMUNIVERSE_TEMPLATE_OPEN_SOURCE_NOTES.md`。

模板本身不携带未授权商业歌曲、封面、歌词或远程音频；公开 Demo 只使用项目内置、由用户提供并声明拥有发布权的本地音频，个人音乐也可以通过系统音乐库或浏览器上传使用。
