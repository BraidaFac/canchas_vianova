"use client";

import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DatePickerProps = {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string; // YYYY-MM-DD
  className?: string;
  isToday?: boolean;
  /** When true, shows day name format ("Jue 12 de Jun"). Default: dd/MM/yyyy */
  showDayName?: boolean;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled,
  minDate,
  className,
  isToday,
  showDayName,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
  const fromDate = minDate && isValid(parseISO(minDate)) ? parseISO(minDate) : undefined;

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-start gap-2 text-sm font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon size={14} className="shrink-0" />
          {selected ? (
            showDayName ? (
              <span className="flex items-center gap-1.5">
                {isToday && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">
                    HOY
                  </span>
                )}
                <span className="capitalize">
                  {format(selected, "EEE d 'de' MMM", { locale: es })}
                </span>
              </span>
            ) : (
              format(selected, "dd/MM/yyyy")
            )
          ) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected ?? fromDate}
          fromDate={fromDate}
          locale={es}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
