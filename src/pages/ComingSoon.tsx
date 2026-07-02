import { Link } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { buttonClasses } from "@/components/ui/Button";

export function ComingSoon({ title }: { title: string }) {
  return (
    <PageShell className="flex flex-col items-center justify-center min-h-dvh gap-4 text-center">
      <div className="text-[17px] font-bold">{title}</div>
      <p className="text-secondary text-[14px] max-w-[280px]">
        This screen lands in an upcoming phase.
      </p>
      <Link to="/" className={buttonClasses("outline")}>
        Back to dashboard
      </Link>
    </PageShell>
  );
}
