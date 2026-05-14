import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/workspace(.*)",
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

const clerkAuthMiddleware = clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});

export default hasClerkCredentials
  ? clerkAuthMiddleware
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
};
