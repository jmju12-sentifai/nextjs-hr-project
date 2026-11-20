// 직무 성과책임 18레벨 기준표.
//
// 출처: 고객 제공 'HRCoach 성과책임·직무가치 통합운영가이드 v4.1'을 요약한
//   샘플 엑셀의 '18레벨_판정기준' 시트와 상세기획서 v1.0 4장.
// meansPattern 은 샘플 문장 500여 개에서 레벨마다 반복된 괄호 안 수단 표현을 일반화한 틀이다.
//   AI가 레벨마다 같은 크기의 판단·권한을 쓰도록 붙잡아 두는 역할을 하며,
//   ○○ 자리에 해당 성과영역의 성과대상을 넣어 쓴다.
// example 은 같은 성과영역(국내 렌즈 인허가 '품목분류·허가경로 판정')의 실제 샘플 문장이라
//   레벨이 올라갈 때 결과의 크기가 어떻게 달라지는지 한 줄로 비교할 수 있다.

export type LevelDef = {
  level: number;
  group: string; // 레벨군
  judgment: string; // 판단·권한 책임 크기
  state: string; // 대표 성과상태
  meansPattern: string;
  example?: string;
};

export const LEVELS: LevelDef[] = [
  { level: 1, group: "실무행정", judgment: "단일 지시작업 기한·형식 준수", state: "안내·입력 적시성",
    meansPattern: "승인된 ○○ 처리일정을 확인하여",
    example: "(승인된 제품특성·품목코드 처리일정을 확인하여) 분류검토 의뢰의 기한 준수율을 높인다." },
  { level: 2, group: "실무행정", judgment: "자기 담당자료 오류·누락 제거", state: "자료 정확성",
    meansPattern: "○○ 원문자료의 번호·판본·근거를 대조하여",
    example: "(제품특성·품목코드 원문자료의 품목번호·판본·근거를 대조하여) 품목·용도 기초정보의 오기입률을 낮춘다." },
  { level: 3, group: "실무행정", judgment: "기초자료 취합·완결된 산출물 제출", state: "제출자료 완결성",
    meansPattern: "○○ 근거와 관련 증빙을 빠짐없이 취합하여",
    example: "(제품별 제품특성·품목코드 근거와 관련 증빙을 빠짐없이 취합하여) 품목분류 근거자료의 완결성을 높인다." },
  { level: 4, group: "숙련운영", judgment: "규정·증빙에 맞는 산출물 보장", state: "규정·증빙 적합성",
    meansPattern: "현행 규정·기준·근거를 교차 확인하여",
    example: "(현행 규정·허가사항·기술근거를 교차 확인하여) 품목코드·등급·허가경로 판정의 기준 적합률을 높인다." },
  { level: 5, group: "숙련운영", judgment: "통상 예외 판단·해결", state: "운영 연속성",
    meansPattern: "일상적인 ○○ 예외사례를 분류·조정하여",
    example: "(일상적인 분류자료 누락 예외사례를 분류·조정하여) 정형적인 품목분류 문의의 적기 해결률을 높인다." },
  { level: 6, group: "숙련운영", judgment: "일정·품질 운영기준 준수 관리", state: "준수율 확보",
    meansPattern: "○○의 일정 및 품질기준을 점검하여",
    example: "(제품특성·품목코드의 제출·회신 일정 및 품질기준을 점검하여) 품목분류 검토 일정과 판정기준 준수율을 높인다." },
  { level: 7, group: "프로세스 개선", judgment: "절차·검증·보고 표준 정립", state: "절차 일관성",
    meansPattern: "○○의 작성·검토·승인·인계 절차를 표준화하여",
    example: "(제품특성·품목코드의 작성·검토·승인·인계 절차를 표준화하여) 제품군별 품목분류 판단의 일관성과 이력 추적률을 높인다." },
  { level: 8, group: "프로세스 개선", judgment: "오류·대기·재작업 원인 개선", state: "처리시간·재작업 감소",
    meansPattern: "반복되는 ○○의 누락·재작업 원인을 개선하여",
    example: "(반복되는 분류자료 누락의 누락·재작성 원인을 개선하여) 잘못된 허가경로 선택에 따른 재접수율을 낮춘다." },
  { level: 9, group: "프로세스 개선", judgment: "위험 사전 탐지·예방", state: "운영차질 사전 방지",
    meansPattern: "○○의 누락·변경·지연 조기 징후를 탐지하여",
    example: "(제품특성·품목코드의 근거누락·규정변경·승인지연 조기 징후를 탐지하여) 신규 착용방식·재료 변경으로 인한 허가경로 오판정 위험을 낮춘다." },
  { level: 10, group: "기획·제도 개선", judgment: "지표·원인분석 기반 방식 개편", state: "개선효과 창출",
    meansPattern: "○○ 실적과 원인을 분석하여",
    example: "(품목별 제품특성·품목코드 반려·보완 실적과 원인을 분석하여) 품목분류의 선행 확인률과 허가경로 판정 정확도를 높인다." },
  { level: 11, group: "기획·제도 개선", judgment: "부서간 판단차이 조정", state: "검토품질 일관성",
    meansPattern: "관련 부서 간 ○○ 판단차이를 조정하여",
    example: "(RA·R&D·QA·QC·영업의 제품특성·품목코드 판단차이를 조정하여) RA·개발·영업 간 허가대상 해석의 일치율을 높인다." },
  { level: 12, group: "기획·제도 개선", judgment: "판단기준·운영원칙 제도화", state: "일관된 제도운영",
    meansPattern: "○○의 판단·예외처리 기준을 제도화하여",
    example: "(제품특성·품목코드의 규제판정·예외처리 기준을 제도화하여) 품목분류·예외사례·경로선택 판단의 재현성을 높인다." },
  { level: 13, group: "기능혁신", judgment: "전문 방법론·실행체계 설계", state: "성과창출체계 확립",
    meansPattern: "○○의 전문 방법론·실행체계를 정교화하여",
    example: "(제품특성·품목코드의 증빙선정·위험분류·사례비교 전문체계를 정교화하여) 제품특성-등급-심사경로의 전문판별 정확도와 신규품목 착수율을 높인다." },
  { level: 14, group: "기능혁신", judgment: "복수 대안·자원 간 상충 조정", state: "기능성과 최적화",
    meansPattern: "○○의 대안·비용·일정 간 상충효과를 비교하여",
    example: "(제품특성·품목코드의 규제대안·검증비용·출시일정 간 상충효과를 비교하여) 분류 불확실성·개발일정·심사부담 간 선택의 합리성과 허가경로 적중률을 높인다." },
  { level: 15, group: "기능혁신", judgment: "기능 전체 구조·성과·위험 혁신", state: "구조적 성과 개선",
    meansPattern: "○○의 기능분장·정보흐름·승인경계를 재편하여",
    example: "(신제품 허가전략의 기능분장·정보흐름·승인경계를 재편하여) 신제품 포트폴리오의 허가전략·개발단계·자료투자 구조를 개선해 출시예측도와 허가 성공률을 구조적으로 높인다." },
  { level: 16, group: "본질목적 실현", judgment: "핵심 성과도구의 타당도·효과 개선", state: "성과기전 실효성",
    meansPattern: "○○에 대한 사전 판단결과를 실제 성과와 비교 검증하여",
    example: "(법령변경·허가포트폴리오에 대한 사전 판단결과를 실제 심사·규제 대응 실적과 비교 검증하여) 규제위험 조기경보·허가경로 추천의 예측 정확도와 유효성을 높인다." },
  { level: 17, group: "본질목적 실현", judgment: "복합 성과시스템 설계·고도화", state: "시스템 수준 최적화",
    meansPattern: "여러 ○○ 성과시스템을 통합 설계·고도화하여" },
  { level: 18, group: "본질목적 실현", judgment: "상충 조직목적 최종 통합조정", state: "본질적 성과 통합",
    meansPattern: "상충하는 조직목적 간 ○○ 우선순위를 최종 통합조정하여" },
];

export const MAX_LEVEL = 18;

export function levelDef(level: number): LevelDef | undefined {
  return LEVELS.find((l) => l.level === level);
}

// 화면과 엑셀이 같은 모양의 문장을 쓰도록 한곳에서 조립한다.
export function sentenceText(means: string, outcome: string): string {
  const m = means.trim();
  const o = outcome.trim();
  return m ? `(${m}) ${o}` : o;
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

export type LevelSentence = { level: number; means: string; outcome: string };
