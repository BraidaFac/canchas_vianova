import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza un número de teléfono argentino a E.164 sin '+'.
 * Ejemplos:
 *   "011 5555-0002"   → "5491155550002"
 *   "9 11 5555-0002"  → "5491155550002"
 *   "+5491155550002"  → "5491155550002"
 *   "1155550002"      → "5491155550002"
 */
export function normalizePhone(raw: string): string {
  // Solo dígitos
  const digits = raw.replace(/\D/g, "")

  // Ya tiene código de país Argentina (54...)
  if (digits.startsWith("54") && digits.length >= 12) return digits

  // Empieza con 0 (formato local: 011...) → sacar el 0
  const withoutLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits

  // 11 dígitos que empiezan con 9 (ej: 91155550002) → agregar 54
  if (withoutLeadingZero.length === 11 && withoutLeadingZero.startsWith("9")) {
    return "54" + withoutLeadingZero
  }

  // 10 dígitos (ej: 1155550002) → agregar 549
  if (withoutLeadingZero.length === 10) {
    return "549" + withoutLeadingZero
  }

  // Cualquier otro caso: devolver solo dígitos sin procesar
  return digits
}
