"use client";

import React from "react";
import { sanitizeUrl } from "@/lib/utils";

type LinkifyProps = {
  text: string;
  className?: string;
};

// Very small linkifier: turns http(s)://... substrings into anchors.
// Keeps other text intact and uses sanitizeUrl on the href before inserting.
export function Linkify({ text, className }: LinkifyProps) {
  if (!text) return <span />;

  // Regex to find URLs (http/https)
  const urlRegex = /(https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+)/g;

  const parts = text.split(urlRegex);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (urlRegex.test(part)) {
          // reset lastIndex in case of global regex reuse
          // create sanitized href
          const href = sanitizeUrl(part);
          return (
            <a key={idx} href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline hover:text-indigo-200">
              {part}
            </a>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
}
