import { AppShell } from "@/components/layout/app-shell";
import { UploadRFPForm } from "@/components/rfp/upload-rfp-form";

export const metadata = {
  title: "Upload RFP — RFP Platform",
};

export default function UploadPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Upload RFP</h1>
          <p className="mt-1 text-slate-500">
            Upload a PDF, DOCX, or TXT document. The AI will extract questions, requirements, and
            evaluation criteria automatically.
          </p>
        </div>
        <UploadRFPForm />
      </div>
    </AppShell>
  );
}
