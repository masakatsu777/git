import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const settingsPath = path.join(process.cwd(), "data", "settings", "salary-structure.json");

type SalaryStructureBand = {
  code: string;
  name: string;
  amount: number;
  description: string;
};

type GrossProfitAdjustmentRow = {
  id: string;
  label: string;
  minRate: number;
  maxRate: number | null;
  multiplier: number;
};

export type SalaryStructureBundle = {
  selfGrowthBands: SalaryStructureBand[];
  synergyBands: SalaryStructureBand[];
  grossProfitAdjustments: GrossProfitAdjustmentRow[];
  source: "default" | "file";
};

type SaveSalaryStructureInput = {
  selfGrowthBands: SalaryStructureBand[];
  synergyBands: SalaryStructureBand[];
  grossProfitAdjustments: GrossProfitAdjustmentRow[];
};

const defaultSelfGrowthBands: SalaryStructureBand[] = [
  { code: "SG1", name: "自律成長初級", amount: 220000, description: "基礎を身につけ、担当業務を安定して進められる水準" },
  { code: "SG2", name: "自律成長準中級", amount: 260000, description: "担当領域を自律的に進め、一定の成果を継続できる水準" },
  { code: "SG3", name: "自律成長中級", amount: 300000, description: "役割期待を安定して満たし、周囲と連携して成果を出せる水準" },
  { code: "SG4", name: "自律成長上級", amount: 350000, description: "高い専門性と推進力で周囲へ波及できる水準" },
  { code: "SG5", name: "自律成長上位", amount: 410000, description: "上位難易度の役割を担い、組織へ広く価値を返せる水準" },
];

const defaultSynergyBands: SalaryStructureBand[] = [
  { code: "KG1", name: "協調相乗初級", amount: 0, description: "継続的な協調相乗行動はこれから広げていく段階" },
  { code: "KG2", name: "協調相乗実践", amount: 10000, description: "チーム内での継続実践が見え始めている段階" },
  { code: "KG3", name: "協調相乗中級", amount: 25000, description: "チームや顧客に対する継続実践が安定している段階" },
  { code: "KG4", name: "協調相乗上級", amount: 45000, description: "組織や顧客拡張に明確な波及がある段階" },
  { code: "KG5", name: "協調相乗牽引", amount: 70000, description: "全社や事業拡大に高い継続価値を生んでいる段階" },
];

const defaultGrossProfitAdjustments: GrossProfitAdjustmentRow[] = [
  { id: "gp-110", label: "110%以上", minRate: 110, maxRate: null, multiplier: 1.1 },
  { id: "gp-105", label: "105%以上110%未満", minRate: 105, maxRate: 109.99, multiplier: 1.05 },
  { id: "gp-95", label: "95%以上105%未満", minRate: 95, maxRate: 104.99, multiplier: 1 },
  { id: "gp-90", label: "90%以上95%未満", minRate: 90, maxRate: 94.99, multiplier: 0.95 },
  { id: "gp-0", label: "90%未満", minRate: 0, maxRate: 89.99, multiplier: 0.9 },
];

function createDefaultBundle(): SalaryStructureBundle {
  return {
    selfGrowthBands: defaultSelfGrowthBands,
    synergyBands: defaultSynergyBands,
    grossProfitAdjustments: defaultGrossProfitAdjustments,
    source: "default",
  };
}

function normalizeBand(band: SalaryStructureBand, index: number, prefix: string): SalaryStructureBand {
  const code = band.code?.trim() || `${prefix}${index + 1}`;
  return {
    code,
    name: band.name?.trim() || code,
    amount: Number.isFinite(band.amount) ? Math.max(0, Math.round(band.amount)) : 0,
    description: band.description?.trim() || "",
  };
}

function normalizeAdjustment(row: GrossProfitAdjustmentRow, index: number): GrossProfitAdjustmentRow {
  return {
    id: row.id?.trim() || `gp-${index + 1}`,
    label: row.label?.trim() || `粗利補正 ${index + 1}`,
    minRate: Number.isFinite(row.minRate) ? row.minRate : 0,
    maxRate: row.maxRate == null ? null : Number.isFinite(row.maxRate) ? row.maxRate : null,
    multiplier: Number.isFinite(row.multiplier) ? row.multiplier : 1,
  };
}

export async function getSalaryStructureBundle(): Promise<SalaryStructureBundle> {
  try {
    const raw = await readFile(settingsPath, "utf-8");
    const parsed = JSON.parse(raw) as SaveSalaryStructureInput;

    return {
      selfGrowthBands: parsed.selfGrowthBands.map((band, index) => normalizeBand(band, index, "SG")),
      synergyBands: parsed.synergyBands.map((band, index) => normalizeBand(band, index, "KG")),
      grossProfitAdjustments: parsed.grossProfitAdjustments.map((row, index) => normalizeAdjustment(row, index)),
      source: "file",
    };
  } catch {
    return createDefaultBundle();
  }
}

export async function saveSalaryStructureBundle(input: SaveSalaryStructureInput): Promise<SalaryStructureBundle> {
  const bundle: SalaryStructureBundle = {
    selfGrowthBands: input.selfGrowthBands.map((band, index) => normalizeBand(band, index, "SG")),
    synergyBands: input.synergyBands.map((band, index) => normalizeBand(band, index, "KG")),
    grossProfitAdjustments: input.grossProfitAdjustments.map((row, index) => normalizeAdjustment(row, index)),
    source: "file",
  };

  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(
    settingsPath,
    JSON.stringify(
      {
        selfGrowthBands: bundle.selfGrowthBands,
        synergyBands: bundle.synergyBands,
        grossProfitAdjustments: bundle.grossProfitAdjustments,
      },
      null,
      2,
    ),
    "utf-8",
  );

  return bundle;
}
