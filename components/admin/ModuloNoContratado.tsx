import { Lock } from "lucide-react";

type Props = {
  modulo: string;
};

export default function ModuloNoContratado({ modulo }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted border border-border">
        <Lock size={28} className="text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Módulo no contratado</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          El módulo <span className="text-foreground font-medium">{modulo}</span> no está habilitado
          para este establecimiento. Contactá a soporte para más información.
        </p>
      </div>
    </div>
  );
}
