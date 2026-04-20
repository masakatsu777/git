import { notFound } from "next/navigation";

import { AnnualGoalForm } from "@/components/annual-goals/annual-goal-form";
import { getAnnualGoalDetailBundle, getAnnualGoalEditorBundle } from "@/lib/annual-goals/service";
import { getSessionUser } from "@/lib/auth/demo-session";

type AnnualGoalEditPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function AnnualGoalEditPage({ params }: AnnualGoalEditPageProps) {
  const { id } = await params;
  const user = await getSessionUser();
  const detail = await getAnnualGoalDetailBundle(user, id);

  if (!detail || !detail.meta.canEdit) {
    notFound();
  }

  const bundle = await getAnnualGoalEditorBundle(user, {
    fiscalYear: String(detail.fiscalYear),
    evaluationPeriodId: detail.evaluationPeriodId,
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <AnnualGoalForm key={`${bundle.fiscalYear}:${bundle.evaluationPeriodId}:${bundle.targetId}:${bundle.goalType}:${id}`} initialBundle={bundle} mode="edit" goalId={id} />
      </div>
    </main>
  );
}
