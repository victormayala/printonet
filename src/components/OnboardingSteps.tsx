import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Sparkles, LucideIcon } from "lucide-react";

export interface OnboardingStep {
  title: string;
  description: string;
  icon?: LucideIcon;
}

interface OnboardingStepsProps {
  storageKey: string;
  title: string;
  description?: string;
  steps: OnboardingStep[];
}

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
          const Icon = step.icon;
          return (
            <li key={idx} className="flex gap-3 items-start rounded-md border bg-card/50 p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {idx + 1}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
                  <p className="text-sm font-medium leading-tight">{step.title}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
