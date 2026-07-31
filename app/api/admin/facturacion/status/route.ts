import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAfipClientDefault } from "@/lib/facturacion/afip-client";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { client } = await getAfipClientDefault();
    const status = await client.ElectronicBilling.getServerStatus();
    const ok = status.AppServer === "OK" && status.DbServer === "OK" && status.AuthServer === "OK";
    return NextResponse.json({
      appServer: status.AppServer,
      dbServer: status.DbServer,
      authServer: status.AuthServer,
      ok,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
