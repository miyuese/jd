import path from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest, NextResponse } from "next/server";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_TYPE = "application/pdf";
const ALLOWED_TYPES = [DOCX_TYPE, PDF_TYPE, "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = [".docx", ".pdf", ".jpg", ".jpeg", ".png"];
const OCR_TIMEOUT_MS = 120_000;

const LANG_PATH = path.join(process.cwd(), "public", "tesseract-data");

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

  const workerUrl = pathToFileURL(
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")
  ).href;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

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

  const workerUrl = pathToFileURL(
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")
  ).href;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array, useSystemFonts: true }).promise;
  const pageTexts: string[] = [];

  const worker = await createOcrWorker();

  try {
    for (let i = 1; i <= doc.numPages; i++) {
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

  return pageTexts.join("\n\n");
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
