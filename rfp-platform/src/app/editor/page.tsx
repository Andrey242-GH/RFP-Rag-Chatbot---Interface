import { AppShell } from "@/components/layout/app-shell";
import { ProposalEditor } from "@/components/proposal/proposal-editor";

export const metadata = {
  title: "Proposal Editor — RFP Platform",
};

// searchParams is a runtime API — opt out of instant/static prerendering
export const instant = false;

export default async function EditorPage(props: PageProps<"/editor">) {
  const searchParams = await props.searchParams;
  const proposalId =
    typeof searchParams.proposalId === "string" ? searchParams.proposalId : undefined;

  return (
    <AppShell>
      <ProposalEditor proposalId={proposalId} />
    </AppShell>
  );
}
