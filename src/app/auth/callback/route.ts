import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const cookieStore = await cookies();
  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(items) { items.forEach(({name,value,options}) => cookieStore.set(name,value,options)); }
      }
    });
    const {error} = await supabase.auth.exchangeCodeForSession(code);
    if (!error) { const invite = searchParams.get("invite"); return NextResponse.redirect(`${origin}/${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`); }
  }
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
