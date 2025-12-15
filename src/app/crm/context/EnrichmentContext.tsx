"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Lead, BulkEnrichmentResult } from "@/types/crm";
import { useToast } from "@/hooks/use-toast";

interface EnrichmentContextValue {
  // Modal state
  enrichModalOpen: boolean;
  enrichingLead: Lead | null;
  openEnrichModal: (lead: Lead) => void;
  closeEnrichModal: () => void;

  // Bulk enrichment state
  isBulkEnriching: boolean;
  handleBulkEnrich: (
    selectedIds: string[],
    onSuccess: (updatedLeads: Map<string, Lead>) => void
  ) => Promise<void>;

  // Update enriching lead (called when a field is applied)
  updateEnrichingLead: (updatedLead: Lead) => void;
}

const EnrichmentContext = createContext<EnrichmentContextValue | null>(null);

export function useEnrichment() {
  const context = useContext(EnrichmentContext);
  if (!context) {
    throw new Error("useEnrichment must be used within an EnrichmentProvider");
  }
  return context;
}

interface EnrichmentProviderProps {
  children: ReactNode;
}

export function EnrichmentProvider({ children }: EnrichmentProviderProps) {
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const [enrichingLead, setEnrichingLead] = useState<Lead | null>(null);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const { toast } = useToast();

  const openEnrichModal = useCallback((lead: Lead) => {
    setEnrichingLead(lead);
    setEnrichModalOpen(true);
  }, []);

  const closeEnrichModal = useCallback(() => {
    setEnrichModalOpen(false);
    setEnrichingLead(null);
  }, []);

  const updateEnrichingLead = useCallback((updatedLead: Lead) => {
    setEnrichingLead((prev) =>
      prev && prev.id === updatedLead.id ? updatedLead : prev
    );
  }, []);

  const handleBulkEnrich = useCallback(async (
    selectedIds: string[],
    onSuccess: (updatedLeads: Map<string, Lead>) => void
  ) => {
    if (selectedIds.length === 0) {
      toast({
        title: "No leads selected",
        description: "Please select leads to enrich",
        variant: "destructive",
      });
      return;
    }

    if (selectedIds.length > 10) {
      toast({
        title: "Too many leads selected",
        description: "Please select 10 or fewer leads for bulk enrichment",
        variant: "destructive",
      });
      return;
    }

    setIsBulkEnriching(true);

    try {
      const response = await fetch("/api/crm/enrich-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to enrich leads");
      }

      const result = await response.json();

      if (result.success && result.results) {
        const updatedLeadsMap = new Map<string, Lead>();
        (result.results as BulkEnrichmentResult[]).forEach((r: BulkEnrichmentResult) => {
          if (r.success && r.updatedLead) {
            updatedLeadsMap.set(r.leadId, r.updatedLead);
          }
        });

        if (updatedLeadsMap.size > 0) {
          onSuccess(updatedLeadsMap);
        }

        const { summary } = result;
        toast({
          title: "Enrichment complete",
          description: `${summary.updated} of ${summary.total} leads updated${summary.failed > 0 ? `, ${summary.failed} failed` : ""}`,
        });
      }
    } catch (error) {
      console.error("Error in bulk enrichment:", error);
      toast({
        title: "Enrichment failed",
        description: error instanceof Error ? error.message : "Failed to enrich leads",
        variant: "destructive",
      });
    } finally {
      setIsBulkEnriching(false);
    }
  }, [toast]);

  const value: EnrichmentContextValue = {
    enrichModalOpen,
    enrichingLead,
    openEnrichModal,
    closeEnrichModal,
    isBulkEnriching,
    handleBulkEnrich,
    updateEnrichingLead,
  };

  return (
    <EnrichmentContext.Provider value={value}>
      {children}
    </EnrichmentContext.Provider>
  );
}
