import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">HR Coach</h1>
      <p className="mt-2 text-gray-600">인사 분석 앱 빌더 데모</p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/admin/builder"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          빌더 열기
        </Link>
      </div>
    </main>
  );
}
