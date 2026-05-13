import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

const NAV_ITEMS = [
  "직무관리",
  "채용관리",
  "평가관리",
  "보상관리",
  "배치관리",
  "복지관리",
  "교육관리",
  "행정관리",
  "기타업무",
];

const PRIMARY_FEATURES = [
  {
    title: "업무 자동화",
    description: "재료부터 퇴직까지, 복잡한 인사 업무를 쉽고 빠르게 자동화하세요.",
  },
  {
    title: "업무 고도화",
    description: "데이터 기반의 인사이트로 의사결정의 품질을 한 단계 끌어올립니다.",
  },
];

const SUB_FEATURES = [
  {
    title: "검증된 기술력",
    description: "엔터프라이즈 HR 노하우 기반",
  },
  {
    title: "즉시 사용 가능한 다양한 앱",
    description: "필요한 기능을 골라 바로 적용",
  },
  {
    title: "보안이 보장되는 환경",
    description: "민감한 인사 데이터 안전 보호",
  },
  {
    title: "지속해서 업데이트 되는 기능",
    description: "변화하는 인사 환경에 발맞춰 개선",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-700">HR</span>
            <span className="text-xl font-bold text-gray-900">coach</span>
            <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
              .co.kr
            </span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm text-gray-600 transition hover:text-gray-900"
              >
                {item}
              </a>
            ))}
          </nav>
          {user ? (
            <form action={logout} className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-600 sm:inline">
                {user.email}
              </span>
              <button
                type="submit"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                로그아웃
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                로그인
              </a>
              <a
                href="/signup"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                회원가입
              </a>
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-3 text-3xl font-semibold text-gray-700">
              인사 업무의 모든 것,
            </p>
            <h1 className="mb-6 text-5xl font-bold leading-tight text-gray-900">
              <span className="text-blue-700">HRcoach</span> 앱 스토어
            </h1>
            <p className="mb-3 text-lg font-medium text-gray-800">
              업로드만으로 원하는 결과를 바로!
            </p>
            <p className="text-sm leading-relaxed text-gray-600">
              채용부터 퇴직까지, 복잡한 인사 업무를
              <br />
              쉽고 빠르게 자동화합니다.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {[
                {
                  title: "업무 자동화",
                  description: "반복 업무를 자동으로 처리해 시간을 절약합니다.",
                },
                {
                  title: "업무 표준화",
                  description: "흩어진 인사 업무를 일관된 프로세스로 통일합니다.",
                },
                {
                  title: "업무 고도화",
                  description: "데이터 기반 인사이트로 의사결정을 강화합니다.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white p-3 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-gray-900">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {!user && (
              <div className="mt-6 flex gap-2">
                <a
                  href="/login"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  로그인하고 시작하기
                </a>
                <a
                  href="/signup"
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  회원가입
                </a>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <Image
              src="/hero_image.png"
              alt="HRcoach 앱 스토어"
              width={1200}
              height={1200}
              quality={100}
              priority
              sizes="(max-width: 768px) 90vw, 600px"
              className="h-auto w-full max-w-md"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid gap-4 md:grid-cols-2">
          {PRIMARY_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="mb-1 text-base font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUB_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-gray-100 bg-white p-5"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h4 className="mb-1 text-sm font-semibold text-gray-900">
                {feature.title}
              </h4>
              <p className="text-xs leading-relaxed text-gray-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
