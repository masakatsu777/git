import { AnnualGoalForm } from "@/components/annual-goals/annual-goal-form";
import { getAnnualGoalEditorBundle } from "@/lib/annual-goals/service";
import { getSessionUser } from "@/lib/auth/demo-session";

type AnnualGoalCreatePageProps = Readonly<{
  searchParams: Promise<{
    fiscalYear?: string;
    evaluationPeriodId?: string;
  }>;
}>;

export default async function AnnualGoalCreatePage({ searchParams }: AnnualGoalCreatePageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  const bundle = await getAnnualGoalEditorBundle(user, params);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <AnnualGoalForm key={`${bundle.fiscalYear}:${bundle.evaluationPeriodId}:${bundle.targetId}:${bundle.goalType}`} initialBundle={bundle} mode="create" />
      </div>
    </main>
  );
}
