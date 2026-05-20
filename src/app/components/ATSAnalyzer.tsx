"use client";

import { useEffect, useRef, useState } from "react";

const WEBHOOK_URL = "https://aihrteam.app.n8n.cloud/webhook/ats-api";

interface ATSAnalyzerProps {
  onBack: () => void;
}

export default function ATSAnalyzer({ onBack }: ATSAnalyzerProps) {
  const [candidateName, setCandidateName] = useState("");
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [reportHtml, setReportHtml] = useState("");
  const [reportInfo, setReportInfo] = useState("");

  const jobInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let injected: HTMLLinkElement | null = null;
    if (!document.getElementById("fa-cdn")) {
      const link = document.createElement("link");
      link.id = "fa-cdn";
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
      document.head.appendChild(link);
      injected = link;
    }
    return () => {
      injected?.remove();
    };
  }, []);

  const startProgress = () => {
    let pct = 0;
    progressIntervalRef.current = setInterval(() => {
      pct = Math.min(pct + Math.random() * 6, 92);
      setProgress(Math.round(pct));
    }, 2000);
  };

  const finishProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);
  };

  const setFile = (num: 1 | 2, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("파일 크기는 10MB 이하여야 합니다.");
      return;
    }
    if (num === 1) setJobFile(file);
    else setResumeFile(file);
  };

  const handleDrop = (e: React.DragEvent, num: 1 | 2) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setFile(num, file);
  };

  const handleExecute = async () => {
    setError("");
    if (!candidateName.trim()) {
      setError("지원자 이름을 입력해주세요.");
      return;
    }
    if (!jobFile) {
      setError("직무요건 파일을 업로드해주세요.");
      return;
    }
    if (!resumeFile) {
      setError("이력서 파일을 업로드해주세요.");
      return;
    }

    setIsLoading(true);
    setReportHtml("");
    setProgress(0);
    startProgress();

    try {
      const fd = new FormData();
      fd.append("candidate_name", candidateName.trim());
      fd.append("job_posting_file", jobFile);
      fd.append("resume_file", resumeFile);
      fd.append("assistant_name", "k-prime-test");

      const resp = await fetch(WEBHOOK_URL, { method: "POST", body: fd });
      finishProgress();

      const text = await resp.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.substring(0, 500) };
      }

      if (resp.ok && data.status === "ok") {
        setReportHtml((data.html_content as string) || "");
        const rid = (data.report_id as string) || (data.file_name as string) || "";
        setReportInfo(
          rid
            ? `${data.candidate_name || candidateName} | ${rid}`
            : "리포트가 생성되었습니다."
        );
        setTimeout(() => {
          document
            .getElementById("ats-result-area")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } else {
        throw new Error(`서버 오류 (${resp.status})`);
      }
    } catch (err) {
      finishProgress();
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setJobFile(null);
    setResumeFile(null);
    setCandidateName("");
    setReportHtml("");
    setReportInfo("");
    setError("");
    setProgress(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openReportNewTab = () => {
    if (!reportHtml) return;
    const w = window.open();
    if (w) {
      w.document.write(reportHtml);
      w.document.close();
    }
  };

  return (
    <div style={{ fontFamily: "'Pretendard', sans-serif" }} className="bg-gray-50 text-gray-800">
      <header
        className="bg-blue-600 text-white py-20 px-4 text-center shadow-sm relative overflow-hidden pb-32"
      >
        <div className="max-w-4xl mx-auto relative z-10">
          <button
            onClick={onBack}
            className="text-blue-200 hover:text-white text-sm font-bold mb-6 flex items-center justify-center mx-auto gap-2 transition-colors"
          >
            ← 도구 리스트로
          </button>
          <span
            className="inline-block py-1 px-3 rounded-full text-white text-sm font-semibold mb-4"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <i className="fas fa-robot mr-2"></i>AI 정밀 진단 도구
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
            채용지원자 직무적합도 진단(ATS)
          </h1>
          <p className="text-lg md:text-xl font-light max-w-2xl mx-auto" style={{ color: "#dbeafe" }}>
            데이터와 AI 기반의 정밀 분석으로 최적의 인재를 찾아보세요.
          </p>
        </div>
      </header>

      <main
        className="max-w-7xl mx-auto px-4 pb-20"
        style={{ marginTop: "-6rem", position: "relative", zIndex: 20 }}
      >
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-16 max-w-4xl mx-auto">
          <div className="bg-gray-50 border-b border-gray-100 px-8 py-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
              <i className="fas fa-file-signature text-blue-600 mr-3"></i>진단 시작하기
            </h2>
            <p className="text-slate-500 mt-2 text-sm">
              아래 안내에 따라 문서를 업로드하고 실행을 눌러주세요.
            </p>
          </div>

          <div className="p-8">
            <div className="mb-10 relative">
              <div
                className="absolute w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold shadow-lg z-10 text-sm"
                style={{ left: "-0.75rem", top: "-0.5rem" }}
              >
                0
              </div>
              <div className="pl-8">
                <h3 className="text-xl font-bold text-slate-800 mb-2">지원자 이름</h3>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full max-w-sm px-4 py-3 border-2 border-slate-200 rounded-xl text-base focus:outline-none transition-colors"
                  style={{ maxWidth: "24rem" }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                />
              </div>
            </div>

            <div className="mb-10 relative">
              <div
                className="absolute w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg z-10"
                style={{ left: "-0.75rem", top: "-0.5rem" }}
              >
                1
              </div>
              <div className="pl-8">
                <h3 className="text-xl font-bold text-slate-800 mb-2">직무요건 파일 업로드</h3>
                <p className="text-slate-500 mb-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 inline-block">
                  <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                  분석하고자 하는 직무와 관련된 파일(PDF, DOCX, TXT, JPG, PNG)을 업로드 하세요.
                </p>
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center transition-colors cursor-pointer group"
                  onClick={() => jobInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, 1)}
                  style={{
                    borderColor: jobFile ? "#3b82f6" : "#cbd5e1",
                    backgroundColor: jobFile ? "#eff6ff" : "",
                  }}
                >
                  <input
                    ref={jobInputRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => e.target.files?.[0] && setFile(1, e.target.files[0])}
                  />
                  {jobFile ? (
                    <div className="inline-flex items-center px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm text-sm font-medium text-blue-700">
                      <i className="fas fa-file-alt mr-2"></i>
                      <span className="truncate" style={{ maxWidth: "200px" }}>
                        {jobFile.name}
                      </span>
                      <button
                        type="button"
                        className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setJobFile(null);
                        }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt text-4xl text-slate-400 mb-4 block transition-colors"></i>
                      <h4 className="text-lg font-medium text-slate-700 mb-1">
                        클릭하거나 파일을 이곳에 드래그 하세요
                      </h4>
                      <p className="text-sm text-slate-400">
                        지원 형식: PDF, DOCX, TXT, JPG, PNG (최대 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-10 relative">
              <div
                className="absolute w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg z-10"
                style={{ left: "-0.75rem", top: "-0.5rem" }}
              >
                2
              </div>
              <div className="pl-8">
                <h3 className="text-xl font-bold text-slate-800 mb-2">지원자 이력서 업로드</h3>
                <p className="text-slate-500 mb-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 inline-block">
                  <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                  매칭해서 분석하고자 하는 지원자의 이력서 또는 입사지원서 파일(PDF, DOCX, TXT, JPG, PNG)을 업로드 하세요.
                </p>
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center transition-colors cursor-pointer"
                  onClick={() => resumeInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, 2)}
                  style={{
                    borderColor: resumeFile ? "#3b82f6" : "#cbd5e1",
                    backgroundColor: resumeFile ? "#eff6ff" : "",
                  }}
                >
                  <input
                    ref={resumeInputRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => e.target.files?.[0] && setFile(2, e.target.files[0])}
                  />
                  {resumeFile ? (
                    <div className="inline-flex items-center px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm text-sm font-medium text-blue-700">
                      <i className="fas fa-file-alt mr-2"></i>
                      <span className="truncate" style={{ maxWidth: "200px" }}>
                        {resumeFile.name}
                      </span>
                      <button
                        type="button"
                        className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResumeFile(null);
                        }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ) : (
                    <>
                      <i className="fas fa-user text-4xl text-slate-400 mb-4 block transition-colors"></i>
                      <h4 className="text-lg font-medium text-slate-700 mb-1">
                        클릭하거나 파일을 이곳에 드래그 하세요
                      </h4>
                      <p className="text-sm text-slate-400">
                        지원 형식: PDF, DOCX, TXT, JPG, PNG (최대 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="relative mt-12 pt-10 border-t border-slate-100">
              <div
                className="absolute w-8 h-8 rounded-full text-white flex items-center justify-center font-bold shadow-lg z-10"
                style={{ left: "-0.75rem", top: "-1rem", background: "#f97316" }}
              >
                3
              </div>
              <div className="pl-8 text-center">
                <h3 className="text-xl font-bold text-slate-800 mb-4">분석 실행</h3>
                <p className="text-slate-600 mb-8 max-w-md mx-auto">
                  실행 버튼을 누르시면 업로드한 자료와 빅데이터가 깊이 있는 레포트를 제공할 것입니다.
                </p>
                <button
                  onClick={handleExecute}
                  disabled={isLoading}
                  className="text-white font-bold text-lg py-4 px-12 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center mx-auto group disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: isLoading ? "#94a3b8" : "#2563eb" }}
                >
                  <i className="fas fa-play mr-3"></i>분석 실행하기
                </button>
                {error && <p className="mt-4 text-red-500 text-sm font-medium">{error}</p>}
              </div>
            </div>
          </div>
        </section>

        {reportHtml && (
          <section id="ats-result-area" className="max-w-4xl mx-auto mb-16">
            <div className="bg-white rounded-2xl shadow-xl border border-emerald-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <i className="fas fa-check-circle text-xl text-emerald-500"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">분석 완료</h3>
                    <p className="text-sm text-slate-500">{reportInfo}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={openReportNewTab}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-all text-sm inline-flex items-center gap-2"
                  >
                    <i className="fas fa-external-link-alt"></i> 새 탭
                  </button>
                  <button
                    onClick={handleReset}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-all text-sm inline-flex items-center gap-2"
                  >
                    <i className="fas fa-redo"></i> 새 분석
                  </button>
                </div>
              </div>
              <iframe
                ref={iframeRef}
                srcDoc={reportHtml}
                style={{
                  width: "100%",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  background: "white",
                  minHeight: "800px",
                }}
                sandbox="allow-same-origin allow-scripts"
                title="ATS 분석 리포트"
                onLoad={() => {
                  try {
                    const h = iframeRef.current?.contentDocument?.body?.scrollHeight;
                    if (h && iframeRef.current)
                      iframeRef.current.style.height = Math.max(h + 40, 800) + "px";
                  } catch {}
                }}
              />
            </div>
          </section>
        )}

        <section className="flex flex-col gap-6 mb-20 max-w-4xl mx-auto">
          <h2
            className="text-2xl font-bold text-slate-800 mb-2 pl-2"
            style={{ borderLeft: "4px solid #2563eb" }}
          >
            서비스 소개
          </h2>
          {[
            {
              icon: "fa-question-circle",
              color: "blue",
              title: "어디에 쓰는 앱일까요?",
              desc: "이 앱은 회사 채용배경, 직무요건, 직무관련 필요사항, 필수/우대요소 등 모집요강에 관련된 정보 대비 실제 지원자의 지식, 경험, 역량 등의 내용이 얼마나 적합한지를 비교 분석해 보여주는 자료입니다.",
            },
            {
              icon: "fa-bolt",
              color: "emerald",
              title: "어떤 특징이 있나요?",
              desc: "체계적인 직무 빅데이터와 인사컨설팅 기반의 역량체계를 활용해서 심층적으로 분석해 직무충족 기준을 도출하고, 이를 분류체계에 의거해 매칭, 분석함으로써 일반 AI가 단순분석 하는 진단과 다른 차원의 정확도를 보여줍니다.",
            },
            {
              icon: "fa-users",
              color: "purple",
              title: "누가 쓰면 좋은가요?",
              desc: "인사채용 담당자, 내부선발 담당자, 서치펌 헤드헌터, 구직을 준비하며 모집건에 적합한지 알고 싶은 구직자 모두 사용이 가능합니다.",
            },
          ].map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-8 border border-slate-100 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 group"
            >
              <div
                className="w-16 h-16 shrink-0 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform"
                style={{
                  background:
                    card.color === "blue"
                      ? "#eff6ff"
                      : card.color === "emerald"
                      ? "#ecfdf5"
                      : "#faf5ff",
                  color:
                    card.color === "blue"
                      ? "#2563eb"
                      : card.color === "emerald"
                      ? "#059669"
                      : "#9333ea",
                }}
              >
                <i className={`fas ${card.icon}`}></i>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3 text-slate-800">{card.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                  {card.desc}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="max-w-6xl mx-auto mb-10">
          <div className="text-center mb-10">
            <h2 className="inline-block text-3xl font-extrabold text-slate-800 relative">
              산출물 예시
              <span
                className="absolute rounded-full"
                style={{
                  bottom: "-12px",
                  left: "25%",
                  right: "25%",
                  height: "4px",
                  background: "#2563eb",
                }}
              ></span>
            </h2>
            <p className="text-slate-500 mt-6">
              분석 완료 후 제공되는 심층 레포트의 예시 화면입니다.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                src: "https://www.genspark.ai/api/files/s/PEcF8Eaa",
                alt: "Scorecard",
                title: "Scorecard Summary",
                desc: "직무 경험, 핵심 역량 및 종합 적합도 점수와 AI의 상세한 종합 의견을 제공합니다.",
                colSpan: false,
              },
              {
                src: "https://www.genspark.ai/api/files/s/u8AOxNCY",
                alt: "Job Fit",
                title: "Job Experience Fit",
                desc: "요구되는 직무 역량별 점수 비교 및 상세 근거(Evidence)를 도출합니다.",
                colSpan: false,
              },
              {
                src: "https://www.genspark.ai/api/files/s/ubNWaFxd",
                alt: "Behavioral",
                title: "Behavioral Fit",
                desc: "소프트 스킬에 대한 요구수준 대비 실제 수준을 매칭합니다.",
                colSpan: true,
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl shadow-md overflow-hidden border border-slate-100 group cursor-pointer hover:shadow-xl transition-all ${
                  item.colSpan ? "md:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <div className="h-64 overflow-hidden flex items-center justify-center bg-slate-50 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="w-full h-auto object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6 border-t border-slate-100">
                  <h4 className="font-bold text-lg text-slate-800 mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {isLoading && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(15,23,42,0.8)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full mx-4">
            <div
              className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 mb-4"
              style={{ borderTopColor: "#2563eb" }}
            ></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">분석 중입니다...</h3>
            <p className="text-sm text-slate-500 mb-4">
              빅데이터와 AI 모델이 문서를 교차 분석하고 있습니다.
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${progress}%`, background: "#2563eb" }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-2">{progress}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
