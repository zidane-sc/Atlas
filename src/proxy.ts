import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isAuthed = Boolean(req.auth);
  const isAuthRoute = req.nextUrl.pathname.startsWith("/auth");

  if (!isAuthed && !isAuthRoute) {
    return NextResponse.redirect(new URL("/auth", req.nextUrl));
  }

  if (isAuthed && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sounds).*)"],
};
