# PDF 解析与 OCR 文字识别 — 问题排查与解决记录

## 背景

阶段 11 需要实现文件上传解析功能，支持 `.docx`、`.pdf` 和图片（`.jpg`、`.png`）格式，提取文字内容后回填到材料编辑区。

## 问题 1：pdf-parse 库中文支持差

**现象：** 使用 `pdf-parse` v1.1.1 解析 PDF 时，中文内容提取失败或返回空字符串。

**排查：** `pdf-parse` 基于旧版 PDF.js，对 CID 字体、自定义编码的 PDF 支持不足。中文简历 PDF 多数使用非标准编码，导致解析失败。

**解决：** 替换为 `pdfjs-dist`（Mozilla 官方维护的 PDF.js Node.js 版本），使用 `legacy/build/pdf.mjs` 兼容 Node.js 环境。

## 问题 2：扫描版 PDF 无法提取文字

**现象：** 设计工具导出的简历 PDF，`pdfjs-dist` 提取到的内嵌文本为空。

**原因：** 这类 PDF 的文字被渲染为矢量路径而非文本字符，属于「图片型 PDF」。

**解决：** 采用 OCR 降级策略 —— 先尝试提取内嵌文本，不足 30 字符时降级为 OCR（渲染页面为图片 → Tesseract.js 识别）。

## 问题 3：webpack 打包破坏 pdfjs-dist worker 路径

**现象：** Next.js API Route 中调用 `pdfjs-dist` 的 `getDocument` 报错：
```
Setting up fake worker failed: "Cannot find module '.next/server/vendor-chunks/pdf.worker.mjs'"
```

**排查过程：**
1. 检查 `.next/server/vendor-chunks/` 目录，发现 `pdfjs-dist.js`（2.7MB）被 webpack 打包，但 `pdf.worker.mjs` 未被包含
2. `pdfjs-dist` 默认的 `GlobalWorkerOptions.workerSrc` 为 `./pdf.worker.mjs`，相对路径在打包后解析到错误位置
3. 设置绝对路径后又报 `Only URLs with a scheme in: file, data, and node are supported`，Windows 绝对路径 `C:\...` 被误解析为协议 `c:`

**根因：** Next.js 默认会把 server-side 的依赖用 webpack 打包，破坏了 `pdfjs-dist` 的 worker 文件查找机制。

**解决：**
1. 在 `next.config.mjs` 的 `experimental.serverComponentsExternalPackages` 中加入 `pdfjs-dist`，阻止 webpack 打包
2. 使用 `url.pathToFileURL()` 将 Windows 绝对路径转为 `file://` URL，设置到 `GlobalWorkerOptions.workerSrc`

```typescript
import { pathToFileURL } from "node:url";

const workerUrl = pathToFileURL(
  path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")
).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
```

## 问题 4：Tesseract.js OCR 超时（120 秒）

**现象：** 上传 JPG/PNG 图片后，OCR 一直卡住，最终超时。

**排查过程：**
1. 独立 Node.js 脚本测试 Tesseract.js，546ms 完成，说明库本身没问题
2. 检查 `tesseract.js` 是否被 webpack 打包 —— 发现 `.next/server/vendor-chunks/tesseract.js.js`（77KB）
3. 怀疑 webpack 打包后 Tesseract.js 的 Worker 线程行为异常

**根因：** 与 pdfjs-dist 相同，webpack 打包破坏了 Tesseract.js 的 worker 线程机制。

**解决：** 在 `serverComponentsExternalPackages` 中加入 `tesseract.js`。

## 问题 5：中文 OCR 语言数据加载失败

**现象：** `chi_sim+eng` 组合语言在 Windows + Node.js v24 上报错：
```
Error opening data file ./?.traineddata
```

**排查：** `chi_sim` 语言代码在 worker 消息传递中被编码损坏，变成乱码。

**解决：**
1. 预下载 `chi_sim.traineddata.gz` 和 `eng.traineddata.gz` 到 `public/tesseract-data/`，避免 CDN 下载
2. 使用 `chi_sim` 单独加载（不与 `eng` 组合），失败时降级到 `eng`

## 问题 6：@napi-rs/canvas 被 webpack 解析失败

**现象：** `@napi-rs/canvas` 的 `.node` 原生二进制文件被 webpack 当作 JS 解析：
```
Module parse failed: Unexpected character '�'
```

**解决：** 在 `serverComponentsExternalPackages` 中加入 `@napi-rs/canvas`。

## 最终方案总结

### next.config.mjs

```javascript
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "tesseract.js"]
  }
};
```

### 文件解析流程

| 文件类型 | 解析策略 |
|----------|----------|
| `.docx` | mammoth 直接提取 |
| `.pdf` | pdfjs-dist 提取内嵌文本 → 不足 30 字符降级 OCR |
| `.jpg` `.png` | Tesseract.js OCR 识别 |

### OCR 配置

- 语言数据预下载到 `public/tesseract-data/`，通过 `langPath` 指向本地
- 使用 `chi_sim` 单独加载，失败降级 `eng`
- 所有 OCR 操作加 120 秒超时保护

### 依赖清单

| 依赖 | 用途 |
|------|------|
| `pdfjs-dist` | PDF 文本提取 + 页面渲染为图片 |
| `@napi-rs/canvas` | Node.js canvas，PDF 页面渲染 |
| `tesseract.js` | OCR 文字识别 |
| `mammoth` | .docx 文本提取 |

## 关键教训

1. **Next.js 的 webpack 打包会破坏包含 Worker 线程或原生二进制的库** —— 必须用 `serverComponentsExternalPackages` 排除
2. **Windows 路径在 ESM 中需要 `file://` URL** —— 用 `url.pathToFileURL()` 转换
3. **Tesseract.js 的多语言组合在某些环境有编码 bug** —— 单独加载更稳定
4. **先在独立环境验证，再集成到框架中** —— 能快速区分是库本身的问题还是框架打包的问题
