import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const DOCS = {
  privacy: {
    file: "케이프라임연구소_개인정보처리방침.md",
    title: "개인정보처리방침",
  },
  refund: {
    file: "케이프라임연구소_환불정책.md",
    title: "환불정책",
  },
  support: {
    file: "케이프라임연구소_고객센터.md",
    title: "고객센터",
  },
} as const;

type Params = { slug: string };

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = params;
  const doc = DOCS[slug as keyof typeof DOCS];
  if (!doc) return {};
  return { title: doc.title };
}

export default async function LegalPage({ params }: { params: Params }) {
  const { slug } = params;
  const doc = DOCS[slug as keyof typeof DOCS];
  if (!doc) notFound();
  const content = await fs.readFile(
    path.join(process.cwd(), "public", doc.file),
    "utf8",
  );
  return (
    <main className="mx-auto max-w-3xl px-6 pt-16 pb-28">
      <a
        href="/"
        className="mb-6 inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        ← 홈으로
      </a>
      <article className="markdown-body text-sm leading-relaxed text-gray-700">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ node: _n, ...props }) => (
              <h1 className="mb-6 text-3xl font-bold text-gray-900" {...props} />
            ),
            h2: ({ node: _n, ...props }) => (
              <h2
                className="mt-10 mb-4 text-xl font-bold text-gray-900"
                {...props}
              />
            ),
            h3: ({ node: _n, ...props }) => (
              <h3 className="mt-6 mb-3 text-lg font-bold text-gray-900" {...props} />
            ),
            p: ({ node: _n, ...props }) => (
              <p className="mb-4 leading-relaxed" {...props} />
            ),
            ul: ({ node: _n, ...props }) => (
              <ul className="mb-4 list-disc space-y-1.5 pl-6" {...props} />
            ),
            ol: ({ node: _n, ...props }) => (
              <ol className="mb-4 list-decimal space-y-1.5 pl-6" {...props} />
            ),
            li: ({ node: _n, ...props }) => (
              <li className="leading-relaxed" {...props} />
            ),
            strong: ({ node: _n, ...props }) => (
              <strong className="font-bold text-gray-900" {...props} />
            ),
            hr: () => null,
            table: ({ node: _n, ...props }) => (
              <div className="my-6 overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm" {...props} />
              </div>
            ),
            thead: ({ node: _n, ...props }) => (
              <thead className="bg-gray-50" {...props} />
            ),
            tr: ({ node: _n, ...props }) => (
              <tr className="border-b border-gray-100 last:border-0" {...props} />
            ),
            th: ({ node: _n, ...props }) => (
              <th
                className="px-4 py-3 text-left text-xs font-bold tracking-wide text-gray-700"
                {...props}
              />
            ),
            td: ({ node: _n, ...props }) => (
              <td className="px-4 py-3 text-gray-700" {...props} />
            ),
            a: ({ node: _n, ...props }) => (
              <a className="text-blue-700 underline hover:text-blue-900" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </main>
  );
}
