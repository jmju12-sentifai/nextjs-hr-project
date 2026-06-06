import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ active: false, reason: "unauthenticated" });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status, expires_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ active: false, error: error.message });
  }

  const active =
    !!data &&
    (!data.expires_at || new Date(data.expires_at).getTime() > Date.now());

  return NextResponse.json({ active });
}
