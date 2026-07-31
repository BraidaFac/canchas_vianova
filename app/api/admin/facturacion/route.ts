import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 20;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("comprobantes")
    .select(
      `*,
       reserva:reservas(id, id_legible, fecha),
       pago:pagos(
         id, medio_pago, monto,
         cuenta_bancaria:cuentas_bancarias(id, nombre_display, entidad_fiscal_id)
       )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (estado) query = query.eq("estado", estado);
  if (desde) query = query.gte("fecha_cbte", desde);
  if (hasta) query = query.lte("fecha_cbte", hasta);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}
