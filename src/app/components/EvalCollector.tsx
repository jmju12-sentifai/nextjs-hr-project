"use client";

import { useEffect, useRef, useState } from "react";

const WEBHOOK_URL = "https://aihrteam.app.n8n.cloud/webhook/eval-process";

const DEFS: Record<number, [string, string][]> = {
  4: [["S", "10"], ["A", "25"], ["B", "40"], ["C", "25"]],
  5: [["S", "10"], ["A", "20"], ["B", "40"], ["C", "20"], ["D", "10"]],
  6: [["S", "5"], ["A", "15"], ["B", "30"], ["C", "30"], ["D", "15"], ["E", "5"]],
};

const EXTS = ["xlsx", "xls", "docx", "doc", "pdf"];

interface GradeRow {
  name: string;
  pct: string;
}

interface EvalCollectorProps {
  onBack: () => void;
}

const css = `
  .ec-wrap{font-family:'Noto Sans KR',sans-serif;background:#F9FAFB;color:#1F2937;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:100px 16px 32px}
  .ec-card{background:#FFF;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.06);border:1px solid #F3F4F6;width:100%;max-width:680px;overflow:hidden}
  .ec-hd{background:#2563EB;color:#FFF;padding:28px 32px}
  .ec-hd h1{font-size:22px;font-weight:700}.ec-hd p{font-size:13px;opacity:.8;margin-top:4px}
  .ec-bd{padding:28px 32px}
  .ec-fg{margin-bottom:22px}
  .ec-fg>label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
  .ec-req{color:#DC2626;margin-left:2px}
  .ec-input{width:100%;padding:10px 14px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:14px;font-family:inherit;transition:border-color .2s;outline:none;box-sizing:border-box}
  .ec-input:focus{border-color:#3B82F6}
  .ec-hint{font-size:11px;color:#6B7280;margin-top:4px}
  .ec-gc-wrap{display:flex;gap:8px;margin-bottom:12px}
  .ec-gc-btn{padding:6px 14px;border:1.5px solid #D1D5DB;border-radius:6px;background:#FFF;font-size:12px;cursor:pointer;font-family:inherit;transition:all .2s}
  .ec-gc-btn:hover{border-color:#3B82F6;color:#3B82F6}
  .ec-gc-btn.active{background:#2563EB;color:#FFF;border-color:#2563EB}
  .ec-gt{width:100%;border-collapse:collapse;margin-bottom:6px}
  .ec-gt th{background:#F3F4F6;padding:8px 12px;font-size:12px;font-weight:600;color:#6B7280;text-align:center;border-bottom:2px solid #D1D5DB}
  .ec-gt td{padding:6px 8px;border-bottom:1px solid #F3F4F6}
  .ec-gi{width:100%;padding:8px 10px;border:1.5px solid #D1D5DB;border-radius:6px;font-size:14px;text-align:center;font-family:inherit;outline:none;box-sizing:border-box}
  .ec-gi:focus{border-color:#3B82F6}
  .ec-gs{font-size:13px;font-weight:600;text-align:right;padding:4px 0}
  .ec-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
  .ec-tc{border:2px solid #D1D5DB;border-radius:12px;padding:16px;cursor:pointer;transition:all .2s;text-align:center}
  .ec-tc:hover{border-color:#3B82F6;background:#EFF6FF}
  .ec-tc.selected{border-color:#2563EB;background:#EFF6FF;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
  .ec-tc-icon{font-size:32px;margin-bottom:8px}
  .ec-tc-title{font-size:14px;font-weight:600;color:#1F2937}
  .ec-tc-desc{font-size:11px;color:#6B7280;margin-top:4px;line-height:1.5}
  .ec-uinfo{font-size:12px;color:#6B7280;margin-bottom:10px;line-height:1.6;background:#F3F4F6;padding:10px 14px;border-radius:8px}
  .ec-drop{border:2px dashed #D1D5DB;border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:all .2s}
  .ec-drop:hover,.ec-drop.over{border-color:#3B82F6;background:#EFF6FF}
  .ec-drop-icon{font-size:28px;margin-bottom:6px}
  .ec-drop-txt{font-size:13px;color:#6B7280}
  .ec-flist{margin-top:8px}
  .ec-fitem{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#F3F4F6;border-radius:6px;margin-top:4px;font-size:12px}
  .ec-rm{color:#DC2626;cursor:pointer;font-weight:700;padding:2px 6px;background:none;border:none;font-size:12px;line-height:1}
  .ec-submit{width:100%;padding:14px;background:#2563EB;color:#FFF;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .2s;margin-top:8px}
  .ec-submit:hover{opacity:.9}.ec-submit:disabled{opacity:.5;cursor:not-allowed}
  .ec-spinner{width:48px;height:48px;border:4px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:ec-spin 1s linear infinite}
  @keyframes ec-spin{to{transform:rotate(360deg)}}
  .ec-back-btn{position:fixed;top:24px;left:24px;z-index:50;padding:8px 16px;background:#FFF;color:#2563EB;border:1px solid #DBEAFE;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:all .2s}
  .ec-back-btn:hover{background:#EFF6FF;color:#2563EB;border-color:#2563EB}
`;

export default function EvalCollector({ onBack }: EvalCollectorProps) {
  const [orgName, setOrgName] = useState("");
  const [gc, setGc] = useState(5);
  const [grades, setGrades] = useState<GradeRow[]>(
    DEFS[5].map(([n, p]) => ({ name: n, pct: p }))
  );
  const [sType, setSType] = useState<"summary" | "individual" | "">("");
  const [sFiles, setSFiles] = useState<File[]>([]);
  const [iFiles, setIFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [dropSOver, setDropSOver] = useState(false);
  const [dropIOver, setDropIOver] = useState(false);
  const fileS = useRef<HTMLInputElement>(null);
  const fileI = useRef<HTMLInputElement>(null);

  const changeGc = (n: number) => {
    setGc(n);
    setGrades(DEFS[n].map(([name, pct]) => ({ name, pct })));
  };

  const gradeSum = grades.reduce((acc, g) => acc + (parseFloat(g.pct) || 0), 0);
  const sumOk = Math.abs(gradeSum - 100) < 0.5;

  const selType = (t: "summary" | "individual") => {
    setSType(t);
    if (t === "summary") setIFiles([]);
    else setSFiles([]);
  };

  const chkExt = (f: File) =>
    EXTS.includes(f.name.split(".").pop()?.toLowerCase() || "");

  const addSFile = (f: File) => {
    if (!chkExt(f)) {
      alert("지원하지 않는 형식입니다.");
      return;
    }
    setSFiles([f]);
  };

  const addIFiles = (newFiles: FileList) => {
    setIFiles((prev) => {
      const updated = [...prev];
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        if (!chkExt(f)) {
          alert(f.name + ": 지원하지 않는 형식");
          continue;
        }
        if (updated.some((ef) => ef.name === f.name)) continue;
        if (updated.length >= 20) {
          alert("최대 20개까지 업로드 가능합니다.");
          break;
        }
        updated.push(f);
      }
      return updated;
    });
  };

  const go = async () => {
    if (!orgName.trim()) {
      alert("조직명을 입력해주세요.");
      return;
    }
    const gs: string[] = [];
    const gd: number[] = [];
    for (let i = 0; i < grades.length; i++) {
      const n = grades[i].name.trim();
      const p = parseFloat(grades[i].pct);
      if (!n) {
        alert(`${i + 1}번째 등급명을 입력해주세요.`);
        return;
      }
      if (isNaN(p)) {
        alert(`${n} 등급의 배분율을 입력해주세요.`);
        return;
      }
      gs.push(n);
      gd.push(p);
    }
    if (!sumOk) {
      alert(`배분율 합계가 ${gradeSum}%입니다. 100%로 맞춰주세요.`);
      return;
    }
    if (!sType) {
      alert("평가자료 유형을 선택해주세요.");
      return;
    }
    const files = sType === "summary" ? sFiles : iFiles;
    if (!files.length) {
      alert("파일을 업로드해주세요.");
      return;
    }

    const fd = new FormData();
    fd.append("org_name", orgName.trim());
    fd.append("grade_system", JSON.stringify(gs));
    fd.append("grade_distribution", JSON.stringify(gd));
    fd.append("file_type", sType);
    const fn = sType === "summary" ? "summary_files" : "individual_files";
    files.forEach((f) => fd.append(fn, f));

    setLoading(true);
    setLoadingMsg(
      "AI가 평가 데이터를 분석하고 있습니다...\n" +
        (files.length > 5
          ? `파일 ${files.length}개, 2~3분 소요될 수 있습니다.`
          : "잠시만 기다려주세요.")
    );
    try {
      const r = await fetch(WEBHOOK_URL, { method: "POST", body: fd });
      if (!r.ok) throw new Error("서버 응답 오류 (" + r.status + ")");
      const h = await r.text();
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(h);
        w.document.close();
      } else alert("팝업 차단됨. 허용 후 다시 시도해주세요.");
    } catch (e) {
      alert("오류: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-eval-collector", "true");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, []);

  return (
    <>
      <button type="button" className="ec-back-btn" onClick={onBack}>
        ← 도구 리스트로
      </button>

      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <div className="ec-spinner" />
          <div
            style={{
              color: "white",
              marginTop: 16,
              fontSize: 14,
              textAlign: "center",
              lineHeight: 1.6,
              whiteSpace: "pre-line",
            }}
          >
            {loadingMsg}
          </div>
        </div>
      )}

      <div className="ec-wrap">
        <div className="ec-card">
          <div className="ec-hd">
            <h1>📊 인사평가 결과 취합 분석</h1>
            <p>평가 파일을 업로드하면 AI가 자동으로 분석 리포트를 생성합니다</p>
          </div>

          <div className="ec-bd">
            <div className="ec-fg">
              <label>
                조직명 <span className="ec-req">*</span>
              </label>
              <input
                type="text"
                className="ec-input"
                placeholder="예: 사업개발팀, 생산부문, 마케팅본부"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>

            <div className="ec-fg">
              <label>
                등급별 배분 기준 <span className="ec-req">*</span>
              </label>
              <div className="ec-gc-wrap">
                {[4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className={`ec-gc-btn${gc === n ? " active" : ""}`}
                    onClick={() => changeGc(n)}
                  >
                    {n}단계
                  </button>
                ))}
              </div>
              <table className="ec-gt">
                <thead>
                  <tr>
                    <th>등급</th>
                    <th>배분 기준 (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          className="ec-gi"
                          placeholder="등급명"
                          value={g.name}
                          onChange={(e) =>
                            setGrades((prev) =>
                              prev.map((r, ri) =>
                                ri === i ? { ...r, name: e.target.value } : r
                              )
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="ec-gi"
                          placeholder="%"
                          value={g.pct}
                          onChange={(e) =>
                            setGrades((prev) =>
                              prev.map((r, ri) =>
                                ri === i ? { ...r, pct: e.target.value } : r
                              )
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                className="ec-gs"
                style={{ color: sumOk ? "#059669" : "#DC2626" }}
              >
                배분 기준 합계: {gradeSum}%
              </div>
              <div className="ec-hint">
                각 등급명과 목표 배분율(%)을 입력하세요. 합계가 100%가 되어야 합니다.
              </div>
            </div>

            <div className="ec-fg">
              <label>
                평가자료 유형 <span className="ec-req">*</span>
              </label>
              <div className="ec-type-grid">
                <div
                  className={`ec-tc${sType === "summary" ? " selected" : ""}`}
                  onClick={() => selType("summary")}
                >
                  <div className="ec-tc-icon">📋</div>
                  <div className="ec-tc-title">등급 총괄표</div>
                  <div className="ec-tc-desc">
                    여러 직원의 등급을<br />한 표에 정리한 파일<br />
                    <b>(1개)</b>
                  </div>
                </div>
                <div
                  className={`ec-tc${sType === "individual" ? " selected" : ""}`}
                  onClick={() => selType("individual")}
                >
                  <div className="ec-tc-icon">📄</div>
                  <div className="ec-tc-title">개인별 평가표</div>
                  <div className="ec-tc-desc">
                    직원 1인당 1파일<br />개인 업적평가표<br />
                    <b>(최대 20개)</b>
                  </div>
                </div>
              </div>
            </div>

            {sType === "summary" && (
              <div style={{ marginTop: 4 }}>
                <div className="ec-uinfo">
                  <b>📋 등급 총괄표</b> — 여러 직원의 등급을 한 표에 정리한 파일{" "}
                  <b>1개</b>를 업로드하세요.
                  <br />※ 개인별 코멘트가 없는 경우 등급 분포 위주 분석 리포트가 생성됩니다.
                </div>
                <div
                  className={`ec-drop${dropSOver ? " over" : ""}`}
                  onClick={() => fileS.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropSOver(true);
                  }}
                  onDragLeave={() => setDropSOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropSOver(false);
                    if (e.dataTransfer.files[0]) addSFile(e.dataTransfer.files[0]);
                  }}
                >
                  <div className="ec-drop-icon">📋</div>
                  <div className="ec-drop-txt">
                    <b style={{ color: "#3B82F6" }}>클릭</b>하거나 파일을 끌어놓으세요
                    <br />
                    .xlsx .xls .docx .pdf (1개)
                  </div>
                </div>
                <input
                  ref={fileS}
                  type="file"
                  accept=".xlsx,.xls,.docx,.doc,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) addSFile(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <div className="ec-flist">
                  {sFiles.map((f, i) => (
                    <div key={i} className="ec-fitem">
                      <span>
                        📎 {f.name} ({(f.size / 1024).toFixed(1)}KB)
                      </span>
                      <button className="ec-rm" onClick={() => setSFiles([])}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sType === "individual" && (
              <div style={{ marginTop: 4 }}>
                <div className="ec-uinfo">
                  <b>📄 개인별 평가표</b> — 직원 1인당 1파일로 된 업적평가표를 업로드하세요.
                  <br />평가의견이 포함되어 있으면 더 상세한 코멘트 품질 분석이 가능합니다.
                  <br />※ 파일 수에 따라 1~3분 소요될 수 있습니다.
                </div>
                <div
                  className={`ec-drop${dropIOver ? " over" : ""}`}
                  onClick={() => fileI.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropIOver(true);
                  }}
                  onDragLeave={() => setDropIOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropIOver(false);
                    addIFiles(e.dataTransfer.files);
                  }}
                >
                  <div className="ec-drop-icon">📄</div>
                  <div className="ec-drop-txt">
                    <b style={{ color: "#3B82F6" }}>클릭</b>하거나 파일을 끌어놓으세요
                    <br />
                    .xlsx .xls .docx .pdf (최대 20개)
                  </div>
                </div>
                <input
                  ref={fileI}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.docx,.doc,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files) addIFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div className="ec-flist">
                  {iFiles.map((f, i) => (
                    <div key={i} className="ec-fitem">
                      <span>
                        📎 {f.name} ({(f.size / 1024).toFixed(1)}KB)
                      </span>
                      <button
                        className="ec-rm"
                        onClick={() =>
                          setIFiles((prev) => prev.filter((_, ri) => ri !== i))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="ec-submit" disabled={loading} onClick={go}>
              📊 AI 분석 리포트 생성
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
