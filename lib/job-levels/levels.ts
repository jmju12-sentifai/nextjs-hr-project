// 직무 성과책임 12레벨 기준표.
//
// 출처: 고객 제공 '12레벨 성과책임 자동 도출 기획서 v1.1'(2026-11-26 수신)의 4장 표준 분류와 6장 산출 예시 A.
//   기존 18레벨(가이드 v4.1)을 고객 요청으로 대체했다. 기획서의 10레벨 중소기업형은 1차 범위에 넣지 않았다.
// example 은 기획서 예시 A(제조기업 품질관리 / 공정 불량관리)의 문장이다.
//   같은 성과영역에서 레벨이 올라갈 때 책임의 크기가 어떻게 달라지는지를 AI에게 보여 주는 용도다.

export type LevelDef = {
  level: number;
  group: string; // 책임 레벨군
  judgment: string; // 판단·권한 기준
  scope: string; // 책임 범위
  question: string; // 핵심 판정 질문
  example: { accountability: string; meaning: string };
};

export const LEVELS: LevelDef[] = [
  { level: 1, group: "실무행정", judgment: "지시작업 완료", scope: "지정 작업·방법·기한에 따른 완료", question: "정해진 작업을 끝냈는가?",
    example: { accountability: "지정된 불량기록 입력의 기한 내 완료율을 제고한다.", meaning: "지시받은 불량기록 입력을 정해진 시점까지 끝낸다." } },
  { level: 2, group: "실무행정", judgment: "정확한 산출물", scope: "자기 산출물의 오류·누락 제거", question: "결과물이 정확하고 완결적인가?",
    example: { accountability: "불량 유형·수량·로트 기록의 정확도를 향상한다.", meaning: "기록이 실제 발생 내용과 일치하고 누락이 없게 한다." } },
  { level: 3, group: "숙련운영", judgment: "기준 적용·예외 해결", scope: "기존 기준과 권한 내 통상 예외 독립 해결", question: "개별 문제를 스스로 해결하는가?",
    example: { accountability: "권한 내 일상적 불량의 적기 조치율을 제고한다.", meaning: "기준에 따라 일반 불량을 분류하고 정해진 조치를 완료한다." } },
  { level: 4, group: "숙련운영", judgment: "운영성과 확보", scope: "담당 영역 품질·기한·수량 기준 지속 충족", question: "담당 영역 전체 기준성과를 보장하는가?",
    example: { accountability: "담당 공정의 자체 귀책 불량률을 감소시킨다.", meaning: "개별 건 처리에 그치지 않고 담당 공정 전체의 불량률 기준을 지속 충족한다." } },
  { level: 5, group: "프로세스 개선", judgment: "반복 문제 개선", scope: "반복 오류·편차 원인 제거 또는 절차 표준화", question: "같은 문제가 반복되지 않게 하는가?",
    example: { accountability: "반복 불량 원인 개선으로 동일 원인 불량 재발률을 감소시킨다.", meaning: "같은 불량이 반복되는 원인을 찾아 승인된 절차를 개선한다." } },
  { level: 6, group: "프로세스 개선", judgment: "위험 사전 예방", scope: "선행 징후 확인 및 예방조치", question: "문제가 발생하기 전에 차질을 줄이는가?",
    example: { accountability: "불량 선행징후 조기 대응으로 대량 불량 발생 위험을 감소시킨다.", meaning: "이상 추세나 공정조건 이탈을 발견하고 확대되기 전에 조치한다." } },
  { level: 7, group: "기획·제도개선", judgment: "운영방식 개편", scope: "실적·원인·예측오차 분석으로 운영방식 개선", question: "분석으로 기존 운영방식을 바꾸는가?",
    example: { accountability: "불량·수율 실적 분석에 따른 관리방식 개편으로 공정 양품률을 향상한다.", meaning: "공정별 손실 데이터를 비교해 검사·관리방식을 바꾸고 효과를 검증한다." } },
  { level: 8, group: "기획·제도개선", judgment: "조직 간 조정·제도화", scope: "유관 조직 간 상충 조정 및 공통 기준 정립", question: "조직 간 이견·기준을 조정할 권한이 있는가?",
    example: { accountability: "생산·품질·기술 간 판정 및 변경 기준 정립으로 불량 귀책 판단의 일관성을 제고한다.", meaning: "부서마다 다른 판정과 조치 기준을 합의하여 공통 적용한다." } },
  { level: 9, group: "기능혁신", judgment: "전문 방법·시스템 혁신", scope: "전문 방법론·핵심 도구·시스템을 재설계", question: "해당 기능의 전문 수행체계를 혁신하는가?",
    example: { accountability: "불량 예측 시스템 혁신으로 불량 사전 검출률을 제고한다.", meaning: "기존 분석 방법과 도구를 재설계하여 불량을 발생 전에 더 잘 포착한다." } },
  { level: 10, group: "기능혁신", judgment: "기능 운영구조 혁신", scope: "기능 전체의 역할·자원·운영구조 재설계", question: "기능의 구조와 자원 운영모델까지 바꾸는가?",
    example: { accountability: "품질기능의 역할·검증체계·전문자원 재설계로 품질관리 체계의 유효성을 제고한다.", meaning: "품질기능 전체의 책임 구조와 인력·도구 배분을 바꿔 품질성과를 개선한다." } },
  { level: 11, group: "본질목적 실현", judgment: "복수 기능 성과 통합", scope: "복수 기능의 목표·자원 상충을 통합 결정하여 공동 최종결과 확보", question: "여러 기능의 최종 사업성과를 함께 책임지는가?",
    example: { accountability: "생산·품질·기술·구매의 상충 목표와 자원 통합으로 사업 단위 품질손실 비용을 절감한다.", meaning: "품질과 생산성·비용의 상충을 통합 결정해 사업 전체의 품질손실을 줄인다." } },
  { level: 12, group: "본질목적 실현", judgment: "사업 본질목적 실현", scope: "사업 방향·자원 배분·투자 우선순위를 통합 결정하여 지속 가능한 사업 목적 달성", question: "독립 사업 또는 전사의 본질적 결과를 책임지는가?",
    example: { accountability: "사업 품질전략과 투자 통합으로 장기 품질 경쟁력을 향상한다.", meaning: "사업책임자가 품질과 수익의 상충을 판단하고 장기 사업성과에 필요한 투자 우선순위를 결정한다." } },
];

export const MAX_LEVEL = 12;

export function levelDef(level: number): LevelDef | undefined {
  return LEVELS.find((l) => l.level === level);
}

// 화면과 엑셀이 같은 모양의 문장을 쓰도록 한곳에서 조립한다. 형식: '성과책임. (의미: …)'
export function meaningText(meaning: string): string {
  const m = meaning.trim();
  return m ? `(의미: ${m})` : "";
}

export function sentenceText(accountability: string, meaning: string): string {
  return [accountability.trim(), meaningText(meaning)].filter(Boolean).join(" ");
}

export type JobArea = {
  id: string;
  name: string; // 성과영역 이름
  target: string; // 핵심 성과대상·최종 결과
  ceiling: number; // 이 영역에서 인정할 수 있는 최고 레벨 (그 위는 공란)
  ceilingReason?: string;
  onetKeyword?: string;
  onet?: { code: string; title: string } | null;
};

export type LevelSentence = { level: number; accountability: string; meaning: string };
