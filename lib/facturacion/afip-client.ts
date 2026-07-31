import Afip from "@afipsdk/afip.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decrypt } from "./crypto";
import type { EntidadFiscalRaw } from "./types";

/**
 * Returns an Afip SDK client configured for the given entidad fiscal.
 * Throws with descriptive messages if anything is misconfigured.
 */
export async function getAfipClient(entidadFiscalId: string): Promise<{
  client: InstanceType<typeof Afip>;
  config: EntidadFiscalRaw;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: config, error } = await supabase
    .from("entidades_fiscales")
    .select("*")
    .eq("id", entidadFiscalId)
    .single();

  if (error || !config) throw new Error("Entidad fiscal no encontrada");
  if (!config.activo) throw new Error("Entidad fiscal inactiva");
  if (!config.cuit) throw new Error("CUIT no configurado");
  if (!config.punto_venta) throw new Error("Punto de venta no configurado");
  if (!config.afipsdk_token) throw new Error("Token AFIP SDK no configurado");
  if (!config.cert_encrypted || !config.key_encrypted)
    throw new Error("Certificados no configurados");

  const cert = decrypt(config.cert_encrypted);
  const key = decrypt(config.key_encrypted);

  const client = new Afip({
    CUIT: Number(config.cuit),
    access_token: config.afipsdk_token,
    production: config.modo === "produccion",
    cert,
    key,
  });

  return { client, config: config as EntidadFiscalRaw };
}

/**
 * Convenience: get the Afip client for the predeterminada entidad fiscal.
 * Used by the legacy procesar-cola route and retry routes that don't yet
 * have a pago_id to resolve the entidad from.
 */
export async function getAfipClientDefault(): Promise<{
  client: InstanceType<typeof Afip>;
  config: EntidadFiscalRaw;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entidades_fiscales")
    .select("id")
    .eq("predeterminada", true)
    .eq("activo", true)
    .single();

  if (error || !data) throw new Error("No hay entidad fiscal predeterminada activa");
  return getAfipClient(data.id);
}
