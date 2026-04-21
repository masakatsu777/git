export type EvaluationGapQuadrant =
  | "high-eval-high-gross-profit"
  | "high-eval-low-gross-profit"
  | "high-eval-low-gross-profit-team-propagation"
  | "low-eval-high-gross-profit"
  | "low-eval-low-gross-profit";

export type EvaluationGapGuideLink = {
  label: string;
  href: string;
};

export type EvaluationGapGuidance = {
  quadrant: EvaluationGapQuadrant;
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
  grossProfitDeductionAmount: number;
};

const guidanceMap: Record<EvaluationGapQuadrant, Omit<EvaluationGapGuidance, "quadrant">> = {
  "high-eval-high-gross-profit": {
    badgeLabel: "順調",
    badgeTone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    panelTone: "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.98))]",
    title: "実践が成果につながっています",
    body: "自律的成長力・協調相乗力の実践が、粗利結果にもつながっています。今期うまくいった行動を、次期も再現できる形に整理し、チームへ広げる視点も持ってください。",
    helper: "良い結果ほど、なぜうまくいったかを言語化することが重要です。",
    nextAction: "今期うまくいった行動を、来期も再現できる形に整理してください。",
    issues: [
      "再現条件が言語化されていない",
      "個人の頑張りに依存している",
      "良い実践がチームへ展開されていない",
    ],
    links: [
      { label: "今期の成功を再現する振り返りガイド", href: "/evaluations/guides?quadrant=high-eval-high-gross-profit" },
      { label: "良い実践をチームへ広げる方法", href: "/evaluations/guides?quadrant=high-eval-high-gross-profit" },
    ],
    guideTitle: "高評価 × 高粗利 ガイド",
    guidePurpose: "この象限では、うまくいった実践を再現できる形に整理し、周囲へ広げることが目的です。",
    guideKeyPoints: [
      "高評価 × 高粗利 は、実践が成果につながっている良い状態です。",
      "ただし、良い結果ほど背景を整理しないと再現できません。",
      "個人の成功で終わらせず、他者も使える形にすることが次の成長につながります。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "どの行動が粗利改善や案件拡大につながったか",
          "継続の頻度や対象を説明できるか",
          "協調相乗力が価値拡大まで届いていたか",
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
  "high-eval-low-gross-profit": {
    badgeLabel: "見直し推奨",
    badgeTone: "bg-amber-100 text-amber-800 border-amber-200",
    panelTone: "border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98))]",
    title: "実践は見えるが、成果へのつながりに課題があります",
    body: "自己評価は高い一方で、粗利結果が目標を下回っています。「やったこと」と「結果につながったこと」を分けて振り返り、次期は成果につながる行動設計へ見直してください。",
    helper: "根拠は、行動の説明だけでなく、変化した結果まで書くことがポイントです。",
    nextAction: "次期は「何をやるか」より先に、「どの成果につなげるか」を明確にしてください。",
    issues: [
      "優先順位が粗利改善につながっていない",
      "協調行動が支援で止まり、価値拡大につながっていない",
      "根拠が実施報告に偏り、成果変化まで整理できていない",
    ],
    links: [
      { label: "高評価なのに結果が伴わないときの見直しガイド", href: "/evaluations/guides?quadrant=high-eval-low-gross-profit" },
      { label: "粗利につながる協調相乗力とは", href: "/evaluations/guides?quadrant=high-eval-low-gross-profit" },
      { label: "実施報告で終わらせない根拠コメント例", href: "/evaluations/guides?quadrant=high-eval-low-gross-profit" },
    ],
    guideTitle: "高評価 × 低粗利 ガイド",
    guidePurpose: "この象限では、努力不足よりも、行動が成果につながる設計になっていたかを見直すことが目的です。",
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
  "high-eval-low-gross-profit-team-propagation": {
    badgeLabel: "波及課題",
    badgeTone: "bg-violet-100 text-violet-800 border-violet-200",
    panelTone: "border-violet-200 bg-[linear-gradient(135deg,rgba(245,243,255,0.95),rgba(255,255,255,0.98))]",
    title: "個人としては成果につながっていますが、チーム全体への波及に課題があります",
    body: "個人ベースでは粗利に貢献できていますが、チーム全体としては目標未達です。自分の実践がチーム成果へどう広がるか、全体課題へどう関わるかを見直してください。",
    helper: "本人のやり方を否定するのではなく、良い実践を全体成果へどう接続するかを見ることがポイントです。",
    nextAction: "次期は、自分の良いやり方をチーム全体の成果へ広げる行動を1つ具体化してください。",
    issues: [
      "個人の良いやり方がチームへ共有されていない",
      "自分の担当範囲では良くても、全体最適への働きかけが弱い",
      "支援や連携が個別対応で止まり、チーム全体の生産性向上につながっていない",
    ],
    links: [
      { label: "個人貢献あり・チーム波及課題ガイド", href: "/evaluations/guides?quadrant=high-eval-low-gross-profit-team-propagation" },
      { label: "自分の成功をチーム成果へ広げる方法", href: "/evaluations/guides?quadrant=high-eval-low-gross-profit-team-propagation" },
      { label: "チーム全体の停滞要因へ関わる視点", href: "/evaluations/guides?quadrant=high-eval-low-gross-profit-team-propagation" },
    ],
    guideTitle: "個人貢献あり・チーム波及課題 ガイド",
    guidePurpose: "この分岐では、個人としての実践が成果につながっていることを前提に、その価値をチーム全体の成果へどう広げるかを見直すことが目的です。",
    guideKeyPoints: [
      "個人ベースでは粗利に貢献できているため、本人の実践自体は肯定的に捉えます。",
      "次に見るべきなのは、良いやり方がチームへ共有・展開されているかどうかです。",
      "自分の担当範囲で終わらせず、全体課題への働きかけまで視野を広げます。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "自分の良いやり方をチームで再利用できる形にしているか",
          "チーム全体の停滞要因に働きかけられているか",
          "支援や連携が、全体の生産性向上や手戻り削減につながっているか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "自分の成功をテンプレートや観点に落とす",
          "チーム共通の停滞要因を1つ選んで改善に関わる",
          "個別支援を仕組み化して全体へ広げる",
        ],
      },
    ],
  },
  "low-eval-high-gross-profit": {
    badgeLabel: "再現性確認",
    badgeTone: "bg-sky-100 text-sky-800 border-sky-200",
    panelTone: "border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(255,255,255,0.98))]",
    title: "結果は出ていますが、再現性の確認が必要です",
    body: "粗利結果は良好ですが、自己評価は高くありません。今期の成果が偶然ではなく、再現可能な行動として定着しているかを確認し、次期につながる形に整理してください。",
    helper: "良かった結果を、次期も続けられる力へ変えることがポイントです。",
    nextAction: "今期の成果を、再現可能な行動と判断基準に言い換えて整理してください。",
    issues: [
      "属人的に成果が出ている",
      "うまくいった理由が整理されていない",
      "他者や次期へ再現できる形になっていない",
    ],
    links: [
      { label: "偶然の成果を再現可能な力に変える方法", href: "/evaluations/guides?quadrant=low-eval-high-gross-profit" },
      { label: "属人化を防ぐ共有のポイント", href: "/evaluations/guides?quadrant=low-eval-high-gross-profit" },
    ],
    guideTitle: "低評価 × 高粗利 ガイド",
    guidePurpose: "この象限では、出た結果を偶然で終わらせず、再現可能な力へ変えることが目的です。",
    guideKeyPoints: [
      "低評価 × 高粗利 は、必ずしも悪い状態ではありません。",
      "ただし、成果の背景が整理されていないと再現性が弱くなります。",
      "自己評価が低い背景に、過小評価や未整理がないかも確認します。",
    ],
    guideSections: [
      {
        title: "見直しポイント",
        points: [
          "何が結果につながったのかを説明できるか",
          "行動要因と環境要因を分けて整理できるか",
          "周囲へ広げられる状態になっているか",
        ],
      },
      {
        title: "次期の方向性",
        points: [
          "成果要因を言語化する",
          "継続できる行動にする",
          "属人化を減らす",
        ],
      },
    ],
  },
  "low-eval-low-gross-profit": {
    badgeLabel: "立て直し優先",
    badgeTone: "bg-rose-100 text-rose-800 border-rose-200",
    panelTone: "border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.95),rgba(255,255,255,0.98))]",
    title: "基本行動と成果の両面で立て直しが必要です",
    body: "自己評価と粗利結果の両方で課題が見られます。まずは課題を絞り、継続できる基本行動に落として、成果確認までつなげてください。",
    helper: "全部を変えるのではなく、優先課題を絞ることが改善の第一歩です。",
    nextAction: "次期は、絞った1つか2つの改善行動を継続し、月次で確認してください。",
    issues: [
      "行動量や継続性が不足している",
      "優先順位が定まらず、場当たり対応になっている",
      "基本動作が安定していない",
    ],
    links: [
      { label: "まず立て直すべき基本行動", href: "/evaluations/guides?quadrant=low-eval-low-gross-profit" },
      { label: "継続実践を始める最小ステップ", href: "/evaluations/guides?quadrant=low-eval-low-gross-profit" },
    ],
    guideTitle: "低評価 × 低粗利 ガイド",
    guidePurpose: "この象限では、課題を広げすぎず、基本行動を絞って継続できる形にすることが目的です。",
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

export function resolveEvaluationGapQuadrant({ gradeSalaryAmount, currentSalary, grossProfitVarianceRate, grossProfitDeductionAmount }: EvaluationGapInput): EvaluationGapQuadrant {
  const evaluationHigh = gradeSalaryAmount > currentSalary;
  const grossProfitHigh = grossProfitVarianceRate >= 0;

  if (evaluationHigh && grossProfitHigh) return "high-eval-high-gross-profit";
  if (evaluationHigh && !grossProfitHigh && grossProfitDeductionAmount > 0) return "high-eval-low-gross-profit-team-propagation";
  if (evaluationHigh && !grossProfitHigh) return "high-eval-low-gross-profit";
  if (!evaluationHigh && grossProfitHigh) return "low-eval-high-gross-profit";
  return "low-eval-low-gross-profit";
}

export function getEvaluationGapGuidance(input: EvaluationGapInput): EvaluationGapGuidance {
  const quadrant = resolveEvaluationGapQuadrant(input);
  return {
    quadrant,
    ...guidanceMap[quadrant],
  };
}

export function getEvaluationGapGuidanceByQuadrant(quadrant: EvaluationGapQuadrant): EvaluationGapGuidance {
  return {
    quadrant,
    ...guidanceMap[quadrant],
  };
}

export function isEvaluationGapQuadrant(value: string): value is EvaluationGapQuadrant {
  return value in guidanceMap;
}
