import { companyByTicker } from "@/lib/config";
import { ResearchView } from "@/components/ResearchView";
import { Shell, AppHeader } from "@/components/Shell";

// Dynamic per-ticker route — render on demand (reads params).
export const instant = false;

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  const company = companyByTicker(t);

  return (
    <Shell>
      <AppHeader
        back="/research"
        title={company?.name ?? t}
        subtitle={`${t}${company?.sector ? ` · ${company.sector}` : ""} · answered only from its own filings`}
      />
      <ResearchView ticker={t} />
    </Shell>
  );
}
