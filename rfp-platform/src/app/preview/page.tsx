import { AppShell } from "@/components/layout/app-shell";
import { ProposalPreview } from "@/components/proposal/proposal-preview";

export const metadata = {
  title: "Proposal Preview — RFP Platform",
};

// searchParams is a runtime API — opt out of instant/static prerendering
export const instant = false;

export default async function PreviewPage(props: PageProps<"/preview">) {
  const searchParams = await props.searchParams;
  const proposalId =
    typeof searchParams.proposalId === "string" ? searchParams.proposalId : undefined;

  return (
    <AppShell>
      <ProposalPreview proposalId={proposalId} />
    </AppShell>
  );
}
