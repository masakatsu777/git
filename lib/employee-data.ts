export type EmployeeRecord = {
  id: string;
  name: string;
  role: string;
  team: string;
  department: string;
  theme: string;
  nextAction: string;
  tone: string;
  joinedAt: string;
  lastUpdatedDaysAgo: number;
  nextOneOnOneDate: string;
  focus: string[];
  recentNote: string;
  teamSummary: {
    yearMonth: string;
    sales: number;
    salesTarget: number;
    grossProfit: number;
    grossProfitTarget: number;
    grossProfitRate: number;
    grossProfitRateTarget: number;
    totalCost: number;
    directCost: number;
    indirectCost: number;
    fixedCostAllocation: number;
    teamMembers: number;
    partners: number;
  };
};

export type EmployeeFilters = {
  q?: string;
  role?: string;
  team?: string;
  tone?: string;
};

export type EmployeeSort = "priority" | "name" | "role" | "team";
export type RecordSort = "priority" | "name" | "role";

export const employees: EmployeeRecord[] = [
  {
    id: "E1001",
    name: "主任 次郎",
    role: "リーダー",
    team: "プラットフォームチーム",
    department: "開発本部",
    theme: "対話の質を上げて、メンバーの挑戦を後押しする",
    nextAction: "1on1で成長テーマの棚卸しを行う",
    tone: "伴走中",
    joinedAt: "2024-04-01",
    lastUpdatedDaysAgo: 3,
    nextOneOnOneDate: "2026-03-18",
    focus: ["1on1の質向上", "チーム支援", "進行の言語化"],
    recentNote: "メンバーの挑戦内容を毎週の対話に乗せる動きが定着し始めています。",
    teamSummary: {
      yearMonth: "2026-03",
      sales: 2450000,
      salesTarget: 2500000,
      grossProfit: 500000,
      grossProfitTarget: 800000,
      grossProfitRate: 20.4,
      grossProfitRateTarget: 32,
      totalCost: 1950000,
      directCost: 1530000,
      indirectCost: 120000,
      fixedCostAllocation: 300000,
      teamMembers: 3,
      partners: 1,
    },
  },
  {
    id: "E1002",
    name: "開発 一郎",
    role: "メンバー",
    team: "プラットフォームチーム",
    department: "開発本部",
    theme: "設計レビューで意図を伝え切る",
    nextAction: "次回レビューで観点メモを事前共有する",
    tone: "ふりかえり更新待ち",
    joinedAt: "2024-04-01",
    lastUpdatedDaysAgo: 14,
    nextOneOnOneDate: "2026-03-14",
    focus: ["設計レビュー", "説明力", "チーム内共有"],
    recentNote: "レビューの論点整理が進み、設計意図の共有が安定してきました。",
    teamSummary: {
      yearMonth: "2026-03",
      sales: 2450000,
      salesTarget: 2500000,
      grossProfit: 500000,
      grossProfitTarget: 800000,
      grossProfitRate: 20.4,
      grossProfitRateTarget: 32,
      totalCost: 1950000,
      directCost: 1530000,
      indirectCost: 120000,
      fixedCostAllocation: 300000,
      teamMembers: 3,
      partners: 1,
    },
  },
  {
    id: "E1003",
    name: "開発 二郎",
    role: "メンバー",
    team: "プラットフォームチーム",
    department: "開発本部",
    theme: "顧客視点を提案に乗せる",
    nextAction: "営業同席メモをキャリアシートへ残す",
    tone: "次回1on1で確認",
    joinedAt: "2024-04-01",
    lastUpdatedDaysAgo: 7,
    nextOneOnOneDate: "2026-03-13",
    focus: ["顧客理解", "提案力", "ふりかえり"],
    recentNote: "顧客会話の要点を整理して次回提案に活かす姿勢が見えてきています。",
    teamSummary: {
      yearMonth: "2026-03",
      sales: 2450000,
      salesTarget: 2500000,
      grossProfit: 500000,
      grossProfitTarget: 800000,
      grossProfitRate: 20.4,
      grossProfitRateTarget: 32,
      totalCost: 1950000,
      directCost: 1530000,
      indirectCost: 120000,
      fixedCostAllocation: 300000,
      teamMembers: 3,
      partners: 1,
    },
  },
  {
    id: "E0002",
    name: "管理 花子",
    role: "管理者",
    team: "コーポレート支援",
    department: "経営支援室",
    theme: "制度と現場運用の距離を縮める",
    nextAction: "テンプレート文言をやわらかく見直す",
    tone: "運用改善中",
    joinedAt: "2024-04-01",
    lastUpdatedDaysAgo: 5,
    nextOneOnOneDate: "2026-03-20",
    focus: ["制度改善", "文言調整", "運用支援"],
    recentNote: "現場の言葉づかいに合わせたテンプレート見直しを継続しています。",
    teamSummary: {
      yearMonth: "2026-03",
      sales: 1180000,
      salesTarget: 1200000,
      grossProfit: 360000,
      grossProfitTarget: 400000,
      grossProfitRate: 30.5,
      grossProfitRateTarget: 33.3,
      totalCost: 820000,
      directCost: 610000,
      indirectCost: 90000,
      fixedCostAllocation: 120000,
      teamMembers: 2,
      partners: 0,
    },
  },
];

const tonePriority: Record<string, number> = {
  "ふりかえり更新待ち": 0,
  "次回1on1で確認": 1,
  "伴走中": 2,
  "運用改善中": 3,
};

const rolePriority: Record<string, number> = {
  "リーダー": 0,
  "メンバー": 1,
  "管理者": 2,
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "ja");
}

function compareDate(a: string, b: string) {
  return a.localeCompare(b);
}

export function getEmployeeById(employeeId: string) {
  return employees.find((employee) => employee.id === employeeId);
}

export function filterEmployees(records: EmployeeRecord[], filters: EmployeeFilters) {
  const query = normalize(filters.q ?? "");

  return records.filter((employee) => {
    const matchesQuery =
      !query ||
      [employee.name, employee.id, employee.role, employee.team, employee.theme, employee.nextAction]
        .map((value) => normalize(value))
        .some((value) => value.includes(query));

    const matchesRole = !filters.role || filters.role === "all" || employee.role === filters.role;
    const matchesTeam = !filters.team || filters.team === "all" || employee.team === filters.team;
    const matchesTone = !filters.tone || filters.tone === "all" || employee.tone === filters.tone;

    return matchesQuery && matchesRole && matchesTeam && matchesTone;
  });
}

export function sortEmployees(records: EmployeeRecord[], sort: EmployeeSort = "priority") {
  return [...records].sort((a, b) => {
    if (sort === "name") {
      return compareText(a.name, b.name);
    }

    if (sort === "role") {
      return rolePriority[a.role] - rolePriority[b.role] || compareText(a.name, b.name);
    }

    if (sort === "team") {
      return compareText(a.team, b.team) || compareText(a.name, b.name);
    }

    return tonePriority[a.tone] - tonePriority[b.tone] || b.lastUpdatedDaysAgo - a.lastUpdatedDaysAgo || compareText(a.name, b.name);
  });
}

export function sortGrowthRecords(records: EmployeeRecord[], sort: RecordSort = "priority") {
  return [...records].sort((a, b) => {
    if (sort === "name") {
      return compareText(a.name, b.name);
    }

    if (sort === "role") {
      return rolePriority[a.role] - rolePriority[b.role] || compareText(a.name, b.name);
    }

    return (
      tonePriority[a.tone] - tonePriority[b.tone] ||
      compareDate(a.nextOneOnOneDate, b.nextOneOnOneDate) ||
      b.lastUpdatedDaysAgo - a.lastUpdatedDaysAgo ||
      compareText(a.name, b.name)
    );
  });
}

export function getFilterOptions(records: EmployeeRecord[]) {
  return {
    roles: Array.from(new Set(records.map((employee) => employee.role))),
    teams: Array.from(new Set(records.map((employee) => employee.team))),
    tones: Array.from(new Set(records.map((employee) => employee.tone))),
  };
}
