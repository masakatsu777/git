import { cookies } from "next/headers";
import { getUiSettings } from "@/lib/ui-settings";
import { getEmployeeRecordByCode, getEmployeeRecords } from "@/lib/server/employee-records";

export type ViewerRole = "employee" | "leader" | "admin";

type Viewer = {
  role: ViewerRole;
  employeeId: string;
};

const defaultViewerByRole: Record<ViewerRole, Viewer> = {
  employee: {
    role: "employee",
    employeeId: "E1002",
  },
  leader: {
    role: "leader",
    employeeId: "E1001",
  },
  admin: {
    role: "admin",
    employeeId: "E0002",
  },
};

function isViewerRole(value: string): value is ViewerRole {
  return value === "employee" || value === "leader" || value === "admin";
}

export async function getCurrentViewer(): Promise<Viewer> {
  const cookieStore = await cookies();
  const cookieRole = cookieStore.get("preview-role")?.value;

  if (cookieRole && isViewerRole(cookieRole)) {
    return defaultViewerByRole[cookieRole];
  }

  return defaultViewerByRole.employee;
}

export async function getCurrentEmployee() {
  const viewer = await getCurrentViewer();
  return getEmployeeRecordByCode(viewer.employeeId);
}

export async function getVisibleEmployees() {
  const viewer = await getCurrentViewer();
  const currentEmployee = await getCurrentEmployee();
  const employees = await getEmployeeRecords();

  if (!currentEmployee) {
    return [];
  }

  if (viewer.role === "employee") {
    return [currentEmployee];
  }

  if (viewer.role === "leader") {
    return employees.filter((employee) => employee.team === currentEmployee.team);
  }

  return employees;
}

export async function canViewEmployeeDetail(employeeId: string) {
  const viewer = await getCurrentViewer();
  const currentEmployee = await getCurrentEmployee();
  const targetEmployee = await getEmployeeRecordByCode(employeeId);

  if (!currentEmployee || !targetEmployee) {
    return false;
  }

  if (viewer.role === "admin") {
    return true;
  }

  if (viewer.role === "leader") {
    return currentEmployee.team === targetEmployee.team;
  }

  return currentEmployee.id === targetEmployee.id;
}

export async function getEmployeesPageContent() {
  const viewer = await getCurrentViewer();
  const currentEmployee = await getCurrentEmployee();
  const ui = await getUiSettings();

  if (!currentEmployee) {
    return {
      navLabel: ui.adminNavLabel,
      pageTitle: ui.adminNavLabel,
      pageDescription: "表示対象の社員情報がありません。",
      ctaLabel: `${ui.growthRecordsLabel}を見る`,
    };
  }

  if (viewer.role === "employee") {
    return {
      navLabel: ui.employeeNavLabel,
      pageTitle: ui.employeeNavLabel,
      pageDescription: "自分の成長テーマや所属チームの状況を確認するための入口です。",
      ctaLabel: `自分の${ui.growthRecordsLabel}を見る`,
    };
  }

  if (viewer.role === "leader") {
    return {
      navLabel: ui.leaderNavLabel,
      pageTitle: ui.leaderNavLabel,
      pageDescription: `${currentEmployee.team} のメンバー状況を見渡し、対話や支援につなげるための一覧です。`,
      ctaLabel: `チームの${ui.growthRecordsLabel}を見る`,
    };
  }

  return {
    navLabel: ui.adminNavLabel,
    pageTitle: ui.adminNavLabel,
    pageDescription: "全体の成長状況を見渡し、そのまま記録や1on1の画面へ進める入口です。",
    ctaLabel: `全体の${ui.growthRecordsLabel}を見る`,
  };
}

export async function getRoleSwitcherItems() {
  const viewer = await getCurrentViewer();

  return [
    { role: "employee" as ViewerRole, label: "社員", active: viewer.role === "employee" },
    { role: "leader" as ViewerRole, label: "リーダー", active: viewer.role === "leader" },
    { role: "admin" as ViewerRole, label: "管理者", active: viewer.role === "admin" },
  ];
}

export async function getHomePageContent() {
  const viewer = await getCurrentViewer();
  const currentEmployee = await getCurrentEmployee();
  const visibleEmployees = await getVisibleEmployees();
  const ui = await getUiSettings();

  if (!currentEmployee) {
    return {
      heroTitle: "キャリア形成ポータル",
      heroHighlight: "必要な情報をやわらかく見渡せる形にしています。",
      description: "ログイン情報が見つからないため、表示内容を決められませんでした。",
      primaryCtaLabel: `${ui.adminNavLabel}を見る`,
      primaryCtaHref: "/employees",
      secondaryCtaLabel: "環境設定を見る",
      secondaryCtaHref: "/settings",
      quickStart: [
        "表示対象を確認する",
        "必要なページへ進む",
        "運用に合わせて画面を整える",
      ],
      quickLinks: [
        { label: ui.adminNavLabel, href: "/employees" },
        { label: ui.growthRecordsLabel, href: "/growth-records" },
        { label: ui.oneOnOneLabel, href: "/one-on-one" },
      ],
      highlights: [
        {
          title: "役割に合わせた出し分け",
          description: "社員・リーダー・管理者で必要な導線を切り替えられます。",
          badge: "Role Based",
        },
        {
          title: "共通 UI を components に集約",
          description: "同じ見た目と操作感を保ったまま画面を増やせます。",
          badge: "Components",
        },
        {
          title: "Next.js / Tailwind の土台",
          description: "App Router を前提に、後から認証や API を差し込みやすい構成です。",
          badge: "Foundation",
        },
      ],
    };
  }

  if (viewer.role === "employee") {
    return {
      heroTitle: `${currentEmployee.name}さんのキャリア形成を`,
      heroHighlight: ui.homeMessage,
      description: "自分の成長テーマ、所属チームの流れ、次回1on1の準備をひと続きで確認できます。",
      primaryCtaLabel: `${ui.employeeNavLabel}を見る`,
      primaryCtaHref: "/employees",
      secondaryCtaLabel: `自分の${ui.growthRecordsLabel}へ`,
      secondaryCtaHref: "/growth-records",
      quickStart: [
        "自分の詳細から今月のテーマを確認する",
        `${ui.growthRecordsLabel}でふりかえりを残す`,
        "1on1準備で次の相談事項を整理する",
      ],
      quickLinks: [
        { label: ui.employeeNavLabel, href: "/employees" },
        { label: `自分の${ui.growthRecordsLabel}`, href: "/growth-records" },
        { label: "1on1準備", href: "/one-on-one" },
      ],
      highlights: [
        {
          title: "自分のテーマに集中",
          description: "今取り組むテーマと次の一歩を、負担なく見返せるようにしています。",
          badge: "Self View",
        },
        {
          title: "チーム状況もやわらかく確認",
          description: "詳細な管理数値ではなく、流れをつかむための主要指標を見られます。",
          badge: "Summary",
        },
        {
          title: `${ui.oneOnOneLabel}へつなげやすい`,
          description: "ふりかえりから対話準備まで自然につながる導線にしています。",
          badge: "Support",
        },
      ],
    };
  }

  if (viewer.role === "leader") {
    return {
      heroTitle: `${currentEmployee.team}の成長支援を`,
      heroHighlight: ui.homeMessage,
      description: `${visibleEmployees.length}名のメンバー状況、成長テーマ、1on1の準備ポイントをひと目で追える入口です。`,
      primaryCtaLabel: `${ui.leaderNavLabel}を見る`,
      primaryCtaHref: "/employees",
      secondaryCtaLabel: `チームの${ui.growthRecordsLabel}へ`,
      secondaryCtaHref: "/growth-records",
      quickStart: [
        `${ui.leaderNavLabel}で支援対象を確認する`,
        `${ui.growthRecordsLabel}でテーマの変化を見る`,
        `${ui.oneOnOneLabel}で次回の問いを整える`,
      ],
      quickLinks: [
        { label: ui.leaderNavLabel, href: "/employees" },
        { label: `チームの${ui.growthRecordsLabel}`, href: "/growth-records" },
        { label: ui.oneOnOneLabel, href: "/one-on-one" },
      ],
      highlights: [
        {
          title: "支援対象が見えやすい",
          description: "同じチームのメンバーだけを対象にして、日々の支援に集中できます。",
          badge: "Team Focus",
        },
        {
          title: "社員詳細からチーム数値へ",
          description: "個人のテーマとチーム状況を行き来しながら支援できます。",
          badge: "Linked View",
        },
        {
          title: "対話準備を軽くする",
          description: "次回1on1で扱う問いや観点を整理しやすい構成です。",
          badge: "Coaching",
        },
      ],
    };
  }

  return {
    heroTitle: "全体のキャリア形成状況を",
    heroHighlight: ui.homeMessage,
    description: "社員全体の状況、チームごとの対話支援、文言や運用の整備ポイントを俯瞰できる入口です。",
    primaryCtaLabel: `${ui.adminNavLabel}を見る`,
    primaryCtaHref: "/employees",
    secondaryCtaLabel: "環境設定を見る",
    secondaryCtaHref: "/settings",
    quickStart: [
      "全体の状況を一覧で確認する",
      `${ui.growthRecordsLabel}と1on1運用の流れを見る`,
      "必要なテンプレートや文言を調整する",
    ],
    quickLinks: [
      { label: ui.adminNavLabel, href: "/employees" },
      { label: `全体の${ui.growthRecordsLabel}`, href: "/growth-records" },
      { label: "環境設定", href: "/settings" },
    ],
    highlights: [
      {
        title: "全体俯瞰しやすい",
        description: "社員・チーム・運用の3つを行き来しながら整備できます。",
        badge: "Overview",
      },
      {
        title: "role ごとの差分を確認できる",
        description: "社員・リーダー・管理者の見え方を切り替えながら検証できます。",
        badge: "Preview",
      },
      {
        title: "運用改善につなげやすい",
        description: "テンプレートや文言の調整ポイントへすぐ進める構成です。",
        badge: "Operations",
      },
    ],
  };
}
