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

完整依赖清单和锁定版本请以 `package.json` 为准；项目没有复制这些依赖的源代码。

## Demo 照片

Demo 使用 60 张本地化的 CC0 图片。图片通过 Openverse 索引人工筛选后下载、裁剪为 `micro` / `thumbnail` / `preview` 三档，并随静态构建发布；运行时不请求原始远程地址。

- 机器可读的逐图来源、作者、提供方、原始页面、许可证和下载日期：`public/demo/demo-asset-credits.json`
- 本地 Demo 数据：`public/demo/demo-memories.json`
- 人工核对图集：`docs/assets/demo-contact-sheet.jpg`
- 许可证：每条记录均标记为 CC0，并保留其原始页面和 Openverse ID，复核时以机器可读记录为准。

## 维护规则

1. 安装或升级依赖时记录准确版本、用途和许可证入口。
2. 复制或改写源码、Shader、算法或示例时记录上游文件、固定 commit、对应 MEMENTO 文件和修改说明。
3. 代码许可证不自动覆盖照片、字体、图标、模型、HDR、音频等资产；每类资产单独核验。
4. 任何素材替换都必须同步更新 `demo-asset-credits.json`，不得只更新展示图或文档。
