"use client";

import { cn, sanitizeUrl } from "@/lib/utils";
import { type ComponentProps, memo, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      // Ensure any anchor elements inside the rendered markdown/openai output
      // open in a new tab and have a safe rel attribute.
      const anchors = el.querySelectorAll<HTMLAnchorElement>("a");
      anchors.forEach((a) => {
        a.setAttribute("target", "_blank");
        // sanitize href to remove utm_source and similar tracking params
        const href = a.getAttribute("href");
        if (href) {
          a.setAttribute("href", sanitizeUrl(href));
        }
        // preserve existing rel values while ensuring noopener noreferrer
        const rel = new Set((a.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
        rel.add("noopener");
        rel.add("noreferrer");
        a.setAttribute("rel", Array.from(rel).join(" "));
      });
    }, [props.children]);

    return (
      <div ref={ref}>
        <Streamdown
          className={cn(
            "size-full leading-6 [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_a]:font-medium [&_a]:text-sky-300 [&_a]:underline [&_a:hover]:text-sky-200",
            className
          )}
          {...props}
        />
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
