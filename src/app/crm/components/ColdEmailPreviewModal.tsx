"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lead } from "@/types/crm";
import { Copy, RefreshCw, Check, Loader2 } from "lucide-react";

interface ColdEmailPreviewModalProps {
  lead: Lead | null;
  onClose: () => void;
}

interface EmailContent {
  subject: string;
  body: string;
  context: Record<string, string | number>;
}

// Human-readable labels for context fields
const FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  studio_name: "Studio",
  email: "Email",
  city: "City",
  state: "State",
  country_code: "Country",
  current_platform: "Platform",
  business_type: "Type",
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  classes_per_week_estimate: "Classes/Week",
  instructors_count_estimate: "Instructors",
  additional_info: "Additional Info",
  notes: "Notes",
};

export function ColdEmailPreviewModal({ lead, onClose }: ColdEmailPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<EmailContent | null>(null);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const generateEmail = useCallback(async () => {
    if (!lead) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/crm/generate-cold-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to generate email");
      }

      setEmail(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate email");
    } finally {
      setLoading(false);
    }
  }, [lead]);

  useEffect(() => {
    if (lead) {
      setEmail(null);
      setError(null);
      generateEmail();
    }
  }, [lead, generateEmail]);

  const copyToClipboard = async (text: string, type: "subject" | "body") => {
    await navigator.clipboard.writeText(text);
    if (type === "subject") {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } else {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
  };

  const contactName = lead
    ? [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.studio_name || "Lead"
    : "Lead";

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm">Cold Email for {contactName}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Generating...</span>
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

        {email && !loading && (
          <div className="grid grid-cols-[1fr,200px] gap-4">
            {/* Left: Email content */}
            <div className="space-y-3">
              {/* Subject */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Subject</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(email.subject, "subject")}
                    className="h-5 px-1.5"
                  >
                    {copiedSubject ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <div className="px-2.5 py-2 bg-muted rounded text-sm font-medium">
                  {email.subject}
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Body</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(email.body, "body")}
                    className="h-5 px-1.5"
                  >
                    {copiedBody ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <div className="px-2.5 py-2 bg-muted rounded whitespace-pre-wrap text-sm leading-relaxed">
                  {email.body}
                </div>
              </div>

              {/* Regenerate */}
              <div className="flex justify-end">
                <Button onClick={generateEmail} variant="outline" size="sm" disabled={loading} className="h-7 text-xs">
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Regenerate
                </Button>
              </div>
            </div>

            {/* Right: Context used */}
            <div className="border-l pl-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Data sent to AI</span>
              <div className="mt-2 space-y-1.5">
                {Object.entries(email.context).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-muted-foreground">{FIELD_LABELS[key] || key}:</span>{" "}
                    <span className="text-foreground break-words">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
