"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Lead } from "@/types/crm";
import { Copy, RefreshCw, Check, Loader2, AlertCircle, Download, Send } from "lucide-react";
import {
  EMAIL_SENDERS,
  DEFAULT_SENDER_ID,
  DEFAULT_REPLY_TO_ID,
} from "@/lib/crm/emailSenderConfig";
import { AI_MODELS } from "@/lib/crm/aiModelsConfig";

interface ColdEmailPreviewModalProps {
  lead: Lead | null;
  onClose: () => void;
}

interface ModelResult {
  modelId: string;
  modelName: string;
  success: boolean;
  subject?: string;
  body?: string;
  error?: string;
  duration: number;
}

// Short labels for compact display
const FIELD_LABELS: Record<string, string> = {
  first_name: "Name",
  last_name: "Last",
  studio_name: "Studio",
  email: "Email",
  city: "City",
  state: "State",
  country_code: "Country",
  current_platform: "Platform",
  business_type: "Type",
  website: "Web",
  instagram: "IG",
  facebook: "FB",
  classes_per_week_estimate: "Classes/wk",
  instructors_count_estimate: "Instructors",
  additional_info: "Info",
  notes: "Notes",
};

export function ColdEmailPreviewModal({ lead, onClose }: ColdEmailPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<Record<string, string | number> | null>(null);
  const [results, setResults] = useState<Map<string, ModelResult>>(new Map());
  const [copiedStates, setCopiedStates] = useState<Record<string, "subject" | "body" | null>>({});
  const [sendingModel, setSendingModel] = useState<string | null>(null);
  const [sentModel, setSentModel] = useState<string | null>(null);
  const [fromSenderId, setFromSenderId] = useState(DEFAULT_SENDER_ID);
  const [fromName, setFromName] = useState(EMAIL_SENDERS.find(s => s.id === DEFAULT_SENDER_ID)?.name || "");
  const [replyToId, setReplyToId] = useState(DEFAULT_REPLY_TO_ID);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get current sender
  const fromSender = EMAIL_SENDERS.find(s => s.id === fromSenderId);
  const replyToSender = EMAIL_SENDERS.find(s => s.id === replyToId);
  const fromEmail = fromSender ? `${fromName} <${fromSender.fromEmail}>` : "";
  const replyToEmail = replyToSender?.replyToEmail || "";

  // Update fromName when sender changes
  const handleFromSenderChange = (id: string) => {
    setFromSenderId(id);
    const sender = EMAIL_SENDERS.find(s => s.id === id);
    if (sender) setFromName(sender.name);
  };

  const generateEmail = useCallback(async () => {
    if (!lead) return;

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    setResults(new Map());
    setContext(null);

    try {
      const response = await fetch("/api/crm/generate-cold-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to generate email");
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "context") {
                setContext(event.data);
              } else if (event.type === "result") {
                setResults(prev => {
                  const newMap = new Map(prev);
                  newMap.set(event.data.modelId, event.data);
                  return newMap;
                });
              } else if (event.type === "done") {
                setLoading(false);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Ignore abort errors
      }
      setError(err instanceof Error ? err.message : "Failed to generate email");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [lead]);

  useEffect(() => {
    if (lead) {
      setResults(new Map());
      setContext(null);
      setError(null);
      setCopiedStates({});
      setSentModel(null);
      generateEmail();
    }

    return () => {
      // Cleanup: abort any ongoing request when lead changes or component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [lead, generateEmail]);

  const copyToClipboard = async (modelId: string, text: string, type: "subject" | "body") => {
    await navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [modelId]: type }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [modelId]: null }));
    }, 2000);
  };

  const sendEmail = async (result: ModelResult) => {
    if (!lead || !result.subject || !result.body) return;

    setSendingModel(result.modelId);
    try {
      const response = await fetch("/api/crm/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmail,
          replyTo: replyToEmail,
          leadIds: [lead.id],
          subject: result.subject,
          html: result.body.replace(/\n/g, "<br>"),
        }),
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.error || res.details || "Failed to send email");
      }

      setSentModel(result.modelId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSendingModel(null);
    }
  };

  const contactName = lead
    ? [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.studio_name || "Lead"
    : "Lead";

  const downloadJSON = () => {
    if (results.size === 0 || !lead) return;

    const exportData = {
      lead: {
        id: lead.id,
        name: contactName,
      },
      input: context,
      outputs: Array.from(results.values()).map((r) => ({
        model: r.modelName,
        modelId: r.modelId,
        success: r.success,
        duration_ms: r.duration,
        ...(r.success ? { subject: r.subject, body: r.body } : { error: r.error }),
      })),
      generated_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cold-email-${lead.id.slice(0, 8)}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Check if all models have completed
  const allComplete = results.size === AI_MODELS.length && !loading;

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-1 shrink-0">
          <DialogTitle className="text-sm">Cold Email for {contactName}</DialogTitle>
        </DialogHeader>

        {/* From / Reply-To selectors */}
        <div className="flex gap-4 shrink-0 mb-2 items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">From:</span>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="h-7 text-xs w-[120px]"
              placeholder="Name"
            />
            <Select value={fromSenderId} onValueChange={handleFromSenderChange}>
              <SelectTrigger className="h-7 text-xs w-[180px]">
                <SelectValue>{fromSender?.fromEmail}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EMAIL_SENDERS.map((sender) => (
                  <SelectItem key={sender.id} value={sender.id} className="text-xs">
                    {sender.fromEmail}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Reply-To:</span>
            <Select value={replyToId} onValueChange={setReplyToId}>
              <SelectTrigger className="h-7 text-xs w-[160px]">
                <SelectValue>{replyToSender?.replyToEmail}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EMAIL_SENDERS.map((sender) => (
                  <SelectItem key={sender.id} value={sender.id} className="text-xs">
                    {sender.replyToEmail}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Compact context bar - always visible when context exists */}
        {context && (
          <div className="shrink-0 mb-2 px-2 py-1.5 bg-muted/50 rounded border text-[10px] leading-relaxed">
            <span className="text-muted-foreground font-medium">AI Input: </span>
            {Object.entries(context).map(([key, value], idx) => (
              <span key={key}>
                {idx > 0 && <span className="text-muted-foreground"> · </span>}
                <span className="text-muted-foreground">{FIELD_LABELS[key] || key}:</span>{" "}
                <span className="text-foreground">{String(value).length > 30 ? String(value).slice(0, 30) + "..." : String(value)}</span>
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="py-6 text-center">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button onClick={generateEmail} variant="outline" size="sm">
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Try Again
            </Button>
          </div>
        )}

        {!error && (
          <div className="flex-1 overflow-x-auto min-h-0">
            <div className="flex gap-3 min-w-max pb-2">
              {AI_MODELS.map((model) => {
                const result = results.get(model.id);
                const isLoading = !result && loading;

                return (
                  <div key={model.id} className="w-[250px] shrink-0">
                    {/* Model header */}
                    <div className="flex items-center justify-between mb-1 px-0.5">
                      <span className="text-[11px] font-medium truncate">{model.name}</span>
                      <div className="flex items-center gap-1.5">
                        {result && (
                          <>
                            <span className="text-[10px] text-muted-foreground">
                              {(result.duration / 1000).toFixed(1)}s
                            </span>
                            {result.success && <span className="text-[10px] text-green-600">OK</span>}
                          </>
                        )}
                        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                    </div>

                    {isLoading ? (
                      <div className="px-2 py-8 bg-muted/30 rounded border border-dashed border-muted-foreground/20 flex items-center justify-center">
                        <span className="text-[11px] text-muted-foreground">Generating...</span>
                      </div>
                    ) : result?.success ? (
                      <div className="space-y-1.5">
                        {/* Subject */}
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Subject</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(result.modelId, result.subject!, "subject")}
                              className="h-4 px-1"
                            >
                              {copiedStates[result.modelId] === "subject" ? (
                                <Check className="w-2.5 h-2.5 text-green-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </Button>
                          </div>
                          <div className="px-2 py-1 bg-muted rounded text-[11px] font-medium">
                            {result.subject}
                          </div>
                        </div>

                        {/* Body */}
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Body</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(result.modelId, result.body!, "body")}
                              className="h-4 px-1"
                            >
                              {copiedStates[result.modelId] === "body" ? (
                                <Check className="w-2.5 h-2.5 text-green-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </Button>
                          </div>
                          <div
                            className="px-2 py-1.5 bg-muted rounded text-[11px] leading-relaxed max-h-[300px] overflow-y-auto [&_a]:text-blue-600 [&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: result.body!.replace(/\n/g, '<br>') }}
                          />
                        </div>

                        {/* Send button */}
                        <Button
                          size="sm"
                          variant={sentModel === result.modelId ? "outline" : "default"}
                          onClick={() => sendEmail(result)}
                          disabled={sendingModel !== null || sentModel === result.modelId}
                          className="w-full h-7 text-xs mt-2"
                        >
                          {sendingModel === result.modelId ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                              Sending...
                            </>
                          ) : sentModel === result.modelId ? (
                            <>
                              <Check className="w-3 h-3 mr-1.5 text-green-600" />
                              Sent
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3 mr-1.5" />
                              Send This
                            </>
                          )}
                        </Button>
                      </div>
                    ) : result ? (
                      <div className="px-2 py-3 bg-destructive/10 rounded text-[11px] text-destructive flex items-start gap-2">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="break-words">{result.error}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer buttons */}
        {(results.size > 0 || allComplete) && (
          <div className="flex justify-between pt-2 border-t mt-1 shrink-0">
            <Button onClick={downloadJSON} variant="outline" size="sm" className="h-7 text-xs" disabled={results.size === 0}>
              <Download className="w-3 h-3 mr-1.5" />
              Download JSON
            </Button>
            <Button onClick={generateEmail} variant="outline" size="sm" disabled={loading} className="h-7 text-xs">
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Regenerate All
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
