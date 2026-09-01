import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth.server";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activo } = await request.json();
  if (typeof activo !== "boolean") {
    return NextResponse.json(
      { error: "activo must be boolean" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("config_bot")
    .upsert({ id: 1, activo }, { onConflict: "id" });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activo });
}
