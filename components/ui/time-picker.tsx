"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type TimePickerProps = {
  value: string; // "HH:00"
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

export function TimePicker({
  value,
  onChange,
  placeholder = "Seleccionar hora",
  disabled,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selHour = value ? value.slice(0, 2) : "";

  function selectHour(h: string) {
    onChange(`${h}:00`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start gap-2 text-sm font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock size={14} className="shrink-0" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1.5" align="start" side="bottom">
        <div className="grid grid-cols-4 gap-0.5 max-h-56 overflow-y-auto">
          {HOURS.map((h) => (
            <button
              key={h}
              onClick={() => selectHour(h)}
              className={cn(
                "rounded py-1.5 text-sm font-mono text-center transition-colors",
                h === selHour
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              )}
            >
              {h}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
