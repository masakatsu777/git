import { prisma } from "@/lib/prisma";
import { judgeOverallGrade } from "@/lib/skill-careers/overall-grade-service";

export type CareerStatusRow = {
  userId: string;
  employeeName: string;
  teamName: string;
  latestPeriodName: string;
  latestFinalRating: string;
  latestOverallGradeName: string;
  latestItSkillGradeName: string;
  latestBusinessSkillGradeName: string;
  previousPeriodName: string;
  previousOverallGradeName: string;
  previousItSkillGradeName: string;
  previousBusinessSkillGradeName: string;
  overallGradeChange: string;
  itGradeChange: string;
  businessGradeChange: string;
};

export type CareerStatusBundle = {
  rows: CareerStatusRow[];
  source: "database" | "fallback";
};

const fallbackBundle: CareerStatusBundle = {
  rows: [
    {
      userId: "demo-member1",
      employeeName: "開発 一郎",
      teamName: "プラットフォームチーム",
      latestPeriodName: "2025年度下期",
      latestFinalRating: "A",
      latestOverallGradeName: "総合G3",
      latestItSkillGradeName: "自律成長中級",
      latestBusinessSkillGradeName: "協調相乗中級",
      previousPeriodName: "2025年度上期",
      previousOverallGradeName: "総合G2",
      previousItSkillGradeName: "自律成長初級",
      previousBusinessSkillGradeName: "協調相乗初級",
      overallGradeChange: "変更",
      itGradeChange: "変更",
      businessGradeChange: "変更",
    },
    {
      userId: "demo-member2",
      employeeName: "開発 二郎",
      teamName: "プラットフォームチーム",
      latestPeriodName: "2025年度下期",
      latestFinalRating: "B",
      latestOverallGradeName: "総合G4",
      latestItSkillGradeName: "自律成長上級",
      latestBusinessSkillGradeName: "協調相乗中級",
      previousPeriodName: "2025年度上期",
      previousOverallGradeName: "総合G4",
      previousItSkillGradeName: "自律成長上級",
      previousBusinessSkillGradeName: "協調相乗中級",
      overallGradeChange: "維持",
      itGradeChange: "維持",
      businessGradeChange: "維持",
    },
  ],
  source: "fallback",
};

function compareGradeChange(current: string, previous: string) {
  if (!previous || previous === "-" || previous === "未判定") return "初回";
  if (current === previous) return "維持";
  return "変更";
}

function toLevel(rankOrder?: number | null) {
  if (!rankOrder) return 0;
  return Math.max(1, Math.round(rankOrder / 10));
}

export async function getCareerStatusBundle(): Promise<CareerStatusBundle> {
  try {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        teamMemberships: {
          where: { isPrimary: true },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { team: { select: { name: true } } },
        },
        employeeEvaluations: {
          where: { status: "FINALIZED" },
          orderBy: { evaluationPeriod: { startDate: "desc" } },
          take: 2,
          select: {
            finalRating: true,
            evaluationPeriod: { select: { name: true } },
            itSkillGrade: { select: { gradeName: true, rankOrder: true } },
            businessSkillGrade: { select: { gradeName: true, rankOrder: true } },
          },
        },
      },
    });

    return {
      rows: users
        .map((user) => {
          const latest = user.employeeEvaluations[0];
          const previous = user.employeeEvaluations[1];
          const latestOverall = judgeOverallGrade(toLevel(latest?.itSkillGrade?.rankOrder), toLevel(latest?.businessSkillGrade?.rankOrder));
          const previousOverall = judgeOverallGrade(toLevel(previous?.itSkillGrade?.rankOrder), toLevel(previous?.businessSkillGrade?.rankOrder));

          return {
            userId: user.id,
            employeeName: user.name,
            teamName: user.teamMemberships[0]?.team.name ?? "未所属",
            latestPeriodName: latest?.evaluationPeriod.name ?? "未評価",
            latestFinalRating: latest?.finalRating ?? "-",
            latestOverallGradeName: latestOverall.gradeName,
            latestItSkillGradeName: latest?.itSkillGrade?.gradeName ?? "未判定",
            latestBusinessSkillGradeName: latest?.businessSkillGrade?.gradeName ?? "未判定",
            previousPeriodName: previous?.evaluationPeriod.name ?? "-",
            previousOverallGradeName: previousOverall.gradeName,
            previousItSkillGradeName: previous?.itSkillGrade?.gradeName ?? "-",
            previousBusinessSkillGradeName: previous?.businessSkillGrade?.gradeName ?? "-",
            overallGradeChange: compareGradeChange(latestOverall.gradeName, previousOverall.gradeName),
            itGradeChange: compareGradeChange(latest?.itSkillGrade?.gradeName ?? "未判定", previous?.itSkillGrade?.gradeName ?? "-"),
            businessGradeChange: compareGradeChange(latest?.businessSkillGrade?.gradeName ?? "未判定", previous?.businessSkillGrade?.gradeName ?? "-"),
          };
        })
        .filter((row) => row.latestPeriodName !== "未評価"),
      source: "database",
    };
  } catch {
    return fallbackBundle;
  }
}
