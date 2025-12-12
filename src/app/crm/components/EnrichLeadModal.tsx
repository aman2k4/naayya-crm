"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Lead, LeadEnrichmentResult } from "@/types/crm";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ExternalLink, Sparkles } from "lucide-react";

interface EnrichLeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated: (updatedLead: Lead) => void;
}

type Phase = "preview" | "loading" | "results";

type SearchField = "studio_name" | "person_name" | "email" | "location";

const FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  phone_number: "Phone",
  website: "Website",
  current_platform: "Platform",
  city: "City",
  state: "State",
  country_code: "Country",
  instagram: "Instagram",
  facebook: "Facebook",
  business_type: "Type",
  additional_info: "Info",
};

export default function EnrichLeadModal({
  lead,
  isOpen,
  onOpenChange,
  onLeadUpdated,
}: EnrichLeadModalProps) {
  const [phase, setPhase] = useState<Phase>("preview");
  const [enrichmentResult, setEnrichmentResult] = useState<LeadEnrichmentResult | null>(null);
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [searchFields, setSearchFields] = useState<Set<SearchField>>(new Set(["email"]));
  const { toast } = useToast();

  // Reset search fields when lead changes
  useEffect(() => {
    if (lead && isOpen) {
      const defaults = new Set<SearchField>(["email"]);
      if (lead.studio_name?.trim()) defaults.add("studio_name");
      else if (lead.first_name || lead.last_name) defaults.add("person_name");
      setSearchFields(defaults);
    }
  }, [lead, isOpen]);

  const handleClose = () => {
    setPhase("preview");
    setEnrichmentResult(null);
    setAppliedFields(new Set());
    setIsApplying(false);
    onOpenChange(false);
  };

  const toggleSearchField = (field: SearchField) => {
    const newFields = new Set(searchFields);
    if (newFields.has(field)) {
      // Don't allow deselecting all fields
      if (newFields.size > 1) {
        newFields.delete(field);
      }
    } else {
      newFields.add(field);
    }
    setSearchFields(newFields);
  };

  const handleEnrich = async () => {
    if (!lead) return;
    setPhase("loading");

    try {
      const response = await fetch("/api/crm/enrich-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          searchFields: Array.from(searchFields),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to enrich lead");
      }

      const result = await response.json();
      setEnrichmentResult(result.data);
      setPhase("results");
    } catch (error) {
      console.error("Error enriching lead:", error);
      toast({
        title: "Enrichment failed",
        description: error instanceof Error ? error.message : "Failed to enrich lead",
        variant: "destructive",
      });
      setPhase("preview");
    }
  };

  const handleApplyField = async (field: string, value: string) => {
    if (!lead) return;
    setIsApplying(true);

    try {
      const response = await fetch("/api/crm/leads-with-count", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, [field]: value }),
      });

      if (!response.ok) throw new Error("Failed to update field");

      const result = await response.json();
      onLeadUpdated(result.data);
      setAppliedFields((prev) => new Set([...prev, field]));
    } catch (error) {
      console.error("Error applying field:", error);
      toast({
        title: "Error",
        description: "Failed to apply update",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyAll = async () => {
    if (!lead || !enrichmentResult) return;
    setIsApplying(true);

    const fieldsToApply: Record<string, string> = {};
    for (const [field, value] of Object.entries(enrichmentResult.newFields)) {
      if (!appliedFields.has(field)) fieldsToApply[field] = value;
    }
    for (const conflict of enrichmentResult.conflicts) {
      if (!appliedFields.has(conflict.field)) fieldsToApply[conflict.field] = conflict.found;
    }

    if (Object.keys(fieldsToApply).length === 0) {
      setIsApplying(false);
      return;
    }

    try {
      const response = await fetch("/api/crm/leads-with-count", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, ...fieldsToApply }),
      });

      if (!response.ok) throw new Error("Failed to update lead");

      const result = await response.json();
      onLeadUpdated(result.data);
      toast({ title: "Updated", description: `${Object.keys(fieldsToApply).length} field(s) applied` });
      handleClose();
    } catch (error) {
      console.error("Error applying all fields:", error);
      toast({ title: "Error", description: "Failed to apply updates", variant: "destructive" });
      setIsApplying(false);
    }
  };

  if (!lead) return null;

  const hasStudioName = lead.studio_name?.trim();
  const hasPersonName = lead.first_name || lead.last_name;
  const personName = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
  const hasLocation = lead.city || lead.state || lead.country_code;
  const locationText = [lead.city, lead.state, lead.country_code].filter(Boolean).join(", ");

  const hasNewFields = enrichmentResult && Object.keys(enrichmentResult.newFields).length > 0;
  const hasConflicts = enrichmentResult && enrichmentResult.conflicts.length > 0;
  const hasAnyResults = hasNewFields || hasConflicts;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[380px] p-4 overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            {phase === "preview" && "Enrich Lead"}
            {phase === "loading" && "Searching..."}
            {phase === "results" && "Results"}
          </DialogTitle>
        </DialogHeader>

        {/* Preview with search field selection */}
        {phase === "preview" && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Select which information to use for web search:
            </p>

            <div className="space-y-2">
              {/* Studio Name */}
              <div className={`flex items-center gap-2 p-2 rounded border ${hasStudioName ? 'bg-muted/30' : 'bg-muted/10 opacity-50'}`}>
                <Checkbox
                  id="search-studio"
                  checked={searchFields.has("studio_name")}
                  onCheckedChange={() => toggleSearchField("studio_name")}
                  disabled={!hasStudioName}
                />
                <Label htmlFor="search-studio" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Studio:</span>{" "}
                  <span className="font-medium">{hasStudioName || "-"}</span>
                </Label>
              </div>

              {/* Person Name */}
              <div className={`flex items-center gap-2 p-2 rounded border ${hasPersonName ? 'bg-muted/30' : 'bg-muted/10 opacity-50'}`}>
                <Checkbox
                  id="search-person"
                  checked={searchFields.has("person_name")}
                  onCheckedChange={() => toggleSearchField("person_name")}
                  disabled={!hasPersonName}
                />
                <Label htmlFor="search-person" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Person:</span>{" "}
                  <span className="font-medium">{personName || "-"}</span>
                </Label>
              </div>

              {/* Email */}
              <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                <Checkbox
                  id="search-email"
                  checked={searchFields.has("email")}
                  onCheckedChange={() => toggleSearchField("email")}
                />
                <Label htmlFor="search-email" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-medium">{lead.email}</span>
                </Label>
              </div>

              {/* Location */}
              <div className={`flex items-center gap-2 p-2 rounded border ${hasLocation ? 'bg-muted/30' : 'bg-muted/10 opacity-50'}`}>
                <Checkbox
                  id="search-location"
                  checked={searchFields.has("location")}
                  onCheckedChange={() => toggleSearchField("location")}
                  disabled={!hasLocation}
                />
                <Label htmlFor="search-location" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Location:</span>{" "}
                  <span className="font-medium">{locationText || "-"}</span>
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-1.5 pt-1">
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 text-xs px-2">
                Cancel
              </Button>
              <Button size="sm" onClick={handleEnrich} className="h-7 text-xs px-2">
                <Sparkles className="w-3 h-3 mr-1" />
                Search
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div className="flex flex-col items-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground mt-2">Searching...</p>
          </div>
        )}

        {/* Results */}
        {phase === "results" && enrichmentResult && (
          <div className="space-y-2 overflow-hidden">
            {!hasAnyResults ? (
              <p className="text-xs text-muted-foreground text-center py-4">No info found.</p>
            ) : (
              <div className="max-h-[280px] overflow-y-auto overflow-x-hidden space-y-1 pr-1">
                {/* New fields */}
                {hasNewFields && Object.entries(enrichmentResult.newFields).map(([field, value]) => (
                  <div
                    key={field}
                    className="flex items-center justify-between gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="text-[10px] text-muted-foreground">{FIELD_LABELS[field] || field}</div>
                      <div className="text-xs font-medium truncate max-w-[260px]">{value}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={appliedFields.has(field) ? "ghost" : "default"}
                      onClick={() => handleApplyField(field, value)}
                      disabled={isApplying || appliedFields.has(field)}
                      className="h-6 text-[10px] px-2 shrink-0"
                    >
                      {appliedFields.has(field) ? <Check className="w-3 h-3" /> : "Apply"}
                    </Button>
                  </div>
                ))}

                {/* Conflicts */}
                {hasConflicts && enrichmentResult.conflicts.map((conflict) => (
                  <div
                    key={conflict.field}
                    className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded px-2 py-1.5"
                  >
                    <div className="text-[10px] text-muted-foreground">{FIELD_LABELS[conflict.field] || conflict.field}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 text-xs overflow-hidden">
                        <span className="line-through text-red-500 truncate">{conflict.current}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="text-green-600 font-medium truncate">{conflict.found}</span>
                      </div>
                      <Button
                        size="sm"
                        variant={appliedFields.has(conflict.field) ? "ghost" : "outline"}
                        onClick={() => handleApplyField(conflict.field, conflict.found)}
                        disabled={isApplying || appliedFields.has(conflict.field)}
                        className="h-6 text-[10px] px-2 shrink-0"
                      >
                        {appliedFields.has(conflict.field) ? <Check className="w-3 h-3" /> : "Use"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sources */}
            {enrichmentResult.sources.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {enrichmentResult.sources.slice(0, 3).map((source, i) => (
                  <a
                    key={i}
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {new URL(source).hostname.replace('www.', '')}
                  </a>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-1.5 pt-1 border-t">
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 text-xs px-2">
                Close
              </Button>
              {hasAnyResults && (
                <Button
                  size="sm"
                  onClick={handleApplyAll}
                  disabled={isApplying || (
                    Object.keys(enrichmentResult.newFields).every(f => appliedFields.has(f)) &&
                    enrichmentResult.conflicts.every(c => appliedFields.has(c.field))
                  )}
                  className="h-7 text-xs px-2"
                >
                  {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply All"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
