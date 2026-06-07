import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 👇 routes لي ما تحتاج auth
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/complete-payment",
  "/api/webhook(.*)",
]);

export default clerkMiddleware((auth, req) => {
  // 👇 حماية كل شيء ما عدا public routes
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // مهم جداً: يشمل API routes
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};