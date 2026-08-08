// 轻量草稿暂存工具（localStorage）：防止生成结果/编辑内容刷新后丢失。
// 仅用于 client 组件，键按页面 + 项目维度隔离。

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadDraft<T>(key: string): T | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, value: T) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 不可用时静默降级，不影响主流程
  }
}

export function clearDraft(key: string) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // 忽略
  }
}
