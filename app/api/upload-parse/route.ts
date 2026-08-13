import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_TYPE = "application/pdf";
const ALLOWED_TYPES = [DOCX_TYPE, PDF_TYPE, "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = [".docx", ".pdf", ".jpg", ".jpeg", ".png"];
const OCR_TIMEOUT_MS = 120_000;

// 扫描型 PDF 的 OCR 页数上限（超出提示用户拆分上传，避免函数超时）
const MAX_SCAN_OCR_PAGES = 8;

/**
 * 解析 tesseract 语言包目录。
 * - 本地开发：public/tesseract-data 直接可读
 * - Vercel/Lambda：通过 outputFileTracingIncludes 将语言包打进函数包，
 *   目录可能随部署结构变化，这里按优先级探测多个候选路径。
 */
function resolveLangPath(): string {
  const candidates = [
    path.join(process.cwd(), "public", "tesseract-data"),
    path.join(process.cwd(), "public", "tesseract-data", "4.0.0"),
    path.join(process.cwd(), ".next", "server", "app", "api", "upload-parse", "public", "tesseract-data")
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // 路径探测失败继续尝试下一个
    }
  }

  return candidates[0];
}

const LANG_PATH = resolveLangPath();

// Vercel 函数最大执行时长（Hobby 上限 300s，OCR 需要宽松上限）
export const maxDuration = 300;

/**
 * [预留扩展点] 云 OCR 服务接入位（本期不启用）。
 * tesseract.js 对低清图片 / 复杂版式识别精度有限，后续可在此接入
 * 腾讯云 OCR / 阿里云 OCR 等云端识别服务作为高精度兜底：
 *
 * 1. 在 lib/ 下新增 cloud-ocr.ts，封装对应 SDK（如 tencentcloud-sdk-nodejs-ocr）；
 * 2. 在 ocrBuffer / ocrPdfPages 失败或置信度低时调用；
 * 3. 通过环境变量注入 SecretId / SecretKey（勿硬编码）。
 *
 * 接入后按置信度对比：云端返回置信度更高时优先采用云端结果。
 */
// async function ocrWithCloudService(imageBuffer: Buffer): Promise<string | null> {
//   // TODO: 接入云 OCR，返回识别文本；失败返回 null 交给本地 tesseract 兜底
//   return null;
// }


function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} 超时（超过 ${Math.round(ms / 1000)} 秒）`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

async function extractPdfTextDirect(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // 注意：不要手动设置 GlobalWorkerOptions.workerSrc。
  // pdfjs v5 在 Node 端会自动使用内置 fake worker，不依赖外部 worker 文件；
  // 手动指向 node_modules 绝对路径会导致 Vercel/Lambda 打包时找不到该文件而报错。

  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array, useSystemFonts: true }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ");

    if (pageText.trim()) {
      pageTexts.push(pageText.trim());
    }
  }

  return pageTexts.join("\n\n");
}

async function createOcrWorker() {
  const Tesseract = await import("tesseract.js");

  try {
    const worker = await Tesseract.createWorker("chi_sim", undefined, {
      langPath: LANG_PATH,
      cacheMethod: "none"
    });
    return worker;
  } catch {
    const worker = await Tesseract.createWorker("eng", undefined, {
      langPath: LANG_PATH,
      cacheMethod: "none"
    });
    return worker;
  }
}

async function ocrBuffer(buffer: Buffer): Promise<string> {
  const worker = await createOcrWorker();
  try {
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

async function ocrPdfPages(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");

  // 同 extractPdfTextDirect：不手动设置 workerSrc，依赖 pdfjs v5 内置 fake worker。

  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array, useSystemFonts: true }).promise;
  const pageTexts: string[] = [];

  const worker = await createOcrWorker();

  try {
    const pagesToOcr = Math.min(doc.numPages, MAX_SCAN_OCR_PAGES);

    for (let i = 1; i <= pagesToOcr; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const canvasContext = canvas.getContext("2d");

      await page.render({
        canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
        canvas: null as unknown as HTMLCanvasElement,
        viewport
      }).promise;

      const imageBuffer = canvas.toBuffer("image/png");
      const { data } = await worker.recognize(imageBuffer);

      if (data.text.trim()) {
        pageTexts.push(data.text.trim());
      }
    }
  } finally {
    await worker.terminate();
  }

  const result = pageTexts.join("\n\n");

  // 页数超上限时，OCR 只处理前 MAX_SCAN_OCR_PAGES 页，提示用户后续页未识别
  if (doc.numPages > MAX_SCAN_OCR_PAGES) {
    return `${result}\n\n[提示] 该扫描 PDF 共 ${doc.numPages} 页，为避免处理超时仅识别了前 ${MAX_SCAN_OCR_PAGES} 页，请手动补充剩余内容。`;
  }

  return result;
}

export async function POST(request: NextRequest) {
  // 开发模式（未配置 Clerk）：以开发用户身份放行；配置了 Clerk 则校验登录
  const { hasClerkCredentials } = await import("@/lib/clerk-env");
  let userId: string | null = null;

  if (hasClerkCredentials) {
    const { auth: clerkAuth } = await import("@clerk/nextjs/server");
    userId = clerkAuth().userId ?? null;
  } else {
    userId = "dev-user";
  }

  if (!userId) {
    return NextResponse.json({ error: "未登录，无法上传文件。" }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "无法解析上传请求，请重试。" }, { status: 400 });
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "未找到上传文件。" }, { status: 400 });
  }

  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: "只支持 .docx、.pdf、.jpg、.png 格式文件。" },
      { status: 400 }
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "文件大小不能超过 10MB。" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let text = "";
    let usedOcr = false;

    if (file.type === DOCX_TYPE || ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (file.type === PDF_TYPE || ext === ".pdf") {
      try {
        text = await extractPdfTextDirect(buffer);
      } catch (e) {
        console.error("PDF 直接提取失败，尝试 OCR:", e instanceof Error ? e.message : e);
        text = "";
      }

      if (text.trim().length < 30) {
        try {
          text = await withTimeout(ocrPdfPages(buffer), OCR_TIMEOUT_MS, "PDF 文字识别");
          usedOcr = true;
        } catch (ocrError) {
          const msg = ocrError instanceof Error ? ocrError.message : "未知错误";
          console.error("PDF OCR 失败:", msg);
          return NextResponse.json(
            { error: `PDF 文字识别失败：${msg}。请尝试手动粘贴文本内容。` },
            { status: 400 }
          );
        }
      }
    } else if (file.type === "image/jpeg" || file.type === "image/png" || [".jpg", ".jpeg", ".png"].includes(ext)) {
      try {
        text = await withTimeout(ocrBuffer(buffer), OCR_TIMEOUT_MS, "图片文字识别");
        usedOcr = true;
      } catch (ocrError) {
        const msg = ocrError instanceof Error ? ocrError.message : "未知错误";
        console.error("图片 OCR 失败:", msg);
        return NextResponse.json(
          { error: `图片文字识别失败：${msg}。请手动粘贴文本内容。` },
          { status: 400 }
        );
      }
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "无法从文件中提取文本内容，请手动粘贴文本。" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      text: text.trim(),
      fileName: file.name,
      fileType: ext.replace(".", ""),
      charCount: text.trim().length,
      usedOcr
    });
  } catch (error) {
    console.error("文件解析失败:", error);
    return NextResponse.json(
      { error: "文件解析失败，请确认文件未损坏，或手动粘贴文本内容。" },
      { status: 500 }
    );
  }
}
