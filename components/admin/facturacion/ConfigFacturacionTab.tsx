"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { EntidadFiscal, CuentaBancaria, IvaAlicuota, ConfigModulos } from "@/lib/facturacion/types";

// ─── Entidades Fiscales ────────────────────────────────────────────────────────

type EntidadForm = {
  nombre_interno: string;
  cuit: string;
  razon_social: string;
  domicilio: string;
  condicion_iva: string;
  punto_venta: string;
  afipsdk_token: string;
  modo: string;
  activo: boolean;
  predeterminada: boolean;
  cert_pem: string;
  key_pem: string;
};

function emptyEntidadForm(): EntidadForm {
  return {
    nombre_interno: "",
    cuit: "",
    razon_social: "",
    domicilio: "",
    condicion_iva: "monotributo",
    punto_venta: "",
    afipsdk_token: "",
    modo: "testing",
    activo: true,
    predeterminada: false,
    cert_pem: "",
    key_pem: "",
  };
}

function EntidadesFiscalesTab() {
  const [entidades, setEntidades] = useState<EntidadFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EntidadFiscal | null>(null);
  const [form, setForm] = useState<EntidadForm>(emptyEntidadForm());
  const [saving, setSaving] = useState(false);

  async function fetchEntidades() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/entidades-fiscales");
      const json = await res.json();
      setEntidades(Array.isArray(json) ? json : []);
    } catch {
      toast.error("Error al cargar entidades fiscales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEntidades(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyEntidadForm());
    setDialogOpen(true);
  }

  function openEdit(e: EntidadFiscal) {
    setEditing(e);
    setForm({
      nombre_interno: e.nombre_interno,
      cuit: e.cuit ?? "",
      razon_social: e.razon_social ?? "",
      domicilio: e.domicilio ?? "",
      condicion_iva: e.condicion_iva ?? "monotributo",
      punto_venta: e.punto_venta ? String(e.punto_venta) : "",
      afipsdk_token: e.afipsdk_token ?? "",
      modo: e.modo,
      activo: e.activo,
      predeterminada: e.predeterminada,
      cert_pem: "",
      key_pem: "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nombre_interno.trim()) { toast.error("Nombre interno requerido"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        nombre_interno: form.nombre_interno.trim(),
        cuit: form.cuit.trim() || null,
        razon_social: form.razon_social.trim() || null,
        domicilio: form.domicilio.trim() || null,
        condicion_iva: form.condicion_iva || null,
        punto_venta: form.punto_venta ? Number(form.punto_venta) : null,
        afipsdk_token: form.afipsdk_token.trim() || null,
        modo: form.modo,
        activo: form.activo,
        predeterminada: form.predeterminada,
      };
      if (form.cert_pem.trim()) body.cert_pem = form.cert_pem.trim();
      if (form.key_pem.trim()) body.key_pem = form.key_pem.trim();

      const res = editing
        ? await fetch(`/api/admin/entidades-fiscales/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/entidades-fiscales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (res.ok) {
        toast.success(editing ? "Entidad actualizada" : "Entidad creada");
        setDialogOpen(false);
        fetchEntidades();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error((json as { error?: string }).error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta entidad fiscal?")) return;
    const res = await fetch(`/api/admin/entidades-fiscales/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Entidad eliminada");
      fetchEntidades();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error((json as { error?: string }).error ?? "Error al eliminar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cada entidad representa un CUIT / punto de venta AFIP.
        </p>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
          <Plus size={13} /> Nueva entidad
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Cargando...</p>
        ) : entidades.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin entidades configuradas.</p>
        ) : (
          <div className="divide-y divide-border">
            {entidades.map((e) => (
              <div key={e.id} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{e.nombre_interno}</span>
                    {e.predeterminada && (
                      <Badge className="text-[10px] px-1.5 py-0">Principal</Badge>
                    )}
                    {!e.activo && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactiva</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono capitalize">
                      {e.modo}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.cuit ? `CUIT: ${e.cuit}` : "Sin CUIT"}
                    {e.punto_venta ? ` · PV: ${e.punto_venta}` : ""}
                    {e.tiene_cert ? " · Cert ✓" : " · Sin cert"}
                    {e.tiene_key ? " · Key ✓" : " · Sin key"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}>
                    <Pencil size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(e.id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar entidad fiscal" : "Nueva entidad fiscal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Nombre interno">
              <Input value={form.nombre_interno} onChange={e => setForm(f => ({ ...f, nombre_interno: e.target.value }))} className="h-9 text-sm" placeholder="Principal" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CUIT">
                <Input value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} className="h-9 text-sm font-mono" placeholder="20123456789" />
              </Field>
              <Field label="Punto de venta">
                <Input type="number" min={1} value={form.punto_venta} onChange={e => setForm(f => ({ ...f, punto_venta: e.target.value }))} className="h-9 text-sm" placeholder="1" />
              </Field>
            </div>
            <Field label="Razón social">
              <Input value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} className="h-9 text-sm" />
            </Field>
            <Field label="Domicilio">
              <Input value={form.domicilio} onChange={e => setForm(f => ({ ...f, domicilio: e.target.value }))} className="h-9 text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Condición IVA">
                <Select value={form.condicion_iva} onValueChange={v => setForm(f => ({ ...f, condicion_iva: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monotributo">Monotributo</SelectItem>
                    <SelectItem value="responsable_inscripto">Resp. Inscripto</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Modo AFIP">
                <Select value={form.modo} onValueChange={v => setForm(f => ({ ...f, modo: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="testing">Testing (sandbox)</SelectItem>
                    <SelectItem value="produccion">Producción</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Token AFIP SDK">
              <Input value={form.afipsdk_token} onChange={e => setForm(f => ({ ...f, afipsdk_token: e.target.value }))} className="h-9 text-sm font-mono" placeholder="sk_..." />
            </Field>
            <Field label={`Certificado (.pem)${editing?.tiene_cert ? " — dejar vacío para mantener el actual" : ""}`}>
              <textarea
                value={form.cert_pem}
                onChange={e => setForm(f => ({ ...f, cert_pem: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="-----BEGIN CERTIFICATE-----..."
              />
            </Field>
            <Field label={`Clave privada (.key)${editing?.tiene_key ? " — dejar vacío para mantener la actual" : ""}`}>
              <textarea
                value={form.key_pem}
                onChange={e => setForm(f => ({ ...f, key_pem: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="-----BEGIN RSA PRIVATE KEY-----..."
              />
            </Field>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="h-4 w-4 accent-primary" />
                Activa
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.predeterminada} onChange={e => setForm(f => ({ ...f, predeterminada: e.target.checked }))} className="h-4 w-4 accent-primary" />
                Predeterminada
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear entidad"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Cuentas Bancarias ────────────────────────────────────────────────────────

type CuentaForm = {
  nombre_display: string;
  banco: string;
  cbu: string;
  alias: string;
  entidad_fiscal_id: string;
  activo: boolean;
};

function CuentasBancariasTab({ entidades }: { entidades: EntidadFiscal[] }) {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CuentaBancaria | null>(null);
  const [form, setForm] = useState<CuentaForm>({
    nombre_display: "", banco: "", cbu: "", alias: "",
    entidad_fiscal_id: entidades[0]?.id ?? "", activo: true,
  });
  const [saving, setSaving] = useState(false);

  async function fetchCuentas() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cuentas-bancarias");
      const json = await res.json();
      setCuentas(Array.isArray(json) ? json : []);
    } catch {
      toast.error("Error al cargar cuentas bancarias");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCuentas(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ nombre_display: "", banco: "", cbu: "", alias: "", entidad_fiscal_id: entidades[0]?.id ?? "", activo: true });
    setDialogOpen(true);
  }

  function openEdit(c: CuentaBancaria) {
    setEditing(c);
    setForm({ nombre_display: c.nombre_display, banco: c.banco ?? "", cbu: c.cbu ?? "", alias: c.alias ?? "", entidad_fiscal_id: c.entidad_fiscal_id, activo: c.activo });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nombre_display.trim()) { toast.error("Nombre requerido"); return; }
    if (!form.entidad_fiscal_id) { toast.error("Seleccioná una entidad fiscal"); return; }
    setSaving(true);
    try {
      const body = { nombre_display: form.nombre_display.trim(), banco: form.banco.trim() || null, cbu: form.cbu.trim() || null, alias: form.alias.trim() || null, entidad_fiscal_id: form.entidad_fiscal_id, activo: form.activo };
      const res = editing
        ? await fetch(`/api/admin/cuentas-bancarias/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/admin/cuentas-bancarias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success(editing ? "Cuenta actualizada" : "Cuenta creada");
        setDialogOpen(false);
        fetchCuentas();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error((json as { error?: string }).error ?? "Error al guardar");
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cuenta bancaria?")) return;
    const res = await fetch(`/api/admin/cuentas-bancarias/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Cuenta eliminada"); fetchCuentas(); }
    else { const json = await res.json().catch(() => ({})); toast.error((json as { error?: string }).error ?? "Error al eliminar"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Cuentas bancarias para recibir transferencias.</p>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
          <Plus size={13} /> Nueva cuenta
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Cargando...</p>
        ) : cuentas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin cuentas configuradas.</p>
        ) : (
          <div className="divide-y divide-border">
            {cuentas.map((c) => (
              <div key={c.id} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.nombre_display}</span>
                    {!c.activo && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactiva</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.banco ? `${c.banco} · ` : ""}{c.alias ? `Alias: ${c.alias}` : ""}{c.cbu ? ` · CBU: ${c.cbu}` : ""}
                    {c.entidad_fiscal && ` · ${c.entidad_fiscal.nombre_interno}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar cuenta" : "Nueva cuenta bancaria"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Nombre display">
              <Input value={form.nombre_display} onChange={e => setForm(f => ({ ...f, nombre_display: e.target.value }))} className="h-9 text-sm" placeholder="Ej: Cuenta Principal Santander" />
            </Field>
            <Field label="Entidad fiscal">
              <Select value={form.entidad_fiscal_id} onValueChange={v => setForm(f => ({ ...f, entidad_fiscal_id: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccioná" /></SelectTrigger>
                <SelectContent>
                  {entidades.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_interno}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco"><Input value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} className="h-9 text-sm" placeholder="Santander" /></Field>
              <Field label="Alias"><Input value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} className="h-9 text-sm font-mono" placeholder="mi.alias.mp" /></Field>
            </div>
            <Field label="CBU">
              <Input value={form.cbu} onChange={e => setForm(f => ({ ...f, cbu: e.target.value }))} className="h-9 text-sm font-mono" placeholder="0720..." />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="h-4 w-4 accent-primary" />
              Activa
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cuenta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Alícuotas IVA ────────────────────────────────────────────────────────────

function AlicuotasIvaTab() {
  const [alicuotas, setAlicuotas] = useState<IvaAlicuota[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/config/iva-alicuotas")
      .then(r => r.json())
      .then(d => setAlicuotas(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Error al cargar alícuotas"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Alícuotas IVA disponibles para comprobantes.</p>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-4 text-sm text-muted-foreground text-center">Cargando...</p>
        ) : (
          <div className="divide-y divide-border">
            {alicuotas.map(a => (
              <div key={a.id} className="flex items-center h-10 px-4 gap-3">
                <span className="flex-1 text-sm font-medium">{a.nombre}</span>
                <span className="text-sm text-muted-foreground">{a.porcentaje}%</span>
                {a.predeterminada && <Badge className="text-[10px] px-1.5 py-0">Predeterminada</Badge>}
                {!a.activo && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactiva</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Módulos ──────────────────────────────────────────────────────────────────

function ModulosTab() {
  const [modulos, setModulos] = useState<ConfigModulos | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/config/modulos")
      .then(r => r.json())
      .then(d => setModulos(d as ConfigModulos))
      .catch(() => toast.error("Error al cargar módulos"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: "facturacion" | "pos" | "stock") {
    if (!modulos) return;
    setSaving(key);
    const newVal = !modulos[key];
    const res = await fetch("/api/admin/config/modulos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newVal }),
    });
    if (res.ok) {
      setModulos(prev => prev ? { ...prev, [key]: newVal } : prev);
      toast.success("Módulo actualizado");
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error((json as { error?: string }).error ?? "Error al actualizar");
    }
    setSaving(null);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!modulos) return null;

  const items: { key: "facturacion" | "pos" | "stock"; label: string; description: string }[] = [
    { key: "facturacion", label: "Facturación electrónica", description: "Habilita la emisión de comprobantes AFIP/ARCA y la sección Facturación en el menú." },
    { key: "pos", label: "POS", description: "Habilita el punto de venta y la sección POS en el menú." },
    { key: "stock", label: "Stock", description: "Habilita la gestión de inventario y la sección Stock en el menú." },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Activá o desactivá módulos del sistema.</p>
      <div className="space-y-3">
        {items.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <button
              disabled={saving === key}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${modulos[key] ? "bg-primary" : "bg-input"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${modulos[key] ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared helper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function ConfigFacturacionTab() {
  const [entidades, setEntidades] = useState<EntidadFiscal[]>([]);
  const [loadingEntidades, setLoadingEntidades] = useState(true);

  useEffect(() => {
    fetch("/api/admin/entidades-fiscales")
      .then(r => r.json())
      .then(d => setEntidades(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingEntidades(false));
  }, []);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="entidades">
        <TabsList className="w-max">
          <TabsTrigger value="entidades">Entidades fiscales</TabsTrigger>
          <TabsTrigger value="cuentas">Cuentas bancarias</TabsTrigger>
          <TabsTrigger value="alicuotas">Alícuotas IVA</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
        </TabsList>
        <TabsContent value="entidades" className="mt-4">
          <EntidadesFiscalesTab />
        </TabsContent>
        <TabsContent value="cuentas" className="mt-4">
          {loadingEntidades ? (
            <p className="text-sm text-muted-foreground">Cargando entidades...</p>
          ) : (
            <CuentasBancariasTab entidades={entidades} />
          )}
        </TabsContent>
        <TabsContent value="alicuotas" className="mt-4">
          <AlicuotasIvaTab />
        </TabsContent>
        <TabsContent value="modulos" className="mt-4">
          <ModulosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
