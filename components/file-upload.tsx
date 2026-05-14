"use client";

import { useRef, useState, useTransition } from "react";
import { ErrorDisplay } from "@/components/error-display";

type FileUploadProps = {
  onTextExtracted: (text: string, fileName: string) => void;
};

export function FileUpload({ onTextExtracted }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, startUploading] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [progress, setProgress] = useState("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");
    setProgress("");

    const allowedExtensions = [".docx", ".pdf", ".jpg", ".jpeg", ".png"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      setError("只支持 .docx、.pdf、.jpg、.png 格式文件。");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    const isImage = [".jpg", ".jpeg", ".png"].includes(fileExt);
    const isPdf = fileExt === ".pdf";

    if (isImage || isPdf) {
      setProgress("正在识别文字，这可能需要一些时间...");
    }

    startUploading(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload-parse", {
          method: "POST",
          body: formData
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "上传失败，请重试。");
        }

        const ocrNote = result.usedOcr ? "（通过 OCR 文字识别提取）" : "";
        setSuccess(`已从 ${result.fileName} 提取 ${result.charCount} 个字符${ocrNote}，内容已回填到下方编辑区。`);
        setProgress("");
        onTextExtracted(result.text, result.fileName);
      } catch (err) {
        setError(err instanceof Error ? err.message : "上传失败，请重试。");
        setProgress("");
      } finally {
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    });
  };

  return (
    <div className="rounded-[20px] border border-dashed border-sky-200 bg-sky-50/50 p-4">
      <div className="flex items-center gap-3">
        <label
          className={`inline-flex cursor-pointer items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {isUploading ? "正在解析..." : "上传文件"}
          <input
            ref={inputRef}
            type="file"
            accept=".docx,.pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </label>
        <span className="text-xs text-slate-500">
          支持 .docx、.pdf、.jpg、.png
        </span>
      </div>
      {progress ? <p className="mt-2 text-sm text-sky-600">{progress}</p> : null}
      {error ? <div className="mt-2"><ErrorDisplay error={error} compact /></div> : null}
      {success ? <p className="mt-2 text-sm text-emerald-600">{success}</p> : null}
    </div>
  );
}
