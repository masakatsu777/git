import {
  PrismaClient,
  CostCategory,
  EvaluationPeriodStatus,
  EvaluationStatus,
  FixedCostAllocationMethod,
  PeriodType,
  SkillCategory,
} from "../generated/prisma";
import { createPasswordHash } from "../lib/auth/password";

const prisma = new PrismaClient();
const sampleYearMonth = "2026-03";
const samplePasswordHash = createPasswordHash("password");

async function main() {
  const permissions = [
    ["evaluation:self:write", "自己評価入力"],
    ["evaluation:team:write", "チーム評価入力"],
    ["evaluation:finalize", "評価確定"],
    ["pl:team:read", "チームPL閲覧"],
    ["pl:team:write", "チームPL入力"],
    ["pl:all:read", "全社PL閲覧"],
    ["cost:write", "原価入力"],
    ["salary:read", "給与閲覧"],
    ["salary:write", "給与更新"],
    ["salary:approve", "給与承認"],
    ["master:write", "マスタ管理"],
  ] as const;

  await prisma.permission.createMany({
    data: permissions.map(([code, name]) => ({ code, name })),
    skipDuplicates: true,
  });

  const roles = [
    { code: "employee", name: "社員" },
    { code: "leader", name: "リーダー" },
    { code: "admin", name: "管理者" },
    { code: "president", name: "役員" },
  ] as const;

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  const rolePermissions: Record<string, string[]> = {
    employee: ["evaluation:self:write", "pl:team:read"],
    leader: ["evaluation:self:write", "evaluation:team:write", "pl:team:read", "pl:team:write"],
    admin: permissions.map(([code]) => code),
    president: ["evaluation:finalize", "pl:all:read", "salary:read", "salary:approve"],
  };

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const permissionRows = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true },
    });

    await prisma.rolePermission.createMany({
      data: permissionRows.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  const development = await prisma.department.upsert({
    where: { id: "dept-development" },
    update: { name: "開発本部" },
    create: { id: "dept-development", name: "開発本部" },
  });

  const positions = [
    { code: "member", name: "メンバー", sortOrder: 10 },
    { code: "leader", name: "リーダー", sortOrder: 20 },
    { code: "manager", name: "管理者", sortOrder: 30 },
    { code: "president", name: "役員", sortOrder: 40 },
  ];

  for (const position of positions) {
    await prisma.position.upsert({
      where: { code: position.code },
      update: position,
      create: position,
    });
  }

  const employeeRole = await prisma.role.findUniqueOrThrow({ where: { code: "employee" } });
  const leaderRole = await prisma.role.findUniqueOrThrow({ where: { code: "leader" } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "admin" } });
  const presidentRole = await prisma.role.findUniqueOrThrow({ where: { code: "president" } });

  const memberPosition = await prisma.position.findUniqueOrThrow({ where: { code: "member" } });
  const leaderPosition = await prisma.position.findUniqueOrThrow({ where: { code: "leader" } });
  const managerPosition = await prisma.position.findUniqueOrThrow({ where: { code: "manager" } });
  const presidentPosition = await prisma.position.findUniqueOrThrow({ where: { code: "president" } });

  const users = [
    {
      email: "president@example.com",
      passwordHash: samplePasswordHash,
      employeeCode: "E0001",
      name: "代表 太郎",
      roleId: presidentRole.id,
      departmentId: development.id,
      positionId: presidentPosition.id,
    },
    {
      email: "admin@example.com",
      passwordHash: samplePasswordHash,
      employeeCode: "E0002",
      name: "管理 花子",
      roleId: adminRole.id,
      departmentId: development.id,
      positionId: managerPosition.id,
    },
    {
      email: "leader@example.com",
      passwordHash: samplePasswordHash,
      employeeCode: "E1001",
      name: "主任 次郎",
      roleId: leaderRole.id,
      departmentId: development.id,
      positionId: leaderPosition.id,
    },
    {
      email: "member1@example.com",
      passwordHash: samplePasswordHash,
      employeeCode: "E1002",
      name: "開発 一郎",
      roleId: employeeRole.id,
      departmentId: development.id,
      positionId: memberPosition.id,
    },
    {
      email: "member2@example.com",
      passwordHash: samplePasswordHash,
      employeeCode: "E1003",
      name: "開発 二郎",
      roleId: employeeRole.id,
      departmentId: development.id,
      positionId: memberPosition.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: {
        ...user,
        joinedAt: new Date("2024-04-01"),
      },
    });
  }

  const leader = await prisma.user.findUniqueOrThrow({ where: { email: "leader@example.com" } });
  const member1 = await prisma.user.findUniqueOrThrow({ where: { email: "member1@example.com" } });
  const member2 = await prisma.user.findUniqueOrThrow({ where: { email: "member2@example.com" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });

  const team = await prisma.team.upsert({
    where: { id: "team-platform" },
    update: { name: "プラットフォームチーム", departmentId: development.id, leaderUserId: leader.id },
    create: {
      id: "team-platform",
      name: "プラットフォームチーム",
      departmentId: development.id,
      leaderUserId: leader.id,
    },
  });

  const internalProject = await prisma.monthlyReportProject.upsert({
    where: { id: "mr-project-platform-core" },
    update: {
      name: "基幹保守PJ",
      normalizedName: "基幹保守pj",
      teamId: team.id,
      teamNameSnapshot: team.name,
      createdBy: leader.id,
      isActive: true,
    },
    create: {
      id: "mr-project-platform-core",
      name: "基幹保守PJ",
      normalizedName: "基幹保守pj",
      teamId: team.id,
      teamNameSnapshot: team.name,
      createdBy: leader.id,
      isActive: true,
    },
  });

  const personalProject = await prisma.monthlyReportProject.upsert({
    where: { id: "mr-project-personal-improve" },
    update: {
      name: "社内改善PJ",
      normalizedName: "社内改善pj",
      teamId: null,
      teamNameSnapshot: "個人",
      createdBy: admin.id,
      isActive: true,
    },
    create: {
      id: "mr-project-personal-improve",
      name: "社内改善PJ",
      normalizedName: "社内改善pj",
      teamId: null,
      teamNameSnapshot: "個人",
      createdBy: leader.id,
      isActive: true,
    },
  });

  for (const userId of [leader.id, member1.id, member2.id]) {
    await prisma.teamMembership.upsert({
      where: {
        teamId_userId_startDate: {
          teamId: team.id,
          userId,
          startDate: new Date("2025-04-01"),
        },
      },
      update: { isPrimary: true },
      create: {
        teamId: team.id,
        userId,
        startDate: new Date("2025-04-01"),
        isPrimary: true,
      },
    });
  }

  const gradeDefinitions = [
    [SkillCategory.IT_SKILL, "SG1", "自律成長初級", 10, "基本的な業務を実行しながら成長できる", 1, 2.32],
    [SkillCategory.IT_SKILL, "SG2", "自律成長中級", 20, "自律的に業務を進め、周囲へ良い影響を与えられる", 2.33, 3.66],
    [SkillCategory.IT_SKILL, "SG3", "自律成長上級", 30, "高い再現性で成果を出し、難度の高い業務も安定して進められる", 3.67, 5],
    [SkillCategory.BUSINESS_SKILL, "KG1", "協調相乗初級", 10, "継続実践は限定的だが、協調相乗の動きが見え始めている", 1, 2.32],
    [SkillCategory.BUSINESS_SKILL, "KG2", "協調相乗中級", 20, "チームや顧客に対する継続実践が安定している", 2.33, 3.66],
    [SkillCategory.BUSINESS_SKILL, "KG3", "協調相乗上級", 30, "組織や顧客拡張に対する高い継続実践が見られる", 3.67, 5],
  ] as const;

  for (const [category, gradeCode, gradeName, rankOrder, description, minScore, maxScore] of gradeDefinitions) {
    const existing = await prisma.skillGradeDefinition.findFirst({
      where: {
        category,
        gradeCode,
        positionId: null,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.skillGradeDefinition.update({
        where: { id: existing.id },
        data: { gradeName, rankOrder, description, minScore, maxScore, positionId: null },
      });
    } else {
      await prisma.skillGradeDefinition.create({
        data: { category, gradeCode, gradeName, rankOrder, description, minScore, maxScore, positionId: null },
      });
    }
  }

  const period = await prisma.evaluationPeriod.upsert({
    where: { id: "period-2025-h2" },
    update: {
      name: "2025年度下期",
      startDate: new Date("2025-10-01"),
      endDate: new Date("2026-03-31"),
      status: EvaluationPeriodStatus.OPEN,
    },
    create: {
      id: "period-2025-h2",
      name: "2025年度下期",
      periodType: PeriodType.HALF_YEAR,
      startDate: new Date("2025-10-01"),
      endDate: new Date("2026-03-31"),
      status: EvaluationPeriodStatus.OPEN,
    },
  });

  const evaluationItems = [
    {
      id: "item-it-foundation",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル",
      minorCategory: "基礎理解",
      title: "使用技術や業務知識の基礎を理解している",
      description: "自ら学び、仕事を通じて必要とされる存在になるための基礎理解を確認する",
      weight: "25.00",
      displayOrder: 1,
      evidenceRequired: false,
      isCore: true,
    },
    {
      id: "item-it-implementation",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "ITスキル",
      minorCategory: "実装",
      title: "設計意図を理解して実装へ落とし込める",
      description: "設計意図を踏まえた実装品質と再現性を確認する",
      weight: "25.00",
      displayOrder: 2,
      evidenceRequired: false,
      isCore: true,
    },
    {
      id: "item-problem-solving",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "課題解決力",
      minorCategory: "課題整理",
      title: "課題の原因を整理して捉えられる",
      description: "課題の構造化と対応方針の整理を確認する",
      weight: "20.00",
      displayOrder: 3,
      evidenceRequired: false,
      isCore: false,
    },
    {
      id: "item-communication",
      category: SkillCategory.IT_SKILL,
      axis: "SELF_GROWTH",
      scoreType: "LEVEL_2",
      majorCategory: "対話力",
      minorCategory: "情報整理",
      title: "必要な情報を整理して伝えられる",
      description: "相手に応じて情報を整理し伝える力を確認する",
      weight: "15.00",
      displayOrder: 4,
      evidenceRequired: false,
      isCore: false,
    },
    {
      id: "item-synergy-customer",
      category: SkillCategory.BUSINESS_SKILL,
      axis: "SYNERGY",
      scoreType: "CONTINUOUS_DONE",
      majorCategory: "顧客拡張力",
      minorCategory: "関係深化",
      title: "関係深化や追加提案につながる行動を継続して行っている",
      description: "単発ではなく、顧客拡張につながる継続実践を確認する",
      weight: "8.00",
      displayOrder: 5,
      evidenceRequired: true,
      isCore: false,
    },
    {
      id: "item-synergy-team",
      category: SkillCategory.BUSINESS_SKILL,
      axis: "SYNERGY",
      scoreType: "CONTINUOUS_DONE",
      majorCategory: "育成支援力",
      minorCategory: "レビュー支援",
      title: "レビューや伴走を通じて他者の成長支援を継続して行っている",
      description: "半期を通じた継続的な育成支援を確認する",
      weight: "7.00",
      displayOrder: 6,
      evidenceRequired: true,
      isCore: false,
    },
  ];

  for (const item of evaluationItems) {
    await prisma.evaluationItem.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  const salarySeeds = [
    [leader.id, 480000, 40000, 70000],
    [member1.id, 360000, 30000, 55000],
    [member2.id, 340000, 30000, 52000],
  ] as const;

  for (const [userId, baseSalary, allowance, socialInsurance] of salarySeeds) {
    await prisma.salaryRecord.upsert({
      where: {
        userId_effectiveFrom: {
          userId,
          effectiveFrom: new Date("2025-04-01"),
        },
      },
      update: { baseSalary, allowance, socialInsurance, otherFixedCost: 10000 },
      create: {
        userId,
        effectiveFrom: new Date("2025-04-01"),
        baseSalary,
        allowance,
        socialInsurance,
        otherFixedCost: 10000,
      },
    });
  }

  const employeeRateSeeds = [
    [leader.id, 950000, 100, "基幹案件標準単価"],
    [member1.id, 800000, 100, "開発支援標準単価"],
    [member2.id, 780000, 100, "開発支援標準単価"],
  ] as const;

  for (const [userId, unitPrice, defaultWorkRate, remarks] of employeeRateSeeds) {
    const effectiveFrom = new Date("2025-04-01");
    await prisma.employeeSalesRateSetting.upsert({
      where: {
        userId_effectiveFrom: {
          userId,
          effectiveFrom,
        },
      },
      update: { unitPrice, defaultWorkRate, remarks },
      create: { userId, effectiveFrom, unitPrice, defaultWorkRate, remarks },
    });
  }

  const partner = await prisma.partner.upsert({
    where: { id: "partner-001" },
    update: { name: "協力会社A", companyName: "協力会社A株式会社" },
    create: { id: "partner-001", name: "協力会社A", companyName: "協力会社A株式会社" },
  });

  const partnerEffectiveFrom = new Date("2025-04-01");

  await prisma.partnerSalesRateSetting.upsert({
    where: {
      partnerId_effectiveFrom: {
        partnerId: partner.id,
        effectiveFrom: partnerEffectiveFrom,
      },
    },
    update: { unitPrice: 700000, defaultWorkRate: 100, remarks: "標準売上単価" },
    create: {
      partnerId: partner.id,
      effectiveFrom: partnerEffectiveFrom,
      unitPrice: 700000,
      defaultWorkRate: 100,
      remarks: "標準売上単価",
    },
  });

  await prisma.partnerOutsourceRateSetting.upsert({
    where: {
      partnerId_effectiveFrom: {
        partnerId: partner.id,
        effectiveFrom: partnerEffectiveFrom,
      },
    },
    update: { amount: 620000, remarks: "標準外注費" },
    create: {
      partnerId: partner.id,
      effectiveFrom: partnerEffectiveFrom,
      amount: 620000,
      remarks: "標準外注費",
    },
  });

  await prisma.monthlyAssignment.deleteMany({ where: { teamId: team.id, yearMonth: sampleYearMonth } });
  await prisma.monthlyCost.deleteMany({ where: { teamId: team.id, yearMonth: sampleYearMonth } });
  await prisma.teamIndirectCost.deleteMany({ where: { teamId: team.id, yearMonth: sampleYearMonth } });
  await prisma.fixedCostAllocation.deleteMany({ where: { teamId: team.id, yearMonth: sampleYearMonth } });
  await prisma.teamTarget.deleteMany({ where: { teamId: team.id, yearMonth: sampleYearMonth } });
  await prisma.teamMonthlyPl.deleteMany({ where: { teamId: team.id, yearMonth: sampleYearMonth } });

  await prisma.monthlyAssignment.createMany({
    data: [
      {
        targetType: "EMPLOYEE",
        userId: leader.id,
        teamId: team.id,
        yearMonth: sampleYearMonth,
        unitPrice: 950000,
        salesAmount: 950000,
        workRate: 100,
      },
      {
        targetType: "EMPLOYEE",
        userId: member1.id,
        teamId: team.id,
        yearMonth: sampleYearMonth,
        unitPrice: 800000,
        salesAmount: 800000,
        workRate: 100,
      },
      {
        targetType: "PARTNER",
        partnerId: partner.id,
        teamId: team.id,
        yearMonth: sampleYearMonth,
        unitPrice: 700000,
        salesAmount: 700000,
        workRate: 100,
      },
    ],
  });

  await prisma.monthlyCost.createMany({
    data: [
      {
        targetType: "EMPLOYEE",
        userId: leader.id,
        teamId: team.id,
        yearMonth: sampleYearMonth,
        costCategory: CostCategory.SALARY,
        amount: 520000,
      },
      {
        targetType: "EMPLOYEE",
        userId: member1.id,
        teamId: team.id,
        yearMonth: sampleYearMonth,
        costCategory: CostCategory.SALARY,
        amount: 390000,
      },
      {
        targetType: "PARTNER",
        partnerId: partner.id,
        teamId: team.id,
        yearMonth: sampleYearMonth,
        costCategory: CostCategory.OUTSOURCING,
        amount: 620000,
      },
    ],
  });

  await prisma.teamIndirectCost.create({
    data: {
      teamId: team.id,
      yearMonth: sampleYearMonth,
      category: "採用・教育費",
      amount: 120000,
    },
  });

  const fixedCost = await prisma.fixedCostSetting.upsert({
    where: { id: "fixedcost-hq-2026-03" },
    update: { amount: 300000, allocationMethod: FixedCostAllocationMethod.HEADCOUNT },
    create: {
      id: "fixedcost-hq-2026-03",
      yearMonth: sampleYearMonth,
      category: "本社固定費",
      amount: 300000,
      allocationMethod: FixedCostAllocationMethod.HEADCOUNT,
    },
  });

  await prisma.fixedCostAllocation.create({
    data: {
      teamId: team.id,
      fixedCostSettingId: fixedCost.id,
      yearMonth: sampleYearMonth,
      allocatedAmount: 300000,
    },
  });

  await prisma.teamTarget.create({
    data: {
      teamId: team.id,
      yearMonth: sampleYearMonth,
      salesTarget: 2500000,
      grossProfitTarget: 800000,
      grossProfitRateTarget: 32,
    },
  });

  const evaluationSeeds = [
    {
      userId: leader.id,
      status: EvaluationStatus.FINALIZED,
      selfComment: "対話の質を上げて、メンバーの挑戦を後押しする",
      managerComment: "1on1で成長テーマの棚卸しを行い、次の支援観点を明確にする",
      finalComment: "メンバーの挑戦内容を毎週の対話に乗せる動きが定着し始めています。",
      finalScoreTotal: 4.2,
    },
    {
      userId: member1.id,
      status: EvaluationStatus.SELF_REVIEW,
      selfComment: "設計レビューで意図を伝え切る",
      managerComment: "次回レビューで観点メモを事前共有する",
      finalComment: "レビューの論点整理が進み、設計意図の共有が安定してきました。",
      finalScoreTotal: null,
    },
    {
      userId: member2.id,
      status: EvaluationStatus.FINALIZED,
      selfComment: "顧客視点を提案に乗せる",
      managerComment: "営業同席メモをキャリアシートへ残し、提案へつなげる",
      finalComment: "顧客会話の要点を整理して次回提案に活かす姿勢が見えてきています。",
      finalScoreTotal: 4.0,
    },
  ];

  for (const evaluation of evaluationSeeds) {
    await prisma.employeeEvaluation.upsert({
      where: {
        userId_evaluationPeriodId: {
          userId: evaluation.userId,
          evaluationPeriodId: period.id,
        },
      },
      update: {
        teamId: team.id,
        status: evaluation.status,
        selfComment: evaluation.selfComment,
        managerComment: evaluation.managerComment,
        finalComment: evaluation.finalComment,
        finalScoreTotal: evaluation.finalScoreTotal,
      },
      create: {
        userId: evaluation.userId,
        evaluationPeriodId: period.id,
        teamId: team.id,
        status: evaluation.status,
        selfComment: evaluation.selfComment,
        managerComment: evaluation.managerComment,
        finalComment: evaluation.finalComment,
        finalScoreTotal: evaluation.finalScoreTotal,
      },
    });
  }

  await prisma.teamMonthlyReport.upsert({
    where: {
      yearMonth_projectId_teamId: {
        yearMonth: sampleYearMonth,
        projectId: internalProject.id,
        teamId: team.id,
      },
    },
    update: {
      projectSummary: "基幹システムの保守運用と追加改善を担当する案件",
      teamSelfGrowthIssue: "レビュー品質を平準化する",
      teamSelfGrowthResult: "観点表を整え、レビュー前共有を定着させた",
      teamSynergyIssue: "相談の先出しを徹底する",
      teamSynergyResult: "朝会で課題を先に出す流れを定着させた",
      updatedBy: leader.id,
    },
    create: {
      yearMonth: sampleYearMonth,
      projectId: internalProject.id,
      teamId: team.id,
      projectSummary: "基幹システムの保守運用と追加改善を担当する案件",
      teamSelfGrowthIssue: "レビュー品質を平準化する",
      teamSelfGrowthResult: "観点表を整え、レビュー前共有を定着させた",
      teamSynergyIssue: "相談の先出しを徹底する",
      teamSynergyResult: "朝会で課題を先に出す流れを定着させた",
      updatedBy: leader.id,
    },
  });

  const personalMonthlySeeds = [
    {
      userId: leader.id,
      projectId: internalProject.id,
      teamId: team.id,
      teamNameSnapshot: team.name,
      userRoleCode: "leader",
      memberType: "leader",
      projectRole: "進行管理・レビュー",
      personalSelfGrowthIssue: "メンバー支援の言語化",
      personalSelfGrowthResult: "レビュー観点を整理して渡せるようになった",
      personalSynergyIssue: "相談しやすい空気づくり",
      personalSynergyResult: "課題共有が早まり、相談件数が増えた",
    },
    {
      userId: member1.id,
      projectId: internalProject.id,
      teamId: team.id,
      teamNameSnapshot: team.name,
      userRoleCode: "employee",
      memberType: "member",
      projectRole: "詳細設計・実装",
      personalSelfGrowthIssue: "設計意図を整理して説明する",
      personalSelfGrowthResult: "レビュー前に論点を共有できるようになった",
      personalSynergyIssue: "相談を早めに出す",
      personalSynergyResult: "詰まる前に周囲へ相談する回数が増えた",
    },
    {
      userId: member2.id,
      projectId: internalProject.id,
      teamId: team.id,
      teamNameSnapshot: team.name,
      userRoleCode: "employee",
      memberType: "member",
      projectRole: "実装・テスト",
      personalSelfGrowthIssue: "顧客視点を設計へ反映する",
      personalSelfGrowthResult: "顧客会話から改善案を出せるようになった",
      personalSynergyIssue: "関連メンバーとの共有密度を上げる",
      personalSynergyResult: "朝会以外にもメモ共有を増やした",
    },
    {
      userId: admin.id,
      projectId: personalProject.id,
      teamId: null,
      teamNameSnapshot: "個人",
      userRoleCode: "admin",
      memberType: "member",
      projectRole: "制度改善",
      personalSelfGrowthIssue: "現場運用と制度文言のずれを減らす",
      personalSelfGrowthResult: "テンプレートの言い回しを見直した",
      personalSynergyIssue: "現場の声を拾いやすくする",
      personalSynergyResult: "管理者ヒアリングの整理メモを定着させた",
    },
  ] as const;

  for (const seed of personalMonthlySeeds) {
    await prisma.personalMonthlyReport.upsert({
      where: {
        yearMonth_projectId_userId: {
          yearMonth: sampleYearMonth,
          projectId: seed.projectId,
          userId: seed.userId,
        },
      },
      update: seed,
      create: {
        yearMonth: sampleYearMonth,
        ...seed,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });


