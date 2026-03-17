"use client";

type EvaluationEvidenceInput = {
  id?: string;
  summary: string;
  targetName: string;
  periodNote: string;
};

type EvidenceInputListProps = {
  disabled: boolean;
  evidences: EvaluationEvidenceInput[];
  required?: boolean;
  onChange: (next: EvaluationEvidenceInput[]) => void;
};

function createEmptyEvidence(): EvaluationEvidenceInput {
  return {
    summary: "",
    targetName: "",
    periodNote: "",
  };
}

export function EvidenceInputList({ disabled, evidences, required = false, onChange }: EvidenceInputListProps) {
  const rows = evidences.length > 0 ? evidences : required ? [createEmptyEvidence()] : [];

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">継続実践の根拠</p>
          <p className="mt-1 text-xs text-slate-500">対象者、頻度、成果などを複数件で残せます。</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...rows, createEmptyEvidence()])}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
        >
          根拠を追加
        </button>
      </div>

      {rows.length === 0 ? <p className="text-xs text-slate-500">根拠の入力は任意です。</p> : null}

      {rows.map((evidence, index) => (
        <div key={evidence.id ?? `evidence-${index}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={evidence.summary}
              disabled={disabled}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...next[index], summary: event.target.value };
                onChange(next);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder={required ? "何を継続実践したかを入力" : "根拠概要を入力"}
            />
            <input
              type="text"
              value={evidence.targetName}
              disabled={disabled}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...next[index], targetName: event.target.value };
                onChange(next);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="対象者・対象顧客・対象チームなど"
            />
          </div>
          <textarea
            value={evidence.periodNote}
            disabled={disabled}
            onChange={(event) => {
              const next = [...rows];
              next[index] = { ...next[index], periodNote: event.target.value };
              onChange(next);
            }}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="半期中の頻度、期間、成果を入力"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              className="text-xs font-semibold text-rose-600 disabled:opacity-50"
            >
              この根拠を削除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
