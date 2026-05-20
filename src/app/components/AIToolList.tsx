"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Tool = {
  no: number;
  category: string;
  code: string;
  name: string;
  definition: string;
  oldTime: string;
  aiOutput: string;
  aiTime: string;
  note: string;
};

const TOOLS: Tool[] = [
  { no: 1, category: "직무", code: "A01", name: "직무분석/직무기술서 생성기", definition: "현업관리자/인사담당이 직무 업무유형 질문에 맞게 답변을 하고, 회사기준을 업로드하면 자동으로 직무분석 결과 및 직무 기술서를 생성함 (성과책임 및 역량모델, 직무평가 포함)", oldTime: "2박3일", aiOutput: "직무분석결과 및 직무기술서", aiTime: "12분", note: "" },
  { no: 2, category: "직무", code: "A02", name: "자동 직무/직급분류기", definition: "A01로 정립된 파일 중 동일직군으로 판단되는 파일을 업로드하면 각 직무를 비교하여 직무분류를 진행하고, 산점도와 클러스터링을 통해 등급 계층을 정립해 줌", oldTime: "8시간", aiOutput: "직무직급분류 파일", aiTime: "10분", note: "" },
  { no: 3, category: "채용", code: "B01", name: "지원자 이력서 정보 취합기", definition: "다양한 양식의 지원자들의 이력서를 업로드하면, 지원자 각종 정보(학력, 경력 등)를 동일 엑셀파일에 각 1줄씩 자동 생성해줌", oldTime: "인당 10분", aiOutput: "지원자 정보 종합파일 (CSV엑셀)", aiTime: "1분", note: "인기" },
  { no: 4, category: "채용", code: "B02", name: "지원자 직무적합도 ATS 레포트 생성기", definition: "직무 모집요강과 지원자 이력서를 업로드하면, 지원자 개인에 대한 직무 적합도 평가기준별 점수와 채용가부 의견 등 종합레포트를 자동 제공함", oldTime: "인당 10분", aiOutput: "직무적합도 ATS레포트", aiTime: "2분", note: "인기" },
  { no: 5, category: "채용", code: "B03", name: "지원자 처우 산정기", definition: "회사의 직급/연봉기준과 지원자 입사지원서를 업로드하면, 자동으로 지원자의 직급연한과 적용가능 연봉액을 계산해줌", oldTime: "건별 1시간", aiOutput: "지원자 경력연한 및 권장연봉 검토 레포트", aiTime: "3분", note: "인기" },
  { no: 6, category: "채용", code: "B04", name: "1차 서류전형 결과보고서 작성기", definition: "직무 모집요강과 지원자 이력서를 업로드하면, 지원자들에 대한 직무 적합도 비교레포트를 자동 정리해줌 (서류전형)", oldTime: "인당 10분", aiOutput: "지원자 서류전형 결과 보고서", aiTime: "3분", note: "" },
  { no: 7, category: "채용", code: "B05", name: "면접일정 조율기", definition: "지원자들에게서 받은 면접일정 구글설문 결과를 종합하여 일정을 확정 후, 각 지원자들에게 확정일정을 안내하는 안내문을 자동 생성", oldTime: "인당 5~20분", aiOutput: "문자 안내문 파일", aiTime: "1분", note: "" },
  { no: 8, category: "채용", code: "B06", name: "면접평가표 양식 작성기", definition: "직무 모집요강과 지원자 이력서를 업로드하면, 지원자 관련 경력을 요약·비교하고 확인해야 할 직무/경력관련 면접질문과 이슈/문제점을 자동 도출하여 정리해줌", oldTime: "인당 10분", aiOutput: "지원자별 면접평가표", aiTime: "3분", note: "" },
  { no: 9, category: "채용", code: "B07", name: "면접결과 종합레포트 작성기", definition: "최종 합불결정 전, 1/2차 면접관별 평가결과(스캔본)를 업로드하면, 의사결정권자에게 제공할 결과레포트를 자동 정리함", oldTime: "건별 20분", aiOutput: "채용건별 면접결과 레포트", aiTime: "3분", note: "" },
  { no: 10, category: "채용", code: "B08", name: "채용합격자 종합 안내문 작성기", definition: "지원자에게 안내할 종합정보(축하인사, 입사일자, 준비서류, 입사일 할일, 지원사항, 현업담당자 등)를 친화적인 안내 이미지로 자동 생성", oldTime: "10분 이상", aiOutput: "지원자 안내 자료(친화적 이미지)", aiTime: "2분", note: "" },
  { no: 11, category: "채용", code: "B09", name: "채용전형 합격자/불합격자 결과 통보기", definition: "채용전형 결과(지원자명, 합불, 메일주소) 파일을 업로드하면, 정해진 멘트에 따라 대상자에게 안내문을 메일로 자동 통보", oldTime: "15분", aiOutput: "자동 메일링", aiTime: "2분", note: "" },
  { no: 12, category: "채용", code: "B09", name: "고용브랜드 및 직무 제안서 (채용홍보물) 생성기", definition: "채용직무 정보 뿐 아니라 고용브랜드 및 직무/조직에 지원자에게 주는 제공가치를 자동 생성하고, 지원자 관점에서 어필 포인트를 제공", oldTime: "-", aiOutput: "지원자(경력개발)관점/EX 향상을 위한 제공 가치 안내자료", aiTime: "3분", note: "" },
  { no: 13, category: "채용", code: "B10", name: "입사 구비서류 점검/취합기", definition: "입사자 서류 스캔본을 업로드하면, 있어야 할 서류 중 빠진 부분을 확인·체크하고, 각 서류의 내용을 개인별 엑셀 한 줄 데이터로 취합 정리", oldTime: "30분", aiOutput: "입사시 개인정보 종합파일", aiTime: "3분", note: "" },
  { no: 14, category: "채용", code: "B11", name: "입사시 안내사항 메일 자동발송기", definition: "입사자 개인정보 및 입사자 지원부서 담당자 성명과 이메일주소 정보파일을 업로드하면, 조직장·동료·지원부서·IT부서 등에 안내할 메일을 자동 생성·발송", oldTime: "30분", aiOutput: "자동 메일링", aiTime: "5분", note: "" },
  { no: 15, category: "채용", code: "B12", name: "신규입사자 90일 온보딩 운영기", definition: "조직, 직무, 지원자 정보를 업로드하면 입사 첫날부터 90일까지 일정별 온보딩 미션(조직/직무 이해 및 작은 성공미션)을 정리하여 해당 조직에 제공", oldTime: "건당 40분", aiOutput: "일정별 온보딩 수행 지원자별 상세양식", aiTime: "3분", note: "" },
  { no: 16, category: "평가", code: "C01", name: "조직별 평가지표 정리 및 분석기", definition: "팀/본부 단위 구성원 평가표를 업로드하면, 조직단위 평가 맵을 정리하고 정렬 수준을 보여주는 레포트를 제공", oldTime: "1시간", aiOutput: "조직별 평가지표 현황", aiTime: "3분", note: "" },
  { no: 17, category: "평가", code: "C02", name: "조직별 평가결과 현황표 도출기", definition: "본부단위 구성원 평가표를 업로드하면, 평가등급 배분 전체 현황과 직급별·팀별·직무별 분포도 수준에 대한 레포트를 제공", oldTime: "3시간", aiOutput: "조직별 평가레포트", aiTime: "5분", note: "" },
  { no: 18, category: "평가", code: "C03", name: "리더십 다면평가 결과 개인별 레포트 작성기", definition: "리더 다면평가 결과에 대해 리더십 항목별 점수현황, 빈도분석 결과, 강약점 분석이 포함된 개인별 피드백 레포트를 제공", oldTime: "30분", aiOutput: "리더 개인별 다면평가 피드백 레포트", aiTime: "3분", note: "" },
  { no: 19, category: "평가", code: "C04", name: "리더십 다면평가 결과 전체 레포트 작성기", definition: "리더 다면평가 결과를 바탕으로 전체 조직 리더의 유형별, 조직별, 직책별, 구성항목별 특성을 분석하여 전체 피드백 레포트를 제공", oldTime: "2시간", aiOutput: "전체 다면평가 피드백 레포트", aiTime: "5분", note: "" },
  { no: 20, category: "평가", code: "C05", name: "개인별 평가지표 SMART 체크리스트 분석기", definition: "구성원 개인의 평가표를 업로드하면, SMART 관점에서 지표별 적정 여부와 대체 가능한 정량 평가지표 Pool을 분석하는 레포트를 제공", oldTime: "20분", aiOutput: "개인별 평가지표 분석 레포트", aiTime: "3분", note: "" },
  { no: 21, category: "평가", code: "C06", name: "개인별 다면평가를 위한 상호 평가자 매칭기", definition: "360도 다면평가를 위한 평가자 교차 설정 시, 조직 또는 직책별 인원데이터를 업로드하면 상호 교차 평가자를 자동으로 설정", oldTime: "10시간", aiOutput: "다면평가 매칭 데이터", aiTime: "5분", note: "" },
  { no: 22, category: "평가", code: "C07", name: "평가 이의신청 요약기", definition: "평가 이의신청서를 업로드하면, 신청사유·등급조정 주장 근거·평가자 의견 등을 대상자별로 엑셀 1줄 요약 자료로 정리", oldTime: "건별 20분", aiOutput: "이의신청 요약자료", aiTime: "3분", note: "" },
  { no: 23, category: "평가", code: "C08", name: "역량모델링-역량평가 항목 도출기", definition: "직무정보(A01)와 대상 직무명 파일을 업로드하면, 직무 역량모델 항목과 역량평가를 위한 평가항목을 도출하여 제공", oldTime: "2시간", aiOutput: "역량평가 항목 선정안", aiTime: "4분", note: "" },
  { no: 24, category: "인력운영", code: "D01", name: "월별 인원현황 대시보드 추출기", definition: "회사 전체인원 리스트 파일을 업로드하면, 조직별·성별·직급별·직책별 등 각종 통계/현황분석 보고서를 작성해줌", oldTime: "5시간", aiOutput: "전사 인원 대시보드 (파워포인트)", aiTime: "5분", note: "인기" },
  { no: 25, category: "인력운영", code: "D02", name: "승진심의대상자 추출기", definition: "승진심의기준과 전사 인원현황 리스트를 업로드하면, 자동으로 이번 회차 승진심의 대상자를 리스트업", oldTime: "1시간", aiOutput: "승진심의 대상자 리스트", aiTime: "3분", note: "" },
  { no: 26, category: "인력운영", code: "D03", name: "적정인원/인건비 계산기", definition: "전년 및 금년 특정조직 인원/직무/연봉 리스트와 핵심성과 데이터를 업로드하면, 인당 생산성 관점에서 인력증가율 적정성을 판단하는 자료를 제공", oldTime: "3시간", aiOutput: "적정인원 검토자료", aiTime: "5분", note: "" },
  { no: 27, category: "인력운영", code: "D04", name: "개편에 따른 일괄발령 생성기", definition: "현재 인원현황 자료와 개편발령 자료를 업로드하면, 현재와 발령 후 인사명령 정리자료를 제공", oldTime: "1시간", aiOutput: "인사발령 공문자료", aiTime: "3분", note: "" },
  { no: 28, category: "인력운영", code: "D05", name: "인사위원회 양형 검토레포트 작성기", definition: "취업규칙, 인사규정과 임직원 규정 저촉사항을 업로드하면, 어떤 규정을 적용해 어떤 양형으로 판단되는지 요약 레포트를 제공", oldTime: "20분", aiOutput: "양형 검토 레포트", aiTime: "3분", note: "" },
  { no: 29, category: "인력운영", code: "D06", name: "퇴직 인수인계/점검 양식 자동 생성기", definition: "인적정보를 입력하거나 업로드하면, 각 조직·직무에 맞는 인수인계서 및 퇴직 시 진행해야 할 일들에 대한 점검 양식을 생성", oldTime: "20분", aiOutput: "퇴직 인수인계/점검 양식", aiTime: "3분", note: "" },
  { no: 30, category: "인력운영", code: "D07", name: "발령장/사령장/표창장 등 자동 작성기", definition: "각종 표창장, 사령장 등에 들어갈 포맷과 인적 정보를 업로드하면, 양식 전체가 반영된 장표를 자동 생성", oldTime: "1시간", aiOutput: "양식 반영 장표", aiTime: "3분", note: "" },
  { no: 31, category: "인력운영", code: "D08", name: "개인별 CDP 설계서 작성기", definition: "개인의 현재 직무와 장래 희망 분야 등을 기재한 파일을 업로드하면, 직무 빅데이터를 통해 향후 개발 가능한 방향·직무·교육정보 등을 정립해 제공", oldTime: "30분", aiOutput: "CDP 설계서", aiTime: "4분", note: "" },
  { no: 32, category: "인력운영", code: "D09", name: "지각/결근자 현황 자동 리포팅", definition: "출퇴근 기록기 데이터를 업로드하면, 당일 중 대상자에게 확인 메일을 당사자와 상위자 메일로 자동 요약 전송", oldTime: "30분", aiOutput: "자동 메일링", aiTime: "3분", note: "" },
  { no: 33, category: "인력운영", code: "D10", name: "초과근무 위험 알리미", definition: "근태데이터를 업로드하면, 주52시간 도달률 85%를 넘긴 직원과 해당 부서장에게 초과근무 위험 알림을 자동 전송", oldTime: "30분", aiOutput: "자동 메일링", aiTime: "3분", note: "" },
  { no: 34, category: "인력운영", code: "D11", name: "연차사용촉진 운영기", definition: "인원 근태데이터를 업로드하면, 연차사용 마감일을 역산하여 적용 대상자와 시기별로 진행할 일, 관련자에 송부할 메일내용을 자동 정리", oldTime: "3시간", aiOutput: "운영파일", aiTime: "5분", note: "" },
  { no: 35, category: "보상/복지", code: "E01", name: "임원 계약갱신 양식 작성기", definition: "임원 보상규정과 항목별 기준 및 개인정보를 업로드하면 각 항목별 금액을 적용하고, 기준에 맞는 옵션을 선택한 갱신 계약서를 제공", oldTime: "30분", aiOutput: "임원 계약서", aiTime: "3분", note: "" },
  { no: 36, category: "보상/복지", code: "E02", name: "연차 개수 및 연차보상금 환산기", definition: "개인정보를 입력하거나 업로드하면, 기준일 발생 연차 개수·실제 사용 개수·남은 연차에 대한 보상액 수준을 계산하여 제공", oldTime: "20분", aiOutput: "연차보상금액", aiTime: "3분", note: "" },
  { no: 37, category: "보상/복지", code: "E03", name: "퇴직금 계산기", definition: "개인정보를 입력하거나 업로드하면, 기준일 3개월 평균임금과 총 근무일 수를 기반으로 퇴직금 총액을 계산하여 제공", oldTime: "20분", aiOutput: "퇴직금 총액", aiTime: "3분", note: "" },
  { no: 38, category: "보상/복지", code: "E04", name: "직무급 계산기2", definition: "직군 인적데이터를 업로드하면, 국내 연봉수준 데이터(RAG)를 통해 비교치를 확인하고 보상정책(업계리드, 평균, 90%, 75%, 50%) 방안 자료를 제공", oldTime: "36시간", aiOutput: "보상정책안", aiTime: "5분", note: "" },
  { no: 39, category: "보상/복지", code: "E05", name: "직무급 계산기3", definition: "해당 직군의 최저·최고 임금수준과 직급 체류년수, 직급간 겹침구간율 등의 수치를 입력하면 직급별 연봉밴드를 자동 계산", oldTime: "4시간", aiOutput: "직무급 밴드", aiTime: "10분", note: "" },
  { no: 40, category: "보상/복지", code: "E06", name: "조직 구성원 보상수준 현황표 작성기", definition: "조직단위 구성원의 연봉·직무평가값이 포함된 파일을 업로드하면, 직무가치 대비 연봉 적정성을 그래프로 제공", oldTime: "2시간", aiOutput: "직무-연봉 배치 그래프", aiTime: "4분", note: "" },
  { no: 41, category: "보상/복지", code: "E07", name: "직무수당/자격수당 수급자격 판단기", definition: "직무수당 및 자격수당 기준과 대상자 정보를 업로드하면 수급대상 여부를 판단하여 적정성을 제시", oldTime: "20분", aiOutput: "적정성 판단 결과", aiTime: "3분", note: "" },
  { no: 42, category: "보상/복지", code: "E08", name: "경조사 복지지급 적정성 점검기", definition: "회사 복지기준자료와 직원이 제출한 영수증 및 신청서를 업로드하면, 기준에 맞는 지급 건인지 여부와 보완할 사항을 점검", oldTime: "20분", aiOutput: "적정성 판단 결과", aiTime: "3분", note: "" },
  { no: 43, category: "보상/복지", code: "E09", name: "세금산출 기준내역 정리기", definition: "개인별 정보 및 회사기준 파일을 업로드하면, 세금 금액 산출근거 및 공제내역에 대한 개인별 상세 기준내역 자료를 정리", oldTime: "15분", aiOutput: "기준내역 자료", aiTime: "3분", note: "" },
  { no: 44, category: "교육", code: "F01", name: "교육니즈 조사 분석기", definition: "교육니즈 설문 및 관련직무 인터뷰 파일을 업로드하면, 교육목표에 따른 조직/직무 니즈를 종합한 개발니즈 분석자료를 제공", oldTime: "1시간", aiOutput: "교육 니즈 분석 자료", aiTime: "4분", note: "" },
  { no: 45, category: "교육", code: "F02", name: "교육과정 기초설계 도우미", definition: "학습목표를 설정하고 교육대상과 니즈 정보를 업로드하면, 이에 맞는 교육컨텐츠 검색, 교과목 설정, 교수법, 교안 방향, 평가계획 초안을 정립", oldTime: "10시간", aiOutput: "교육과정안 초안", aiTime: "5분", note: "" },
  { no: 46, category: "교육", code: "F03", name: "교육입소 및 운영안내 도우미", definition: "교육대상, 교육일정 및 안내사항을 업로드하면, 교육 입과대상에 교육안내·입소/퇴실 안내 등 시기별·대상자별 안내문을 생성", oldTime: "1시간", aiOutput: "교육안내 자료", aiTime: "3분", note: "" },
  { no: 47, category: "교육", code: "F04", name: "교육형성평가 문항 추출기", definition: "교육목표와 교안 및 교육자료를 업로드하면, 학습 형성도를 측정하기 위한 문항을 추출해 문제은행을 제공", oldTime: "3시간", aiOutput: "문제은행", aiTime: "3분", note: "" },
  { no: 48, category: "교육", code: "F05", name: "교육만족도 평가항목 및 설문문항 개발 도우미", definition: "각 과정 정보를 업로드하면, 과정에 맞는 내용·강사 만족도·시설/운영 서비스 만족도 등을 위한 설문자료를 제공", oldTime: "20분", aiOutput: "설문자료", aiTime: "3분", note: "" },
  { no: 49, category: "교육", code: "F06", name: "법정교육 미수료자 독촉기", definition: "교육수료 현황파일을 업로드하면, 과정명·일정·기준에 맞춰 개인별 수강 독촉 메일을 자동 발송", oldTime: "20분", aiOutput: "자동 메일링", aiTime: "3분", note: "" },
  { no: 50, category: "조직문화", code: "G01", name: "조직진단 결과 전체 레포트 작성기", definition: "조직진단 결과를 바탕으로 전체 조직 리더의 유형별, 조직별, 직책별, 구성항목별 특성을 분석하여 피드백 레포트를 제공", oldTime: "2시간", aiOutput: "조직진단 결과 레포트", aiTime: "5분", note: "" },
  { no: 51, category: "조직문화", code: "G02", name: "조직진단 결과 - 인사제도 매칭 검토기", definition: "조직진단 결과(G01)와 인사규정/제도집 파일을 업로드하면, 진단 결과와 현재 인사제도 간 갭과 조정 필요사항을 체크하여 개선 반영안을 제공", oldTime: "2시간", aiOutput: "조직진단 결과 인사제도 개선 반영안", aiTime: "4분", note: "" },
  { no: 52, category: "조직문화", code: "G03", name: "조직진단 주관식 결과 유형분류기", definition: "조직문화 진단 주관식 결과에 대해 카테고리 분류기준 및 응답 엑셀파일을 업로드하면, 주관식 응답을 카테고리별로 분류하고 빈도분석까지 정리", oldTime: "3시간~", aiOutput: "주관식 유형화 자료", aiTime: "4분", note: "" },
  { no: 53, category: "조직문화", code: "G04", name: "조직진단 워드 클라우드 분석기", definition: "조직진단 객관식 문항과 주관식 내용의 키워드를 분석하여 조직문화 핵심 키워드를 중심으로 워드 클라우드 이미지를 제공", oldTime: "3시간", aiOutput: "워드 클라우드 이미지", aiTime: "4분", note: "" },
  { no: 54, category: "조직문화", code: "G05", name: "핵심가치 추출기", definition: "회사 연혁, 신년사 자료, 기사, 진단자료 등을 업로드하면 공통적인 회사의 가치와 비전화된 미래 전략을 도출하여 핵심가치 기초자료를 제공", oldTime: "2시간", aiOutput: "핵심가치 근거자료", aiTime: "3분", note: "" },
  { no: 55, category: "기타", code: "H01", name: "보고서/자료 요약기", definition: "각종 보고서나 참고자료에 대해 1. 작성자/일시, 2. 목적/취지, 3. 주요 내용, 4. 인사관점 착안사항의 순으로 핵심내용을 정리해줌", oldTime: "20분", aiOutput: "보고서/자료 요약파일", aiTime: "1분", note: "인기" },
  { no: 56, category: "기타", code: "H02", name: "우리회사 취업규칙/인사규정 챗봇", definition: "회사의 취업규칙과 인사규정을 업로드한 후 다양한 질문을 하면 이에 대해 바로 응답해 주는 전용 챗봇을 생성", oldTime: "-", aiOutput: "실시간 챗봇", aiTime: "1분", note: "" },
  { no: 57, category: "기타", code: "H03", name: "회의 녹취록 요약기", definition: "회의 녹음파일을 업로드하면, 핵심내용·중요 결정사항·다음 미팅 일정에 대한 요약사항을 정리해 제공", oldTime: "30분~5시간", aiOutput: "녹취록 요약자료", aiTime: "3분", note: "" },
  { no: 58, category: "기타", code: "H04", name: "설문조사결과 레포트 작성기", definition: "각종 설문조사 결과(엑셀 Raw데이터 또는 설문결과 URL)를 입력하면, 각 항목별 점수·요소별 점수·주관식 요약을 정리한 요약 레포트를 제공", oldTime: "1시간", aiOutput: "설문조사결과 요약집", aiTime: "3분", note: "" },
  { no: 59, category: "기타", code: "H05", name: "규정개선 모니터", definition: "회사의 취업규칙, 인사규정 등 내부기준을 업로드하면, 업데이트된 노동법·근로기준법 등에 합당한지를 검토하고 조정의견을 제공", oldTime: "2시간", aiOutput: "규정 개선 검토결과", aiTime: "3분", note: "" },
  { no: 60, category: "기타", code: "H06", name: "조직도 업데이터", definition: "조직개편 발령자료와 현 조직도 자료를 업로드하면, 개편된 조직도를 자동으로 생성하여 제공", oldTime: "10분~30분", aiOutput: "개편 조직도", aiTime: "4분", note: "" },
  { no: 61, category: "기타", code: "H07", name: "신규입사자 안내영상 제작기", definition: "신규입사자에게 안내해야 할 가이드를 기재한 문서를 업로드하면, 그 내용을 바탕으로 안내 영상을 자동 제작", oldTime: "3시간", aiOutput: "안내 동영상", aiTime: "10분", note: "" },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  "직무": { bg: "bg-blue-50", text: "text-blue-600" },
  "채용": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "평가": { bg: "bg-violet-50", text: "text-violet-600" },
  "인력운영": { bg: "bg-orange-50", text: "text-orange-600" },
  "보상/복지": { bg: "bg-sky-50", text: "text-sky-600" },
  "교육": { bg: "bg-teal-50", text: "text-teal-600" },
  "조직문화": { bg: "bg-rose-50", text: "text-rose-500" },
  "기타": { bg: "bg-gray-100", text: "text-gray-500" },
};

function parseAiTimeToMinutes(time: string): number {
  if (!time || time === "-") return Number.POSITIVE_INFINITY;
  const numeric = parseInt(time.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(numeric)) return Number.POSITIVE_INFINITY;
  if (time.includes("분")) return numeric;
  if (time.includes("시간")) return numeric * 60;
  if (time.includes("박") || time.includes("일")) return numeric * 24 * 60;
  return Number.POSITIVE_INFINITY;
}

type DifyTool = "report-summary";
type Activation = { kind: "dify"; tool: DifyTool } | { kind: "ats" } | { kind: "eval" };

const DIFY_CONFIG: Record<DifyTool, { title: string; src: string; helper: string }> = {
  "report-summary": {
    title: "보고서/자료 요약기",
    src: "https://udify.app/workflow/wiiyddzOMb3Wq8QA",
    helper: "요약할 보고서/자료 파일을 업로드한 후 실행을 눌러 주세요.",
  },
};

const TOOL_ACTIVATION: Record<number, Activation> = {
  1: { kind: "dify", tool: "report-summary" },
  4: { kind: "ats" },
  17: { kind: "eval" },
};

const NEW_BADGE_TOOLS = new Set([4, 17]);

export default function AIToolList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<"default" | "name" | "aiTime">("default");
  const [activeDify, setActiveDify] = useState<DifyTool | null>(null);

  useEffect(() => {
    console.log("[AIToolList] activeDify =", activeDify);
  }, [activeDify]);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      console.log("[AIToolList] pageshow persisted=", e.persisted);
      if (e.persisted) {
        window.location.reload();
      }
    };
    const handlePopState = (e: PopStateEvent) => {
      console.log("[AIToolList] popstate, pathname=", window.location.pathname, e);
      if (window.location.pathname === "/") {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let result = TOOLS.filter((t) =>
      !term
        ? true
        : t.name.toLowerCase().includes(term) ||
          t.definition.toLowerCase().includes(term)
    );
    if (sortKey === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
    } else if (sortKey === "aiTime") {
      result = [...result].sort(
        (a, b) => parseAiTimeToMinutes(a.aiTime) - parseAiTimeToMinutes(b.aiTime)
      );
    }
    return result;
  }, [searchTerm, sortKey]);

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-4">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          전체 AI 도구 리스트{" "}
          <span className="text-gray-500">- 인사 전 영역의</span>{" "}
          <span className="text-blue-700">61개 AIA 엔진</span>
          <span className="text-gray-500">을 한눈에</span>
        </h2>
        <p className="text-sm text-gray-500">
          직무·채용·평가·인력운영·보상·교육·조직문화 등 모든 인사업무를
          자동화하는 AI 도구 라인업입니다.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="도구명 또는 설명으로 검색"
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-gray-500">정렬</span>
            <select
              value={sortKey}
              onChange={(e) =>
                setSortKey(e.target.value as "default" | "name" | "aiTime")
              }
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="default">기본 순서</option>
              <option value="name">이름 (가나다순)</option>
              <option value="aiTime">AI 소요시간</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50 text-[11px] font-bold uppercase tracking-wider text-gray-900">
                <th className="whitespace-nowrap px-3 py-3 text-center">No.</th>
                <th className="whitespace-nowrap px-2 py-3 text-center">비고</th>
                <th className="whitespace-nowrap px-3 py-3 text-left">인사영역</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">AI 앱 상품명</th>
                <th className="whitespace-nowrap px-3 py-3 text-center">기존 시간</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">AI 산출물</th>
                <th className="whitespace-nowrap px-3 py-3 text-center">AI 시간</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">기능 정의</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tool, idx) => {
                const cat = CATEGORY_STYLES[tool.category] ?? CATEGORY_STYLES["기타"];
                return (
                  <tr
                    key={`${tool.code}-${idx}`}
                    className="group border-b border-gray-100 last:border-b-0 transition hover:bg-blue-50/30"
                  >
                    <td className="px-3 py-3 text-center text-xs font-semibold text-gray-400">
                      {tool.no}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {tool.note === "인기" && (
                        <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          HOT
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${cat.bg} ${cat.text}`}
                      >
                        {tool.category}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold">
                      {TOOL_ACTIVATION[tool.no] ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const act = TOOL_ACTIVATION[tool.no];
                            console.log("[AIToolList] CLICK fired no=", tool.no, "act=", act);
                            if (act.kind === "dify") {
                              setActiveDify(act.tool);
                            } else if (act.kind === "ats") {
                              router.push("/tools/ats");
                            } else if (act.kind === "eval") {
                              router.push("/tools/eval");
                            }
                          }}
                          className="inline-flex cursor-pointer items-center gap-2 text-blue-600 hover:underline"
                        >
                          {tool.name}
                          {NEW_BADGE_TOOLS.has(tool.no) && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                              NEW
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-900 transition-colors group-hover:text-blue-600">
                          {tool.name}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center text-xs font-medium text-gray-400">
                      {tool.oldTime}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-700">
                      {tool.aiOutput}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center">
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                        {tool.aiTime}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {tool.definition}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
        위 리스트는 현재 제공 중이거나 곧 업데이트 예정인 핵심 인사 도구들입니다.
        <br />
        K Prime HR은 이외에도 조직 관리, 성과 평가, 보상 체계 등 100개 이상의 AIA를 개발하고 있습니다.
      </p>

      {activeDify && (
        <div className="fixed bottom-6 right-6 z-[200] flex w-[95vw] max-w-[1100px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-blue-600 p-4 text-white">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-base font-bold">{DIFY_CONFIG[activeDify].title}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveDify(null)}
              className="rounded-lg p-1 transition-colors hover:bg-white/10"
              aria-label="닫기"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="h-[700px] w-full overflow-hidden bg-white">
            <iframe
              src={DIFY_CONFIG[activeDify].src}
              className="h-full w-full border-0"
              title={DIFY_CONFIG[activeDify].title}
              allow="microphone"
            />
          </div>
          <div className="border-t border-blue-100 bg-blue-50 p-4">
            <p className="text-center text-sm font-bold leading-relaxed text-blue-900">
              {DIFY_CONFIG[activeDify].helper}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
