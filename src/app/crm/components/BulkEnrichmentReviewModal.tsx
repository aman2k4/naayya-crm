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
import { useState, useEffect, useCallback } from "react";
import { Lead, LeadEnrichmentProviderResult, BulkEnrichmentPreviewItem } from "@/types/crm";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ChevronDown, ChevronRight, Sparkles, AlertCircle } from "lucide-react";
import { normalizeForComparison } from "@/lib/crm/enrichmentNormalization";
import { cn } from "@/lib/utils";

interface BulkEnrichmentReviewModalProps {
  selectedLeads: Lead[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadsUpdated: (updatedLeads: Map<string, Lead>) => void;
}

type Phase = "preview" | "loading" | "results";
type SearchField = "studio_name" | "person_name" | "email" | "location" | "current_platform" | "additional_info";

type EnrichmentStatus = "idle" | "loading" | "done";

interface LeadEnrichmentState {
  leadId: string;
  lead: Lead;
  status: EnrichmentStatus;
  providers?: {
    gemini: LeadEnrichmentProviderResult;
    perplexity: LeadEnrichmentProviderResult;
  };
  appliedFields: Set<string>;
  error?: string;
  expanded: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  first_name: "First",
  last_name: "Last",
  phone_number: "Phone",
  website: "Website",
  current_platform: "Platform",
  classes_per_week_estimate: "Classes/wk",
  instructors_count_estimate: "Instructors",
  city: "City",
  state: "State",
  country_code: "Country",
  instagram: "Instagram",
  facebook: "Facebook",
  business_type: "Type",
  additional_info: "Info",
};

export default function BulkEnrichmentReviewModal({
  selectedLeads,
  isOpen,
  onOpenChange,
  onLeadsUpdated,
}: BulkEnrichmentReviewModalProps) {
  const [phase, setPhase] = useState<Phase>("preview");
  const [searchFields, setSearchFields] = useState<Set<SearchField>>(new Set(["studio_name", "email"]));
  const [enrichmentStates, setEnrichmentStates] = useState<Map<string, LeadEnrichmentState>>(new Map());
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();

  // Compute which search fields are available across all selected leads
  const availableFields = useCallback(() => {
    const result: Record<SearchField, { available: boolean; count: number; example: string }> = {
      studio_name: { available: false, count: 0, example: "" },
      person_name: { available: false, count: 0, example: "" },
      email: { available: false, count: 0, example: "" },
      location: { available: false, count: 0, example: "" },
      current_platform: { available: false, count: 0, example: "" },
      additional_info: { available: false, count: 0, example: "" },
    };

    selectedLeads.forEach((lead) => {
      if (lead.studio_name?.trim()) {
        result.studio_name.count++;
        if (!result.studio_name.example) result.studio_name.example = lead.studio_name;
      }
      if (lead.first_name || lead.last_name) {
        result.person_name.count++;
        if (!result.person_name.example) {
          result.person_name.example = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
        }
      }
      if (lead.email?.trim()) {
        result.email.count++;
        if (!result.email.example) result.email.example = lead.email;
      }
      if (lead.city || lead.state || lead.country_code) {
        result.location.count++;
        if (!result.location.example) {
          result.location.example = [lead.city, lead.state, lead.country_code].filter(Boolean).join(", ");
        }
      }
      if (lead.current_platform?.trim()) {
        result.current_platform.count++;
        if (!result.current_platform.example) result.current_platform.example = lead.current_platform;
      }
      if (lead.additional_info?.trim()) {
        result.additional_info.count++;
        if (!result.additional_info.example) {
          const info = lead.additional_info.trim();
          result.additional_info.example = info.length > 30 ? info.slice(0, 30) + "..." : info;
        }
      }
    });

    // Mark as available if at least one lead has the field
    Object.keys(result).forEach((key) => {
      const k = key as SearchField;
      result[k].available = result[k].count > 0;
    });

    return result;
  }, [selectedLeads]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && selectedLeads.length > 0) {
      setPhase("preview");
      setEnrichmentStates(new Map());

      // Auto-select fields that are available
      const fields = availableFields();
      const defaults = new Set<SearchField>();
      if (fields.studio_name.available) defaults.add("studio_name");
      if (fields.email.available) defaults.add("email");
      if (defaults.size === 0 && fields.person_name.available) defaults.add("person_name");
      setSearchFields(defaults);
    }
  }, [isOpen, selectedLeads, availableFields]);

  const handleClose = () => {
    setPhase("preview");
    setEnrichmentStates(new Map());
    setIsApplying(false);
    onOpenChange(false);
  };

  const toggleSearchField = (field: SearchField) => {
    const newFields = new Set(searchFields);
    if (newFields.has(field)) {
      if (newFields.size > 1) {
        newFields.delete(field);
      }
    } else {
      newFields.add(field);
    }
    setSearchFields(newFields);
  };

  const startEnrichment = useCallback(async () => {
    if (selectedLeads.length === 0) return;

    setPhase("loading");

    // Initialize states
    const states = new Map<string, LeadEnrichmentState>();
    selectedLeads.forEach((lead, idx) => {
      states.set(lead.id, {
        leadId: lead.id,
        lead,
        status: "loading",
        appliedFields: new Set(),
        expanded: idx === 0,
      });
    });
    setEnrichmentStates(states);

    try {
      const response = await fetch("/api/crm/enrich-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: selectedLeads.map((l) => l.id),
          previewMode: true,
          searchFields: Array.from(searchFields),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to enrich leads");
      }

      const result = await response.json();

      if (result.success && result.items) {
        setEnrichmentStates((prev) => {
          const next = new Map(prev);
          (result.items as BulkEnrichmentPreviewItem[]).forEach((item: BulkEnrichmentPreviewItem) => {
            const existing = next.get(item.leadId);
            if (existing) {
              next.set(item.leadId, {
                ...existing,
                status: "done",
                providers: item.providers,
                error: item.error,
              });
            }
          });
          return next;
        });
        setPhase("results");
      }
    } catch (error) {
      console.error("Error in bulk enrichment:", error);
      toast({
        title: "Enrichment failed",
        description: error instanceof Error ? error.message : "Failed to enrich leads",
        variant: "destructive",
      });

      setEnrichmentStates((prev) => {
        const next = new Map(prev);
        next.forEach((state, key) => {
          next.set(key, {
            ...state,
            status: "done",
            error: "Enrichment failed",
          });
        });
        return next;
      });
      setPhase("results");
    }
  }, [selectedLeads, searchFields, toast]);

  const toggleExpand = (leadId: string) => {
    setEnrichmentStates((prev) => {
      const next = new Map(prev);
      const state = next.get(leadId);
      if (state) {
        next.set(leadId, { ...state, expanded: !state.expanded });
      }
      return next;
    });
  };

  const coerceUpdateValue = (field: string, raw: string): string | number => {
    if (field === "classes_per_week_estimate" || field === "instructors_count_estimate") {
      const digits = raw.replace(/[^\d]/g, "");
      const n = parseInt(digits, 10);
      return Number.isFinite(n) ? n : raw;
    }
    return raw;
  };

  const handleApplyField = async (leadId: string, field: string, value: string) => {
    setIsApplying(true);
    try {
      const response = await fetch("/api/crm/leads-with-count", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, [field]: coerceUpdateValue(field, value) }),
      });

      if (!response.ok) throw new Error("Failed to update field");

      const result = await response.json();

      setEnrichmentStates((prev) => {
        const next = new Map(prev);
        const state = next.get(leadId);
        if (state) {
          const newApplied = new Set(state.appliedFields);
          newApplied.add(field);
          next.set(leadId, {
            ...state,
            lead: result.data,
            appliedFields: newApplied,
          });
        }
        return next;
      });

      const updatedMap = new Map<string, Lead>();
      updatedMap.set(leadId, result.data);
      onLeadsUpdated(updatedMap);
    } catch (error) {
      console.error("Error applying field:", error);
      toast({ title: "Error", description: "Failed to apply field", variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyAllFromProvider = async (leadId: string, provider: "gemini" | "perplexity") => {
    const state = enrichmentStates.get(leadId);
    if (!state?.providers) return;

    setIsApplying(true);
    const providerResult = state.providers[provider];

    const fieldsToApply: Record<string, string | number> = {};
    for (const [field, value] of Object.entries(providerResult.newFields)) {
      if (!state.appliedFields.has(field)) {
        fieldsToApply[field] = coerceUpdateValue(field, value);
      }
    }
    for (const conflict of providerResult.conflicts) {
      if (!state.appliedFields.has(conflict.field)) {
        fieldsToApply[conflict.field] = coerceUpdateValue(conflict.field, conflict.found);
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
        body: JSON.stringify({ id: leadId, ...fieldsToApply }),
      });

      if (!response.ok) throw new Error("Failed to update lead");

      const result = await response.json();

      setEnrichmentStates((prev) => {
        const next = new Map(prev);
        const s = next.get(leadId);
        if (s) {
          const newApplied = new Set(s.appliedFields);
          Object.keys(fieldsToApply).forEach((f) => newApplied.add(f));
          next.set(leadId, {
            ...s,
            lead: result.data,
            appliedFields: newApplied,
          });
        }
        return next;
      });

      const updatedMap = new Map<string, Lead>();
      updatedMap.set(leadId, result.data);
      onLeadsUpdated(updatedMap);

      toast({ title: "Applied", description: `${Object.keys(fieldsToApply).length} field(s) updated` });
    } catch (error) {
      console.error("Error applying all:", error);
      toast({ title: "Error", description: "Failed to apply updates", variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  const getCurrentValue = (lead: Lead, field: string) => {
    const v = (lead as unknown as Record<string, unknown>)[field];
    if (v === null || v === undefined) return "";
    return String(v);
  };

  const isSameAsCurrent = (lead: Lead, field: string, value: string) => {
    if (!value) return true;
    const current = getCurrentValue(lead, field);
    return normalizeForComparison(field, current) === normalizeForComparison(field, value);
  };

  const getFieldsToShow = (providers: { gemini: LeadEnrichmentProviderResult; perplexity: LeadEnrichmentProviderResult }) => {
    const fields = new Set<string>();
    Object.keys(providers.gemini.found || {}).forEach((f) => fields.add(f));
    Object.keys(providers.perplexity.found || {}).forEach((f) => fields.add(f));
    return Array.from(fields);
  };

  const getResultCount = (providers: { gemini: LeadEnrichmentProviderResult; perplexity: LeadEnrichmentProviderResult }) => {
    const gCount = Object.keys(providers.gemini.found || {}).length;
    const pCount = Object.keys(providers.perplexity.found || {}).length;
    return { gemini: gCount, perplexity: pCount };
  };

  const statesArray = Array.from(enrichmentStates.values());
  const doneCount = statesArray.filter((s) => s.status === "done").length;
  const loadingCount = statesArray.filter((s) => s.status === "loading").length;
  const fields = availableFields();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl p-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-primary" />
            {phase === "preview" && `Bulk Enrich ${selectedLeads.length} Leads`}
            {phase === "loading" && "Searching..."}
            {phase === "results" && (
              <>
                Bulk Enrichment Results
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  {loadingCount > 0 ? (
                    <>
                      <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                      {loadingCount} loading...
                    </>
                  ) : (
                    `${doneCount}/${statesArray.length} complete`
                  )}
                </span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Preview Phase - Search Field Selection */}
        {phase === "preview" && (
          <div className="p-4 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Select which data to use for web search (applies to all {selectedLeads.length} leads):
            </p>

            <div className="space-y-2">
              {/* Studio Name */}
              <div className={cn(
                "flex items-center gap-2 p-2 rounded border",
                fields.studio_name.available ? "bg-muted/30" : "bg-muted/10 opacity-50"
              )}>
                <Checkbox
                  id="search-studio"
                  checked={searchFields.has("studio_name")}
                  onCheckedChange={() => toggleSearchField("studio_name")}
                  disabled={!fields.studio_name.available}
                />
                <Label htmlFor="search-studio" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Studio:</span>{" "}
                  <span className="font-medium">
                    {fields.studio_name.available
                      ? `${fields.studio_name.count}/${selectedLeads.length} have data`
                      : "No data"}
                  </span>
                  {fields.studio_name.example && (
                    <span className="text-muted-foreground ml-1">
                      (e.g. {fields.studio_name.example.slice(0, 25)}{fields.studio_name.example.length > 25 ? "..." : ""})
                    </span>
                  )}
                </Label>
              </div>

              {/* Person Name */}
              <div className={cn(
                "flex items-center gap-2 p-2 rounded border",
                fields.person_name.available ? "bg-muted/30" : "bg-muted/10 opacity-50"
              )}>
                <Checkbox
                  id="search-person"
                  checked={searchFields.has("person_name")}
                  onCheckedChange={() => toggleSearchField("person_name")}
                  disabled={!fields.person_name.available}
                />
                <Label htmlFor="search-person" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Person:</span>{" "}
                  <span className="font-medium">
                    {fields.person_name.available
                      ? `${fields.person_name.count}/${selectedLeads.length} have data`
                      : "No data"}
                  </span>
                  {fields.person_name.example && (
                    <span className="text-muted-foreground ml-1">
                      (e.g. {fields.person_name.example})
                    </span>
                  )}
                </Label>
              </div>

              {/* Email */}
              <div className={cn(
                "flex items-center gap-2 p-2 rounded border",
                fields.email.available ? "bg-muted/30" : "bg-muted/10 opacity-50"
              )}>
                <Checkbox
                  id="search-email"
                  checked={searchFields.has("email")}
                  onCheckedChange={() => toggleSearchField("email")}
                  disabled={!fields.email.available}
                />
                <Label htmlFor="search-email" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-medium">
                    {fields.email.available
                      ? `${fields.email.count}/${selectedLeads.length} have data`
                      : "No data"}
                  </span>
                  {fields.email.example && (
                    <span className="text-muted-foreground ml-1">
                      (e.g. {fields.email.example})
                    </span>
                  )}
                </Label>
              </div>

              {/* Location */}
              <div className={cn(
                "flex items-center gap-2 p-2 rounded border",
                fields.location.available ? "bg-muted/30" : "bg-muted/10 opacity-50"
              )}>
                <Checkbox
                  id="search-location"
                  checked={searchFields.has("location")}
                  onCheckedChange={() => toggleSearchField("location")}
                  disabled={!fields.location.available}
                />
                <Label htmlFor="search-location" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Location:</span>{" "}
                  <span className="font-medium">
                    {fields.location.available
                      ? `${fields.location.count}/${selectedLeads.length} have data`
                      : "No data"}
                  </span>
                  {fields.location.example && (
                    <span className="text-muted-foreground ml-1">
                      (e.g. {fields.location.example})
                    </span>
                  )}
                </Label>
              </div>

              {/* Platform */}
              <div className={cn(
                "flex items-center gap-2 p-2 rounded border",
                fields.current_platform.available ? "bg-muted/30" : "bg-muted/10 opacity-50"
              )}>
                <Checkbox
                  id="search-platform"
                  checked={searchFields.has("current_platform")}
                  onCheckedChange={() => toggleSearchField("current_platform")}
                  disabled={!fields.current_platform.available}
                />
                <Label htmlFor="search-platform" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Platform:</span>{" "}
                  <span className="font-medium">
                    {fields.current_platform.available
                      ? `${fields.current_platform.count}/${selectedLeads.length} have data`
                      : "No data"}
                  </span>
                  {fields.current_platform.example && (
                    <span className="text-muted-foreground ml-1">
                      (e.g. {fields.current_platform.example})
                    </span>
                  )}
                </Label>
              </div>

              {/* Additional Info */}
              <div className={cn(
                "flex items-center gap-2 p-2 rounded border",
                fields.additional_info.available ? "bg-muted/30" : "bg-muted/10 opacity-50"
              )}>
                <Checkbox
                  id="search-additional"
                  checked={searchFields.has("additional_info")}
                  onCheckedChange={() => toggleSearchField("additional_info")}
                  disabled={!fields.additional_info.available}
                />
                <Label htmlFor="search-additional" className="flex-1 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Additional Info:</span>{" "}
                  <span className="font-medium">
                    {fields.additional_info.available
                      ? `${fields.additional_info.count}/${selectedLeads.length} have data`
                      : "No data"}
                  </span>
                  {fields.additional_info.example && (
                    <span className="text-muted-foreground ml-1">
                      (e.g. {fields.additional_info.example})
                    </span>
                  )}
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-1.5 pt-2">
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 text-xs px-2">
                Cancel
              </Button>
              <Button size="sm" onClick={startEnrichment} className="h-7 text-xs px-2">
                <Sparkles className="w-3 h-3 mr-1" />
                Search All ({selectedLeads.length})
              </Button>
            </div>
          </div>
        )}

        {/* Loading Phase */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">
              Enriching {selectedLeads.length} leads...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Using: {Array.from(searchFields).join(", ")}
            </p>
          </div>
        )}

        {/* Results Phase */}
        {phase === "results" && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-2 space-y-1">
                {statesArray.map((state) => (
                  <LeadEnrichmentCard
                    key={state.leadId}
                    state={state}
                    isApplying={isApplying}
                    onToggleExpand={() => toggleExpand(state.leadId)}
                    onApplyField={(field, value) => handleApplyField(state.leadId, field, value)}
                    onApplyAllFromProvider={(provider) => handleApplyAllFromProvider(state.leadId, provider)}
                    getCurrentValue={(field) => getCurrentValue(state.lead, field)}
                    isSameAsCurrent={(field, value) => isSameAsCurrent(state.lead, field, value)}
                    getFieldsToShow={() => state.providers ? getFieldsToShow(state.providers) : []}
                    getResultCount={() => state.providers ? getResultCount(state.providers) : { gemini: 0, perplexity: 0 }}
                  />
                ))}
              </div>
            </div>

            <div className="px-4 py-2 border-t flex justify-end gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 text-xs">
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface LeadEnrichmentCardProps {
  state: LeadEnrichmentState;
  isApplying: boolean;
  onToggleExpand: () => void;
  onApplyField: (field: string, value: string) => void;
  onApplyAllFromProvider: (provider: "gemini" | "perplexity") => void;
  getCurrentValue: (field: string) => string;
  isSameAsCurrent: (field: string, value: string) => boolean;
  getFieldsToShow: () => string[];
  getResultCount: () => { gemini: number; perplexity: number };
}

function LeadEnrichmentCard({
  state,
  isApplying,
  onToggleExpand,
  onApplyField,
  onApplyAllFromProvider,
  getCurrentValue,
  isSameAsCurrent,
  getFieldsToShow,
  getResultCount,
}: LeadEnrichmentCardProps) {
  const { lead, status, providers, appliedFields, error, expanded } = state;
  const counts = getResultCount();
  const hasResults = counts.gemini > 0 || counts.perplexity > 0;

  return (
    <div className={cn("border rounded", expanded ? "bg-muted/20" : "bg-background")}>
      {/* Header - always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-muted/30 transition-colors"
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
        ) : expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{lead.studio_name || lead.email}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {lead.city && lead.state ? `${lead.city}, ${lead.state}` : lead.email}
          </div>
        </div>

        {status === "done" && !error && (
          <div className="flex items-center gap-2 text-[10px] shrink-0">
            <span className="text-blue-600">G:{counts.gemini}</span>
            <span className="text-purple-600">P:{counts.perplexity}</span>
            {appliedFields.size > 0 && (
              <span className="text-green-600 flex items-center gap-0.5">
                <Check className="w-3 h-3" />
                {appliedFields.size}
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1 text-[10px] text-destructive shrink-0">
            <AlertCircle className="w-3 h-3" />
            Error
          </div>
        )}
      </button>

      {/* Expanded content */}
      {expanded && status === "done" && providers && hasResults && (
        <div className="px-3 pb-3 pt-1 border-t">
          {/* Quick apply buttons */}
          <div className="flex gap-1.5 mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApplyAllFromProvider("gemini")}
              disabled={isApplying || counts.gemini === 0}
              className="h-6 text-[10px] px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Apply All Gemini
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApplyAllFromProvider("perplexity")}
              disabled={isApplying || counts.perplexity === 0}
              className="h-6 text-[10px] px-2 text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              Apply All Perplexity
            </Button>
          </div>

          {/* Fields table */}
          <div className="space-y-1">
            {getFieldsToShow().map((field) => {
              const gVal = providers.gemini.found?.[field] || "";
              const pVal = providers.perplexity.found?.[field] || "";
              const current = getCurrentValue(field);
              const isApplied = appliedFields.has(field);

              // Get website validation status
              const gWebsiteStatus = field === "website" && gVal ? providers.gemini.websiteStatus : undefined;
              const pWebsiteStatus = field === "website" && pVal ? providers.perplexity.websiteStatus : undefined;

              return (
                <div key={field} className="grid grid-cols-[80px_1fr_1fr] gap-1.5 items-start text-[10px]">
                  {/* Field label */}
                  <div className="font-medium text-muted-foreground pt-1">
                    {FIELD_LABELS[field] || field}
                    {current && (
                      <div className="text-[9px] text-muted-foreground/70 truncate" title={current}>
                        now: {current.slice(0, 15)}{current.length > 15 ? "..." : ""}
                      </div>
                    )}
                  </div>

                  {/* Gemini value */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-start gap-1">
                      {gVal ? (
                        <>
                          <span className={cn("flex-1 break-words", isApplied && "text-green-600")}>
                            {gVal}
                          </span>
                          {!isApplied && !isSameAsCurrent(field, gVal) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onApplyField(field, gVal)}
                              disabled={isApplying}
                              className="h-5 w-5 p-0 shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          {isApplied && <Check className="w-3 h-3 text-green-600 shrink-0" />}
                        </>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </div>
                    {/* Website validation status */}
                    {gWebsiteStatus && (
                      <div className={cn("text-[9px]", gWebsiteStatus.valid ? "text-green-600" : "text-red-500")}>
                        {gWebsiteStatus.valid
                          ? `✓ Valid (${gWebsiteStatus.status})`
                          : `✗ ${gWebsiteStatus.error || `Error ${gWebsiteStatus.status}`}`}
                      </div>
                    )}
                  </div>

                  {/* Perplexity value */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-start gap-1">
                      {pVal ? (
                        <>
                          <span className={cn("flex-1 break-words", isApplied && "text-green-600")}>
                            {pVal}
                          </span>
                          {!isApplied && !isSameAsCurrent(field, pVal) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onApplyField(field, pVal)}
                              disabled={isApplying}
                              className="h-5 w-5 p-0 shrink-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          {isApplied && <Check className="w-3 h-3 text-green-600 shrink-0" />}
                        </>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </div>
                    {/* Website validation status */}
                    {pWebsiteStatus && (
                      <div className={cn("text-[9px]", pWebsiteStatus.valid ? "text-green-600" : "text-red-500")}>
                        {pWebsiteStatus.valid
                          ? `✓ Valid (${pWebsiteStatus.status})`
                          : `✗ ${pWebsiteStatus.error || `Error ${pWebsiteStatus.status}`}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No results message */}
      {expanded && status === "done" && !hasResults && !error && (
        <div className="px-3 pb-2 pt-1 text-[10px] text-muted-foreground">
          No enrichment data found
        </div>
      )}

      {/* Error message */}
      {expanded && error && (
        <div className="px-3 pb-2 pt-1 text-[10px] text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
