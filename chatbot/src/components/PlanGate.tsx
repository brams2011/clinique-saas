import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth, type Plan } from "../contexts/AuthContext";

const PLAN_LABELS: Record<Plan, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

interface Props {
  feature: string;
  requiredPlan: Plan;
  children: React.ReactNode;
}

export default function PlanGate({ feature, requiredPlan, children }: Props) {
  const { hasPlan } = useAuth();
  const navigate = useNavigate();

  if (hasPlan(requiredPlan)) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 p-8">
      <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
        <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Fonctionnalité {feature}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Cette fonctionnalité est incluse dans le forfait{" "}
          <span className="font-semibold text-indigo-600">{PLAN_LABELS[requiredPlan]}</span> et supérieur.
        </p>
      </div>
      <button
        onClick={() => navigate("/subscription")}
        className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
      >
        Mettre à niveau mon forfait
      </button>
    </div>
  );
}
