import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 py-8 text-gray-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div>
          <div className="mb-3">
            <Image
              src="/logo-footer.png"
              alt="K Prime HR"
              width={240}
              height={64}
              className="h-14 w-auto"
            />
          </div>
          <p className="mb-5 text-sm italic leading-relaxed text-gray-600">
            우리는 인사 컨설팅의 복잡한 블랙박스를 걷어내고, 누구나 실행 가능한 도구(AIA)로 바꿉니다. 기업의 성장은 데이터와 로직 위에 세워져야 한다는 믿음으로 서비스를 만듭니다.
          </p>

          <div>
            <div className="space-y-1 text-right text-[11px] leading-relaxed text-gray-600">
              <p>
                <span className="font-semibold text-gray-700">상호명</span>{" "}
                <span className="text-gray-600">케이프라임연구소</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="font-semibold text-gray-700">대표자명</span>{" "}
                <span className="text-gray-600">조윤정</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="font-semibold text-gray-700">사업자등록번호</span>{" "}
                <span className="text-gray-600">264-24-02200</span>
              </p>
              <p>
                <span className="font-semibold text-gray-700">사업자 주소</span>{" "}
                <span className="text-gray-600">서울 강동구 명일동 225-4</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="font-semibold text-gray-700">고객센터</span>{" "}
                <span className="text-gray-600">010.9041.9930</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="font-semibold text-gray-700">이메일 문의</span>{" "}
                <span className="text-gray-600">besthrcoach@naver.com</span>
              </p>
              <p>
                <span className="font-semibold text-gray-700">통신판매업 신고번호</span>{" "}
                <span className="text-gray-600">면허번호 : 2026-서울강동-0856</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="font-semibold text-gray-700">개인정보관리책임자</span>{" "}
                <span className="text-gray-600">조윤정</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="font-semibold text-gray-700">호스팅제공자</span>{" "}
                <span className="text-gray-600">자체구축</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-5 text-[10px] font-bold uppercase tracking-widest text-gray-500 md:flex-row">
          <p>© {new Date().getFullYear()} AI인사팀 (K Prime HR Solution). All Rights Reserved.</p>
          <div className="flex space-x-8">
            <a href="/legal/privacy" className="transition-colors hover:text-gray-900">개인정보처리방침</a>
            <a href="/legal/refund" className="transition-colors hover:text-gray-900">환불정책</a>
            <a href="/legal/support" className="transition-colors hover:text-gray-900">고객센터</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
