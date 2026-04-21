export type EvaluationGapDiagnosisType =
  | "high-eval-high-gross-profit-personal-high"
  | "high-eval-high-gross-profit-personal-low"
  | "high-eval-low-gross-profit-personal-high"
  | "high-eval-low-gross-profit-personal-low"
  | "low-eval-high-gross-profit-personal-high"
  | "low-eval-high-gross-profit-personal-low"
  | "low-eval-low-gross-profit-personal-high"
  | "low-eval-low-gross-profit-personal-low";

export type EvaluationGapQuadrant = EvaluationGapDiagnosisType;

export type EvaluationGapGuideLink = {
  label: string;
  href: string;
};

export type EvaluationGapGuideGroup = {
  key: "high-eval-high-gross-profit" | "high-eval-low-gross-profit" | "low-eval-high-gross-profit" | "low-eval-low-gross-profit";
  title: string;
  description: string;
  diagnoses: EvaluationGapDiagnosisType[];
};

export type EvaluationGapGuidance = {
  quadrant: EvaluationGapDiagnosisType;
  badgeLabel: string;
  badgeTone: string;
  panelTone: string;
  title: string;
  body: string;
  helper: string;
  nextAction: string;
  issues: string[];
  links: EvaluationGapGuideLink[];
  guideTitle: string;
  guidePurpose: string;
  guideKeyPoints: string[];
  guideSections: Array<{
    title: string;
    points: string[];
  }>;
};

type EvaluationGapInput = {
  gradeSalaryAmount: number;
  currentSalary: number;
  grossProfitVarianceRate: number;
  personalGrossProfitVarianceRate: number;
};

const diagnosisPath = (quadrant: EvaluationGapDiagnosisType) => `/evaluations/guides?quadrant=${quadrant}`;

const guidanceMap: Record<EvaluationGapDiagnosisType, Omit<EvaluationGapGuidance, "quadrant">> = {
  "high-eval-high-gross-profit-personal-high": {
    badgeLabel: "再現と展開",
    badgeTone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    panelTone: "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.98))]",
    title: "個人・チームともに実践が成果へつながっています",
    body: "評価、チーム粗利、個人ベース粗利のすべてが良好です。今期うまくいった実践を再現できる形に整理し、自分の成功を周囲へ広げてください。",
    helper: "良い結果ほど、なぜうまくいったかを言語化して共有することが重要です。",
    nextAction: "今期うまくいった行動を、来期も再現できる形に整理してください。",
    issues: [
      "再現条件が言語化されていない",
      "個人の頑張りに依存している",
      "良い実践がチームへ展開されていない",
    ],
    links: [
      { label: "再現と展開のガイドを見る", href: diagnosisPath("high-eval-high-gross-profit-personal-high") },
      { label: "良い実践をチームへ広げる方法", href: diagnosisPath("high-eval-high-gross-profit-personal-high") },
    ],
    guideTitle: "再現と展開 ガイド",
    guidePurpose: "この類型では、うまくいった実践を再現できる形に整理し、個人の成功をチームへ展開することが目的です。",
    guideKeyPoints: [
      "評価、チーム粗利、個人粗利がそろって良い状態です。",
      "良い結果ほど、背景を整理しないと再現できません。",
      "個人の成功で終わらせず、他者も使える形にすることが次の成長につながります。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "どの行動が個人粗利とチーム粗利の両方につながったか",
          "継続の頻度や対象を説明できるか",
          "周囲へ広げられる型に整理できているか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "成功要因を言語化する",
          "再利用できる手順や観点にする",
          "チームへ展開できる形に整理する",
        ],
      },
    ],
  },
  "high-eval-high-gross-profit-personal-low": {
    badgeLabel: "体制拡大",
    badgeTone: "bg-teal-100 text-teal-800 border-teal-200",
    panelTone: "border-teal-200 bg-[linear-gradient(135deg,rgba(240,253,250,0.95),rgba(255,255,255,0.98))]",
    title: "チーム成果は良好です。次は体制拡大への関与を強める余地があります",
    body: "評価もチーム粗利も良好ですが、個人ベースの粗利は低めです。チーム貢献を維持しながら、パートナー増員や体制拡大への関与をさらに強めてください。",
    helper: "全体成果に貢献できている土台を活かし、収益拡大へどう関わるかを具体化することがポイントです。",
    nextAction: "チーム貢献を維持しながら、パートナー増員や体制拡大への働きかけをさらに強めてください。",
    issues: [
      "個人単位の収益接続が見えにくい",
      "体制拡大への関与が行動として明確でない",
      "全体成果に比べて本人の収益寄与が弱い",
    ],
    links: [
      { label: "体制拡大型のガイドを見る", href: diagnosisPath("high-eval-high-gross-profit-personal-low") },
      { label: "パートナー増員につなげる視点", href: diagnosisPath("high-eval-high-gross-profit-personal-low") },
    ],
    guideTitle: "全体成果貢献・体制拡大型 ガイド",
    guidePurpose: "この類型では、チーム全体で出せている成果を保ちながら、本人としての収益拡大への関与を強めることが目的です。",
    guideKeyPoints: [
      "評価とチーム粗利は良好で、土台はできています。",
      "個人粗利が低い場合は、体制拡大やパートナー増員への関与が次の論点です。",
      "本人の役割を収益拡大型へ一段進める意識が重要です。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "パートナー増員や体制拡大へどのように関われているか",
          "チーム貢献が本人の収益接続にもつながっているか",
          "全体成果の中で自分の役割を説明できるか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "増員や体制拡大の余地を具体化する",
          "収益拡大への関与を行動計画に落とす",
          "自分の役割をチーム内で明確にする",
        ],
      },
    ],
  },
  "high-eval-low-gross-profit-personal-high": {
    badgeLabel: "チーム波及",
    badgeTone: "bg-violet-100 text-violet-800 border-violet-200",
    panelTone: "border-violet-200 bg-[linear-gradient(135deg,rgba(245,243,255,0.95),rgba(255,255,255,0.98))]",
    title: "個人としては成果につながっていますが、チーム全体への波及に課題があります",
    body: "個人ベースでは粗利に貢献できていますが、チーム全体としては目標未達です。案件自体に拡張性があるか、周辺業務や体制拡大へ広げる余地があるかを見直してください。",
    helper: "本人のやり方を否定するのではなく、良い実践をチーム成果へどう接続するかを見ることがポイントです。",
    nextAction: "次期は、案件自体の拡張性や周辺業務への広がりを検討し、チーム全体の成果へつながる動きを1つ具体化してください。",
    issues: [
      "個人の良いやり方がチームへ共有されていない",
      "案件自体の拡張性や周辺業務への広がりを十分に検討できていない",
      "全体最適への働きかけが弱い",
    ],
    links: [
      { label: "個人貢献あり・チーム波及課題ガイド", href: diagnosisPath("high-eval-low-gross-profit-personal-high") },
      { label: "自分の成功をチーム成果へ広げる方法", href: diagnosisPath("high-eval-low-gross-profit-personal-high") },
    ],
    guideTitle: "個人貢献あり・チーム波及課題 ガイド",
    guidePurpose: "この類型では、個人として成果につながっている実践を、案件拡張や体制拡大を通じてチーム全体へ広げることが目的です。",
    guideKeyPoints: [
      "個人ベースでは粗利に貢献できているため、本人の実践自体は肯定的に捉えます。",
      "次に見るべきなのは、良いやり方がチームへ共有・展開されているかどうかです。",
      "案件自体の拡張性や周辺業務への広がりも重要な観点です。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "自分の良いやり方をチームで再利用できる形にしているか",
          "案件自体に拡張性があるか、周辺業務へ広げられるか",
          "支援や連携が、全体の生産性向上や手戻り削減につながっているか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "自分の成功をテンプレートや観点に落とす",
          "案件拡張や体制拡大につながる余地を探る",
          "個別支援を仕組み化して全体へ広げる",
        ],
      },
    ],
  },
  "high-eval-low-gross-profit-personal-low": {
    badgeLabel: "成果接続",
    badgeTone: "bg-amber-100 text-amber-800 border-amber-200",
    panelTone: "border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98))]",
    title: "実践は見えるが、個人・チームともに成果へのつながりを見直す必要があります",
    body: "評価は高い一方で、チーム粗利も個人ベース粗利も目標未達です。「やったこと」と「結果につながったこと」を分けて振り返り、成果につながる行動設計へ見直してください。",
    helper: "根拠は、行動の説明だけでなく、変化した結果まで書くことがポイントです。",
    nextAction: "次期は「何をやるか」より先に、「どの成果につなげるか」を明確にしてください。",
    issues: [
      "優先順位が粗利改善につながっていない",
      "協調行動が支援で止まり、価値拡大につながっていない",
      "根拠が実施報告に偏り、成果変化まで整理できていない",
    ],
    links: [
      { label: "成果接続の見直しガイドを見る", href: diagnosisPath("high-eval-low-gross-profit-personal-low") },
      { label: "粗利につながる協調相乗力とは", href: diagnosisPath("high-eval-low-gross-profit-personal-low") },
    ],
    guideTitle: "成果接続の見直し ガイド",
    guidePurpose: "この類型では、努力不足よりも、行動が成果につながる設計になっていたかを見直すことが目的です。",
    guideKeyPoints: [
      "自己評価は、やったことの報告ではなく、成果につながる実践の確認です。",
      "支援や協力が、案件拡大、生産性向上、手戻り削減につながったかを見ます。",
      "振り返りでは、何をしたかだけでなく、何がどう変わったかを確認します。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "その行動は、粗利改善や案件拡大のどれにつながる想定だったか",
          "支援が個別対応で止まらず、再利用可能になっていたか",
          "根拠コメントが行動説明だけで終わっていないか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "行動対象を絞る",
          "個別支援を仕組み化する",
          "成果確認までセットで行う",
        ],
      },
    ],
  },
  "low-eval-high-gross-profit-personal-high": {
    badgeLabel: "成果再定義",
    badgeTone: "bg-sky-100 text-sky-800 border-sky-200",
    panelTone: "border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(255,255,255,0.98))]",
    title: "個人としては収益に貢献しています。次は評価対象の実践として整理が必要です",
    body: "チーム粗利と個人ベース粗利は良好ですが、評価は高くありません。本人の成果を継続実践として言語化し、評価対象となる形へ整理してください。",
    helper: "成果が出ているなら、過小評価で終わらせず、何が評価対象の実践かを整理することが大切です。",
    nextAction: "今期の成果を、再現可能な行動と判断基準に言い換えて整理してください。",
    issues: [
      "成果が継続実践として整理されていない",
      "うまくいった理由が評価コメントへ十分に反映されていない",
      "個人成果が他者へ伝わる形になっていない",
    ],
    links: [
      { label: "個人成果再定義のガイドを見る", href: diagnosisPath("low-eval-high-gross-profit-personal-high") },
      { label: "成果を評価対象へ言い換える方法", href: diagnosisPath("low-eval-high-gross-profit-personal-high") },
    ],
    guideTitle: "個人成果再定義 ガイド",
    guidePurpose: "この類型では、出ている成果を偶然で終わらせず、評価対象となる継続実践へ整理することが目的です。",
    guideKeyPoints: [
      "低評価でも、個人とチームの収益貢献ができているケースです。",
      "成果の背景が整理されていないと評価へつながりません。",
      "自己評価が低い背景に、過小評価や未整理がないかも確認します。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "何が結果につながったのかを説明できるか",
          "行動要因と環境要因を分けて整理できるか",
          "評価対象となる継続実践へ言い換えられているか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "成果要因を言語化する",
          "継続できる行動にする",
          "評価コメントへ反映する",
        ],
      },
    ],
  },
  "low-eval-high-gross-profit-personal-low": {
    badgeLabel: "役割見直し",
    badgeTone: "bg-cyan-100 text-cyan-800 border-cyan-200",
    panelTone: "border-cyan-200 bg-[linear-gradient(135deg,rgba(236,254,255,0.95),rgba(255,255,255,0.98))]",
    title: "チーム成果は出ていますが、本人としての役割の置き方に見直し余地があります",
    body: "チーム全体の成果は良好ですが、本人としての収益貢献は弱めです。役割によっては、パートナー増員や体制整備に徹する方向も含めて、自分の貢献の出し方を明確にしてください。",
    helper: "チーム成果に支えられているだけでなく、自分として再現できる貢献を明確にすることがポイントです。",
    nextAction: "自分の担当範囲で成果につながる行動に加え、パートナー増員や体制整備に徹する方向も含めて、貢献の出し方を明確にしてください。",
    issues: [
      "チーム成果に対して本人貢献の再現性が弱い",
      "役割の置き方に見直し余地がある",
      "収益貢献の出し方が本人の中で明確でない",
    ],
    links: [
      { label: "役割特化の見直しガイドを見る", href: diagnosisPath("low-eval-high-gross-profit-personal-low") },
      { label: "パートナー増員や体制整備の役割設計", href: diagnosisPath("low-eval-high-gross-profit-personal-low") },
    ],
    guideTitle: "役割特化の見直し ガイド",
    guidePurpose: "この類型では、チーム成果を支える役割を整理し、本人としての貢献の出し方を明確にすることが目的です。",
    guideKeyPoints: [
      "チーム粗利は良好でも、本人の収益接続は弱いケースです。",
      "役割によっては、直接の粗利より体制整備や増員支援が主軸になることがあります。",
      "その場合でも、本人の貢献の出し方は明確にする必要があります。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "自分の役割がチーム成果へどうつながっているか",
          "パートナー増員や体制整備にどこまで関われるか",
          "本人として再現できる貢献が整理されているか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "役割を明確にする",
          "体制整備への関与を具体化する",
          "本人としての成果確認方法を決める",
        ],
      },
    ],
  },
  "low-eval-low-gross-profit-personal-high": {
    badgeLabel: "全体展開",
    badgeTone: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    panelTone: "border-fuchsia-200 bg-[linear-gradient(135deg,rgba(253,244,255,0.95),rgba(255,255,255,0.98))]",
    title: "個人としては粗利に貢献しています。次はその強みを全体へ広げる段階です",
    body: "個人ベースでは粗利に貢献できていますが、評価面やチーム全体では課題が残っています。個人の成果を、パートナー増員や配置拡大、体制強化へ広げる視点で見直してください。",
    helper: "本人の収益貢献を肯定しつつ、評価対象の実践やチーム成果へどう広げるかを見ることがポイントです。",
    nextAction: "個人の収益貢献を土台に、パートナー増員や配置拡大、体制強化へどう広げるかを整理してください。",
    issues: [
      "個人成果がチーム全体の成果へ結びついていない",
      "評価対象となる継続実践として整理されていない",
      "パートナー増員や配置拡大への展開が弱い",
    ],
    links: [
      { label: "個人成果の全体展開ガイドを見る", href: diagnosisPath("low-eval-low-gross-profit-personal-high") },
      { label: "配置拡大や体制強化へつなげる視点", href: diagnosisPath("low-eval-low-gross-profit-personal-high") },
    ],
    guideTitle: "個人成果の全体展開 ガイド",
    guidePurpose: "この類型では、個人として出せている成果を、評価対象の実践やチーム全体の成果へ広げることが目的です。",
    guideKeyPoints: [
      "個人としては粗利に貢献できている状態です。",
      "一方で、評価面やチーム全体の成果にはまだ接続し切れていません。",
      "個人成果を全体展開へ変える視点が重要です。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "個人の成功を周囲へ共有できているか",
          "パートナー増員や配置拡大へつながる余地があるか",
          "評価対象となる継続実践として整理できているか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "個人成果を見える化する",
          "体制強化へ展開する",
          "評価コメントへ具体的に反映する",
        ],
      },
    ],
  },
  "low-eval-low-gross-profit-personal-low": {
    badgeLabel: "立て直し",
    badgeTone: "bg-rose-100 text-rose-800 border-rose-200",
    panelTone: "border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.95),rgba(255,255,255,0.98))]",
    title: "基本行動と成果の両面で立て直しが必要です",
    body: "評価、チーム粗利、個人ベース粗利のすべてで課題が見られます。まずは課題を絞り、継続できる基本行動に落として、成果確認までつなげてください。",
    helper: "全部を変えるのではなく、優先課題を絞ることが改善の第一歩です。",
    nextAction: "次期は、絞った1つか2つの改善行動を継続し、月次で確認してください。",
    issues: [
      "行動量や継続性が不足している",
      "優先順位が定まらず、場当たり対応になっている",
      "基本動作が安定していない",
    ],
    links: [
      { label: "基本行動の立て直しガイドを見る", href: diagnosisPath("low-eval-low-gross-profit-personal-low") },
      { label: "継続実践を始める最小ステップ", href: diagnosisPath("low-eval-low-gross-profit-personal-low") },
    ],
    guideTitle: "基本行動の立て直し ガイド",
    guidePurpose: "この類型では、課題を広げすぎず、基本行動を絞って継続できる形にすることが目的です。",
    guideKeyPoints: [
      "立て直しが必要でも、全部を一度に変えようとすると続きません。",
      "基本行動の不足を特定し、続けられる最小単位へ落とすことが大切です。",
      "振り返りは反省文で終わらせず、次の行動まで明確にします。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "どの基本行動が不足していたか",
          "粗利未達に影響した行動を絞れているか",
          "結果確認の方法まで決められているか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "課題を絞る",
          "行動を小さくする",
          "相談と共有を早める",
        ],
      },
    ],
  },
};

export const evaluationGapGuideGroups: EvaluationGapGuideGroup[] = [
  {
    key: "high-eval-high-gross-profit",
    title: "高評価 × 高粗利",
    description: "評価もチーム粗利も高い状態です。個人粗利の高低で、再現と展開か、体制拡大かを見分けます。",
    diagnoses: ["high-eval-high-gross-profit-personal-high", "high-eval-high-gross-profit-personal-low"],
  },
  {
    key: "high-eval-low-gross-profit",
    title: "高評価 × 低粗利",
    description: "評価は高い一方でチーム粗利が未達です。個人粗利の高低で、チーム波及か、成果接続の見直しかを見分けます。",
    diagnoses: ["high-eval-low-gross-profit-personal-high", "high-eval-low-gross-profit-personal-low"],
  },
  {
    key: "low-eval-high-gross-profit",
    title: "低評価 × 高粗利",
    description: "チーム粗利は良好でも、評価は高くない状態です。個人粗利の高低で、成果再定義か、役割見直しかを見分けます。",
    diagnoses: ["low-eval-high-gross-profit-personal-high", "low-eval-high-gross-profit-personal-low"],
  },
  {
    key: "low-eval-low-gross-profit",
    title: "低評価 × 低粗利",
    description: "評価とチーム粗利の両方に課題がある状態です。個人粗利の高低で、全体展開か、立て直しかを見分けます。",
    diagnoses: ["low-eval-low-gross-profit-personal-high", "low-eval-low-gross-profit-personal-low"],
  },
];

export function resolveEvaluationGapQuadrant({ gradeSalaryAmount, currentSalary, grossProfitVarianceRate, personalGrossProfitVarianceRate }: EvaluationGapInput): EvaluationGapDiagnosisType {
  const evaluationHigh = gradeSalaryAmount > currentSalary;
  const grossProfitHigh = grossProfitVarianceRate >= 0;
  const personalGrossProfitHigh = personalGrossProfitVarianceRate > 0;

  if (evaluationHigh && grossProfitHigh && personalGrossProfitHigh) return "high-eval-high-gross-profit-personal-high";
  if (evaluationHigh && grossProfitHigh) return "high-eval-high-gross-profit-personal-low";
  if (evaluationHigh && !grossProfitHigh && personalGrossProfitHigh) return "high-eval-low-gross-profit-personal-high";
  if (evaluationHigh && !grossProfitHigh) return "high-eval-low-gross-profit-personal-low";
  if (!evaluationHigh && grossProfitHigh && personalGrossProfitHigh) return "low-eval-high-gross-profit-personal-high";
  if (!evaluationHigh && grossProfitHigh) return "low-eval-high-gross-profit-personal-low";
  if (personalGrossProfitHigh) return "low-eval-low-gross-profit-personal-high";
  return "low-eval-low-gross-profit-personal-low";
}

export function getEvaluationGapGuidance(input: EvaluationGapInput): EvaluationGapGuidance {
  const quadrant = resolveEvaluationGapQuadrant(input);
  return {
    quadrant,
    ...guidanceMap[quadrant],
  };
}

export function getEvaluationGapGuidanceByQuadrant(quadrant: EvaluationGapDiagnosisType): EvaluationGapGuidance {
  return {
    quadrant,
    ...guidanceMap[quadrant],
  };
}

export function isEvaluationGapQuadrant(value: string): value is EvaluationGapDiagnosisType {
  return value in guidanceMap;
}
