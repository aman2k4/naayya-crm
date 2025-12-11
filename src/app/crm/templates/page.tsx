"use client";

import { useState, useEffect } from "react";
import { getTemplates, EmailTemplateCategory } from "@/lib/crm/emailTemplates";
import { useToast } from "@/hooks/use-toast";
import { Lead } from "@/types/crm";
import { Loader2, Monitor, Smartphone } from "lucide-react";

export default function EmailTemplatesPage() {
  const templates = getTemplates();
  const { toast } = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [sampleLead, setSampleLead] = useState<Lead | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Fetch a sample lead for preview
  useEffect(() => {
    const fetchSampleLead = async () => {
      try {
        const response = await fetch("/api/crm/leads-with-count?limit=1");
        if (!response.ok) throw new Error("Failed to fetch sample lead");

        const result = await response.json();
        if (result.success && result.data?.leads?.length > 0) {
          setSampleLead(result.data.leads[0]);
        }
      } catch (error) {
        console.error("Error fetching sample lead:", error);
      }
    };

    fetchSampleLead();
  }, []);

  const handlePreview = async (templateId: string) => {
    if (!sampleLead) {
      toast({
        title: "No preview available",
        description: "No sample lead available for preview",
        variant: "destructive",
      });
      return;
    }

    setSelectedTemplateId(templateId);
    setIsLoadingPreview(true);

    try {
      const response = await fetch("/api/crm/preview-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: templateId,
          leadId: sampleLead.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to render preview");
      }

      const result = await response.json();
      if (result.success) {
        setPreviewHtml(result.html);
        setPreviewSubject(result.subject);
      } else {
        throw new Error(result.error || "Failed to render preview");
      }
    } catch (error: any) {
      console.error("Error rendering preview:", error);
      toast({
        title: "Preview error",
        description: error.message || "Failed to render email preview",
        variant: "destructive",
      });
      setSelectedTemplateId(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<EmailTemplateCategory, typeof templates>);

  const categories: EmailTemplateCategory[] = ["First Email", "First Follow Up", "Second Follow Up"];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background p-6">
      {/* Top - Category Columns */}
      <div className="flex-1 flex gap-6 overflow-hidden mb-6">
        {categories.map((category) => {
          const categoryTemplates = templatesByCategory[category] || [];

          return (
            <div key={category} className="flex-1 flex flex-col min-w-0">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex-shrink-0">
                {category}
              </h2>
              <div className="space-y-1 overflow-y-auto">
                {categoryTemplates.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No templates yet</p>
                ) : (
                  categoryTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handlePreview(template.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedTemplateId === template.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {template.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom - Preview */}
      <div className="border-t pt-6 flex-shrink-0 h-[500px] overflow-y-auto">
        {!selectedTemplateId ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Select a template to preview
            </p>
          </div>
        ) : isLoadingPreview ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {sampleLead && (
              <p className="text-xs text-muted-foreground">
                Preview with sample data: {sampleLead.first_name} {sampleLead.last_name}
              </p>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Subject</p>
              <p className="text-sm">{previewSubject}</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground">Body</p>
                <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={`p-1.5 rounded ${
                      previewMode === "desktop"
                        ? "bg-background shadow-sm"
                        : "hover:bg-background/50"
                    }`}
                    title="Desktop view"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={`p-1.5 rounded ${
                      previewMode === "mobile"
                        ? "bg-background shadow-sm"
                        : "hover:bg-background/50"
                    }`}
                    title="Mobile view"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className={`border rounded-lg overflow-hidden bg-white mx-auto ${
                previewMode === "mobile" ? "w-[375px]" : "w-full"
              }`}>
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-[350px]"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
