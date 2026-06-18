"use client";
import { useEffect, useRef, useState } from "react";
import type { Grp, Unit, VarType, Variable } from "app-renderer";
import { UNITS } from "app-renderer";

const uid = () => Math.random().toString(36).slice(2, 7);

interface Props {
  grp: Grp;
  vars: Variable[];
  onChange: (vars: Variable[]) => void;
}

const TYPES: VarType[] = ["number", "text", "date"];

export default function TabVars({ grp, vars, onChange }: Props) {
  const list = vars.filter((v) => v.grp === grp);
  const others = vars.filter((v) => v.grp !== grp);

  const [nm, setNm] = useState("");
  const [ty, setTy] = useState<VarType>("number");
  const [un, setUn] = useState<Unit>("");
  const [req, setReq] = useState(false);
  // 변수명 검증 실패 안내 — 브라우저 기본 alert 대신 커스텀 팝업
  const [nameError, setNameError] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Variable>) => {
    onChange(vars.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  // 변수명 검증 — 빈값/공백/중복(전체 변수 기준, 규정·개인 통틀어) 차단.
  // 유효하면 정리된 이름을 반환, 무효면 null. 공백/중복은 알림, 빈값은 호출부에서 분기.
  const validateName = (raw: string, selfId?: string): string | null => {
    const name = raw.trim();
    if (!name) return null;
    if (/\s/.test(name)) {
      setNameError("변수명에 공백을 사용할 수 없습니다.");
      return null;
    }
    if (vars.some((v) => v.id !== selfId && (v.name || "").trim() === name)) {
      setNameError(`이미 "${name}" 변수가 있습니다.\n다른 이름을 사용해 주세요.`);
      return null;
    }
    return name;
  };
  // 인라인 표에서 이름 수정 시 커밋. 성공 여부 반환(무효면 입력칸 원복용).
  // 빈 이름은 허용(지울 수 있게) — 빨간 테두리로 플래그만. 공백 포함·중복만 차단.
  const commitName = (id: string, raw: string): boolean => {
    if (!raw.trim()) {
      update(id, { name: "" });
      return true;
    }
    const name = validateName(raw, id);
    if (!name) return false; // 공백/중복 — validateName 이 알림, 입력칸 원복
    update(id, { name });
    return true;
  };
  // 입력칸 라이브 검증(빨간 테두리)용 — 공백포함/중복이면 true. 커밋과 무관(부수효과 없음).
  // 빈값은 추가 직후 자연스러운 상태라 빨간 표시 안 함.
  const nameInvalid = (raw: string, selfId: string): boolean => {
    const n = raw.trim();
    if (!n) return false;
    if (/\s/.test(n)) return true;
    return vars.some((v) => v.id !== selfId && (v.name || "").trim() === n);
  };
  const remove = (id: string) => onChange(vars.filter((v) => v.id !== id));
  // 여러 변수를 한 번의 onChange 로 일괄 삭제 (그룹/하위묶음 통째 삭제용 — 낱개 remove 반복은 stale state 로 1개만 지워짐)
  const removeMany = (ids: string[]) => {
    const set = new Set(ids);
    onChange(vars.filter((v) => !set.has(v.id)));
  };
  // 새 묶음 추가 — placeholder 변수 1개를 group 만 채워 추가 (빈 그룹은 표시 불가)
  const addInGroup = (group: string, subGroup: string = "") => {
    onChange([
      ...vars,
      {
        id: uid(),
        grp,
        name: "",
        type: "number",
        unit: "",
        req: false,
        test: "",
        group,
        subGroup,
      },
    ]);
  };
  const add = () => {
    if (!nm.trim()) {
      setNameError("변수명을 입력해 주세요.");
      return;
    }
    const name = validateName(nm);
    if (!name) return; // 공백/중복 — validateName 이 알림 처리
    onChange([
      ...vars,
      {
        id: uid(),
        grp,
        name,
        type: ty,
        unit: ty === "number" ? un : "",
        req,
        test: "",
      },
    ]);
    setNm("");
    setReq(false);
  };

  const inpCls = "rounded border px-2 py-1 text-sm font-mono";
  const selCls = "rounded border px-2 py-1 text-sm";

  return (
    <div className="space-y-5">
      <div className="pb-5 border-b border-gray-100">
        <div className="text-xs font-mono uppercase tracking-wider text-blue-700 mb-2">
          {grp === "규정" ? "변수 · 규정 측 정의" : "변수 · 개인 측 정의"}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {grp === "규정" ? "규정 변수" : "개인 변수"}
        </h2>
        <p className="text-base text-gray-600 whitespace-nowrap overflow-x-auto">
          {grp === "규정"
            ? "회사 규정·기준 문서에서 파싱할 기준값과 정책 상수를 정의합니다."
            : "임직원 1인 문서에서 파싱할 항목을 정의합니다 — 필수는 누락 시 수기 보완 대상."}
        </p>
      </div>

      <div className="flex items-start gap-1.5 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] leading-relaxed text-blue-800">
        <span className="shrink-0">💡</span>
        <span>
          <b>테스트값</b>은 빌더에서 로직·리포트가 올바른지 확인할 때 쓰는 미리보기용 샘플값입니다.
          발행된 완제품에서는 사용자가 입력한 실제 값으로 대체됩니다.
        </span>
      </div>

      <GroupedVarsTable
        grp={grp}
        list={list}
        update={update}
        remove={remove}
        removeMany={removeMany}
        addInGroup={addInGroup}
        commitName={commitName}
        nameInvalid={nameInvalid}
        inpCls={inpCls}
        selCls={selCls}
      />

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
        <span className="text-xs font-mono text-gray-500">+ {grp} 변수</span>
        <input
          value={nm}
          onChange={(e) => setNm(e.target.value)}
          placeholder="변수명"
          className={inpCls + " w-40"}
        />
        <select
          value={ty}
          onChange={(e) => setTy(e.target.value as VarType)}
          className={selCls}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={un}
          disabled={ty !== "number"}
          onChange={(e) => setUn(e.target.value as Unit)}
          className={selCls}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u || "(단위없음)"}
            </option>
          ))}
        </select>
        <label className="text-xs flex items-center gap-1 font-mono text-gray-600">
          <input
            type="checkbox"
            checked={req}
            onChange={(e) => setReq(e.target.checked)}
          />
          필수
        </label>
        <button
          onClick={add}
          className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50"
        >
          추가
        </button>
      </div>

      {nameError && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setNameError(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </span>
              <div className="text-base font-bold text-gray-900">변수명 확인</div>
            </div>
            <p className="text-sm leading-relaxed text-gray-600 mb-5 whitespace-pre-line">
              {nameError}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setNameError(null)}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 인라인 변수명 입력 — 로컬 draft 로 편집하다 blur/Enter 시 커밋.
// 중복/공백이면 커밋만 거부(스키마 미반영)하고 입력한 값은 그대로 유지 → 이어서 고쳐 쓸 수 있음.
// 빨간 테두리로 무효 상태를 라이브 표시. Esc 로 직전 이름으로 취소 가능.
function VarNameInput({
  value,
  invalidOf,
  onCommit,
  cls,
}: {
  value: string;
  invalidOf: (raw: string) => boolean;
  onCommit: (raw: string) => boolean;
  cls: string;
}) {
  const [draft, setDraft] = useState(value);
  // 외부에서 value 가 실제로 바뀌었을 때만 draft 동기화 (커밋 성공/앱 로드 등).
  // 중복 거부로 value 가 그대로면 draft 를 덮어쓰지 않아 사용자가 친 값이 보존된다.
  const lastValue = useRef(value);
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setDraft(value);
    }
  }, [value]);
  const commit = () => {
    if (draft.trim() === (value || "").trim()) {
      setDraft(value);
      return;
    }
    onCommit(draft); // 성공 시 부모가 value 갱신 → 위 effect 로 동기화. 실패 시 draft 유지.
  };
  const invalid = invalidOf(draft);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="변수명"
      title={invalid ? "빈 이름이거나 중복된 이름입니다 — 다른 이름을 입력하세요" : undefined}
      className={cls + (invalid ? " border-rose-400 bg-rose-50" : "")}
    />
  );
}

// 변수를 group > subGroup 계층으로 묶어서 표시. 모든 변수가 group 비어 있으면 평탄 표시.
function GroupedVarsTable({
  grp,
  list,
  update,
  remove,
  removeMany,
  addInGroup,
  commitName,
  nameInvalid,
  inpCls,
  selCls,
}: {
  grp: Grp;
  list: Variable[];
  update: (id: string, patch: Partial<Variable>) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  addInGroup: (group: string, subGroup?: string) => void;
  commitName: (id: string, raw: string) => boolean;
  nameInvalid: (raw: string, selfId: string) => boolean;
  inpCls: string;
  selCls: string;
}) {
  // 묶음/하위묶음 삭제 확인 모달 상태 (브라우저 confirm 대신 커스텀 삭제창)
  const [pendingDelete, setPendingDelete] = useState<
    { ids: string[]; label: string; count: number } | null
  >(null);
  // 계층화 — group → subGroup → [vars]
  // group 이 없는 변수는 "_미분류" 묶음.
  const groups: Record<string, Record<string, Variable[]>> = {};
  for (const v of list) {
    const g = v.group?.trim() || "_미분류";
    const sg = v.subGroup?.trim() || "_기본";
    if (!groups[g]) groups[g] = {};
    if (!groups[g][sg]) groups[g][sg] = [];
    groups[g][sg].push(v);
  }
  const hasHierarchy = list.some((v) => v.group?.trim());
  const renderRow = (v: Variable) => (
    <tr key={v.id} className="border-b border-gray-100">
      <td className="py-1.5 px-2">
        <VarNameInput
          value={v.name}
          invalidOf={(raw) => nameInvalid(raw, v.id)}
          onCommit={(raw) => commitName(v.id, raw)}
          cls={inpCls + " w-full"}
        />
      </td>
      <td className="py-1.5 px-2">
        <select
          value={v.type}
          onChange={(e) => update(v.id, { type: e.target.value as VarType })}
          className={selCls + " w-full"}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </td>
      <td className="py-1.5 px-2">
        <select
          value={v.unit || ""}
          disabled={v.type !== "number"}
          onChange={(e) => update(v.id, { unit: e.target.value as Unit })}
          className={selCls + " w-full"}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>{u || "(단위없음)"}</option>
          ))}
        </select>
      </td>
      <td className="py-1.5 px-2">
        <input
          value={v.test || ""}
          onChange={(e) => update(v.id, { test: e.target.value })}
          className={inpCls + " w-full"}
          placeholder={v.type === "date" ? "YYYY-MM-DD" : ""}
        />
      </td>
      <td className="py-1.5 px-2 text-center">
        <input
          type="checkbox"
          checked={!!v.req}
          onChange={(e) => update(v.id, { req: e.target.checked })}
        />
      </td>
      <td className="py-1.5 px-2 whitespace-nowrap w-px">
        <button
          onClick={() => remove(v.id)}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition"
          title="변수 삭제"
          aria-label="변수 삭제"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
  const header = (
    <thead>
      <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border-y border-blue-100">
        <th className="py-2.5 px-3 rounded-l">변수명</th>
        <th className="py-2.5 px-3 w-28">타입</th>
        <th className="py-2.5 px-3 w-32">단위</th>
        <th className="py-2.5 px-3 w-44">테스트값</th>
        <th className="py-2.5 px-3 w-14 text-center">필수</th>
        <th className="w-14 rounded-r"></th>
      </tr>
    </thead>
  );
  // 묶음(상위) 추가 — 참고 문서 분석 결과와 동일한 group/subGroup 구조를 수동으로도 만들 수 있게.
  const addGroupHandler = (name: string) => {
    const safe = name.trim();
    if (!safe || groups[safe]) return;
    addInGroup(safe);
  };

  // 변수가 아예 없을 때 — 묶음부터 만들 수 있도록 안내 + 추가 버튼
  if (list.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded border border-dashed p-6 text-center text-sm text-gray-500 font-mono">
          {grp} 변수가 없습니다. 아래 “+ 새 묶음 추가”로 상위/하위 구조를 만들거나, 맨 아래에서 변수를 바로 추가하세요.
        </div>
        <NewGroupAdder onAddGroup={addGroupHandler} />
      </div>
    );
  }

  // 계층 정보가 없으면 평탄 표 + “묶음 추가”(수동으로 상위/하위 구조 시작 가능)
  if (!hasHierarchy) {
    return (
      <div className="space-y-4">
        <table className="w-full text-sm">
          {header}
          <tbody>{list.map(renderRow)}</tbody>
        </table>
        <NewGroupAdder onAddGroup={addGroupHandler} />
      </div>
    );
  }
  // 그룹 헬퍼들
  const renameGroup = (oldName: string, newName: string) => {
    const safe = newName.trim();
    if (!safe) return;
    if (safe === oldName) return;
    for (const v of list) {
      if ((v.group?.trim() || "_미분류") === oldName) {
        update(v.id, { group: safe });
      }
    }
  };
  const renameSubGroup = (gName: string, oldSub: string, newSub: string) => {
    const safe = newSub.trim();
    if (safe === oldSub) return;
    for (const v of list) {
      if ((v.group?.trim() || "_미분류") !== gName) continue;
      if ((v.subGroup?.trim() || "_기본") !== oldSub) continue;
      update(v.id, { subGroup: safe });
    }
  };
  const deleteGroup = (gName: string) => {
    const inGroup = list.filter((v) => (v.group?.trim() || "_미분류") === gName);
    if (inGroup.length === 0) return;
    setPendingDelete({
      ids: inGroup.map((v) => v.id),
      label: `“${gName === "_미분류" ? "기타" : gName}” 묶음`,
      count: inGroup.length,
    });
  };
  const deleteSubGroup = (gName: string, sgName: string) => {
    const items = list.filter(
      (v) =>
        (v.group?.trim() || "_미분류") === gName &&
        (v.subGroup?.trim() || "_기본") === sgName
    );
    if (items.length === 0) return;
    setPendingDelete({
      ids: items.map((v) => v.id),
      label: `“${sgName}” 하위 묶음`,
      count: items.length,
    });
  };

  // 정렬 우선순위 — "기본정보" 항상 맨 위, "_미분류" 항상 맨 아래, 그 외는 입력 순
  const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
    if (a === "기본정보") return -1;
    if (b === "기본정보") return 1;
    if (a === "_미분류") return 1;
    if (b === "_미분류") return -1;
    return 0;
  });

  // 묶음에 속하지 않은 변수("_미분류")는 "기타" 카드로 감싸지 않고 평탄 표로 그대로 표시.
  // (수동으로 그냥 추가한 기존 변수 — 묶음이 생겨도 강제로 기타 분류하지 않음)
  const namedEntries = sortedEntries.filter(([g]) => g !== "_미분류");
  const ungroupedVars = groups["_미분류"]
    ? Object.values(groups["_미분류"]).flat()
    : [];

  // 계층 표시 — 묶음 없는 변수(평탄) + 상위>하위 그루핑 카드
  return (
    <div className="space-y-5">
      {ungroupedVars.length > 0 && (
        <table className="w-full text-sm">
          {header}
          <tbody>{ungroupedVars.map(renderRow)}</tbody>
        </table>
      )}
      {namedEntries.map(([g, subs]) => (
        <GroupCard
          key={g}
          gName={g}
          subs={subs}
          header={header}
          renderRow={renderRow}
          onRename={(newName) => renameGroup(g, newName)}
          onDelete={() => deleteGroup(g)}
          onRenameSub={(oldSub, newSub) => renameSubGroup(g, oldSub, newSub)}
          onDeleteSub={(sgName) => deleteSubGroup(g, sgName)}
          onAddSub={(subName) => addInGroup(g, subName)}
          onAddVarInGroup={() => addInGroup(g)}
          onAddVarInSub={(sgName) => addInGroup(g, sgName === "_기본" ? "" : sgName)}
        />
      ))}
      <NewGroupAdder onAddGroup={addGroupHandler} />

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-bold text-gray-900 mb-1.5">묶음 삭제</div>
            <p className="text-sm leading-relaxed text-gray-600 mb-5">
              {pendingDelete.label} 안의 변수{" "}
              <b className="text-rose-600">{pendingDelete.count}개</b>를 모두 삭제할까요?
              <br />
              <span className="text-xs text-gray-400">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  removeMany(pendingDelete.ids);
                  setPendingDelete(null);
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 상위/하위 묶음 카드 — 라벨을 클릭하면 인라인 편집, 우측에 삭제 버튼.
function GroupCard({
  gName,
  subs,
  header,
  renderRow,
  onRename,
  onDelete,
  onRenameSub,
  onDeleteSub,
  onAddSub,
  onAddVarInGroup,
  onAddVarInSub,
}: {
  gName: string;
  subs: Record<string, Variable[]>;
  header: JSX.Element;
  renderRow: (v: Variable) => JSX.Element;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onRenameSub: (oldSub: string, newSub: string) => void;
  onDeleteSub: (sgName: string) => void;
  onAddSub: (subName: string) => void;
  onAddVarInGroup: () => void;
  onAddVarInSub: (sgName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(gName === "_미분류" ? "" : gName);
  const total = Object.values(subs).reduce((a, x) => a + x.length, 0);
  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== gName) onRename(v);
  };
  return (
    <details open className="rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <summary className="cursor-pointer select-none bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-2.5 text-sm font-bold text-blue-900 hover:from-blue-100 hover:to-sky-100 flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-blue-600 text-white text-[10px] font-bold">
          {total}개
        </span>
        <input
          value={editing ? draft : (gName === "_미분류" ? "기타 (분류 없음)" : gName)}
          onChange={(e) => { setEditing(true); setDraft(e.target.value); }}
          onFocus={() => { setEditing(true); setDraft(gName === "_미분류" ? "" : gName); }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(gName === "_미분류" ? "" : gName);
              setEditing(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-sm font-bold text-blue-900 hover:border-blue-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 min-w-[160px]"
          placeholder="묶음 이름"
          title="클릭해서 묶음 이름 수정"
        />
        <span className="ml-auto text-[10px] font-mono text-blue-700 opacity-70">
          하위 {Object.keys(subs).filter((s) => s !== "_기본").length}개
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition"
          title="묶음 안 변수 모두 삭제"
          aria-label="묶음 삭제"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </summary>
      <div className="p-3 space-y-3">
        {Object.entries(subs).map(([sg, items]) => (
          <SubGroupCard
            key={sg}
            sgName={sg}
            items={items}
            header={header}
            renderRow={renderRow}
            onRename={(newSub) => onRenameSub(sg, newSub)}
            onDelete={() => onDeleteSub(sg)}
            onAddVar={() => onAddVarInSub(sg)}
          />
        ))}
        <NewSubGroupAdder onAddSub={onAddSub} />
      </div>
    </details>
  );
}

function NewSubGroupAdder({ onAddSub }: { onAddSub: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="inline-flex items-center rounded-md border border-dashed border-blue-200 bg-blue-50/30 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 transition"
      >
        + 하위 묶음
      </button>
    );
  }
  const commit = () => {
    const v = draft.trim();
    if (v) onAddSub(v);
    setDraft("");
    setAdding(false);
  };
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/30 px-1.5 py-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setAdding(false);
            setDraft("");
          }
        }}
        className="rounded border border-blue-300 px-2 py-0.5 text-[11px] bg-white w-40"
        placeholder="하위 이름"
      />
      <button onClick={commit} className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700">
        추가
      </button>
      <button onClick={() => { setAdding(false); setDraft(""); }} className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-700">
        취소
      </button>
    </div>
  );
}

function SubGroupCard({
  sgName,
  items,
  header,
  renderRow,
  onRename,
  onDelete,
  onAddVar,
}: {
  sgName: string;
  items: Variable[];
  header: JSX.Element;
  renderRow: (v: Variable) => JSX.Element;
  onRename: (newSub: string) => void;
  onDelete: () => void;
  onAddVar: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sgName === "_기본" ? "" : sgName);
  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v !== sgName) onRename(v);
  };
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/40 overflow-hidden">
      {sgName !== "_기본" && (
        <div className="px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          <input
            value={editing ? draft : sgName}
            onChange={(e) => { setEditing(true); setDraft(e.target.value); }}
            onFocus={() => { setEditing(true); setDraft(sgName); }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(sgName);
                setEditing(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-bold text-gray-800 hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 min-w-[120px]"
            placeholder="하위 묶음 이름"
            title="클릭해서 하위 묶음 이름 수정"
          />
          <span className="ml-auto text-[10px] font-mono text-gray-500">{items.length}개</span>
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center h-5 w-5 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition"
            title="하위 묶음 안 변수 모두 삭제"
            aria-label="하위 묶음 삭제"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        {header}
        <tbody>{items.map(renderRow)}</tbody>
      </table>
      <div className="px-3 py-1.5 border-t border-gray-100 bg-white/40">
        <button
          onClick={onAddVar}
          className="w-full rounded-md border border-dashed border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700 transition"
        >
          + 이 하위에 변수 추가
        </button>
      </div>
    </div>
  );
}

// 새 묶음 추가 — 인라인으로 이름 입력
function NewGroupAdder({ onAddGroup }: { onAddGroup: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="w-full rounded-lg border border-dashed border-blue-300 bg-blue-50/40 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 transition"
      >
        + 새 묶음 추가
      </button>
    );
  }
  const commit = () => {
    const v = draft.trim();
    if (v) onAddGroup(v);
    setDraft("");
    setAdding(false);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/40 px-3 py-2">
      <span className="text-xs font-medium text-blue-700">새 묶음 이름</span>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setAdding(false);
            setDraft("");
          }
        }}
        className="flex-1 rounded border border-blue-300 px-2 py-1 text-xs bg-white"
        placeholder="예: 경조사 / 급여 / 휴가"
      />
      <button onClick={commit} className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">
        추가
      </button>
      <button onClick={() => { setAdding(false); setDraft(""); }} className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">
        취소
      </button>
    </div>
  );
}
