import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type UiSettings = {
  employeeNavLabel: string;
  leaderNavLabel: string;
  adminNavLabel: string;
  growthRecordsLabel: string;
  oneOnOneLabel: string;
  homeMessage: string;
};

export const defaultUiSettings: UiSettings = {
  employeeNavLabel: "マイページ",
  leaderNavLabel: "メンバー一覧",
  adminNavLabel: "社員一覧",
  growthRecordsLabel: "成長の記録",
  oneOnOneLabel: "1on1サポート",
  homeMessage: "キャリア形成を自分らしく進められる入口",
};

const settingsFilePath = path.join(process.cwd(), "data", "ui-settings.json");

function sanitizeSettings(input: Partial<UiSettings> | null | undefined): UiSettings {
  return {
    employeeNavLabel: input?.employeeNavLabel?.trim() || defaultUiSettings.employeeNavLabel,
    leaderNavLabel: input?.leaderNavLabel?.trim() || defaultUiSettings.leaderNavLabel,
    adminNavLabel: input?.adminNavLabel?.trim() || defaultUiSettings.adminNavLabel,
    growthRecordsLabel: input?.growthRecordsLabel?.trim() || defaultUiSettings.growthRecordsLabel,
    oneOnOneLabel: input?.oneOnOneLabel?.trim() || defaultUiSettings.oneOnOneLabel,
    homeMessage: input?.homeMessage?.trim() || defaultUiSettings.homeMessage,
  };
}

export async function getUiSettings(): Promise<UiSettings> {
  try {
    const raw = await readFile(settingsFilePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return sanitizeSettings(parsed);
  } catch {
    return defaultUiSettings;
  }
}

export async function saveUiSettings(input: Partial<UiSettings>): Promise<UiSettings> {
  const settings = sanitizeSettings(input);
  await mkdir(path.dirname(settingsFilePath), { recursive: true });
  await writeFile(settingsFilePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}
