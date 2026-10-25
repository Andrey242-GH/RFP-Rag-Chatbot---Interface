"use client";

import { useCallback, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { uploadRFP } from "@/services/rfp.service";
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/constants";
import { formatFileSize } from "@/lib/utils";
import type { UploadProgress } from "@/types";

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Government",
  "Education",
  "Manufacturing",
  "Retail",
  "Energy",
  "Transportation",
  "Telecommunications",
  "Other",
];

const REGIONS = [
  "North America",
  "South America",
  "Europe",
  "Asia Pacific",
  "Middle East",
  "Africa",
  "Global",
];

const formSchema = z.object({
  client: z.string().min(1, "Client name is required"),
  industry: z.string().min(1, "Industry is required"),
  region: z.string().min(1, "Region is required"),
  submissionDate: z.string().min(1, "Submission date is required"),
  estimatedValue: z.string().optional(),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function UploadRFPForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      submissionDate: "",
    },
  });

  // Set today's date client-side (avoids unstable new Date() during prerender)
  useEffect(() => {
    setValue("submissionDate", new Date().toISOString().split("T")[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const industry = watch("industry");
  const region = watch("region");

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(f.type) && !ACCEPTED_FILE_EXTENSIONS.some((ext) => f.name.endsWith(ext))) {
      return `Unsupported file type. Accepted: ${ACCEPTED_FILE_EXTENSIONS.join(", ")}`;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`;
    }
    return null;
  };

  const handleFileSelect = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setFileError(err);
      setFile(null);
    } else {
      setFileError(null);
      setFile(f);
    }
  };

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFileSelect(dropped);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);

  const onSubmit = async (values: FormValues) => {
    if (!file) {
      setFileError("Please select a file to upload.");
      return;
    }

    setUploadProgress({ stage: "uploading", percentage: 0, message: "Uploading document…" });

    try {
      const tags = values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;

      const response = await uploadRFP({
        file,
        metadata: {
          client: values.client,
          industry: values.industry,
          region: values.region,
          submissionDate: values.submissionDate,
          estimatedValue: values.estimatedValue ? parseFloat(values.estimatedValue) : undefined,
          tags,
        },
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
      });

      setUploadProgress({ stage: "complete", percentage: 100, message: "Upload complete!" });

      // Navigate to analysis with the new RFP id
      const rfpId = response.data?.id;
      if (rfpId) {
        setTimeout(() => router.push(`/analysis?rfpId=${rfpId}`), 800);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setUploadProgress({ stage: "error", percentage: 0, message: msg });
    }
  };

  const stageLabel: Record<UploadProgress["stage"], string> = {
    uploading: "Uploading",
    extracting: "Extracting questions",
    analyzing: "Analyzing requirements",
    complete: "Complete",
    error: "Error",
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-6">
        {/* Drop Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              role="button"
              tabIndex={0}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => document.getElementById("rfp-file-input")?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  document.getElementById("rfp-file-input")?.click();
                }
              }}
              aria-label="Drop zone for RFP document upload"
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
                dragging
                  ? "border-indigo-500 bg-indigo-50"
                  : file
                  ? "border-green-400 bg-green-50"
                  : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <input
                id="rfp-file-input"
                type="file"
                accept={ACCEPTED_FILE_EXTENSIONS.join(",")}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                aria-hidden="true"
              />

              {file ? (
                <>
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="mt-3 font-medium text-slate-800">{file.name}</p>
                  <p className="text-sm text-slate-500">{formatFileSize(file.size)}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="mt-3 flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                    aria-label="Remove selected file"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-slate-400" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Drag & drop or click to browse
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    PDF, DOCX, TXT up to {formatFileSize(MAX_FILE_SIZE_BYTES)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {[".pdf", ".docx", ".txt"].map((ext) => (
                      <Badge key={ext} variant="secondary">
                        {ext}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>

            {fileError && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {fileError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposal Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Client */}
              <div className="space-y-2">
                <Label htmlFor="client">Client Name *</Label>
                <Input
                  id="client"
                  placeholder="e.g. Microsoft"
                  {...register("client")}
                  aria-invalid={!!errors.client}
                />
                {errors.client && (
                  <p className="text-xs text-red-600" role="alert">
                    {errors.client.message}
                  </p>
                )}
              </div>

              {/* Submission Date */}
              <div className="space-y-2">
                <Label htmlFor="submissionDate">Submission Date *</Label>
                <Input
                  id="submissionDate"
                  type="date"
                  {...register("submissionDate")}
                  aria-invalid={!!errors.submissionDate}
                />
                {errors.submissionDate && (
                  <p className="text-xs text-red-600" role="alert">
                    {errors.submissionDate.message}
                  </p>
                )}
              </div>

              {/* Industry */}
              <div className="space-y-2">
                <Label htmlFor="industry">Industry *</Label>
                <Select
                  value={industry}
                  onValueChange={(v) => setValue("industry", v, { shouldValidate: true })}
                >
                  <SelectTrigger id="industry" aria-invalid={!!errors.industry}>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.industry && (
                  <p className="text-xs text-red-600" role="alert">
                    {errors.industry.message}
                  </p>
                )}
              </div>

              {/* Region */}
              <div className="space-y-2">
                <Label htmlFor="region">Region *</Label>
                <Select
                  value={region}
                  onValueChange={(v) => setValue("region", v, { shouldValidate: true })}
                >
                  <SelectTrigger id="region" aria-invalid={!!errors.region}>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.region && (
                  <p className="text-xs text-red-600" role="alert">
                    {errors.region.message}
                  </p>
                )}
              </div>

              {/* Estimated Value */}
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Estimated Value (USD)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  placeholder="e.g. 500000"
                  {...register("estimatedValue")}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g. security, cloud, compliance"
                  {...register("tags")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Progress */}
        {uploadProgress && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    {uploadProgress.stage === "complete" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : uploadProgress.stage === "error" ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    )}
                    {stageLabel[uploadProgress.stage]}
                  </span>
                  <span className="text-slate-500">{uploadProgress.percentage}%</span>
                </div>
                <Progress
                  value={uploadProgress.percentage}
                  className={
                    uploadProgress.stage === "error"
                      ? "[&>div]:bg-red-500"
                      : uploadProgress.stage === "complete"
                      ? "[&>div]:bg-green-500"
                      : "[&>div]:bg-indigo-600"
                  }
                />
                <p className="text-xs text-slate-500">{uploadProgress.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/lifecycle")}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || uploadProgress?.stage === "uploading"}
            loading={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <FileText className="mr-2 h-4 w-4" />
            Upload & Analyze
          </Button>
        </div>
      </div>
    </form>
  );
}
