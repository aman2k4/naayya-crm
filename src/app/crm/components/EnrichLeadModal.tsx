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
import { Lead, LeadEnrichmentResult, LeadEnrichmentProviderResult } from "@/types/crm";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ExternalLink, Sparkles } from "lucide-react";
import { normalizeForComparison } from "@/lib/crm/enrichmentNormalization";

interface EnrichLeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated: (updatedLead: Lead) => void;
}

type Phase = "preview" | "loading" | "results";

type SearchField = "studio_name" | "person_name" | "email" | "location" | "current_platform" | "additional_info";

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  first_name: "First Name",
  last_name: "Last Name",
  phone_number: "Phone",
  website: "Website",
  current_platform: "Platform",
  classes_per_week_estimate: "Classes / Week",
  instructors_count_estimate: "Instructors",
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

  // Reset search fields when lead changes - default to studio_name + email if available
  useEffect(() => {
    if (lead && isOpen) {
      const defaults = new Set<SearchField>();
      if (lead.studio_name?.trim()) defaults.add("studio_name");
      if (lead.email?.trim()) defaults.add("email");
      // If neither studio nor email, fall back to person name
      if (defaults.size === 0 && (lead.first_name || lead.last_name)) {
        defaults.add("person_name");
      }
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
      const coerceUpdateValue = (fieldName: string, raw: string): string | number => {
        if (fieldName === "classes_per_week_estimate" || fieldName === "instructors_count_estimate") {
          const digits = raw.replace(/[^\d]/g, "");
          const n = parseInt(digits, 10);
          return Number.isFinite(n) ? n : raw;
        }
        return raw;
      };

      const response = await fetch("/api/crm/leads-with-count", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, [field]: coerceUpdateValue(field, value) }),
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
    // Default to Gemini for backwards UX; Perplexity has its own button below.
    return handleApplyAllFromProvider("gemini");
  };

  const handleApplyAllFromProvider = async (provider: "gemini" | "perplexity") => {
    if (!lead || !enrichmentResult) return;
    setIsApplying(true);

    const providerResult = enrichmentResult.providers[provider];

    const fieldsToApply: Record<string, string | number> = {};
    for (const [field, value] of Object.entries(providerResult.newFields)) {
      if (!appliedFields.has(field)) {
        if (field === "classes_per_week_estimate" || field === "instructors_count_estimate") {
          const digits = value.replace(/[^\d]/g, "");
          const n = parseInt(digits, 10);
          if (Number.isFinite(n)) fieldsToApply[field] = n;
        } else {
          fieldsToApply[field] = value;
        }
      }
    }
    for (const conflict of providerResult.conflicts) {
      if (!appliedFields.has(conflict.field)) {
        if (conflict.field === "classes_per_week_estimate" || conflict.field === "instructors_count_estimate") {
          const digits = conflict.found.replace(/[^\d]/g, "");
          const n = parseInt(digits, 10);
          if (Number.isFinite(n)) fieldsToApply[conflict.field] = n;
        } else {
          fieldsToApply[conflict.field] = conflict.found;
        }
      }
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
  const hasEmail = lead.email?.trim();
  const hasLocation = lead.city || lead.state || lead.country_code;
  const locationText = [lead.city, lead.state, lead.country_code].filter(Boolean).join(", ");
  const hasPlatform = lead.current_platform?.trim();
  const hasAdditionalInfo = lead.additional_info?.trim();
  const additionalInfoText = lead.additional_info?.trim() || "";

  const gemini = enrichmentResult?.providers.gemini;
  const perplexity = enrichmentResult?.providers.perplexity;

  const hostnameForSource = (source: string) => {
    try {
      return new URL(source).hostname.replace("www.", "");
    } catch {
      return source;
    }
  };

  const providerHasAny = (r: LeadEnrichmentProviderResult | undefined | null) => {
    if (!r) return false;
    return Object.keys(r.found).length > 0;
  };

  const hasAnyResults = providerHasAny(gemini) || providerHasAny(perplexity);

  const orderedFields = Object.keys(FIELD_LABELS);

  const allFields = (() => {
    const s = new Set<string>();
    for (const f of orderedFields) s.add(f);
    for (const f of Object.keys(gemini?.found || {})) s.add(f);
    for (const f of Object.keys(perplexity?.found || {})) s.add(f);
    return Array.from(s);
  })();

  const getCurrentValue = (field: string) => {
    const v = (lead as unknown as Record<string, unknown>)[field];
    if (v === null || v === undefined) return "";
    return String(v);
  };

  const diffStatus = (field: string, a: string, b: string) => {
    const na = normalizeForComparison(field, a);
    const nb = normalizeForComparison(field, b);
    if (!na && !nb) return "empty";
    if (na && nb && na === nb) return "match";
    return "diff";
  };

  const isSameAsCurrent = (field: string, value: string) => {
    if (!value) return true;
    const current = getCurrentValue(field);
    return normalizeForComparison(field, current) === normalizeForComparison(field, value);
  };

  const providerApplyable = (r: LeadEnrichmentProviderResult | undefined | null) => {
    if (!r) return [];
    const keys = new Set<string>();
    for (const k of Object.keys(r.newFields || {})) keys.add(k);
    for (const c of r.conflicts || []) keys.add(c.field);
    return Array.from(keys);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[920px] p-4 overflow-hidden">
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
              <div className={`flex items-center gap-2 p-2 rounded border ${hasEmail ? 'bg-muted/30' : 'bg-muted/10 opacity-50'}`}>
                <Checkbox
                  id="search-email"
                  checked={searchFields.has("email")}
                  onCheckedChange={() => toggleSearchField("email")}
                  disabled={!hasEmail}
                />
                <Label htmlFor="search-email" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-medium">{hasEmail || "-"}</span>
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

              {/* Platform */}
              <div className={`flex items-center gap-2 p-2 rounded border ${hasPlatform ? 'bg-muted/30' : 'bg-muted/10 opacity-50'}`}>
                <Checkbox
                  id="search-platform"
                  checked={searchFields.has("current_platform")}
                  onCheckedChange={() => toggleSearchField("current_platform")}
                  disabled={!hasPlatform}
                />
                <Label htmlFor="search-platform" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Platform:</span>{" "}
                  <span className="font-medium">{hasPlatform || "-"}</span>
                </Label>
              </div>

              {/* Additional Info */}
              <div className={`flex items-center gap-2 p-2 rounded border ${hasAdditionalInfo ? 'bg-muted/30' : 'bg-muted/10 opacity-50'}`}>
                <Checkbox
                  id="search-additional-info"
                  checked={searchFields.has("additional_info")}
                  onCheckedChange={() => toggleSearchField("additional_info")}
                  disabled={!hasAdditionalInfo}
                />
                <Label htmlFor="search-additional-info" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Additional Info:</span>{" "}
                  <span className="font-medium truncate">{additionalInfoText ? (additionalInfoText.length > 50 ? additionalInfoText.slice(0, 50) + "..." : additionalInfoText) : "-"}</span>
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
              <div className="max-h-[380px] overflow-y-auto overflow-x-hidden pr-1">
                <div className="grid grid-cols-[160px_1fr_1fr] gap-2 items-start mb-2">
                  <div />
                  <div className="text-[10px] text-muted-foreground">
                    {gemini?.error ? (
                      <span className="text-destructive">Gemini error: {gemini.error}</span>
                    ) : (
                      "Gemini results"
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {perplexity?.error ? (
                      <span className="text-destructive">Perplexity error: {perplexity.error}</span>
                    ) : (
                      "Perplexity results"
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[160px_1fr_1fr] gap-2 items-center sticky top-0 bg-background pb-2">
                  <div className="text-[11px] text-muted-foreground">Field</div>
                  <div className="text-[11px] text-muted-foreground">Gemini</div>
                  <div className="text-[11px] text-muted-foreground">Perplexity</div>
                </div>

                <div className="space-y-2">
                  {allFields.map((field) => {
                    const g = gemini?.found?.[field] || "";
                    const p = perplexity?.found?.[field] || "";
                    const status = diffStatus(field, g, p);
                    const current = getCurrentValue(field);

                    if (!g && !p) return null;

                    const rowClass =
                      status === "match"
                        ? "border-green-200 dark:border-green-900/50 bg-green-50/60 dark:bg-green-950/25"
                        : status === "diff"
                          ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20"
                          : "border-border bg-muted/10";

                    return (
                      <div
                        key={field}
                        className={`border rounded p-2 ${rowClass}`}
                      >
                        <div className="grid grid-cols-[160px_1fr_1fr] gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium">{FIELD_LABELS[field] || field}</div>
                            {current && (
                              <div className="text-[10px] text-muted-foreground truncate">
                                Current: {current}
                              </div>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {status === "match" ? "Match" : status === "diff" ? "Different" : ""}
                            </div>
                          </div>

                          {/* Gemini cell */}
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-medium break-words">{g || "-"}</div>
                              {g && (
                                <Button
                                  size="sm"
                                  variant={appliedFields.has(field) ? "ghost" : "default"}
                                  onClick={() => handleApplyField(field, g)}
                                  disabled={isApplying || appliedFields.has(field) || isSameAsCurrent(field, g)}
                                  className="h-6 text-[10px] px-2 shrink-0"
                                >
                                  {appliedFields.has(field) ? <Check className="w-3 h-3" /> : "Apply"}
                                </Button>
                              )}
                            </div>
                            {g && isSameAsCurrent(field, g) && (
                              <div className="text-[10px] text-muted-foreground mt-1">Same as current</div>
                            )}
                            {field === "website" && g && gemini?.websiteStatus && (
                              <div className={`text-[10px] mt-1 ${gemini.websiteStatus.valid ? 'text-green-600' : 'text-red-500'}`}>
                                {gemini.websiteStatus.valid
                                  ? `✓ Working (${gemini.websiteStatus.status})`
                                  : `✗ ${gemini.websiteStatus.error || `Error ${gemini.websiteStatus.status}`}`}
                              </div>
                            )}
                          </div>

                          {/* Perplexity cell */}
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-medium break-words">{p || "-"}</div>
                              {p && (
                                <Button
                                  size="sm"
                                  variant={appliedFields.has(field) ? "ghost" : "outline"}
                                  onClick={() => handleApplyField(field, p)}
                                  disabled={isApplying || appliedFields.has(field) || isSameAsCurrent(field, p)}
                                  className="h-6 text-[10px] px-2 shrink-0"
                                >
                                  {appliedFields.has(field) ? <Check className="w-3 h-3" /> : "Apply"}
                                </Button>
                              )}
                            </div>
                            {p && isSameAsCurrent(field, p) && (
                              <div className="text-[10px] text-muted-foreground mt-1">Same as current</div>
                            )}
                            {field === "website" && p && perplexity?.websiteStatus && (
                              <div className={`text-[10px] mt-1 ${perplexity.websiteStatus.valid ? 'text-green-600' : 'text-red-500'}`}>
                                {perplexity.websiteStatus.valid
                                  ? `✓ Working (${perplexity.websiteStatus.status})`
                                  : `✗ ${perplexity.websiteStatus.error || `Error ${perplexity.websiteStatus.status}`}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sources (once) */}
                {(gemini?.sources?.length || 0) > 0 || (perplexity?.sources?.length || 0) > 0 ? (
                  <div className="grid grid-cols-[160px_1fr_1fr] gap-2 mt-3 pt-3 border-t">
                    <div className="text-[11px] text-muted-foreground">Sources</div>
                    <div className="flex flex-wrap gap-1">
                      {(gemini?.sources || []).slice(0, 5).map((source, i) => (
                        <a
                          key={`gemini-source-${i}`}
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {hostnameForSource(source)}
                        </a>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(perplexity?.sources || []).slice(0, 5).map((source, i) => (
                        <a
                          key={`perplexity-source-${i}`}
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {hostnameForSource(source)}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex justify-end gap-1.5 pt-1 border-t">
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 text-xs px-2">
                Close
              </Button>
              {gemini && (
                <Button
                  size="sm"
                  onClick={() => handleApplyAllFromProvider("gemini")}
                  disabled={
                    isApplying ||
                    providerApplyable(gemini).length === 0 ||
                    providerApplyable(gemini).every((f) => appliedFields.has(f))
                  }
                  className="h-7 text-xs px-2"
                >
                  {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply All (Gemini)"}
                </Button>
              )}
              {perplexity && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplyAllFromProvider("perplexity")}
                  disabled={
                    isApplying ||
                    providerApplyable(perplexity).length === 0 ||
                    providerApplyable(perplexity).every((f) => appliedFields.has(f))
                  }
                  className="h-7 text-xs px-2"
                >
                  {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply All (Perplexity)"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
