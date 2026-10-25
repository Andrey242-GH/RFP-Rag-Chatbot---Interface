import { AppShell } from "@/components/layout/app-shell";
import { ChatInterface } from "@/components/chat/chat-interface";

export const metadata = {
  title: "AI Chat — RFP Platform",
};

// searchParams is a runtime API — opt out of instant/static prerendering
export const instant = false;

export default async function ChatPage(props: PageProps<"/chat">) {
  const searchParams = await props.searchParams;
  const rfpId = typeof searchParams.rfpId === "string" ? searchParams.rfpId : undefined;
  const proposalId =
    typeof searchParams.proposalId === "string" ? searchParams.proposalId : undefined;

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">AI Chat</h1>
          <p className="mt-1 text-slate-500">
            Chat with the knowledge base. Every answer includes confidence scores, approval
            predictions, and source citations.
          </p>
        </div>
        <ChatInterface rfpId={rfpId} proposalId={proposalId} />
      </div>
    </AppShell>
  );
}
