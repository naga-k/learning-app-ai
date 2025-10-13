"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { sanitizeUrl } from "@/lib/utils";

type MarkdownContentProps = {
  content: string;
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-base prose-slate max-w-none text-slate-100 prose-headings:text-slate-100 prose-p:text-slate-200 prose-p:leading-6 prose-strong:text-white prose-a:text-indigo-300 prose-a:no-underline hover:prose-a:underline prose-code:text-indigo-200 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 prose-ul:list-disc prose-ol:list-decimal prose-li:text-slate-200 prose-blockquote:border-l-indigo-400 prose-blockquote:bg-indigo-500/10 prose-blockquote:py-1 prose-blockquote:italic">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, ...props }) => (
            // open links in a new tab and use safe rel; sanitize href
            <a href={href ? sanitizeUrl(String(href)) : href} {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
