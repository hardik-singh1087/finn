import { Shell, AppHeader } from "@/components/Shell";
import { ResearchIndex } from "@/components/ResearchIndex";

export default function ResearchHome() {
  return (
    <Shell>
      <AppHeader title="Research" subtitle="Grounded only in a company's own filings. Tap in for promised vs delivered, then ask." />
      <ResearchIndex />
    </Shell>
  );
}
