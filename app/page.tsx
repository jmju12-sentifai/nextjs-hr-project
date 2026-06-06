import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AIToolList from "./components/AIToolList";
import UserMenu from "./components/UserMenu";

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

const ICONS = {
  gift: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20 12v9H4v-9M2 7h20v5H2V7Zm10 0v14M12 7s-2-4-5-4-3 3-1 4 6 0 6 0Zm0 0s2-4 5-4 3 3 1 4-6 0-6 0Z"
    />
  ),
  doc: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h5"
    />
  ),
  calendar: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
    />
  ),
  user: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 6v2h14v-2c0-4-3-6-7-6Z"
    />
  ),
  cap: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4 2 9l10 5 10-5-10-5Zm-6 7v5c3 2 9 2 12 0v-5M22 9v5"
    />
  ),
  chair: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 4h12v8H6V4Zm-2 8h16M7 12v8m10-8v8"
    />
  ),
  clock: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  ),
  idCard: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 6h18v12H3V6Zm5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3 4c0-2 2-3 3-3s3 1 3 3m3-6h4m-4 4h4"
    />
  ),
  badge: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 2 4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6l-8-4Zm-3 9 2 2 4-4"
    />
  ),
  paper: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l5-3Zm0 0v3H6m4 4h6m-6 4h6"
    />
  ),
  monitor: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 4h18v12H3V4Zm5 16h8m-4-4v4"
    />
  ),
  door: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 3h9v18H9V3Zm0 0H5v18h4M14 12h.01"
    />
  ),
  clipboard: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 4h6a1 1 0 0 1 1 1v2H8V5a1 1 0 0 1 1-1Zm-3 3h12v14H6V7Zm3 6 2 2 4-4"
    />
  ),
  plane: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2 12 22 4l-4 18-5-7-7-3Z"
    />
  ),
  handshake: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m11 17 2 2 4-4 4-4-4-4-3 3-3-3-4 4-4 4 4 4 2-2Z"
    />
  ),
  contract: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 3h7l5 5v13H7V3Zm0 0v5h5m-2 4 1.5 1.5L14 12m-4 4h6"
    />
  ),
};

type App = {
  title: string;
  icon: React.ReactElement;
  steps: [string, string, string, string];
};

const APP_LIST: App[] = [
  {
    title: "복리후생(경조사 지원) 자동처리",
    icon: ICONS.gift,
    steps: [
      "경조사 기준파일 지식화",
      "신청서 및 증빙자료 파싱",
      "지원 자격 및 금액 적정성 판단",
      "지원금액 산출 및 안내자료 생성",
    ],
  },
  {
    title: "인사위원회 회부 건 양형 결정",
    icon: ICONS.paper,
    steps: [
      "징계규정/양형기준 지식화",
      "비위정보 및 관련 증빙 파싱",
      "징계 사유 적정성 및 양정 검토",
      "징계 양정 및 검토결과 안내자료 생성",
    ],
  },
  {
    title: "연차보상금 계산내역 송부 건",
    icon: ICONS.calendar,
    steps: [
      "연차 산정 기준화 등 지시화",
      "보상 대상 연차 파싱",
      "연차 보상금 산정",
      "보상금 안내·지급 이행",
    ],
  },
  {
    title: "사내공모 서류 1차 합격여부 검토",
    icon: ICONS.user,
    steps: [
      "응모 자격 기준화 등 지시화",
      "응모자 자격 정보 파싱",
      "자격 부합 여부 판단",
      "1차 합격여부 안내",
    ],
  },
  {
    title: "외부교육 참가자 교육비지원 적정성 검토",
    icon: ICONS.cap,
    steps: [
      "교육비 지원 기준화 등 지시화",
      "신청자 교육 내용 파싱",
      "지원 적정성 판단",
      "지원 결정 안내·이행",
    ],
  },
  {
    title: "신규 직책자 직책수당 적용 검토",
    icon: ICONS.chair,
    steps: [
      "직책수당 기준화 등 지시화",
      "신규 직책 부여 정보 파싱",
      "수당 적용 적정성 판단",
      "적용 안내·지급 이행",
    ],
  },
  {
    title: "주말 연장근로 추가신청자 연장근로수당 검토",
    icon: ICONS.clock,
    steps: [
      "연장근로수당 기준화 등 지시화",
      "연장근로 신청 데이터 파싱",
      "수당 적용 적정성 판단",
      "수당 안내·지급 이행",
    ],
  },
  {
    title: "핵심인력 90일 온보딩 계획일정표 송부",
    icon: ICONS.idCard,
    steps: [
      "온보딩 기준화 등 지시화",
      "핵심인력 대상자 파싱",
      "일정 적정성 판단",
      "일정표 안내·송부 이행",
    ],
  },
  {
    title: "자격수당 대상여부 및 금액산정 검토",
    icon: ICONS.badge,
    steps: [
      "자격수당 기준화 등 지시화",
      "자격 보유 정보 파싱",
      "대상·금액 적정성 판단",
      "결과 안내·지급 이행",
    ],
  },
  {
    title: "이의신청 확인 1차 결과지 도출",
    icon: ICONS.doc,
    steps: [
      "이의신청 기준화 등 지시화",
      "신청 내용 데이터 파싱",
      "이의 적정성 판단",
      "1차 결과 안내·이행",
    ],
  },
  {
    title: "리더십 특화교육 신청대상자 선정 검토",
    icon: ICONS.monitor,
    steps: [
      "선정 기준화 등 지시화",
      "후보자 정보 파싱",
      "선정 적정성 판단",
      "선정 결과 안내·이행",
    ],
  },
  {
    title: "퇴직금 예상금액 안내문 검토",
    icon: ICONS.door,
    steps: [
      "퇴직금 기준화 등 지시화",
      "재직 정보 데이터 파싱",
      "예상 금액 적정성 판단",
      "안내문 송부·이행",
    ],
  },
  {
    title: "근무평가 결과 피드백 자료 생성",
    icon: ICONS.clipboard,
    steps: [
      "평가 기준화 등 지시화",
      "평가 데이터 파싱",
      "피드백 적정성 판단",
      "자료 안내·송부 이행",
    ],
  },
  {
    title: "해외출장 정산내역 적정성 검토",
    icon: ICONS.plane,
    steps: [
      "출장 정산 기준화 등 지시화",
      "정산 영수증 등 파싱",
      "정산 적정성 판단",
      "정산 결과 안내·이행",
    ],
  },
  {
    title: "인사 차수 협의 결과 정리 및 승인 요청",
    icon: ICONS.handshake,
    steps: [
      "협의 기준화 등 지시화",
      "협의 내용 정리 파싱",
      "결과 적정성 판단",
      "승인 요청 안내·이행",
    ],
  },
  {
    title: "근로계약 갱신 여부 검토 및 안내",
    icon: ICONS.contract,
    steps: [
      "갱신 기준화 등 지시화",
      "계약 정보 데이터 파싱",
      "갱신 적정성 판단",
      "갱신 안내·이행",
    ],
  },
];

type SubFeature = {
  title: string;
  description: string;
  icon: React.ReactElement;
};

const SUB_SECTION_FEATURES: SubFeature[] = [
  {
    title: "검증된 기술력",
    description: "엔터프라이즈 HR 노하우 기반",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    ),
  },
  {
    title: "즉시 사용 가능한 다양한 앱",
    description: "필요한 기능을 골라 바로 적용",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h6v6H4V6Zm10 0h6v6h-6V6ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"
      />
    ),
  },
  {
    title: "보안이 보장되는 환경",
    description: "민감한 인사 데이터 안전 보호",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6l-8-3Z"
      />
    ),
  },
  {
    title: "지속해서 업데이트 되는 기능",
    description: "변화하는 인사 환경에 발맞춰 개선",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 12a8 8 0 0 1 14-5l3-1v6h-6l2-2a5 5 0 0 0-9 2M20 12a8 8 0 0 1-14 5l-3 1v-6h6l-2 2a5 5 0 0 0 9-2"
      />
    ),
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 관리자가 발행한 앱 — 홈 "인사AI 앱 세트"에 동적으로 추가
  const { data: publishedApps } = await supabase
    .from("apps")
    .select("id, name, app_schema, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: true });

  const defaultFlow = ["기준 지식화", "예측·파싱", "적정성 판단", "안내·이행"];
  type DynamicApp = {
    id: string;
    title: string;
    steps: [string, string, string, string];
  };
  const dynamicApps: DynamicApp[] = (publishedApps || []).map((row: any) => {
    const meta = row.app_schema?.meta || {};
    const flowRaw: string[] = Array.isArray(meta.flow) ? meta.flow : [];
    const steps = [0, 1, 2, 3].map(
      (i) => (flowRaw[i] && String(flowRaw[i]).trim()) || defaultFlow[i]
    ) as [string, string, string, string];
    return {
      id: row.id,
      title: meta.appName || row.name || "Untitled",
      steps,
    };
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-blue-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center">
            <Image
              src="/HRCoach_v2_transparent.png"
              alt="HRCoach"
              width={136}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm font-medium text-gray-800 transition hover:text-blue-700"
              >
                {item}
              </a>
            ))}
          </nav>
          {user ? (
            <UserMenu email={user.email ?? ""} />
          ) : (
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="rounded-full bg-blue-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-950"
              >
                로그인
              </a>
              <a
                href="/signup"
                className="rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                회원가입
              </a>
            </div>
          )}
        </div>
      </header>

      <div className="bg-gradient-to-b from-blue-50 from-55% to-white to-80%">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-3 text-3xl font-semibold text-gray-700">
              인사 업무의 모든 것,
            </p>
            <h1 className="mb-6 text-5xl font-bold leading-tight text-gray-900">
              <span className="bg-gradient-to-r from-blue-400 to-blue-700 bg-clip-text text-transparent">
                HR
              </span>
              <span className="text-gray-700">coach</span> 앱 스토어
            </h1>
            <p className="mb-3 text-xl font-medium text-gray-800">
              업로드만으로 원하는 결과를 바로!
            </p>
            <p className="text-base leading-relaxed text-gray-600">
              채용부터 퇴직까지, 복잡한 인사 업무를
              <br />
              쉽고 빠르게 자동화합니다.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {["업무 자동화", "업무 표준화", "업무 고도화"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-900 shadow-sm ring-1 ring-blue-100"
                >
                  # {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <Image
              src="/hero-image-back.png"
              alt="HRcoach 앱 스토어"
              width={1200}
              height={1200}
              quality={100}
              priority
              sizes="(max-width: 768px) 90vw, 600px"
              className="h-auto w-full max-w-lg rotate-3"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-blue-200" />
          <span className="text-[11px] font-bold tracking-[0.25em] text-blue-900">
            WHY HRCOACH
          </span>
          <span className="h-px w-8 bg-blue-200" />
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 rounded-2xl border border-blue-100 bg-gradient-to-b from-white to-blue-50/40 p-6 shadow-[0_10px_30px_-12px_rgba(30,58,138,0.18),0_4px_10px_-4px_rgba(30,58,138,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] sm:grid-cols-4 sm:p-8">
          {SUB_SECTION_FEATURES.map((feature, idx) => (
            <div
              key={feature.title}
              className={
                "flex items-start gap-4 sm:relative " +
                (idx > 0
                  ? "sm:before:absolute sm:before:-left-4 sm:before:top-1 sm:before:bottom-1 sm:before:w-px sm:before:bg-blue-200/70"
                  : "")
              }
            >
              <span className="text-[32px] font-black leading-none text-blue-300 tabular-nums">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 pt-1">
                <h4 className="text-sm font-bold text-gray-900">
                  {feature.title}
                </h4>
                <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-40">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            인사AI 앱 세트{" "}
            <span className="text-gray-500">- 다양한 세부업무를</span>{" "}
            <span className="text-blue-700">4단계 패턴(1-2-3-4)</span>
            <span className="text-gray-500">으로 자동화</span>
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-gray-500">
            모든 인사업무는 동일한 4단계 흐름으로 처리됩니다.
          </p>

          {/* 4단계 패턴 legend */}
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-3">
            {[
              { n: 1, label: "기준 지시화", dot: "bg-sky-500 ring-sky-100", bg: "bg-sky-50", text: "text-sky-700" },
              { n: 2, label: "예측·파싱", dot: "bg-blue-500 ring-blue-100", bg: "bg-blue-50", text: "text-blue-700" },
              { n: 3, label: "적정성 판단", dot: "bg-indigo-500 ring-indigo-100", bg: "bg-indigo-50", text: "text-indigo-700" },
              { n: 4, label: "안내·이행", dot: "bg-violet-500 ring-violet-100", bg: "bg-violet-50", text: "text-violet-700" },
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center gap-2 sm:gap-3">
                <div className={`flex items-center gap-1.5 rounded-full ${s.bg} px-3 py-1.5`}>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${s.dot} text-[10px] font-bold text-white ring-4`}
                  >
                    {s.n}
                  </span>
                  <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <svg
                    className="h-3 w-3 text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 12 12"
                    aria-hidden
                  >
                    <path d="M3 1l5 5-5 5V1z" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* 관리자 빌더에서 발행한 앱 — 활성 카드 (클릭 시 /apps/[id]) */}
          {dynamicApps.map((app, di) => {
            const idx = di;
            return (
              <Link
                href={`/apps/${app.id}`}
                key={app.id}
                className="group relative flex min-h-[276px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-emerald-400 via-violet-400 to-blue-600 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="-mx-7 -mt-7 mb-5 h-[7rem] px-7 pt-4 pb-4 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <span className="mb-2 inline-flex items-center justify-center rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-wider text-blue-700 shadow-sm ring-1 ring-blue-100">
                    APP {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="break-keep text-[16px] font-bold leading-snug text-gray-900">
                    {app.title}
                  </h3>
                </div>
                <ol className="relative mt-1 space-y-2.5">
                  <div className="absolute left-[10px] top-3 bottom-3 w-px bg-gradient-to-b from-sky-200 via-blue-200 via-indigo-200 to-violet-200" />
                  {app.steps.map((step, i) => {
                    const colors = [
                      "bg-sky-500 ring-sky-100",
                      "bg-blue-500 ring-blue-100",
                      "bg-indigo-500 ring-indigo-100",
                      "bg-violet-500 ring-violet-100",
                    ];
                    return (
                      <li key={i} className="relative flex items-start gap-2.5">
                        <span
                          className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${colors[i]} text-[10px] font-bold text-white ring-4`}
                        >
                          {i + 1}
                        </span>
                        <span className="flex-1 break-keep text-[12px] leading-snug text-gray-700">
                          {step}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </Link>
            );
          })}

          {/* 하드코딩된 앱 세트 — 동적 앱 뒤에 이어서 표시 (준비중 라벨 유지) */}
          {APP_LIST.map((app, hi) => {
            const idx = dynamicApps.length + hi;
            const isFirstHardcoded = dynamicApps.length === 0 && hi === 0;
            return (
              <div
                key={app.title}
                className={`group relative flex min-h-[276px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all ${
                  isFirstHardcoded ? "hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl" : ""
                }`}
              >
                {isFirstHardcoded && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-emerald-400 via-violet-400 to-blue-600 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
                {!isFirstHardcoded && (
                  <span className="absolute right-4 top-4 z-10 rounded-full bg-gray-200 px-2.5 py-0.5 text-[10px] font-bold text-gray-500">
                    준비중
                  </span>
                )}
                <div
                  className={`-mx-7 -mt-7 mb-5 h-[7rem] px-7 pt-4 pb-4 ${
                    isFirstHardcoded ? "bg-gradient-to-br from-blue-50 to-indigo-50" : "bg-gray-100"
                  }`}
                >
                  <span className="mb-2 inline-flex items-center justify-center rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-wider text-blue-700 shadow-sm ring-1 ring-blue-100">
                    APP {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="break-keep text-[16px] font-bold leading-snug text-gray-900">
                    {app.title}
                  </h3>
                </div>

                <ol className="relative mt-1 space-y-2.5">
                  <div className="absolute left-[10px] top-3 bottom-3 w-px bg-gradient-to-b from-sky-200 via-blue-200 via-indigo-200 to-violet-200" />
                  {app.steps.map((step, i) => {
                    const colors = [
                      "bg-sky-500 ring-sky-100",
                      "bg-blue-500 ring-blue-100",
                      "bg-indigo-500 ring-indigo-100",
                      "bg-violet-500 ring-violet-100",
                    ];
                    return (
                      <li key={step} className="relative flex items-start gap-2.5">
                        <span
                          className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${colors[i]} text-[10px] font-bold text-white ring-4`}
                        >
                          {i + 1}
                        </span>
                        <span className="flex-1 break-keep text-[12px] leading-snug text-gray-700">
                          {step}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>

        <p className="mt-10 rounded-xl bg-gradient-to-r from-sky-50 via-blue-50 via-indigo-50 to-violet-50 px-6 py-4 text-center text-xs text-gray-700">
          위 앱 세트는 기업 인사실무에서 반복적으로 발생하는 업무를 4단계 패턴으로
          표준화하여, AI가 일관되고 정확하게 자동 처리하도록 설계되었습니다.
        </p>
      </section>

      <AIToolList />

      <section
        id="pricing"
        className="mx-auto max-w-6xl px-6 pb-24 pt-32 scroll-mt-20"
      >
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            한 번 구독으로{" "}
            <span className="text-gray-500">-</span>{" "}
            <span className="text-blue-700">40+ 도구</span>
            <span className="text-gray-500"> 모두</span>
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-gray-500">
            월 단위로 자유롭게 변경·해지할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              name: "Free Trial",
              price: "0원",
              unit: "/14일",
              featured: false,
              features: [
                "기본 자소서 첨삭 1회",
                "JOB-FIT 진단 미리보기",
                "도구 카탈로그 열람",
              ],
              cta: "무료로 시작",
              href: "/signup",
            },
            {
              name: "Coach",
              price: "19,900원",
              unit: "/월",
              featured: true,
              badge: "가장 많이 선택",
              features: [
                "40+ AI 도구 전체",
                "자소서 진단 무제한",
                "모의면접 월 5회",
                "이메일 우선 지원",
              ],
              cta: "Coach 구독 →",
              href: "/payment?plan=coach",
            },
            {
              name: "Coach+",
              price: "49,900원",
              unit: "/월",
              featured: false,
              features: [
                "Coach 모든 기능",
                "1:1 전문가 컨설팅 월 1회",
                "모의면접 무제한",
                "전담 매니저 배정",
              ],
              cta: "Coach+ 시작",
              href: "/payment?plan=coach-plus",
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${
                plan.featured
                  ? "border-blue-200 bg-white ring-2 ring-blue-100"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.featured && plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-semibold text-blue-700 shadow-sm">
                  {plan.badge}
                </span>
              )}
              <h3
                className={`mb-3 text-base font-bold ${
                  plan.featured ? "text-blue-700" : "text-gray-900"
                }`}
              >
                {plan.name}
              </h3>
              <div className="mb-5 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">
                  {plan.price}
                </span>
                <span className="text-sm text-gray-500">{plan.unit}</span>
              </div>
              <ul className="mb-6 space-y-2">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-auto block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition ${
                  plan.featured
                    ? "bg-blue-700 text-white hover:bg-blue-800"
                    : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-slate-800 px-8 py-7 text-white md:flex-row md:items-center">
          <div>
            <p className="text-xl font-bold leading-snug">
              합격은 운이 아닙니다.
              <br />
              준비된 사람의 결과입니다.
            </p>
            <p className="mt-2 text-xs text-slate-300">
              14일 무료 체험 · 신용카드 등록 없이 시작
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
          >
            무료로 시작하기 →
          </button>
        </div>
      </section>

      {/* Footer 는 src/app/layout.tsx 에서 모든 페이지에 자동 렌더링 */}
    </div>
  );
}
