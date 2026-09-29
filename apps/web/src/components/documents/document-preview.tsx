import { Download, FileQuestion, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import fetchDocumentBlob from "@/fetchers/document/fetch-document-blob";
import type { DocumentItem } from "./types";

type PreviewKind =
  | "image"
  | "pdf"
  | "text"
  | "markdown"
  | "video"
  | "audio"
  | "none";

// Text/markdown files larger than this are treated as non-previewable
// (download instead) to avoid loading huge strings into the DOM.
const TEXT_PREVIEW_MAX = 1024 * 1024;

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdx"]);
const TEXT_EXTENSIONS = new Set([
  "txt",
  "csv",
  "tsv",
  "log",
  "json",
  "xml",
  "yml",
  "yaml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "env",
  "gitignore",
  "dockerignore",
]);

function getFileExtension(name: string): string {
  const base = name.trim().split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

function isMarkdownDoc(doc: DocumentItem): boolean {
  const ct = doc.contentType.toLowerCase();
  if (
    ct === "text/markdown" ||
    ct === "text/x-markdown" ||
    ct === "application/markdown"
  ) {
    return true;
  }
  return MARKDOWN_EXTENSIONS.has(getFileExtension(doc.name));
}

function isTextLikeDoc(doc: DocumentItem): boolean {
  const ct = doc.contentType.toLowerCase();
  if (
    ct.startsWith("text/") ||
    ct === "application/json" ||
    ct === "application/xml" ||
    ct === "application/x-yaml" ||
    ct === "application/yaml"
  ) {
    return true;
  }

  // Browsers often upload .md/.txt as application/octet-stream (empty File.type).
  if (
    ct === "application/octet-stream" ||
    ct === "binary/octet-stream" ||
    ct === ""
  ) {
    const ext = getFileExtension(doc.name);
    return TEXT_EXTENSIONS.has(ext) || MARKDOWN_EXTENSIONS.has(ext);
  }

  return false;
}

function getPreviewKind(doc: DocumentItem): PreviewKind {
  const ct = doc.contentType.toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct === "application/pdf") return "pdf";
  if (ct.startsWith("video/")) return "video";
  if (ct.startsWith("audio/")) return "audio";

  if (doc.size > TEXT_PREVIEW_MAX) return "none";

  if (isMarkdownDoc(doc)) return "markdown";
  if (isTextLikeDoc(doc)) return "text";

  return "none";
}

type DocumentPreviewProps = {
  doc: DocumentItem | null;
  onClose: () => void;
  onDownload: (doc: DocumentItem) => void;
};

export default function DocumentPreview({
  doc,
  onClose,
  onDownload,
}: DocumentPreviewProps) {
  const { t } = useTranslation();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const kind = doc ? getPreviewKind(doc) : "none";
  const docId = doc?.id;

  useEffect(() => {
    if (!docId || kind === "none") {
      setObjectUrl(null);
      setText(null);
      setError(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(false);
    setObjectUrl(null);
    setText(null);

    fetchDocumentBlob(docId)
      .then(async (blob) => {
        if (cancelled) return;
        if (kind === "text" || kind === "markdown") {
          const content = await blob.text();
          if (!cancelled) setText(content);
        } else {
          createdUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(createdUrl);
            return;
          }
          setObjectUrl(createdUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [docId, kind]);

  return (
    <Dialog open={doc !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{doc?.name}</DialogTitle>
        </DialogHeader>

        <DialogPanel>
          <div className="min-h-[320px] overflow-auto rounded-md border border-border/60 bg-muted/30">
            {loading && (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
                <Loader2 className="size-6 animate-spin" />
                {t("documents:preview.loading")}
              </div>
            )}

            {!loading && error && (
              <div className="flex min-h-[320px] items-center justify-center py-16 text-destructive text-sm">
                {t("documents:preview.error")}
              </div>
            )}

            {!loading && !error && kind === "none" && (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <FileQuestion className="size-10 text-muted-foreground" />
                <p className="font-medium text-sm">
                  {t("documents:preview.cannotPreview")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t("documents:preview.cannotPreviewHint")}
                </p>
              </div>
            )}

            {!loading && !error && kind === "image" && objectUrl && (
              <div className="flex min-h-[320px] items-center justify-center p-4">
                <img
                  src={objectUrl}
                  alt={doc?.name}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
            )}

            {!loading && !error && kind === "pdf" && objectUrl && (
              <iframe
                src={objectUrl}
                title={doc?.name}
                className="h-[70vh] w-full"
              />
            )}

            {!loading && !error && kind === "video" && objectUrl && (
              <div className="flex min-h-[320px] items-center justify-center p-4">
                <video src={objectUrl} controls className="max-h-[70vh] w-full">
                  <track kind="captions" />
                </video>
              </div>
            )}

            {!loading && !error && kind === "audio" && objectUrl && (
              <div className="flex min-h-[320px] items-center px-6">
                <audio src={objectUrl} controls className="w-full">
                  <track kind="captions" />
                </audio>
              </div>
            )}

            {!loading && !error && kind === "text" && text !== null && (
              <pre className="max-h-[70vh] w-full overflow-auto whitespace-pre-wrap p-4 text-left text-xs">
                {text}
              </pre>
            )}

            {!loading && !error && kind === "markdown" && text !== null && (
              <div className="document-markdown-preview max-h-[70vh] w-full overflow-auto p-6 text-left text-sm leading-7 text-foreground">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-4 mt-0 border-b border-border/70 pb-2 text-2xl font-semibold tracking-tight">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-3 mt-6 border-b border-border/50 pb-1.5 text-xl font-semibold tracking-tight first:mt-0">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-2 mt-5 text-lg font-semibold first:mt-0">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="mb-2 mt-4 text-base font-semibold first:mt-0">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="mb-3 whitespace-pre-wrap last:mb-0">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-3 list-disc space-y-1.5 pl-6">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-3 list-decimal space-y-1.5 pl-6">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="pl-0.5 [&>p]:mb-1">{children}</li>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary underline underline-offset-2 hover:opacity-90"
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="mb-3 border-l-2 border-border pl-4 text-muted-foreground italic">
                        {children}
                      </blockquote>
                    ),
                    code: ({ className, children }) => {
                      const isBlock = Boolean(className);
                      if (isBlock) {
                        return (
                          <code className="font-mono text-[12px] leading-5">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="mb-4 overflow-x-auto rounded-md border border-border/60 bg-background p-3">
                        {children}
                      </pre>
                    ),
                    hr: () => <hr className="my-6 border-border" />,
                    table: ({ children }) => (
                      <div className="mb-4 overflow-x-auto rounded-md border border-border/70">
                        <table className="w-full border-collapse text-left text-sm">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-muted/60">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="border-b border-border px-3 py-2 font-medium">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border-b border-border/70 px-3 py-2 align-top">
                        {children}
                      </td>
                    ),
                    tr: ({ children }) => (
                      <tr className="even:bg-muted/25">{children}</tr>
                    ),
                    img: ({ src, alt }) => (
                      <img
                        src={src}
                        alt={alt ?? ""}
                        className="my-3 max-h-[50vh] max-w-full rounded-md object-contain"
                      />
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic">{children}</em>
                    ),
                    del: ({ children }) => (
                      <del className="text-muted-foreground line-through">
                        {children}
                      </del>
                    ),
                  }}
                >
                  {text}
                </Markdown>
              </div>
            )}
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("documents:actions.close")}
          </Button>
          {doc && (
            <Button type="button" size="sm" onClick={() => onDownload(doc)}>
              <Download className="size-3.5" />
              {t("documents:actions.download")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
