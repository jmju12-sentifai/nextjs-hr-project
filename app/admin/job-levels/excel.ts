// 18레벨 표 엑셀 내보내기 (브라우저에서 생성).
//
// 고객 샘플의 첫 시트('국내렌즈RA_18레벨_성과책임')와 같은 배치를 따른다:
//   1~3행 제목·요약·주의문, 4행 머리글, 그 아래 L18→L1. 상한을 넘는 칸은 비워 둔다.
// exceljs 는 1MB가 넘어 처음 화면 번들에 넣지 않고, 내려받기를 누를 때만 불러온다.
// 서식은 문서 규칙대로 검은 글씨와 회색 음영만 쓴다.

import { LEVELS, sentenceText, type JobArea, type LevelSentence } from "@/lib/job-levels/levels";
import { mockScore, scoreLabel } from "@/lib/job-levels/score";

export type ExportData = {
  jobName: string;
  industry: string;
  kraText: string;
  areas: JobArea[];
  sentences: Record<string, LevelSentence[]>;
};

const FONT = { name: "맑은 고딕", size: 10 };
const BORDER = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const GRAY = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF2F2F2" } };

// 엑셀은 줄바꿈된 셀의 행 높이를 열 때 다시 계산하지 않으므로 글자 수로 어림해 넣는다.
// 한글은 열 너비 1당 약 0.5자라 너비 40 칸에 20자 안팎이 한 줄에 들어간다.
function rowHeight(texts: string[], colWidth: number): number {
  const perLine = Math.max(8, Math.floor(colWidth / 1.9));
  const lines = Math.max(1, ...texts.map((t) => Math.ceil((t || "").length / perLine)));
  return Math.max(30, lines * 14 + 8);
}

function safeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "_").trim() || "직무";
}

export async function downloadLevelTable(d: ExportData) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "HRcoach";

  const areas = d.areas;
  const AREA_W = 40;
  const lastCol = 3 + areas.length;
  const count = areas.reduce(
    (n, a) => n + (d.sentences[a.id] || []).filter((s) => s.level <= a.ceiling).length,
    0,
  );
  const maxCeiling = Math.max(...areas.map((a) => a.ceiling));
  const minCeiling = Math.min(...areas.map((a) => a.ceiling));

  // ── 시트 1: 18레벨 성과책임 ──
  const ws = wb.addWorksheet("18레벨_성과책임", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 5 }],
  });
  ws.columns = [
    { width: 14 }, { width: 24 }, { width: 5 },
    ...areas.map(() => ({ width: AREA_W })),
  ];

  const banner = (row: number, text: string, bold = false, size = 10) => {
    ws.mergeCells(row, 1, row, lastCol);
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = { ...FONT, size, bold };
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  };
  banner(1, `${d.jobName} | 18레벨 성과책임·모의 직무가치`, true, 13);
  banner(
    2,
    `${d.industry ? `${d.industry} • ` : ""}${areas.length}개 성과영역 / ${count}개 레벨별 문장 • (수단) 성과상태 (모의 점수)`,
  );
  banner(
    3,
    `상한 L${minCeiling === maxCeiling ? maxCeiling : `${minCeiling}~L${maxCeiling}`}, 상한을 넘는 레벨은 공란 / 점수는 O*NET 실측값이 아닌 레벨별 기준값을 적용한 모의평가이며 문장을 고쳐도 바뀌지 않습니다.`,
  );
  ws.getRow(1).height = 24;
  ws.getRow(3).height = 30;

  const head = ws.getRow(4);
  ["책임 레벨군", "판단·권한 책임 크기", "L", ...areas.map((a) => a.name)].forEach((t, i) => {
    const c = head.getCell(i + 1);
    c.value = t;
    c.font = { ...FONT, bold: true };
    c.fill = GRAY;
    c.border = BOX;
    c.alignment = { vertical: "middle", horizontal: i === 2 ? "center" : "left", wrapText: true };
  });
  head.height = 32;

  const onetRow = ws.getRow(5);
  ws.mergeCells(5, 1, 5, 3);
  onetRow.getCell(1).value = "O*NET 참고 직업 (점수 미반영)";
  areas.forEach((a, i) => {
    onetRow.getCell(4 + i).value = a.onet ? `${a.onet.code} ${a.onet.title}` : "";
  });
  for (let col = 1; col <= lastCol; col++) {
    const c = onetRow.getCell(col);
    c.font = { ...FONT, size: 9, color: { argb: "FF595959" } };
    c.fill = GRAY;
    c.border = BOX;
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }
  onetRow.height = 28;

  [...LEVELS].reverse().forEach((lv, idx) => {
    const row = ws.getRow(6 + idx);
    const texts: string[] = [];
    row.getCell(1).value = lv.group;
    row.getCell(2).value = lv.judgment;
    row.getCell(3).value = lv.level;
    areas.forEach((a, i) => {
      const s = lv.level <= a.ceiling ? (d.sentences[a.id] || []).find((x) => x.level === lv.level) : undefined;
      const text = s ? `${sentenceText(s.means, s.outcome)} ${scoreLabel(lv.level)}` : "";
      row.getCell(4 + i).value = text;
      texts.push(text);
    });
    for (let col = 1; col <= lastCol; col++) {
      const c = row.getCell(col);
      c.font = col <= 3 ? { ...FONT, bold: col === 3 } : FONT;
      c.border = BOX;
      if (col <= 3) c.fill = GRAY;
      c.alignment = { vertical: "top", horizontal: col === 3 ? "center" : "left", wrapText: true };
    }
    row.height = rowHeight(texts, AREA_W);
  });

  // ── 시트 2: 성과영역 ──
  const wa = wb.addWorksheet("성과영역");
  wa.columns = [
    { header: "번호", width: 6 },
    { header: "성과영역", width: 26 },
    { header: "핵심 성과대상·최종 결과", width: 48 },
    { header: "상한", width: 7 },
    { header: "상한 근거", width: 48 },
    { header: "O*NET 참고 직업", width: 36 },
    { header: "상한 레벨 모의점수", width: 12 },
  ];
  areas.forEach((a, i) =>
    wa.addRow([
      i + 1,
      a.name,
      a.target,
      `L${a.ceiling}`,
      a.ceilingReason || "",
      a.onet ? `${a.onet.code} ${a.onet.title}` : "",
      mockScore(a.ceiling).V,
    ]),
  );
  wa.eachRow((row, n) => {
    row.eachCell((c) => {
      c.font = { ...FONT, bold: n === 1 };
      c.border = BOX;
      if (n === 1) c.fill = GRAY;
      c.alignment = { vertical: "top", wrapText: true };
    });
  });

  // ── 시트 3: 입력 원문 (사용자가 넣은 그대로 보존) ──
  const wi = wb.addWorksheet("입력_원문");
  wi.columns = [{ width: 16 }, { width: 90 }];
  [["직무명", d.jobName], ["산업·회사 특성", d.industry], ["KRA·주요 업무", d.kraText]].forEach(([k, v]) => {
    const row = wi.addRow([k, v]);
    row.getCell(1).font = { ...FONT, bold: true };
    row.getCell(1).fill = GRAY;
    row.getCell(2).font = FONT;
    row.eachCell((c) => {
      c.border = BOX;
      c.alignment = { vertical: "top", wrapText: true };
    });
    row.height = rowHeight([String(v || "")], 180);
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(d.jobName)}_18레벨_성과책임.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
