import { NextResponse, type NextRequest } from "next/server";
import { wwwRedirectTarget } from "@/lib/www-redirect";

export function middleware(request: NextRequest) {
  const target = wwwRedirectTarget(
    request.headers.get("host"),
    request.nextUrl.pathname,
    request.nextUrl.search,
  );
  if (target) return NextResponse.redirect(target, 301);
  return NextResponse.next();
}

export const config = {
  // Static build output is served by the asset layer and never reaches the Worker.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
