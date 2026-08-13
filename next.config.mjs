/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "tesseract.js"],
    // 把 tesseract 语言包显式打进 /api/upload-parse 的函数部署包，
    // 否则 Vercel 打包时 public/ 静态资源与函数运行时目录分离，OCR 会找不到语言包。
    // 注意：Next 14.2 中该字段在 experimental 内生效（collect-build-traces 从 config.experimental 读取）。
    outputFileTracingIncludes: {
      "/api/upload-parse": ["./public/tesseract-data/**"]
    }
  }
};

export default nextConfig;
