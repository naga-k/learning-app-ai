"use client";

import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { sanitizeUrl } from "@/lib/utils";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

type MarkdownInlineProps = {
  content: string;
  className?: string;
};

const baseContentClasses =
  "prose prose-base prose-slate max-w-none text-slate-100 prose-headings:text-slate-100 prose-p:text-slate-200 prose-p:leading-6 prose-strong:text-white prose-a:text-indigo-300 prose-a:no-underline hover:prose-a:underline prose-code:text-indigo-200 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 prose-ul:list-disc prose-ol:list-decimal prose-li:text-slate-200 prose-blockquote:border-l-indigo-400 prose-blockquote:bg-indigo-500/10 prose-blockquote:py-1 prose-blockquote:italic";

const sharedRemarkPlugins = [remarkGfm];
const sharedRehypePlugins = [rehypeHighlight];

const sharedComponents: Partial<Components> = {
  a: ({ href, ...props }: { href?: string | null } & ComponentPropsWithoutRef<"a">) => (
    // open links in a new tab and use safe rel; sanitize href
    <a href={href ? sanitizeUrl(String(href)) : href ?? undefined} {...props} target="_blank" rel="noopener noreferrer" />
  ),
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
  "prose prose-sm prose-slate max-w-none text-slate-100 prose-p:my-0 prose-p:text-inherit prose-strong:text-white prose-a:text-indigo-300 prose-a:no-underline hover:prose-a:underline prose-code:text-indigo-200 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded";

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
