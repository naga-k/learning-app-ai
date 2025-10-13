import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Remove utm_source (and specifically utm_source=openai) from a URL while
 * preserving other query params and hash. Returns the original string if
 * parsing fails.
 */
export function sanitizeUrl(href: string) {
  try {
    const url = new URL(href);
    // Remove all utm_source params
    url.searchParams.delete('utm_source');
    // Also remove any utm_source value variants (defensive)
    // Return serialized URL
    return url.toString();
  } catch {
    // If it's a relative URL or invalid, attempt a conservative replace
    try {
      // remove ?utm_source=... or &utm_source=...
      return href.replace(/([?&])utm_source=[^&]+(&?)/g, (_m, prefix, tail) => {
        if (prefix === '?' && tail) return '?';
        return tail ? '&' : '';
      }).replace(/[?&]$/,'');
    } catch {
      return href;
    }
  }
}
