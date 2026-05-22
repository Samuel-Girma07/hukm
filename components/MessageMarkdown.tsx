/**
 * MessageMarkdown
 *
 * Sanitised markdown renderer used in the chat transcript. Handles three
 * cases that show up in real assistant output:
 *
 *   1. Plain Markdown — rendered with safe defaults via react-markdown.
 *   2. Pretty JSON wrapped in ```json``` fences — rendered as a labelled
 *      <pre> code block instead of leaking the fences as raw text.
 *   3. A WHOLE message that is a JSON object string (no fence) matching
 *      the AnalysisResult schema — defensively pretty-printed so legacy
 *      transcripts saved before the chat-prompt fix still display cleanly.
 *
 * Key safety invariant: react-markdown does NOT pass through inline HTML
 * (we never wire `rehype-raw`), so untrusted message content can't inject
 * scripts or arbitrary tags through this component.
 */

"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";

interface MessageMarkdownProps {
  content: string;
  /** Tailwind classes for the surrounding prose container. */
  className?: string;
}

/**
 * If the entire message body is a JSON object, attempt to pretty-print it
 * inside a ```json fence so the markdown renderer shows it as a code
 * block instead of escaping every character.
 */
function maybePrettyPrintJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return raw;
  try {
    const parsed = JSON.parse(trimmed);
    return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
  } catch {
    return raw;
  }
}

const components: Components = {
  // Render anchors as new-tab safe by default. Null target stays inline.
  a: ({ href, children, ...rest }) => (
    <a
      {...rest}
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className="underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300"
    >
      {children}
    </a>
  ),
  // Tighten the default code styling so JSON dumps don't blow out the
  // chat bubble width.
  code: ({ className, children, ...rest }) => {
    const isBlock = /language-/.test(className ?? "");
    if (!isBlock) {
      return (
        <code
          {...rest}
          className="rounded bg-gray-200 dark:bg-gray-900 px-1 py-0.5 text-[0.85em] font-mono"
        >
          {children}
        </code>
      );
    }
    return (
      <code
        {...rest}
        className={`${className ?? ""} text-[0.85em] font-mono`}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...rest }) => (
    <pre
      {...rest}
      className="bg-gray-200 dark:bg-gray-900 rounded-md p-3 my-2 overflow-x-auto whitespace-pre text-[0.85em] leading-relaxed"
    >
      {children}
    </pre>
  ),
  ul: ({ children, ...rest }) => (
    <ul {...rest} className="list-disc pl-5 my-2 space-y-1">
      {children}
    </ul>
  ),
  ol: ({ children, ...rest }) => (
    <ol {...rest} className="list-decimal pl-5 my-2 space-y-1">
      {children}
    </ol>
  ),
  p: ({ children, ...rest }) => (
    <p {...rest} className="my-1.5 leading-relaxed">
      {children}
    </p>
  ),
  h1: ({ children, ...rest }) => (
    <h1 {...rest} className="text-base font-semibold mt-3 mb-2">
      {children}
    </h1>
  ),
  h2: ({ children, ...rest }) => (
    <h2 {...rest} className="text-base font-semibold mt-3 mb-2">
      {children}
    </h2>
  ),
  h3: ({ children, ...rest }) => (
    <h3 {...rest} className="text-sm font-semibold mt-2 mb-1">
      {children}
    </h3>
  ),
  blockquote: ({ children, ...rest }) => (
    <blockquote
      {...rest}
      className="border-l-2 border-gray-400 dark:border-gray-500 pl-3 italic my-2"
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...rest }) => (
    <div className="overflow-x-auto my-2">
      <table
        {...rest}
        className="border-collapse text-[0.85em] min-w-full"
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...rest }) => (
    <th
      {...rest}
      className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left font-semibold"
    >
      {children}
    </th>
  ),
  td: ({ children, ...rest }) => (
    <td
      {...rest}
      className="border border-gray-300 dark:border-gray-600 px-2 py-1 align-top"
    >
      {children}
    </td>
  ),
};

export default function MessageMarkdown({
  content,
  className,
}: MessageMarkdownProps) {
  // Defensively pretty-print bare JSON objects (legacy assistant outputs).
  const normalised = useMemo(() => maybePrettyPrintJson(content), [content]);

  return (
    <div className={`text-sm ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalised}
      </ReactMarkdown>
    </div>
  );
}
