"use client";

import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-light.css";
import { Check, Copy } from "lucide-react";
import { cn, sanitizeUrl } from "@/lib/utils";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

type MarkdownInlineProps = {
  content: string;
  className?: string;
};

const baseContentClasses =
  "prose prose-base max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-p:leading-[1.55] prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-transparent prose-pre:border-0 prose-pre:my-3 prose-pre:p-0 prose-ul:list-disc prose-ol:list-decimal prose-li:text-foreground prose-blockquote:border-l-primary/40 prose-blockquote:bg-primary/10 prose-blockquote:py-1 prose-blockquote:italic dark:prose-invert dark:text-slate-100 dark:prose-strong:text-white dark:prose-code:bg-slate-800/80 dark:prose-code:text-slate-100 dark:prose-pre:bg-transparent";

const sharedRemarkPlugins = [remarkGfm];
const sharedRehypePlugins = [rehypeHighlight];

const CodeBlock: Components["code"] = ({ inline, className, children, ...props }: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    setCanCopy(typeof navigator !== "undefined" && Boolean(navigator.clipboard));
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!preRef.current || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(preRef.current.innerText);
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Unable to copy code block", error);
    }
  }, []);

  if (inline) {
    return (
      <code {...props} className={className}>
        {children}
      </code>
    );
  }

  const language =
    className
      ?.split(" ")
      .find((token) => token.startsWith("language-"))
      ?.replace("language-", "") ?? "";
  const languageLabel = language || null;

  return (
    <div className="group/code relative my-2">
      <pre
        ref={preRef}
        className={cn("code-surface", className)}
      >
        <code {...props} className={cn(className, "bg-transparent text-inherit dark:bg-transparent dark:text-inherit")}>
          {children}
        </code>
      </pre>
      <div className="pointer-events-none absolute inset-0 rounded-xl border border-border/60 shadow-sm transition-opacity group-hover/code:opacity-100 dark:border-slate-700/60" />
      <div className="absolute right-3 top-3 flex items-center gap-2">
        {languageLabel ? (
          <span className="chip-language">
            {languageLabel.replace(/[-_]/g, " ")}
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleCopy}
          disabled={!canCopy}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card/90 px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-white/15 dark:hover:text-white dark:focus-visible:ring-offset-slate-950"
          aria-label={copied ? "Code copied to clipboard" : "Copy code to clipboard"}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
};

const blockLevelTags = new Set([
  "div",
  "pre",
  "table",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

// Helper function to check if children contain block-level elements
const hasBlockLevelChild = (children: ReactNode): boolean => {
  if (!children) {
    return false;
  }

  const items = Array.isArray(children) ? children : [children];

  for (const child of items) {
    if (child == null || typeof child === "boolean") {
      continue;
    }

    if (Array.isArray(child)) {
      if (hasBlockLevelChild(child)) {
        return true;
      }
      continue;
    }

    if (isValidElement(child)) {
      if (
        child.type === CodeBlock ||
        (typeof child.type === "string" && blockLevelTags.has(child.type))
      ) {
        return true;
      }

      const { children: nestedChildren, className } = child.props as {
        children?: ReactNode;
        className?: string;
      };

      if (typeof className === "string" && className.includes("group/code")) {
        return true;
      }

      if (nestedChildren && hasBlockLevelChild(nestedChildren)) {
        return true;
      }
    }
  }

  return false;
};

const sharedComponents: Partial<Components> = {
  a: ({ href, ...props }: { href?: string | null } & ComponentPropsWithoutRef<"a">) => (
    // open links in a new tab and use safe rel; sanitize href
    <a href={href ? sanitizeUrl(String(href)) : href ?? undefined} {...props} target="_blank" rel="noopener noreferrer" />
  ),
  code: CodeBlock,
  p: ({ children, ...props }) => {
    // If paragraph contains block-level elements (like our CodeBlock div),
    // render as Fragment to avoid invalid HTML nesting
    if (hasBlockLevelChild(children)) {
      return <Fragment>{children}</Fragment>;
    }
    return <p {...props}>{children}</p>;
  },
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const combinedClassName = className ? `${baseContentClasses} ${className}` : baseContentClasses;

  return (
    <div className={combinedClassName}>
      <ReactMarkdown
        remarkPlugins={sharedRemarkPlugins}
        rehypePlugins={sharedRehypePlugins}
        components={sharedComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const inlineBaseClasses =
  "prose prose-sm max-w-none text-foreground prose-p:my-0 prose-p:text-inherit prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded dark:prose-invert dark:text-slate-100 dark:prose-strong:text-white dark:prose-code:bg-slate-800/80 dark:prose-code:text-slate-100";

export function MarkdownInline({ content, className }: MarkdownInlineProps) {
  if (!content) return null;

  const combinedClassName = className ? `${inlineBaseClasses} ${className}` : inlineBaseClasses;

  return (
    <div className={combinedClassName}>
      <ReactMarkdown
        remarkPlugins={sharedRemarkPlugins}
        rehypePlugins={sharedRehypePlugins}
        components={{
          ...sharedComponents,
          p: ({ children, ...props }) => (
            <p {...props} className="my-0">
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
