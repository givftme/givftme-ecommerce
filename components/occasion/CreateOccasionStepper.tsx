import { cn } from "@/lib/utils";

export function CreateOccasionStepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Step ${step} of 3`}>
      {[1, 2, 3].map((value) => (
        <span
          key={value}
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-colors",
            step === value ? "bg-brand" : "bg-stone-200"
          )}
        />
      ))}
    </div>
  );
}
