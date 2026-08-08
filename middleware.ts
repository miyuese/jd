import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/workspace(.*)",
  "/memory(.*)",
  "/resume-materials(.*)",
  "/project-materials(.*)",
  "/project-card(.*)",
  "/jd-analysis(.*)",
  "/resume-rewrite(.*)",
  "/interview-prep(.*)",
  "/history(.*)"
]);

const hasClerkCredentials = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

// 只有配置了 Clerk 凭据才创建鉴权中间件，避免本地无 key 时启动报错
const clerkAuthMiddleware = hasClerkCredentials
  ? clerkMiddleware((auth, req) => {
      if (isProtectedRoute(req)) {
        auth().protect();
      }
    })
  : undefined;

export default clerkAuthMiddleware ?? (() => NextResponse.next());

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
};
