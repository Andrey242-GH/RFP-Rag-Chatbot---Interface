import { AppShell } from "@/components/layout/app-shell";
import { AnalysisDashboard } from "@/components/rfp/analysis-dashboard";

export const metadata = {
  title: "Analysis Dashboard — RFP Platform",
};

// searchParams is a runtime API — opt out of instant/static prerendering
export const instant = false;

export default async function AnalysisPage(props: PageProps<"/analysis">) {
  const searchParams = await props.searchParams;
  const rfpId = typeof searchParams.rfpId === "string" ? searchParams.rfpId : undefined;

  return (
    <AppShell>
      <AnalysisDashboard rfpId={rfpId} />
    </AppShell>
  );
}
