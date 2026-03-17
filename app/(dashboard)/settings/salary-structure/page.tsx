import { SalaryStructureEditor } from "@/components/settings/salary-structure-editor";
import { getSalaryStructureBundle } from "@/lib/salary-structure/salary-structure-service";
import { getSessionUser } from "@/lib/auth/demo-session";

export default async function SalaryStructurePage() {
  const user = await getSessionUser();
  const defaults = await getSalaryStructureBundle();
  const canEdit = user.role === "admin" || user.role === "president";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Salary Structure</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">給与構成設定</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
          自律成長基準額と協調相乗基準額を別々に設定し、その合計を基準基本給として扱います。
          最終的な基本給案は、粗利達成率に応じた補正係数をかけて算出します。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">1. 自律成長基準額</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            SGごとの基準額を設定して、仕事の土台となる基準基本給を定めます。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">2. 協調相乗基準額</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            KGごとの加点額を設定して、継続的な他者貢献や組織貢献を金額へ反映します。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">3. 粗利補正</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            基準基本給に対して粗利達成率の係数をかけ、最終的な基本給案を調整します。
          </p>
        </div>
      </section>

      <SalaryStructureEditor canEdit={canEdit} defaults={defaults} />
    </div>
  );
}
