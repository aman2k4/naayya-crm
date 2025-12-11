"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lead, ResponseStatus, BulkEnrichmentResult } from "@/types/crm";
import { type EmailStatus } from "@/lib/crm/emailStatusHelpers";
import { CopyableCell } from "@/components/ui/copyable-cell";
import { useToast } from "@/hooks/use-toast";
import CSVImportDialog from "./components/CSVImportDialog";
import EmailEventsModal from "./components/EmailEventsModal";
import AddLeadDialog from "./components/AddLeadDialog";
import CreateAudienceDialog from "./components/CreateAudienceDialog";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  Mail,
  MailCheck,
  MailX,
  AlertTriangle,
  MousePointer,
  Eye,
  CheckCircle,
  XCircle,
  Info,
  RefreshCw,
  Send,
  Pencil,
  Sparkles,
  Loader2,
} from "lucide-react";
import EditLeadDialog from "./components/EditLeadDialog";
import EnrichLeadModal from "./components/EnrichLeadModal";
import { ExportPdfButton } from "./components/ExportPdfButton";

const EMAIL_STATUS_OPTIONS = [
  { value: "not_sent", label: "Not Sent", icon: Mail },
  { value: "sent", label: "Sent", icon: MailCheck },
  { value: "delivered", label: "Delivered", icon: CheckCircle },
  { value: "opened", label: "Opened", icon: Eye },
  { value: "clicked", label: "Clicked", icon: MousePointer },
  { value: "bounced", label: "Bounced", icon: XCircle },
  { value: "complained", label: "Complained", icon: AlertTriangle },
  { value: "failed", label: "Failed", icon: MailX },
  { value: "unsubscribed", label: "Unsubscribed", icon: MailX },
];

const RESPONSE_STATUS_OPTIONS: Array<{
  value: ResponseStatus;
  label: string;
  color: string;
}> = [
  { value: "interested", label: "✅ Interested", color: "text-green-600" },
  {
    value: "not_interested",
    label: "❌ Not Interested",
    color: "text-red-600",
  },
  {
    value: "interested_later",
    label: "⏰ Interested Later",
    color: "text-yellow-600",
  },
  {
    value: "follow_up_needed",
    label: "📞 Follow Up Needed",
    color: "text-blue-600",
  },
  { value: "qualified", label: "🎯 Qualified", color: "text-purple-600" },
  { value: "converted", label: "🚀 Converted", color: "text-green-700" },
];

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CRMDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("__all__");
  const [selectedEmailStatus, setSelectedEmailStatus] = useState("__all__");
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState("__all__");
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState("__all__");
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAllFilteredSelected, setIsAllFilteredSelected] = useState(false);
  const [allFilteredLeads, setAllFilteredLeads] = useState<Lead[]>([]);
  const [isLoadingAllFiltered, setIsLoadingAllFiltered] = useState(false);
  const [emailStatus, setEmailStatus] = useState<Record<string, EmailStatus>>(
    {}
  );
  const [lastEmailFrom, setLastEmailFrom] = useState("");
  const [lastEmailTo, setLastEmailTo] = useState("");
  const [minEmailsSent, setMinEmailsSent] = useState("");
  const [maxEmailsSent, setMaxEmailsSent] = useState("");
  const [emailEventsModalOpen, setEmailEventsModalOpen] = useState(false);
  const [selectedEmailForEvents, setSelectedEmailForEvents] =
    useState<string>("");
  const [isAudienceDialogOpen, setIsAudienceDialogOpen] = useState(false);
  const [everEmailedOnly, setEverEmailedOnly] = useState(false);
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const [enrichingLead, setEnrichingLead] = useState<Lead | null>(null);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Function to update URL with current filter state
  const updateURL = useCallback(
    (filters: {
      search?: string;
      country_code?: string;
      emailStatus?: string;
      platform?: string;
      source?: string;
      page?: number;
      limit?: number;
      lastEmailFrom?: string;
      lastEmailTo?: string;
      minEmailsSent?: string;
      maxEmailsSent?: string;
    }) => {
      const params = new URLSearchParams(searchParams);

      // Update or remove search parameter
      if (filters.search !== undefined) {
        if (filters.search.trim()) {
          params.set("search", filters.search.trim());
        } else {
          params.delete("search");
        }
      }

      // Update or remove country_code parameter
      if (filters.country_code !== undefined) {
        if (filters.country_code && filters.country_code !== "__all__") {
          params.set("country_code", filters.country_code);
        } else {
          params.delete("country_code");
        }
      }

      // Update or remove email status parameter
      if (filters.emailStatus !== undefined) {
        if (filters.emailStatus && filters.emailStatus !== "__all__") {
          params.set("emailStatus", filters.emailStatus);
        } else {
          params.delete("emailStatus");
        }
      }

      // Update or remove last email window filters
      if (filters.lastEmailFrom !== undefined) {
        if (filters.lastEmailFrom) {
          params.set("lastEmailFrom", filters.lastEmailFrom);
        } else {
          params.delete("lastEmailFrom");
        }
      }

      if (filters.lastEmailTo !== undefined) {
        if (filters.lastEmailTo) {
          params.set("lastEmailTo", filters.lastEmailTo);
        } else {
          params.delete("lastEmailTo");
        }
      }

      if (filters.minEmailsSent !== undefined) {
        if (filters.minEmailsSent) {
          params.set("minEmailsSent", filters.minEmailsSent);
        } else {
          params.delete("minEmailsSent");
        }
      }

      if (filters.maxEmailsSent !== undefined) {
        if (filters.maxEmailsSent) {
          params.set("maxEmailsSent", filters.maxEmailsSent);
        } else {
          params.delete("maxEmailsSent");
        }
      }

      // Update or remove platform parameter
      if (filters.platform !== undefined) {
        if (filters.platform && filters.platform !== "__all__") {
          params.set("platform", filters.platform);
        } else {
          params.delete("platform");
        }
      }

      // Update or remove source parameter
      if (filters.source !== undefined) {
        if (filters.source && filters.source !== "__all__") {
          params.set("source", filters.source);
        } else {
          params.delete("source");
        }
      }

      // Update or remove page parameter
      if (filters.page !== undefined) {
        if (filters.page > 1) {
          params.set("page", filters.page.toString());
        } else {
          params.delete("page");
        }
      }

      // Update or remove limit parameter
      if (filters.limit !== undefined) {
        if (filters.limit !== 20) {
          // 20 is the default
          params.set("limit", filters.limit.toString());
        } else {
          params.delete("limit");
        }
      }

      const newURL = params.toString() ? `?${params.toString()}` : "";
      router.push(`/crm${newURL}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Function to initialize filters from URL parameters
  const initializeFiltersFromURL = useCallback(() => {
    const urlSearch = searchParams.get("search") || "";
    const urlCountryCode = searchParams.get("country_code") || "__all__";
    const urlEmailStatus = searchParams.get("emailStatus") || "__all__";
    const urlPlatform = searchParams.get("platform") || "__all__";
    const urlSource = searchParams.get("source") || "__all__";
    const urlLastEmailFrom = normalizeDateInput(
      searchParams.get("lastEmailFrom") || ""
    );
    const urlLastEmailTo = normalizeDateInput(
      searchParams.get("lastEmailTo") || ""
    );
    const urlMinEmailsSent = searchParams.get("minEmailsSent") || "";
    const urlMaxEmailsSent = searchParams.get("maxEmailsSent") || "";
    const urlPage = parseInt(searchParams.get("page") || "1");
    const urlLimit = parseInt(searchParams.get("limit") || "20");

    // Set state without triggering re-fetches
    setSearchTerm(urlSearch);
    setSearchInput(urlSearch);
    setSelectedCountry(urlCountryCode);
    setSelectedEmailStatus(urlEmailStatus);
    setSelectedPlatform(urlPlatform);
    setSelectedSource(urlSource);
    setLastEmailFrom(urlLastEmailFrom);
    setLastEmailTo(urlLastEmailTo);
    setMinEmailsSent(urlMinEmailsSent);
    setMaxEmailsSent(urlMaxEmailsSent);
    setEverEmailedOnly(
      urlMinEmailsSent.trim() === "1" && (urlMaxEmailsSent.trim() === "")
    );
    setCurrentPage(urlPage);
    setRowsPerPage(urlLimit);

    return {
      search: urlSearch,
      country_code: urlCountryCode,
      emailStatus: urlEmailStatus,
      platform: urlPlatform,
      source: urlSource,
      lastEmailFrom: urlLastEmailFrom,
      lastEmailTo: urlLastEmailTo,
      minEmailsSent: urlMinEmailsSent,
      maxEmailsSent: urlMaxEmailsSent,
      page: urlPage,
      limit: urlLimit,
    };
  }, [searchParams]);

  const normalizeDateInput = (value: string) => {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    const [datePart] = trimmed.includes(" ") ? trimmed.split(" ") : trimmed.split("T");
    return datePart || "";
  };

  const handleImportComplete = () => {
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;
    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;
    fetchLeads(
      currentPage,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo
    );
  };

  const openEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    setEditDialogOpen(true);
  };

  const openEnrichModal = (lead: Lead) => {
    setEnrichingLead(lead);
    setEnrichModalOpen(true);
  };

  const handleLeadUpdated = (updatedLead: Lead) => {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead))
    );
  };

  const getLeadLastEventTimestamp = (
    lead: Lead,
    statusMap: Record<string, EmailStatus> = emailStatus
  ) => {
    const candidate = lead.last_event_timestamp || statusMap[lead.email]?.lastEventTimestamp;
    if (!candidate) return null;
    const parsed = Date.parse(candidate);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const sortLeadListByLastEvent = (
    leadList: Lead[],
    direction: "asc" | "desc",
    statusMap?: Record<string, EmailStatus>
  ) => {
    const activeStatusMap = statusMap ?? emailStatus;
    return [...leadList].sort((a, b) => {
      const aTimestamp = getLeadLastEventTimestamp(a, activeStatusMap);
      const bTimestamp = getLeadLastEventTimestamp(b, activeStatusMap);

      if (aTimestamp === null && bTimestamp === null) {
        return 0;
      }
      if (aTimestamp === null) return 1;
      if (bTimestamp === null) return -1;

      const comparison =
        direction === "asc" ? aTimestamp - bTimestamp : bTimestamp - aTimestamp;

      if (comparison !== 0) return comparison;

      // Secondary sort by created_at descending to keep stable ordering
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
  };

  // Sort by last email event timestamp, newest first by default
  const sortLeads = () => {
    const nextDirection = sortDirection === "asc" ? "desc" : "asc";
    const sortedLeads = sortLeadListByLastEvent(leads, nextDirection);

    setLeads(sortedLeads);
    setSortDirection(nextDirection);
  };

  const handleViewEmailEvents = (email: string) => {
    setSelectedEmailForEvents(email);
    setEmailEventsModalOpen(true);
  };

  // Fetch all unique filter values for dropdowns
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch("/api/crm/filter-options");
      if (!response.ok) {
        throw new Error("Failed to fetch filter options");
      }
      const result = await response.json();

      if (result.success && result.data) {
        setAvailableCountries(result.data.countries || []);
        setAvailablePlatforms(result.data.platforms || []);
        setAvailableSources(result.data.sources || []);
        // Cities are fetched per country, so don't set them here
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  const fetchLeads = async (
    page = 1,
    search = "",
    countryCode = "",
    emailStatus = "",
    limit?: number,
    platform = "",
    source = "",
    lastEmailFromParam = lastEmailFrom,
    lastEmailToParam = lastEmailTo,
    minEmailsSentParam = minEmailsSent,
    maxEmailsSentParam = maxEmailsSent
  ) => {
    try {
      setLoading(true);
      const trimmedLastEmailFrom = lastEmailFromParam?.trim() || "";
      const trimmedLastEmailTo = lastEmailToParam?.trim() || "";
      const trimmedMinEmailsSent = minEmailsSentParam?.trim() || "";
      const trimmedMaxEmailsSent = maxEmailsSentParam?.trim() || "";
      const params = new URLSearchParams({
        page: page.toString(),
        limit: (limit || rowsPerPage).toString(),
        ...(search && { search: search.trim() }),
        ...(countryCode && { country_code: countryCode.trim() }),
        ...(platform && { platform: platform.trim() }),
        ...(source && { source: source.trim() }),
      });

      // Add email status parameter
      if (emailStatus && emailStatus !== "__all__") {
        params.set("emailStatus", emailStatus);
      }

      if (trimmedLastEmailFrom) {
        params.set("lastEmailFrom", trimmedLastEmailFrom);
      }

      if (trimmedLastEmailTo) {
        params.set("lastEmailTo", trimmedLastEmailTo);
      }

      if (trimmedMinEmailsSent) {
        params.set("minEmailsSent", trimmedMinEmailsSent);
      }

      if (trimmedMaxEmailsSent) {
        params.set("maxEmailsSent", trimmedMaxEmailsSent);
      }

      const response = await fetch(`/api/crm/leads-with-count?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch leads");
      }

      const result = await response.json();

      // Handle new API response structure
      if (result.success && result.data) {
        const leadsData = result.data.leads || [];
        const emailStatusData = result.data.emailStatus as Record<string, EmailStatus> | undefined;

        setLeads(
          sortLeadListByLastEvent(
            leadsData,
            sortDirection,
            emailStatusData
          )
        );
        setPagination(result.data.pagination);
        setCurrentPage(page);

        // Set email status from the new response structure
        if (emailStatusData) {
          setEmailStatus(emailStatusData);
        }

        // Don't extract from current page - we'll fetch all unique values separately
      } else {
        console.error("API response error:", result);
        throw new Error(result.error || "Failed to fetch leads");
      }
    } catch (err) {
      setError("Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    setSearchTerm(searchInput);
    setCurrentPage(1);

    // Clear selections when filters change
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    // Update URL with new search term
    updateURL({ search: searchInput, page: 1 });

    // Convert "__all__" to empty string for API
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;

    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;
    fetchLeads(
      1,
      searchInput,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo
    );
  };

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
  };

  const handlePageChange = (page: number) => {
    // Update URL with new page
    updateURL({ page });

    // Convert "__all__" to empty string for API
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;

    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;
    fetchLeads(
      page,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo
    );
    // Note: Page changes don't need to refetch counts since they don't affect totals
  };

  const handleCountryChange = async (countryCode: string) => {
    setSelectedCountry(countryCode);
    setCurrentPage(1);

    // Clear selections when filters change
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    // Update URL with new country and reset page
    updateURL({
      country_code: countryCode,
      page: 1,
    });

    // Convert "__all__" to empty string for API
    const apiCountry = countryCode === "__all__" ? "" : countryCode;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;

    // Fetch leads with new country filter
    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;
    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo
    );
  };

  const handlePlatformChange = (platformCode: string) => {
    setSelectedPlatform(platformCode);
    setCurrentPage(1);

    // Clear selections when filters change
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    // Update URL with new platform and reset page
    updateURL({ platform: platformCode, page: 1 });

    // Convert "__all__" to empty string for API
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = platformCode === "__all__" ? "" : platformCode;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;

    // Fetch leads with new platform filter
    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;
    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo
    );
  };

  const handleSourceChange = (sourceCode: string) => {
    setSelectedSource(sourceCode);
    setCurrentPage(1);

    // Clear selections when filters change
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    // Update URL with new source and reset page
    updateURL({ source: sourceCode, page: 1 });

    // Convert "__all__" to empty string for API
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = sourceCode === "__all__" ? "" : sourceCode;

    // Fetch leads with new source filter
    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;
    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo
    );
  };

  const handleEmailStatusChange = (status: string) => {
    setSelectedEmailStatus(status);
    setCurrentPage(1);

    // Clear selections when filters change
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    // Update URL with new email status and reset page
    updateURL({ emailStatus: status, page: 1 });

    // Convert "__all__" to empty string for API
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;
    const apiEmailStatus = status === "__all__" ? "" : status;

    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo
    );
  };

  const handleLastEmailRangeChange = (type: "from" | "to", value: string) => {
    const nextFrom = type === "from" ? value : lastEmailFrom;
    const nextTo = type === "to" ? value : lastEmailTo;

    setLastEmailFrom(nextFrom);
    setLastEmailTo(nextTo);
    setCurrentPage(1);

    // Clear selections when filters change
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    updateURL({
      lastEmailFrom: nextFrom,
      lastEmailTo: nextTo,
      page: 1,
    });

    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;
    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;

    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      nextFrom,
      nextTo
    );
  };

  const handleEmailsSentRangeChange = (
    type: "min" | "max",
    value: string
  ) => {
    const nextMin = type === "min" ? value : minEmailsSent;
    const nextMax = type === "max" ? value : maxEmailsSent;

    setMinEmailsSent(nextMin);
    setMaxEmailsSent(nextMax);
    setEverEmailedOnly(nextMin.trim() === "1" && nextMax.trim() === "");
    setCurrentPage(1);

    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    updateURL({
      minEmailsSent: nextMin,
      maxEmailsSent: nextMax,
      page: 1,
    });

    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;
    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;

    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo,
      nextMin,
      nextMax
    );
  };

  const handleEverEmailedToggle = (checked: boolean) => {
    const nextMin = checked ? "1" : "";
    const nextMax = "";

    setEverEmailedOnly(checked);
    setMinEmailsSent(nextMin);
    setMaxEmailsSent(nextMax);
    setCurrentPage(1);

    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    updateURL({
      minEmailsSent: nextMin,
      maxEmailsSent: nextMax,
      page: 1,
    });

    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;
    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;

    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo,
      nextMin,
      nextMax
    );
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage);
    setCurrentPage(1); // Reset to first page when changing rows per page

    // Clear selections when changing pagination
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    // Update URL with new limit and reset page to 1
    updateURL({ page: 1, limit: newRowsPerPage });

    // Convert "__all__" to empty string for API
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;

    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;
    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      newRowsPerPage,
      apiPlatform,
      apiSource,
      lastEmailFrom,
      lastEmailTo
    );
  };

  // Function to fetch all filtered leads (without pagination)
  const fetchAllFilteredLeads = async (): Promise<Lead[]> => {
    setIsLoadingAllFiltered(true);

    try {
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm.trim() }),
        ...(selectedCountry !== "__all__" && {
          country_code: selectedCountry.trim(),
        }),
        ...(selectedPlatform !== "__all__" && {
          platform: selectedPlatform.trim(),
        }),
        ...(selectedSource !== "__all__" && { source: selectedSource.trim() }),
        ...(lastEmailFrom.trim() && { lastEmailFrom: lastEmailFrom.trim() }),
        ...(lastEmailTo.trim() && { lastEmailTo: lastEmailTo.trim() }),
        ...(minEmailsSent.trim() && { minEmailsSent: minEmailsSent.trim() }),
        ...(maxEmailsSent.trim() && { maxEmailsSent: maxEmailsSent.trim() }),
      });

      // Add email status filter
      if (selectedEmailStatus && selectedEmailStatus !== "__all__") {
        params.set("emailStatus", selectedEmailStatus);
      }

      const response = await fetch(`/api/crm/leads-with-count/all?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch all filtered leads");
      }

      const result = await response.json();

      // Handle new API response structure
      if (result.success && result.data) {
        const sortedResults = sortLeadListByLastEvent(
          result.data.leads || [],
          sortDirection,
          result.data.emailStatus || emailStatus
        );
        setAllFilteredLeads(sortedResults);
        return sortedResults;
      } else {
        console.error("API response error:", result);
        throw new Error(result.error || "Failed to fetch all filtered leads");
      }
    } catch (err) {
      console.error("Error fetching all filtered leads:", err);
      toast({
        title: "Error",
        description: "Failed to fetch all filtered leads",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoadingAllFiltered(false);
    }
  };

  // Bulk selection functions
  const handleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(leads.map((lead) => lead.id)));
    } else {
      setSelectedLeads(new Set());
    }
    setIsAllFilteredSelected(false);
  };

  const handleSelectAllFiltered = async () => {
    if (isAllFilteredSelected) {
      // Deselect all
      setSelectedLeads(new Set());
      setIsAllFilteredSelected(false);
      setAllFilteredLeads([]);
    } else {
      // Select all filtered
      const allLeads = await fetchAllFilteredLeads();
      if (allLeads.length > 0) {
        setSelectedLeads(new Set(allLeads.map((lead) => lead.id)));
        setIsAllFilteredSelected(true);
      }
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
      // If we deselect any lead, we're no longer in "all filtered" mode
      setIsAllFilteredSelected(false);
    }
    setSelectedLeads(newSelected);
  };

  const handleAudienceCreated = () => {
    setSelectedLeads(new Set()); // Clear selection
    setIsAllFilteredSelected(false);
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) {
      toast({
        title: "No leads selected",
        description: "Please select leads to delete",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedLeads.size} lead(s)? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch("/api/crm/leads-with-count", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: Array.from(selectedLeads),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete leads");
      }

      const result = await response.json();

      // Remove deleted leads from state
      setLeads((prev) => prev.filter((lead) => !selectedLeads.has(lead.id)));
      setSelectedLeads(new Set());

      // Update pagination total
      setPagination((prev) => ({
        ...prev,
        total: prev.total - selectedLeads.size,
      }));

      toast({
        title: "Success",
        description: result.message,
      });
    } catch (error) {
      console.error("Error deleting leads:", error);
      toast({
        title: "Error",
        description: "Failed to delete leads. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkEnrich = async () => {
    const selectedIds = Array.from(selectedLeads);

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
        // Update leads state with enriched data
        const updatedLeadsMap = new Map<string, Lead>();
        (result.results as BulkEnrichmentResult[]).forEach((r: BulkEnrichmentResult) => {
          if (r.success && r.updatedLead) {
            updatedLeadsMap.set(r.leadId, r.updatedLead);
          }
        });

        if (updatedLeadsMap.size > 0) {
          setLeads((prev) =>
            prev.map((lead) => updatedLeadsMap.get(lead.id) || lead)
          );
        }

        // Show results summary
        const { summary } = result;
        toast({
          title: "Enrichment complete",
          description: `${summary.updated} of ${summary.total} leads updated${summary.failed > 0 ? `, ${summary.failed} failed` : ""}`,
        });

        // Clear selections
        setSelectedLeads(new Set());
        setIsAllFilteredSelected(false);
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
  };

  useEffect(() => {
    // Fetch filter options first
    fetchFilterOptions();

    // Initialize filters from URL parameters and fetch data
    const urlFilters = initializeFiltersFromURL();

    // Convert "__all__" to empty string for API
    const apiCountryCode =
      urlFilters.country_code === "__all__" ? "" : urlFilters.country_code;
    const apiPlatform =
      urlFilters.platform === "__all__" ? "" : urlFilters.platform;
    const apiSource = urlFilters.source === "__all__" ? "" : urlFilters.source;

    const apiEmailStatus =
      urlFilters.emailStatus === "__all__" ? "" : urlFilters.emailStatus;
    fetchLeads(
      urlFilters.page,
      urlFilters.search,
      apiCountryCode,
      apiEmailStatus,
      urlFilters.limit,
      apiPlatform,
      apiSource,
      urlFilters.lastEmailFrom,
      urlFilters.lastEmailTo,
      urlFilters.minEmailsSent,
      urlFilters.maxEmailsSent
    );
  }, [initializeFiltersFromURL]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background p-4">
      {/* Compact Header with Actions and Search */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">CRM Dashboard</h1>
            <p className="text-xs text-muted-foreground">{pagination?.total || 0} leads</p>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search..."
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit();
                }
              }}
              className="pl-9 h-9 w-64 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/crm/send-email?ids=${Array.from(selectedLeads).join(',')}`)}
                className="h-9 text-xs"
              >
                <Send className="w-3 h-3 mr-1" />
                Send ({selectedLeads.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAudienceDialogOpen(true)}
                className="h-9 text-xs"
              >
                <Mail className="w-3 h-3 mr-1" />
                Audience ({selectedLeads.size})
              </Button>
              <ExportPdfButton
                leads={leads.filter(lead => selectedLeads.has(lead.id))}
                disabled={isBulkEnriching || isDeleting}
              />
              {selectedLeads.size <= 10 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkEnrich}
                  disabled={isBulkEnriching}
                  className="h-9 text-xs"
                >
                  {isBulkEnriching ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                  )}
                  {isBulkEnriching ? `Enriching...` : `Enrich (${selectedLeads.size})`}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground px-2">Max 10 for enrich</span>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="h-9 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportDialogOpen(true)}
            className="h-9 text-xs"
          >
            Import
          </Button>

          <AddLeadDialog
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onLeadCreated={handleImportComplete}
            availableCountries={availableCountries.map((c) => ({
              name: c,
              count: 0,
            }))}
          >
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary-hover h-9 text-xs">Add Lead</Button>
          </AddLeadDialog>
        </div>

        <CSVImportDialog
          isOpen={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onImportComplete={handleImportComplete}
        />
      </div>

      {/* Compact Filters Bar */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
        <Select value={selectedCountry} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-32 h-8 text-xs bg-background">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__">All Countries</SelectItem>
            {availableCountries.filter((c) => c && c.trim()).map((country) => (
              <SelectItem key={country} value={country}>{country}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPlatform} onValueChange={handlePlatformChange}>
          <SelectTrigger className="w-32 h-8 text-xs bg-background">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__">All Platforms</SelectItem>
            {availablePlatforms.filter((p) => p && p.trim()).map((platform) => (
              <SelectItem key={platform} value={platform}>{platform}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSource} onValueChange={handleSourceChange}>
          <SelectTrigger className="w-32 h-8 text-xs bg-background">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__">All Sources</SelectItem>
            {availableSources.filter((s) => s && s.trim()).map((source) => (
              <SelectItem key={source} value={source}>{source}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedEmailStatus} onValueChange={handleEmailStatusChange}>
          <SelectTrigger className="w-32 h-8 text-xs bg-background" title="Last email event status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__">All Statuses</SelectItem>
            {EMAIL_STATUS_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-3 h-3" />
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={lastEmailFrom}
            onChange={(e) => handleLastEmailRangeChange("from", e.target.value)}
            className="h-8 w-[130px] text-xs bg-background"
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={lastEmailTo}
            onChange={(e) => handleLastEmailRangeChange("to", e.target.value)}
            className="h-8 w-[130px] text-xs bg-background"
            placeholder="To"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            value={minEmailsSent}
            onChange={(e) => handleEmailsSentRangeChange("min", e.target.value)}
            className="h-8 w-16 text-xs bg-background"
            placeholder="Min"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <Input
            type="number"
            min={0}
            value={maxEmailsSent}
            onChange={(e) => handleEmailsSentRangeChange("max", e.target.value)}
            className="h-8 w-16 text-xs bg-background"
            placeholder="Max"
          />
        </div>

        <div className="flex items-center gap-1.5 h-8 px-2 border border-input rounded-md bg-background">
          <Checkbox
            id="ever-emailed"
            checked={everEmailedOnly}
            onCheckedChange={(checked) =>
              handleEverEmailedToggle(Boolean(checked))
            }
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <Label htmlFor="ever-emailed" className="text-xs cursor-pointer whitespace-nowrap">
            Ever emailed (≥1)
          </Label>
        </div>
      </div>

      {/* Leads Table */}
      <Card className="border border-border rounded-lg flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="pb-2 pt-3 px-3 shrink-0 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium">Leads</h2>
              {leads.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1">
                    <Checkbox
                      id="select-visible"
                      checked={selectedLeads.size === leads.length && leads.length > 0 && !isAllFilteredSelected}
                      onCheckedChange={(checked) => handleSelectAllVisible(checked as boolean)}
                      disabled={isAllFilteredSelected}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label htmlFor="select-visible" className="text-xs cursor-pointer">
                      Visible ({leads.length})
                    </Label>

                    <div className="h-3 w-px bg-border mx-1"></div>

                    <Checkbox
                      id="select-all-filtered"
                      checked={isAllFilteredSelected}
                      onCheckedChange={handleSelectAllFiltered}
                      disabled={isLoadingAllFiltered}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label htmlFor="select-all-filtered" className="text-xs cursor-pointer">
                      {isLoadingAllFiltered ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        `All (${pagination?.total || 0})`
                      )}
                    </Label>

                    {selectedLeads.size > 0 && (
                      <>
                        <div className="h-3 w-px bg-border mx-1"></div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedLeads(new Set());
                            setIsAllFilteredSelected(false);
                          }}
                          className="h-5 px-1.5 text-xs"
                        >
                          Clear
                        </Button>
                      </>
                    )}
                  </div>

                  {selectedLeads.size > 0 && (
                    <div className="flex items-center gap-2 bg-primary/10 rounded-md px-2 py-1 border border-primary/20">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      <span className="text-xs font-medium">
                        {selectedLeads.size} selected
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50 border-b border-border z-10">
                  <tr className="text-muted-foreground text-left">
                    <th className="px-2 py-2 text-left font-medium w-8">
                      <Checkbox
                        checked={isAllFilteredSelected || (selectedLeads.size === leads.length && leads.length > 0)}
                        onCheckedChange={(checked) => {
                          if (isAllFilteredSelected) {
                            handleSelectAllFiltered();
                          } else {
                            handleSelectAllVisible(checked as boolean);
                          }
                        }}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </th>
                    <th className="px-2 py-2 text-left font-medium">Studio</th>
                    <th className="px-2 py-2 text-left font-medium">Contact</th>
                    <th className="px-2 py-2 text-left font-medium">Email</th>
                    <th className="px-2 py-2 text-left font-medium">Phone</th>
                    <th className="px-2 py-2 text-left font-medium">Location</th>
                    <th className="px-2 py-2 text-left font-medium">Response</th>
                    <th className="px-2 py-2 text-left font-medium">Source</th>
                    <th className="px-2 py-2 text-left font-medium">Platform</th>
                    <th className="px-2 py-2 text-left font-medium">Created</th>
                    <th className="px-2 py-2 font-medium text-center">Sent</th>
                    <th
                      className="px-2 py-2 text-left font-medium cursor-pointer hover:bg-muted transition-colors"
                      onClick={sortLeads}
                      title="Sort by last email event"
                    >
                      <div className="flex items-center gap-1">
                        <span>Last Email</span>
                        <span className="text-muted-foreground">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      </div>
                    </th>
                    <th className="px-2 py-2 text-left font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {(leads || []).map((lead) => {
                    const isSelected = selectedLeads.has(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        className={`group hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                      >
                        <td className="px-2 py-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </td>
                        {/* Studio */}
                        <td className="px-2 py-2 font-medium">
                          <span className="truncate block max-w-[150px]" title={lead.studio_name}>
                            {lead.studio_name || "-"}
                          </span>
                        </td>

                        {/* Contact */}
                        <td className="px-2 py-2">
                          <span className="truncate block max-w-[120px]" title={`${lead.first_name} ${lead.last_name}`}>
                            {`${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "-"}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="px-2 py-2">
                          <CopyableCell value={lead.email} />
                        </td>

                        {/* Phone */}
                        <td className="px-2 py-2">
                          <span className="truncate block max-w-[100px]" title={lead.phone_number || ""}>
                            {lead.phone_number || "-"}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="px-2 py-2">
                          <span className="truncate block max-w-[100px]" title={[lead.city, lead.country_code].filter(Boolean).join(", ")}>
                            {[lead.city, lead.country_code].filter(Boolean).join(", ") || "-"}
                          </span>
                        </td>

                        {/* Response Status */}
                        <td className="px-2 py-2">
                          <span className={RESPONSE_STATUS_OPTIONS.find((opt) => opt.value === lead.response_status)?.color || ""}>
                            {RESPONSE_STATUS_OPTIONS.find((opt) => opt.value === lead.response_status)?.label || lead.response_status}
                          </span>
                        </td>

                        {/* Source */}
                        <td className="px-2 py-2">
                          <span className="truncate block max-w-[80px]" title={lead.lead_source}>
                            {lead.lead_source || "-"}
                          </span>
                        </td>

                        {/* Platform */}
                        <td className="px-2 py-2">
                          <span className="truncate block max-w-[80px]" title={lead.current_platform}>
                            {lead.current_platform || "-"}
                          </span>
                        </td>

                        {/* Created Date */}
                        <td className="px-2 py-2 text-muted-foreground">
                          <span className="font-mono">
                            {new Date(lead.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "2-digit",
                            })}
                          </span>
                        </td>

                        {/* Emails Sent Count */}
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center justify-center bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                            {emailStatus[lead.email]?.emailsSentCount || 0}
                          </span>
                        </td>

                        {/* Last Email */}
                        <td className="px-2 py-2 text-muted-foreground">
                          {emailStatus[lead.email]?.lastEventType && emailStatus[lead.email]?.lastEventTimestamp ? (
                            <div className="flex flex-col" title={`${new Date(emailStatus[lead.email].lastEventTimestamp!).toLocaleString("en-US", {
                              timeZone: "Europe/Berlin",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })} CET`}>
                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                {emailStatus[lead.email]?.lastEventType?.replace("email.", "")?.substring(0, 4) || ""}
                              </span>
                              <span className="text-[10px] mt-0.5">
                                {new Date(emailStatus[lead.email].lastEventTimestamp!).toLocaleString("en-US", {
                                  timeZone: "Europe/Berlin",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEnrichModal(lead)}
                              className="h-7 w-7 p-0"
                              title="Enrich lead data"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(lead)}
                              className="h-7 w-7 p-0"
                              title="Edit lead"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewEmailEvents(lead.email)}
                              className="h-7 w-7 p-0"
                              title="View details"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border shrink-0 bg-muted/30">
            <div className="flex items-center space-x-2">
              <div className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                {Math.min(currentPage * rowsPerPage, pagination?.total || 0)} of{" "}
                {pagination?.total || 0} leads
              </div>

              {/* Rows per page selector */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">Rows per page:</span>
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(value) =>
                    handleRowsPerPageChange(parseInt(value))
                  }
                >
                  <SelectTrigger className="w-16 h-6 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(pagination?.totalPages || 0) > 1 && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="flex items-center space-x-1"
                >
                  <ChevronLeft className="h-3 w-3" />
                  <span>Previous</span>
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from(
                    { length: Math.min(5, pagination?.totalPages || 0) },
                    (_, i) => {
                      let pageNum: number;
                      if ((pagination?.totalPages || 0) <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (
                        currentPage >=
                        (pagination?.totalPages || 0) - 2
                      ) {
                        pageNum = (pagination?.totalPages || 0) - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            currentPage === pageNum ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                          className="w-6 h-6 p-0 text-xs"
                        >
                          {pageNum}
                        </Button>
                      );
                    }
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={
                    currentPage === (pagination?.totalPages || 0) || loading
                  }
                  className="flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Events Modal Component */}
      <EmailEventsModal
        isOpen={emailEventsModalOpen}
        onOpenChange={setEmailEventsModalOpen}
        emailAddress={selectedEmailForEvents}
      />

      {/* Create Audience Dialog */}
      <CreateAudienceDialog
        isOpen={isAudienceDialogOpen}
        onOpenChange={setIsAudienceDialogOpen}
        selectedLeads={selectedLeads}
        isAllFilteredSelected={isAllFilteredSelected}
        allFilteredLeads={allFilteredLeads}
        visibleLeads={leads}
        onSuccess={handleAudienceCreated}
      />

      {/* Edit Lead Dialog */}
      <EditLeadDialog
        lead={editingLead}
        isOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onLeadUpdated={handleLeadUpdated}
      />

      {/* Enrich Lead Modal */}
      <EnrichLeadModal
        lead={enrichingLead}
        isOpen={enrichModalOpen}
        onOpenChange={setEnrichModalOpen}
        onLeadUpdated={handleLeadUpdated}
      />
    </div>
  );
}
