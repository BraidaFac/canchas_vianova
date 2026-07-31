import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { CobroOrigen, EstadoFiscal, PagoConComprobante } from "@/lib/facturacion/types";

function deriveEstadoFiscal(pagos: PagoConComprobante[]): EstadoFiscal {
  const transferencias = pagos.filter((p) => p.medio_pago === "transferencia");
  if (transferencias.length === 0) return "sin_comprobante";

  const todosFacturados = transferencias.every(
    (p) => p.comprobante?.estado === "emitida"
  );
  if (todosFacturados) return "facturado";

  const algunoFacturado = transferencias.some(
    (p) => p.comprobante?.estado === "emitida"
  );
  if (algunoFacturado) return "mixto";

  return "sin_comprobante";
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const perPage = parseInt(searchParams.get("per_page") ?? "20");
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");
  const origenTipo = searchParams.get("origen_tipo"); // "reserva" | "consumo" | null

  const supabase = await createSupabaseServerClient();

  // 1. Fetch all pagos with their comprobantes
  // TODO: replace with server-side grouping RPC when data grows past 5000 pagos
  let pagosQuery = supabase
    .from("pagos")
    .select(`
      *,
      cuenta_bancaria:cuentas_bancarias(id, nombre_display, entidad_fiscal_id),
      comprobante:comprobantes(id, cae, estado, importe)
    `)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (fromDate) pagosQuery = pagosQuery.gte("created_at", fromDate);
  if (toDate) pagosQuery = pagosQuery.lte("created_at", toDate + "T23:59:59Z");
  if (origenTipo) pagosQuery = pagosQuery.eq("origen_tipo", origenTipo);

  const { data: pagosRaw, error: pagosErr } = await pagosQuery;
  if (pagosErr) return NextResponse.json({ error: pagosErr.message }, { status: 500 });

  // 2. Group pagos by (origen_tipo, origen_id)
  const grouped = new Map<string, PagoConComprobante[]>();
  for (const pago of pagosRaw ?? []) {
    const key = `${pago.origen_tipo}:${pago.origen_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    // comprobante is an array from the join; take first match
    const comprobante = Array.isArray(pago.comprobante)
      ? (pago.comprobante[0] ?? null)
      : (pago.comprobante ?? null);
    grouped.get(key)!.push({ ...pago, comprobante });
  }

  // 3. Fetch origen details (reservas)
  const reservaIds = [...grouped.entries()]
    .filter(([key]) => key.startsWith("reserva:"))
    .map(([key]) => key.split(":")[1]);

  const reservaMap = new Map<string, { id: string; id_legible: string; fecha: string }>();
  if (reservaIds.length > 0) {
    const { data: reservas } = await supabase
      .from("reservas")
      .select("id, id_legible, fecha")
      .in("id", reservaIds);
    for (const r of reservas ?? []) reservaMap.set(r.id, r);
  }

  // 4. Build CobroOrigen array
  const cobros: CobroOrigen[] = [];
  for (const [key, pagos] of grouped) {
    const [tipo, origenId] = key.split(":") as ["reserva" | "consumo", string];
    const total = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
    const estado_fiscal = deriveEstadoFiscal(pagos);

    let descripcion = tipo === "consumo" ? "Consumo" : `Reserva sin datos`;
    let fecha = pagos[0].created_at;

    if (tipo === "reserva") {
      const r = reservaMap.get(origenId);
      if (r) {
        descripcion = `Reserva #${r.id_legible}`;
        fecha = r.fecha;
      }
    }

    cobros.push({ id: origenId, tipo, descripcion, fecha, total, estado_fiscal, pagos });
  }

  // 5. Sort by fecha desc and paginate
  cobros.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = cobros.length;
  const paginated = cobros.slice((page - 1) * perPage, page * perPage);

  return NextResponse.json({ data: paginated, total, page, per_page: perPage });
}
