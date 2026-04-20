import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const settingsPath = path.join(process.cwd(), "data", "settings", "grade-salary-setting.json");

export type GradeSalarySetting = {
  baseAmount: number;
  pointUnitAmount: number;
  effectiveFrom: string;
  remarks: string;
};

export type GradeSalarySettingBundle = GradeSalarySetting & {
  source: "default" | "file";
};

const defaultBundle: GradeSalarySettingBundle = {
  baseAmount: 180000,
  pointUnitAmount: 1000,
  effectiveFrom: "2026-04-01",
  remarks: "ベース金額 + G点×1点金額 で本給を算出",
  source: "default",
};

function normalize(input: Partial<GradeSalarySetting>): GradeSalarySettingBundle {
  return {
    baseAmount: Number.isFinite(Number(input.baseAmount)) ? Math.max(0, Math.round(Number(input.baseAmount))) : defaultBundle.baseAmount,
    pointUnitAmount: Number.isFinite(Number(input.pointUnitAmount)) ? Math.max(0, Math.round(Number(input.pointUnitAmount))) : defaultBundle.pointUnitAmount,
    effectiveFrom: String(input.effectiveFrom || defaultBundle.effectiveFrom),
    remarks: String(input.remarks || "").trim(),
    source: "file",
  };
}

export async function getGradeSalarySettingBundle(): Promise<GradeSalarySettingBundle> {
  try {
    const raw = await readFile(settingsPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<GradeSalarySetting>;
    return normalize(parsed);
  } catch {
    return defaultBundle;
  }
}

export async function saveGradeSalarySettingBundle(input: Partial<GradeSalarySetting>): Promise<GradeSalarySettingBundle> {
  const bundle = normalize(input);
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(
    settingsPath,
    JSON.stringify(
      {
        baseAmount: bundle.baseAmount,
        pointUnitAmount: bundle.pointUnitAmount,
        effectiveFrom: bundle.effectiveFrom,
        remarks: bundle.remarks,
      },
      null,
      2,
    ),
    "utf-8",
  );
  return bundle;
}
