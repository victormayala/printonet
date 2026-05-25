import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Sparkles } from "lucide-react";

export interface OnboardingStep {
  title: string;
  description: string;
}

interface OnboardingStepsProps {
  storageKey: string;
  title: string;
  description?: string;
  steps: OnboardingStep[];
}

const STEP_COLORS = [
  { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", number: "bg-sky-500", darkBg: "dark:bg-sky-950/40", darkBorder: "dark:border-sky-800", darkText: "dark:text-sky-300" },
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", number: "bg-emerald-500", darkBg: "dark:bg-emerald-950/40", darkBorder: "dark:border-emerald-800", darkText: "dark:text-emerald-300" },
  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", number: "bg-amber-500", darkBg: "dark:bg-amber-950/40", darkBorder: "dark:border-amber-800", darkText: "dark:text-amber-300" },
  { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", number: "bg-rose-500", darkBg: "dark:bg-rose-950/40", darkBorder: "dark:border-rose-800", darkText: "dark:text-rose-300" },
];

export function OnboardingSteps({ storageKey, title, description, steps }: OnboardingStepsProps) {
  const fullKey = `onboarding_dismissed_${storageKey}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(fullKey) === "1");
  }, [fullKey]);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(fullKey, "1");
    setDismissed(true);
  };

  return (
    <Card className="mb-6 p-5 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7"
        onClick={handleDismiss}
        aria-label="Dismiss onboarding"
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-base">{title}</h3>
      </div>
      {description && <p className="text-sm text-muted-foreground mb-4 pr-8">{description}</p>}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
        {steps.map((step, idx) => {
          const colors = STEP_COLORS[idx % STEP_COLORS.length];
          return (
            <li key={idx} className={`flex gap-3 items-start rounded-md border p-3 ${colors.bg} ${colors.border} ${colors.darkBg} ${colors.darkBorder}`}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors.number} text-white text-xs font-semibold`}>
                {idx + 1}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${colors.text} ${colors.darkText}`}>{step.title}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
