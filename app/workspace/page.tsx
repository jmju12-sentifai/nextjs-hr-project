import Link from "next/link";
import SectionShell, { PlannedList } from "../components/home/SectionShell";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "내 작업실 — HRcoach" };

/**
 * 엑셀 "4. 내 작업실" + "5. 결제 내역 및 영수증".
 * 하위 항목이 전부 내 데이터라 대메뉴가 아닌 프로필 메뉴에서만 진입한다.
 * 비로그인 접근은 막지 않고 로그인 안내로 대체한다 — 무엇이 있는지는 보여주는 편이 낫다.
 */
export default async function WorkspacePage() {
  const viewer = await getViewer();

  return (
    <SectionShell
      userEmail={viewer.email}
      isAdmin={viewer.isAdmin}
      eyebrow="MY WORKSPACE"
      title="내가 만든 산출물이 쌓이는 곳."
      lead="실행한 앱의 결과 문서와 이력, 결제 내역을 한곳에서 관리합니다."
    >
      {!viewer.email && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-blue/25 bg-[#f2f7ff] px-6 py-5">
          <div>
            <p className="text-[13px] font-bold text-brand-ink">
              로그인하면 내 작업실을 볼 수 있습니다.
            </p>
            <p className="mt-1 text-[12px] text-brand-muted">
              실행한 앱의 산출물과 결제 내역은 계정에 귀속됩니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/login?next=/workspace"
              className="rounded-xl bg-brand-blue px-5 py-3 text-[12px] font-bold text-white transition hover:bg-brand-blue2"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-brand-line bg-white px-5 py-3 text-[12px] font-bold text-brand-ink transition hover:border-brand-blue"
            >
              회원가입
            </Link>
          </div>
        </div>
      )}

      <PlannedList
        items={[
          { title: "인사이트 대시보드", desc: "주요 사용 앱 통계 및 업무 진척도 시각화" },
          { id: "bundles", title: "마이 앱 번들", desc: "채용·평가 시즌 등 목적별 앱 그룹화 폴더" },
          { id: "archive", title: "산출물 보관함", desc: "생성된 리포트·데이터 다운로드 및 이력 관리" },
          { id: "billing", title: "결제 내역·영수증", desc: "세금계산서 발행 및 결제 히스토리 조회" },
        ]}
      />
    </SectionShell>
  );
}
