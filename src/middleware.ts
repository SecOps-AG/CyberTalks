import { NextResponse, type NextRequest } from "next/server";
import { topicRedirectPath } from "@/lib/topic-merges";
import { wwwRedirectTarget } from "@/lib/www-redirect";

export function middleware(request: NextRequest) {
  const target = wwwRedirectTarget(
    request.headers.get("host"),
    request.nextUrl.pathname,
    request.nextUrl.search,
  );
  if (target) return NextResponse.redirect(target, 301);

  // A merged-away topic spelling answers with a permanent redirect to its canonical topic.
  const topic = topicRedirectPath(request.nextUrl.pathname, request.nextUrl.search);
  if (topic) return NextResponse.redirect(new URL(topic, request.url), 301);

  return NextResponse.next();
}

export const config = {
  // Static build output is served by the asset layer and never reaches the Worker.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
