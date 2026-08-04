import { Loader2 } from "lucide-react";

export function TabLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm">Cargando...</span>
    </div>
  );
}
