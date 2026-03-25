"use client";

import { ChangeEvent, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SkillCategory } from "@/generated/prisma";
import { downloadCsv, parseCsv } from "@/lib/client/csv";
import type { EvaluationInputScope, EvaluationItemRow, SkillGradeRow } from "@/lib/skill-careers/skill-career-setting-service";

type SkillCareerSettingEditorProps = {
  canEdit: boolean;
  gradeDefaults: SkillGradeRow[];
  evaluationItemDefaults: EvaluationItemRow[];
};

type CsvImportPreview = {
  rows: EvaluationItemRow[];
  newCount: number;
  updateCount: number;
  errorMessages: string[];
};

type CsvImportMode = "merge" | "replace-category" | "replace-all";

const categoryGuides: Record<
  SkillCategory,
  {
    label: string;
    subtitle: string;
    scoreLabel: string;
    majorCategories: Array<{ name: string; items: string[] }>;
  }
> = {
  [SkillCategory.IT_SKILL]: {
    label: "自律成長力",
    subtitle: "自ら学び、考え、行動し、必要とされる存在になる力",
    scoreLabel: "0: これから習得する段階 / 1: 完全ではないができる / 2: 問題なくできる",
    majorCategories: [
      {
        name: "ITスキル: 基礎理解",
        items: [
          "使用技術や業務知識の基礎を理解している",
          "必要な情報を自分で調べてキャッチアップできる",
          "既存システムの構成や前提を理解して作業へ入れる",
        ],
      },
      {
        name: "ITスキル: 設計",
        items: [
          "要件や仕様を踏まえて設計方針を整理できる",
          "データや処理の流れを構造化して設計できる",
          "保守性や拡張性を意識した設計ができる",
        ],
      },
      {
        name: "ITスキル: 実装",
        items: [
          "設計意図を理解して実装へ落とし込める",
          "読みやすく保守しやすいコードを書ける",
          "例外や異常系を考慮して実装できる",
        ],
      },
      {
        name: "ITスキル: テスト・品質",
        items: [
          "必要なテスト観点を洗い出せる",
          "自分の成果物を見直し品質を担保できる",
          "不具合の再発防止を考えられる",
        ],
      },
      {
        name: "ITスキル: 運用保守",
        items: [
          "障害や問い合わせに対して適切に一次切り分けできる",
          "既存システムを理解し安全に改修できる",
          "運用上の問題を見つけて改善提案できる",
        ],
      },
      {
        name: "ITスキル: 開発推進・レビュー",
        items: [
          "開発上の課題やリスクを早めに共有できる",
          "他者成果物をレビューし、改善につなげられる",
          "チーム開発全体を意識して進行できる",
        ],
      },
      {
        name: "課題解決力",
        items: [
          "課題の原因を整理して捉えられる",
          "対応案を比較して妥当な方法を選べる",
          "仕様や要件の抜け漏れに気づける",
        ],
      },
      {
        name: "品質向上力",
        items: [
          "自分の成果物を見直し品質を担保できる",
          "不具合の再発防止を考えられる",
          "作業手順の改善提案ができる",
        ],
      },
      {
        name: "対話力",
        items: [
          "相手に合わせて必要な情報を整理して伝えられる",
          "報告・連絡・相談を適切なタイミングで行える",
          "認識差があるときに確認し、すり合わせできる",
        ],
      },
      {
        name: "顧客理解力",
        items: [
          "顧客や関係者の要望を正しく把握できる",
          "相手の立場や業務背景を踏まえて会話できる",
          "要望を整理して分かりやすく返せる",
        ],
      },
      {
        name: "推進連携力",
        items: [
          "周囲と役割分担しながら仕事を進められる",
          "必要に応じて他メンバーを支援できる",
          "チーム全体の進行を意識して行動できる",
        ],
      },
      {
        name: "自己成長力",
        items: [
          "自分の課題を認識し、改善に取り組める",
          "指示待ちではなく次に必要な行動を考えられる",
          "振り返りを次の行動に活かせる",
        ],
      },
    ],
  },
  [SkillCategory.BUSINESS_SKILL]: {
    label: "協調相乗力",
    subtitle: "周囲と力を掛け合わせ、他者や組織に価値を広げる力",
    scoreLabel: "0: 継続実践には至っていない / 1: 継続実践できている",
    majorCategories: [
      {
        name: "育成支援力",
        items: [
          "後輩やメンバーへの助言・支援を継続して行っている",
          "相手の理解度に応じた育成フォローを継続して行っている",
          "レビューや伴走を通じて他者の成長支援を継続して行っている",
        ],
      },
      {
        name: "採用貢献力",
        items: [
          "採用活動への協力を継続して行っている",
          "候補者に会社の魅力を伝える行動を継続して行っている",
          "採用改善につながる提案や協力を継続して行っている",
        ],
      },
      {
        name: "提案支援力",
        items: [
          "提案に必要な整理や支援を継続して行っている",
          "営業や関係者と連携した提案支援を継続して行っている",
          "会社の強みを提案機会へつなげる行動を継続して行っている",
        ],
      },
      {
        name: "顧客拡張力",
        items: [
          "顧客との関係深化につながる行動を継続して行っている",
          "追加提案や相談機会の創出につながる行動を継続して行っている",
          "取引拡大につながる働きかけを継続して行っている",
        ],
      },
      {
        name: "仕組み化力",
        items: [
          "属人化解消につながる整理を継続して行っている",
          "手順やテンプレート整備を継続して進めている",
          "生産性向上につながる仕組みづくりを継続して行っている",
        ],
      },
      {
        name: "ナレッジ共有力",
        items: [
          "自身の知見を周囲へ継続して共有している",
          "学びや改善事例の展開を継続して行っている",
          "チーム内の良い習慣づくりに継続して関わっている",
        ],
      },
      {
        name: "組織貢献力",
        items: [
          "組織課題への提案や改善行動を継続して行っている",
          "部門やチームを越えた改善への関与を継続して行っている",
          "会社の成長に向けた活動へ継続して関わっている",
        ],
      },
    ],
  },
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function categoryLabel(category: SkillCategory) {
  return categoryGuides[category].label;
}

function defaultMajorCategory(category: SkillCategory) {
  return categoryGuides[category].majorCategories[0]?.name ?? "";
}

function defaultMinorCategory(category: SkillCategory) {
  return categoryGuides[category].majorCategories[0]?.items[0] ?? "";
}

function scoreTypeLabel(scoreType: EvaluationItemRow["scoreType"]) {
  return scoreType === "CONTINUOUS_DONE" ? "0 / 1 継続実践" : "1 / 2 評価";
}

function inputScopeLabel(inputScope: EvaluationInputScope) {
  if (inputScope === "SELF") return "本人のみ";
  if (inputScope === "MANAGER") return "上長のみ";
  return "両方";
}

function normalizeInputScope(value: string): EvaluationInputScope | null {
  const normalized = value.trim();
  if (["SELF", "本人のみ"].includes(normalized)) return "SELF";
  if (["MANAGER", "上長のみ", "管理者のみ"].includes(normalized)) return "MANAGER";
  if (["BOTH", "両方"].includes(normalized)) return "BOTH";
  return null;
}

function weightHint(row: EvaluationItemRow) {
  if (row.axis === "SYNERGY") {
    if (row.weight >= 3) return "全社・事業拡大型";
    if (row.weight >= 2) return "チーム・顧客へ継続価値";
    return "チーム内の継続協力";
  }
  return "加重平均で使用";
}

function normalizeItemByAxis(row: EvaluationItemRow, axis: EvaluationItemRow["axis"]): EvaluationItemRow {
  if (axis === "SYNERGY") {
    return {
      ...row,
      axis,
      scoreType: "CONTINUOUS_DONE",
      weight: Math.min(3, Math.max(1, Math.round(row.weight || 1))),
      evidenceRequired: true,
    };
  }

  return {
    ...row,
    axis,
    scoreType: "LEVEL_2",
    weight: row.weight > 0 ? row.weight : 10,
  };
}


function toRecommendedWeight(category: SkillCategory, majorCategory: string) {
  if (category === SkillCategory.BUSINESS_SKILL) {
    if (majorCategory.includes("顧客拡張") || majorCategory.includes("仕組み化") || majorCategory.includes("採用")) {
      return 3;
    }
    if (majorCategory.includes("育成") || majorCategory.includes("提案") || majorCategory.includes("組織")) {
      return 2;
    }
    return 1;
  }

  if (majorCategory.includes("設計") || majorCategory.includes("実装") || majorCategory.includes("テスト") || majorCategory.includes("運用保守")) {
    return 20;
  }
  return 10;
}

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCsvHeader(header: string) {
  const normalized = header.trim().replace(/^﻿/, "");
  const aliasMap: Record<string, string> = {
    カテゴリ: "category",
    軸: "axis",
    採点方式: "scoreType",
    大分類: "majorCategory",
    大分類順: "majorCategoryOrder",
    小分類: "minorCategory",
    小分類順: "minorCategoryOrder",
    項目名: "title",
    説明: "description",
    重み: "weight",
    表示順: "displayOrder",
    根拠必須: "evidenceRequired",
    使用: "isActive",
    入力者区分: "inputScope",
  };

  return aliasMap[normalized] ?? normalized;
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized == "1" || normalized == "yes" || normalized == "on" || normalized === "有効" || normalized === "必須";
}

function parseCategory(value: string): SkillCategory | null {
  const normalized = value.trim();
  if (["IT_SKILL", "自律成長力", "ITスキル"].includes(normalized)) return SkillCategory.IT_SKILL;
  if (["BUSINESS_SKILL", "協調相乗力", "ビジネススキル"].includes(normalized)) return SkillCategory.BUSINESS_SKILL;
  return null;
}

function parseAxis(value: string): EvaluationItemRow["axis"] | null {
  const normalized = value.trim();
  if (["SELF_GROWTH", "自律成長力"].includes(normalized)) return "SELF_GROWTH";
  if (["SYNERGY", "協調相乗力"].includes(normalized)) return "SYNERGY";
  return null;
}

function parseScoreType(value: string): EvaluationItemRow["scoreType"] | null {
  const normalized = value.trim();
  if (["LEVEL_2", "1 / 2 評価"].includes(normalized)) return "LEVEL_2";
  if (["CONTINUOUS_DONE", "0 / 1 継続実践"].includes(normalized)) return "CONTINUOUS_DONE";
  return null;
}

function buildItemIdentity(row: Pick<EvaluationItemRow, "category" | "majorCategory" | "minorCategory" | "title">) {
  return [row.category, row.majorCategory.trim(), row.minorCategory.trim(), row.title.trim()].join("::");
}

function parseEvaluationItemsCsv(text: string, currentItems: EvaluationItemRow[]): CsvImportPreview {
  const rows = parseCsv(text);
  if (rows.length <= 1) {
    return { rows: [], newCount: 0, updateCount: 0, errorMessages: ["CSVにデータ行がありません"] };
  }

  const header = rows[0].map(normalizeCsvHeader);
  const indexByName = new Map(header.map((value, index) => [value, index]));
  const required = ["category", "axis", "scoreType", "majorCategory", "majorCategoryOrder", "minorCategory", "minorCategoryOrder", "title", "description", "weight", "displayOrder", "evidenceRequired", "isActive"];
  const missing = required.filter((key) => !indexByName.has(key));
  if (missing.length > 0) {
    return { rows: [], newCount: 0, updateCount: 0, errorMessages: [`CSVヘッダーが不足しています: ${missing.join(", ")}`] };
  }

  const currentMap = new Map(currentItems.map((row) => [buildItemIdentity(row), row]));
  const importedRows: EvaluationItemRow[] = [];
  const errorMessages: string[] = [];
  let newCount = 0;
  let updateCount = 0;

  for (let lineIndex = 1; lineIndex < rows.length; lineIndex += 1) {
    const csvRow = rows[lineIndex];
    if (csvRow.every((cell) => cell.trim() === "")) continue;

    const category = parseCategory(csvRow[indexByName.get("category")! ] ?? "");
    const axis = parseAxis(csvRow[indexByName.get("axis")! ] ?? "");
    const scoreType = parseScoreType(csvRow[indexByName.get("scoreType")! ] ?? "");
    const majorCategory = (csvRow[indexByName.get("majorCategory")! ] ?? "").trim();
    const minorCategory = (csvRow[indexByName.get("minorCategory")! ] ?? "").trim();
    const title = (csvRow[indexByName.get("title")! ] ?? "").trim();
    const rawInputScope = indexByName.has("inputScope") ? String(csvRow[indexByName.get("inputScope")! ] ?? "") : "";
    const inputScope = normalizeInputScope(rawInputScope) ?? "BOTH";

    if (!category || !axis || !scoreType || !majorCategory || !minorCategory || !title) {
      errorMessages.push(`${lineIndex + 1}行目: 必須列の値が不足しています`);
      continue;
    }

    const identity = buildItemIdentity({ category, majorCategory, minorCategory, title });
    const existing = currentMap.get(identity);
    const row: EvaluationItemRow = {
      id: existing?.id ?? createClientId("new-item"),
      category,
      axis,
      scoreType,
      inputScope,
      majorCategory,
      majorCategoryOrder: toNumber(csvRow[indexByName.get("majorCategoryOrder")! ] ?? "0"),
      minorCategory,
      minorCategoryOrder: toNumber(csvRow[indexByName.get("minorCategoryOrder")! ] ?? "0"),
      title,
      description: String(csvRow[indexByName.get("description")! ] ?? ""),
      weight: toNumber(csvRow[indexByName.get("weight")! ] ?? "0"),
      displayOrder: toNumber(csvRow[indexByName.get("displayOrder")! ] ?? "0"),
      evidenceRequired: parseBoolean(String(csvRow[indexByName.get("evidenceRequired")! ] ?? "")),
      isActive: parseBoolean(String(csvRow[indexByName.get("isActive")! ] ?? "")),
      gradeDefinitionId: existing?.gradeDefinitionId ?? null,
    };

    importedRows.push(axis === "SYNERGY" ? normalizeItemByAxis(row, "SYNERGY") : normalizeItemByAxis(row, "SELF_GROWTH"));
    if (existing) updateCount += 1
    else newCount += 1
  }

  return { rows: importedRows, newCount, updateCount, errorMessages };
}

function mergeImportedEvaluationItems(currentItems: EvaluationItemRow[], importedRows: EvaluationItemRow[]) {
  const importedMap = new Map(importedRows.map((row) => [buildItemIdentity(row), row]));
  const merged = currentItems.map((row) => importedMap.get(buildItemIdentity(row)) ?? row);
  const existingKeys = new Set(currentItems.map((row) => buildItemIdentity(row)));
  const newRows = importedRows.filter((row) => !existingKeys.has(buildItemIdentity(row)));
  return [...merged, ...newRows];
}

function replaceImportedEvaluationItemsByCategory(currentItems: EvaluationItemRow[], importedRows: EvaluationItemRow[]) {
  const importedCategories = new Set(importedRows.map((row) => row.category));
  const remaining = currentItems.filter((row) => !importedCategories.has(row.category));
  return [...remaining, ...importedRows];
}

function applyImportedEvaluationItems(currentItems: EvaluationItemRow[], importedRows: EvaluationItemRow[], mode: CsvImportMode) {
  if (mode === "replace-all") return importedRows;
  if (mode === "replace-category") return replaceImportedEvaluationItemsByCategory(currentItems, importedRows);
  return mergeImportedEvaluationItems(currentItems, importedRows);
}

function csvImportModeLabel(mode: CsvImportMode) {
  if (mode === "replace-category") return "カテゴリ単位置換";
  if (mode === "replace-all") return "全件置換";
  return "追加 / 更新";
}

function readCsvFile(file: File) {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("CSVファイルの読み込みに失敗しました"));
    reader.readAsText(file, "utf-8");
  });
}

function buildRecommendedItems(category: SkillCategory, currentItems: EvaluationItemRow[]): EvaluationItemRow[] {
  const guide = categoryGuides[category];
  const existingTitles = new Set(
    currentItems
      .filter((item) => item.category === category)
      .map((item) => item.title.trim()),
  );

  const nextDisplayOrderBase = currentItems.filter((item) => item.category === category).length;
  let offset = 0;

  return guide.majorCategories.flatMap((majorCategory, majorIndex) =>
    majorCategory.items.flatMap((itemTitle, minorIndex) => {
      if (existingTitles.has(itemTitle.trim())) {
        return [];
      }
      offset += 1;
      const axis = category === SkillCategory.IT_SKILL ? "SELF_GROWTH" : "SYNERGY";
      return [
        {
          id: createClientId(`recommended-${category}`),
          category,
          axis,
          scoreType: axis === "SYNERGY" ? "CONTINUOUS_DONE" : "LEVEL_2",
          inputScope: "BOTH",
          majorCategory: majorCategory.name,
          majorCategoryOrder: (majorIndex + 1) * 10,
          minorCategory: majorCategory.name,
          minorCategoryOrder: (minorIndex + 1) * 10,
          title: itemTitle,
          description: "",
          weight: toRecommendedWeight(category, majorCategory.name),
          displayOrder: nextDisplayOrderBase + offset,
          isActive: true,
          evidenceRequired: axis === "SYNERGY",
          gradeDefinitionId: null,
        },
      ];
    }),
  );
}

export function SkillCareerSettingEditor({ canEdit, gradeDefaults, evaluationItemDefaults }: SkillCareerSettingEditorProps) {
  const router = useRouter();
  const [grades] = useState(gradeDefaults);
  const [evaluationItems, setEvaluationItems] = useState(evaluationItemDefaults);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startSaving] = useTransition();
  const [showPhilosophy, setShowPhilosophy] = useState(false);
  const [majorCategoryFilters, setMajorCategoryFilters] = useState<Record<SkillCategory, string>>({
    [SkillCategory.IT_SKILL]: "",
    [SkillCategory.BUSINESS_SKILL]: "",
  });
  const [csvImportPreview, setCsvImportPreview] = useState<CsvImportPreview | null>(null);
  const [csvImportMode, setCsvImportMode] = useState<CsvImportMode>("merge");
  const [csvImportStatus, setCsvImportStatus] = useState<string | null>(null);
  const csvPreviewRef = useRef<HTMLElement | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  const majorCategoryOptions = useMemo(() => ({
    [SkillCategory.IT_SKILL]: Array.from(
      new Set(
        evaluationItems
          .filter((item) => item.category === SkillCategory.IT_SKILL)
          .map((item) => item.majorCategory.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "ja")),
    [SkillCategory.BUSINESS_SKILL]: Array.from(
      new Set(
        evaluationItems
          .filter((item) => item.category === SkillCategory.BUSINESS_SKILL)
          .map((item) => item.majorCategory.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "ja")),
  }), [evaluationItems]);

  const itemSummary = useMemo(() => {
    const selfGrowth = evaluationItems.filter((item) => item.axis === "SELF_GROWTH");
    const synergy = evaluationItems.filter((item) => item.axis === "SYNERGY");
    return {
      selfGrowthCount: selfGrowth.length,
      synergyCount: synergy.length,
      synergyEvidenceRequiredCount: synergy.filter((item) => item.evidenceRequired).length,
      synergyHighWeightCount: synergy.filter((item) => item.weight >= 3).length,
    };
  }, [evaluationItems]);



  function addEvaluationItem(category: SkillCategory) {
    setEvaluationItems((current) => [
      ...current,
      {
        id: createClientId("new-item"),
        category,
        axis: category === SkillCategory.IT_SKILL ? "SELF_GROWTH" : "SYNERGY",
        scoreType: category === SkillCategory.IT_SKILL ? "LEVEL_2" : "CONTINUOUS_DONE",
        inputScope: "BOTH",
        majorCategory: defaultMajorCategory(category),
        majorCategoryOrder: current.filter((row) => row.category === category).length + 1,
        minorCategory: defaultMinorCategory(category),
        minorCategoryOrder: 1,
        title: "",
        description: "",
        weight: category === SkillCategory.IT_SKILL ? 10 : 1,
        displayOrder: current.filter((row) => row.category === category).length + 1,
        isActive: true,
        evidenceRequired: category === SkillCategory.BUSINESS_SKILL,
        gradeDefinitionId: null,
      },
    ]);
  }

  async function saveSkillCareerSettings(nextEvaluationItems = evaluationItems, successMessage = "評価制度設定を保存しました") {
    setMessage(null);

    startSaving(async () => {
      const response = await fetch("/api/skill-careers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades, evaluationItems: nextEvaluationItems }),
      });

      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? successMessage : "保存に失敗しました"));

      if (response.ok) {
        setEvaluationItems(nextEvaluationItems);
        setCsvImportPreview(null);
        router.refresh();
      }
    });
  }

  async function handleSave() {
    await saveSkillCareerSettings(evaluationItems, "評価制度設定を保存しました");
  }



  function handleExportItemsCsv() {
    const rows = evaluationItems
      .slice()
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category, "ja") ||
          left.majorCategoryOrder - right.majorCategoryOrder ||
          left.minorCategoryOrder - right.minorCategoryOrder ||
          left.displayOrder - right.displayOrder ||
          left.id.localeCompare(right.id, "ja"),
      )
      .map((row) => [
        row.category,
        row.axis,
        row.scoreType,
        row.majorCategory,
        row.majorCategoryOrder,
        row.minorCategory,
        row.minorCategoryOrder,
        row.title,
        row.description,
        row.weight,
        row.displayOrder,
        row.evidenceRequired,
        row.isActive,
        row.inputScope,
      ]);

    downloadCsv(
      "evaluation-settings-items.csv",
      ["category", "axis", "scoreType", "majorCategory", "majorCategoryOrder", "minorCategory", "minorCategoryOrder", "title", "description", "weight", "displayOrder", "evidenceRequired", "isActive", "inputScope"],
      rows,
    );
  }

  async function handleImportItemsCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      setCsvImportStatus("ファイル選択がキャンセルされました");
      return;
    }

    setCsvImportStatus(`選択ファイル: ${file.name}`);
    setMessage(`CSVファイル ${file.name} を読み込み中です...`);

    try {
      const text = await readCsvFile(file);
      const preview = parseEvaluationItemsCsv(text, evaluationItems);
      setCsvImportPreview(preview);
      setCsvImportMode("merge");

      requestAnimationFrame(() => {
        csvPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      if (preview.errorMessages.length > 0 && preview.rows.length === 0) {
        setCsvImportStatus(`読込失敗: ${preview.errorMessages.join(" / ")}`);
        setMessage(preview.errorMessages.join(" / "));
        return;
      }

      const nextMessage = `CSVを読み込みました。新規 ${preview.newCount} 件、更新 ${preview.updateCount} 件です。画面下のプレビューを確認してください。`;
      setCsvImportStatus(nextMessage);
      setMessage(nextMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSVの読み込みに失敗しました";
      setCsvImportPreview(null);
      setCsvImportStatus(`読込例外: ${message}`);
      setMessage(message);
    }
  }

  async function handleApplyItemsCsv() {
    if (!csvImportPreview || csvImportPreview.rows.length === 0) {
      setMessage("反映するCSVプレビューがありません");
      return;
    }

    const nextItems = applyImportedEvaluationItems(evaluationItems, csvImportPreview.rows, csvImportMode);
    await saveSkillCareerSettings(
      nextItems,
      `CSV取込を反映しました（${csvImportModeLabel(csvImportMode)} / 新規 ${csvImportPreview.newCount} 件 / 更新 ${csvImportPreview.updateCount} 件）`,
    );
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">評価制度設定</h2>
            <p className="mt-1 text-sm text-slate-500">等級名称、判定閾値、職種別ルール、評価項目を管理し、半期評価の制度設定として利用します。項目毎に根拠要否、使用有無の設定ができます。</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPhilosophy((current) => !current)}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            {showPhilosophy ? "制度説明を閉じる" : "制度説明を表示"}
          </button>
        </div>
        {showPhilosophy ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-slate-700">
            <p>当社の評価制度は、理念である「自律的成長によって必要とされる存在となり、協調相乗をもって他者貢献に尽くす。」を軸に、<span className="font-semibold text-slate-950">自律成長力</span>と<span className="font-semibold text-slate-950">協調相乗力</span>の2つの観点から構成します。</p>
            <p className="mt-2"><span className="font-semibold text-slate-950">自律成長力</span>は、自ら学び、考え、行動し、仕事を通じて必要とされる存在になる力を表します。</p>
            <p className="mt-2"><span className="font-semibold text-slate-950">協調相乗力</span>は、周囲と力を掛け合わせ、他者や組織により大きな価値を生み出す力を表します。</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-sm text-slate-500">自律成長力項目数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{itemSummary.selfGrowthCount}</p>
          <p className="mt-2 text-xs text-slate-500">1 / 2 評価で能力水準を確認します。</p>
        </article>
        <article className="rounded-3xl border border-sky-200 bg-sky-50/80 p-4">
          <p className="text-sm text-slate-500">協調相乗力項目数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{itemSummary.synergyCount}</p>
          <p className="mt-2 text-xs text-slate-500">0 / 1 で継続実践を確認します。</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">根拠必須項目</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{itemSummary.synergyEvidenceRequiredCount}</p>
          <p className="mt-2 text-xs text-slate-500">協調相乗力では原則オンを推奨します。</p>
        </article>
        <article className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-sm text-slate-500">重み3の重点項目</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{itemSummary.synergyHighWeightCount}</p>
          <p className="mt-2 text-xs text-slate-500">全社・事業拡大に効く項目の目安です。</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {([SkillCategory.IT_SKILL, SkillCategory.BUSINESS_SKILL] as SkillCategory[]).map((category) => (
          <section key={`guide-${category}`} className="rounded-3xl border border-slate-200 p-5">
            <h3 className="text-lg font-semibold text-slate-950">{categoryLabel(category)}</h3>
            <p className="mt-1 text-sm text-slate-500">{categoryGuides[category].subtitle}</p>
            <p className="mt-2 text-sm font-medium text-slate-700">評価方式: {categoryGuides[category].scoreLabel}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {categoryGuides[category].majorCategories.map((section) => (
                <span key={section.name} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  {section.name}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>





      {[SkillCategory.IT_SKILL, SkillCategory.BUSINESS_SKILL].map((category) => (
        <section key={`${category}-items`} className="space-y-4 rounded-3xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-950">{categoryLabel(category)}評価項目</h3>
              <p className="mt-1 text-sm text-slate-500">半期評価で使う項目、採点方式、重み、有効状態を管理します。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-slate-700">
                大分類で絞込
                <select
                  value={majorCategoryFilters[category]}
                  onChange={(event) =>
                    setMajorCategoryFilters((current) => ({
                      ...current,
                      [category]: event.target.value,
                    }))
                  }
                  className="mt-2 w-56 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none"
                >
                  <option value="">すべて</option>
                  {majorCategoryOptions[category].map((option) => (
                    <option key={`${category}-${option}`} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const recommendedItems = buildRecommendedItems(category, evaluationItems);
                  if (recommendedItems.length === 0) {
                    setMessage(`${categoryLabel(category)}のおすすめ項目はすでに反映済みです`);
                    return;
                  }
                  setEvaluationItems((current) => [...current, ...recommendedItems]);
                  setMessage(`${categoryLabel(category)}のおすすめ初期項目を ${recommendedItems.length} 件追加しました`);
                }}
                disabled={!canEdit || isPending}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:border-slate-200 disabled:text-slate-400"
              >
                おすすめ初期項目を入れる
              </button>
              <button type="button" onClick={() => addEvaluationItem(category)} disabled={!canEdit || isPending} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:border-slate-200 disabled:text-slate-400">
                項目を追加
              </button>
            </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1660px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">軸</th>
                  <th className="px-4 py-3 font-medium">採点方式</th>
                  <th className="px-4 py-3 font-medium">大分類</th>
                  <th className="px-4 py-3 font-medium">大分類順</th>
                  <th className="px-4 py-3 font-medium">小分類</th>
                  <th className="px-4 py-3 font-medium">小分類順</th>
                  <th className="px-4 py-3 font-medium">項目名</th>
                  <th className="px-4 py-3 font-medium">説明</th>
                  <th className="px-4 py-3 font-medium">重み</th>
                  <th className="px-4 py-3 font-medium">入力者区分</th>
                  <th className="px-4 py-3 font-medium">根拠</th>
                  <th className="px-4 py-3 font-medium">使用</th>
                </tr>
              </thead>
              <tbody>
                {evaluationItems
                  .filter((row) => row.category === category)
                  .filter((row) => !majorCategoryFilters[category] || row.majorCategory === majorCategoryFilters[category])
                  .sort((left, right) =>
                    left.majorCategoryOrder - right.majorCategoryOrder ||
                    left.minorCategoryOrder - right.minorCategoryOrder ||
                    left.displayOrder - right.displayOrder ||
                    left.id.localeCompare(right.id, "ja")
                  )
                  .map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <select
                          value={row.axis}
                          disabled={!canEdit || isPending}
                          onChange={(event) =>
                            setEvaluationItems((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? normalizeItemByAxis(item, event.target.value === "SYNERGY" ? "SYNERGY" : "SELF_GROWTH")
                                  : item,
                              ),
                            )
                          }
                          className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="SELF_GROWTH">自律成長力</option>
                          <option value="SYNERGY">協調相乗力</option>
                        </select>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${row.axis === "SYNERGY" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {row.axis === "SYNERGY" ? "継続実践を評価" : "能力水準を評価"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <select
                          value={row.scoreType}
                          disabled={!canEdit || isPending || row.axis === "SYNERGY"}
                          onChange={(event) =>
                            setEvaluationItems((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? { ...item, scoreType: event.target.value === "CONTINUOUS_DONE" ? "CONTINUOUS_DONE" : "LEVEL_2" }
                                  : item,
                              ),
                            )
                          }
                          className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="LEVEL_2">1 / 2 評価</option>
                          <option value="CONTINUOUS_DONE">0 / 1 継続実践</option>
                        </select>
                        <p className="text-xs text-slate-500">{scoreTypeLabel(row.scoreType)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" value={row.majorCategory} disabled={!canEdit || isPending} onChange={(event) => setEvaluationItems((current) => current.map((item) => item.id === row.id ? { ...item, majorCategory: event.target.value } : item))} className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={row.majorCategoryOrder}
                        disabled={!canEdit || isPending}
                        onChange={(event) => {
                          const nextValue = toNumber(event.target.value);
                          setEvaluationItems((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? { ...item, majorCategoryOrder: nextValue }
                                : item,
                            ),
                          );
                        }}
                        className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" value={row.minorCategory} disabled={!canEdit || isPending} onChange={(event) => setEvaluationItems((current) => current.map((item) => item.id === row.id ? { ...item, minorCategory: event.target.value } : item))} className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={row.minorCategoryOrder}
                        disabled={!canEdit || isPending}
                        onChange={(event) => {
                          const nextValue = toNumber(event.target.value);
                          setEvaluationItems((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? { ...item, minorCategoryOrder: nextValue }
                                : item,
                            ),
                          );
                        }}
                        className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" value={row.title} disabled={!canEdit || isPending} onChange={(event) => setEvaluationItems((current) => current.map((item) => item.id === row.id ? { ...item, title: event.target.value } : item))} className="w-72 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" value={row.description} disabled={!canEdit || isPending} onChange={(event) => setEvaluationItems((current) => current.map((item) => item.id === row.id ? { ...item, description: event.target.value } : item))} className="w-72 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <input
                          type="number"
                          min={row.axis === "SYNERGY" ? 1 : 0}
                          max={row.axis === "SYNERGY" ? 3 : undefined}
                          step={row.axis === "SYNERGY" ? 1 : 0.01}
                          value={row.weight}
                          disabled={!canEdit || isPending}
                          onChange={(event) =>
                            setEvaluationItems((current) =>
                              current.map((item) => {
                                if (item.id !== row.id) return item;
                                const nextWeight = toNumber(event.target.value);
                                return {
                                  ...item,
                                  weight: item.axis === "SYNERGY" ? Math.min(3, Math.max(1, Math.round(nextWeight || 1))) : nextWeight,
                                };
                              }),
                            )
                          }
                          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        {row.axis === "SYNERGY" ? (
                          <div className="flex gap-2">
                            {[1, 2, 3].map((weight) => (
                              <button
                                key={weight}
                                type="button"
                                disabled={!canEdit || isPending}
                                onClick={() =>
                                  setEvaluationItems((current) =>
                                    current.map((item) => (item.id === row.id ? { ...item, weight } : item)),
                                  )
                                }
                                className={`rounded-full border px-2.5 py-1 text-xs ${row.weight === weight ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                              >
                                {weight}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-xs text-slate-500">{weightHint(row)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <select
                          value={row.inputScope}
                          disabled={!canEdit || isPending}
                          onChange={(event) =>
                            setEvaluationItems((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? { ...item, inputScope: normalizeInputScope(event.target.value) ?? "BOTH" }
                                  : item,
                              ),
                            )
                          }
                          className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="SELF">本人のみ</option>
                          <option value="MANAGER">上長のみ</option>
                          <option value="BOTH">両方</option>
                        </select>
                        <p className="text-xs text-slate-500">{inputScopeLabel(row.inputScope)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-slate-700">
                        <input
                          type="checkbox"
                          checked={row.evidenceRequired}
                          disabled={!canEdit || isPending || row.axis === "SYNERGY"}
                          onChange={(event) => setEvaluationItems((current) => current.map((item) => item.id === row.id ? { ...item, evidenceRequired: event.target.checked } : item))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {row.axis === "SYNERGY" ? "必須" : "根拠"}
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-slate-700">
                        <input type="checkbox" checked={row.isActive} disabled={!canEdit || isPending} onChange={(event) => setEvaluationItems((current) => current.map((item) => item.id === row.id ? { ...item, isActive: event.target.checked } : item))} className="h-4 w-4 rounded border-slate-300" />
                        使用
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">判定ロジック</p>
        <p className="mt-2">最終評価時に、自律成長力は 1 / 2、協調相乗力は 0 / 1 の継続実践で集計し、各カテゴリ点を別々に計算します。</p>
        <p className="mt-1">同じカテゴリに職種別ルールがある場合は、対象社員の職種に一致する設定を優先し、なければ全職種共通ルールを使います。</p>
      </div>

      {csvImportPreview ? (
        <section ref={csvPreviewRef} className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-950">CSV取込プレビュー</p>
              <p className="mt-1">新規 {csvImportPreview.newCount} 件 / 更新 {csvImportPreview.updateCount} 件 / エラー {csvImportPreview.errorMessages.length} 件</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={handleApplyItemsCsv} disabled={!canEdit || isPending || csvImportPreview.rows.length === 0} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
                CSVを反映
              </button>
              <button type="button" onClick={() => setCsvImportPreview(null)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                プレビューを閉じる
              </button>
            </div>
          </div>
          {csvImportPreview.errorMessages.length > 0 ? (
            <ul className="mt-3 space-y-1 text-rose-700">
              {csvImportPreview.errorMessages.slice(0, 10).map((error) => (
                <li key={error}>・{error}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleExportItemsCsv} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700">
          評価項目CSV出力
        </button>
        <button
          type="button"
          onClick={() => csvFileInputRef.current?.click()}
          disabled={!canEdit || isPending}
          className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 disabled:border-slate-200 disabled:text-slate-400"
        >
          評価項目CSV取込
        </button>
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleImportItemsCsv}
          disabled={!canEdit || isPending}
          className="hidden"
        />
        <button type="button" onClick={handleSave} disabled={!canEdit || isPending} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {isPending ? "処理中..." : "評価制度設定を保存"}
        </button>
      </div>

      {csvImportStatus ? <p className="text-sm text-sky-700">{csvImportStatus}</p> : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
