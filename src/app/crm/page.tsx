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
import { Lead } from "@/types/crm";
import { type EmailStatus } from "@/lib/crm/emailStatusHelpers";
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
  RefreshCw,
  Send,
  Sparkles,
  Loader2,
  X,
  Download,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import EditLeadDialog from "./components/EditLeadDialog";
import EnrichLeadModal from "./components/EnrichLeadModal";
import BulkEnrichmentReviewModal from "./components/BulkEnrichmentReviewModal";
import { ColdEmailPreviewModal } from "./components/ColdEmailPreviewModal";
import { LeadsTable } from "./components/LeadsTable";
import { EnrichmentProvider, useEnrichment } from "./context/EnrichmentContext";
import { getCountryName } from "@/utils/countries";

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

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CRMDashboard() {
  return (
    <EnrichmentProvider>
      <CRMDashboardContent />
    </EnrichmentProvider>
  );
}

function CRMDashboardContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [sortField, setSortField] = useState<"updated_at" | "last_email">(
    "last_email"
  );
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
  const [dateFilterField, setDateFilterField] = useState<"last_email" | "updated_at">("last_email");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minEmailsSent, setMinEmailsSent] = useState("");
  const [maxEmailsSent, setMaxEmailsSent] = useState("");
  const [emailEventsModalOpen, setEmailEventsModalOpen] = useState(false);
  const [selectedEmailForEvents, setSelectedEmailForEvents] =
    useState<string>("");
  const [isAudienceDialogOpen, setIsAudienceDialogOpen] = useState(false);
  const [everEmailedOnly, setEverEmailedOnly] = useState(false);
  const [coldEmailLead, setColdEmailLead] = useState<Lead | null>(null);
  const { toast } = useToast();

  // Enrichment context
  const {
    enrichModalOpen,
    enrichingLead,
    openEnrichModal,
    closeEnrichModal,
    bulkReviewOpen,
    bulkReviewLeads,
    openBulkReviewModal,
    closeBulkReviewModal,
    isBulkEnriching,
    updateEnrichingLead,
  } = useEnrichment();
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
      dateField?: "last_email" | "updated_at";
      dateFrom?: string;
      dateTo?: string;
      minEmailsSent?: string;
      maxEmailsSent?: string;
      sort?: "updated_at" | "last_email";
      dir?: "asc" | "desc";
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

      // Update or remove date filter field
      if (filters.dateField !== undefined) {
        if (filters.dateField && filters.dateField !== "last_email") {
          params.set("dateField", filters.dateField);
        } else {
          params.delete("dateField");
        }
      }

      // Update or remove date range filters
      if (filters.dateFrom !== undefined) {
        if (filters.dateFrom) {
          params.set("dateFrom", filters.dateFrom);
        } else {
          params.delete("dateFrom");
        }
      }

      if (filters.dateTo !== undefined) {
        if (filters.dateTo) {
          params.set("dateTo", filters.dateTo);
        } else {
          params.delete("dateTo");
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

      // Update or remove sort parameter (default: last_email)
      if (filters.sort !== undefined) {
        if (filters.sort && filters.sort !== "last_email") {
          params.set("sort", filters.sort);
        } else {
          params.delete("sort");
        }
      }

      // Update or remove dir parameter (default: desc)
      if (filters.dir !== undefined) {
        if (filters.dir && filters.dir !== "desc") {
          params.set("dir", filters.dir);
        } else {
          params.delete("dir");
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
    const urlDateField = (searchParams.get("dateField") as "last_email" | "updated_at" | null) || "last_email";
    const urlDateFrom = normalizeDateInput(searchParams.get("dateFrom") || "");
    const urlDateTo = normalizeDateInput(searchParams.get("dateTo") || "");
    const urlMinEmailsSent = searchParams.get("minEmailsSent") || "";
    const urlMaxEmailsSent = searchParams.get("maxEmailsSent") || "";
    const urlPage = parseInt(searchParams.get("page") || "1");
    const urlLimit = parseInt(searchParams.get("limit") || "20");
    const urlSort =
      (searchParams.get("sort") as "updated_at" | "last_email" | null) ||
      "last_email";
    const urlDir =
      (searchParams.get("dir") as "asc" | "desc" | null) || "desc";

    // Set state without triggering re-fetches
    setSearchTerm(urlSearch);
    setSearchInput(urlSearch);
    setSelectedCountry(urlCountryCode);
    setSelectedEmailStatus(urlEmailStatus);
    setSelectedPlatform(urlPlatform);
    setSelectedSource(urlSource);
    setDateFilterField(urlDateField === "updated_at" ? "updated_at" : "last_email");
    setDateFrom(urlDateFrom);
    setDateTo(urlDateTo);
    setMinEmailsSent(urlMinEmailsSent);
    setMaxEmailsSent(urlMaxEmailsSent);
    setEverEmailedOnly(
      urlMinEmailsSent.trim() === "1" && (urlMaxEmailsSent.trim() === "")
    );
    setCurrentPage(urlPage);
    setRowsPerPage(urlLimit);
    setSortField(urlSort === "updated_at" ? "updated_at" : "last_email");
    setSortDirection(urlDir === "asc" ? "asc" : "desc");

    return {
      search: urlSearch,
      country_code: urlCountryCode,
      emailStatus: urlEmailStatus,
      platform: urlPlatform,
      source: urlSource,
      dateField: (urlDateField === "updated_at" ? "updated_at" : "last_email") as "updated_at" | "last_email",
      dateFrom: urlDateFrom,
      dateTo: urlDateTo,
      minEmailsSent: urlMinEmailsSent,
      maxEmailsSent: urlMaxEmailsSent,
      page: urlPage,
      limit: urlLimit,
      sort: urlSort === "updated_at" ? "updated_at" : "last_email",
      dir: urlDir === "asc" ? "asc" : "desc",
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
      dateFilterField,
      dateFrom,
      dateTo
    );
  };

  const openEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    setEditDialogOpen(true);
  };

  const handleLeadUpdated = (updatedLead: Lead) => {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead))
    );
    // Also update enrichingLead (via context) and editingLead if they reference the same lead
    updateEnrichingLead(updatedLead);
    setEditingLead((prev) =>
      prev && prev.id === updatedLead.id ? updatedLead : prev
    );
  };

  const refetchFirstPageWithCurrentFilters = (
    nextSortField: "updated_at" | "last_email" = sortField,
    nextDir: "asc" | "desc" = sortDirection
  ) => {
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;
    const apiEmailStatus =
      selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;

    // Clear selections when changing ordering (prevents confusing bulk ops)
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    updateURL({ page: 1, sort: nextSortField, dir: nextDir });

    fetchLeads(
      1,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      dateFilterField,
      dateFrom,
      dateTo,
      minEmailsSent,
      maxEmailsSent,
      nextSortField,
      nextDir
    );
  };

  // Clicking a sort header toggles direction (or switches field and resets to desc)
  const toggleSort = (field: "updated_at" | "last_email") => {
    const nextDirection =
      sortField === field ? (sortDirection === "asc" ? "desc" : "asc") : "desc";
    setSortField(field);
    setSortDirection(nextDirection);
    refetchFirstPageWithCurrentFilters(field, nextDirection);
  };

  const handleSortFieldChange = (value: "updated_at" | "last_email") => {
    setSortField(value);
    setSortDirection("desc");
    refetchFirstPageWithCurrentFilters(value, "desc");
  };

  const handleViewEmailEvents = (email: string) => {
    setSelectedEmailForEvents(email);
    setEmailEventsModalOpen(true);
  };

  const handleGenerateEmail = (lead: Lead) => {
    setColdEmailLead(lead);
  };

  const handleExportCSV = (leadsToExport: Lead[]) => {
    if (leadsToExport.length === 0) return;

    const headers = [
      "Studio Name",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Website",
      "Instagram",
      "Facebook",
      "City",
      "State",
      "Country",
      "Business Type",
      "Platform",
      "Lead Source",
      "Classes/Week",
      "Instructors",
      "Response Status",
      "Notes",
      "Additional Info",
      "Created At",
      "Updated At",
    ];

    const rows = leadsToExport.map((lead) => [
      lead.studio_name || "",
      lead.first_name || "",
      lead.last_name || "",
      lead.email || "",
      lead.phone_number || "",
      lead.website || "",
      lead.instagram || "",
      lead.facebook || "",
      lead.city || "",
      lead.state || "",
      lead.country_code || "",
      lead.business_type || "",
      lead.current_platform || "",
      lead.lead_source || "",
      lead.classes_per_week_estimate?.toString() || "",
      lead.instructors_count_estimate?.toString() || "",
      lead.response_status || "",
      lead.notes || "",
      lead.additional_info || "",
      lead.created_at || "",
      lead.updated_at || "",
    ]);

    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: `${leadsToExport.length} leads exported to CSV`,
    });
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
    dateFieldParam: "last_email" | "updated_at" = dateFilterField,
    dateFromParam = dateFrom,
    dateToParam = dateTo,
    minEmailsSentParam = minEmailsSent,
    maxEmailsSentParam = maxEmailsSent,
    sortFieldParam: "updated_at" | "last_email" = sortField,
    sortDirParam: "asc" | "desc" = sortDirection
  ) => {
    try {
      setLoading(true);
      const trimmedDateFrom = dateFromParam?.trim() || "";
      const trimmedDateTo = dateToParam?.trim() || "";
      const trimmedMinEmailsSent = minEmailsSentParam?.trim() || "";
      const trimmedMaxEmailsSent = maxEmailsSentParam?.trim() || "";
      const params = new URLSearchParams({
        page: page.toString(),
        limit: (limit || rowsPerPage).toString(),
        sort: sortFieldParam,
        dir: sortDirParam,
        ...(search && { search: search.trim() }),
        ...(countryCode && { country_code: countryCode.trim() }),
        ...(platform && { platform: platform.trim() }),
        ...(source && { source: source.trim() }),
      });

      // Add email status parameter
      if (emailStatus && emailStatus !== "__all__") {
        params.set("emailStatus", emailStatus);
      }

      // Add date range filters based on selected date field
      if (trimmedDateFrom) {
        if (dateFieldParam === "updated_at") {
          params.set("updatedFrom", trimmedDateFrom);
        } else {
          params.set("lastEmailFrom", trimmedDateFrom);
        }
      }

      if (trimmedDateTo) {
        if (dateFieldParam === "updated_at") {
          params.set("updatedTo", trimmedDateTo);
        } else {
          params.set("lastEmailTo", trimmedDateTo);
        }
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

        // Keep server ordering so pagination and sort always match
        setLeads(leadsData);
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
      dateFilterField,
      dateFrom,
      dateTo
    );
  };

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
  };

  const handlePageChange = (page: number) => {
    // Update local state first
    setCurrentPage(page);

    // Update URL (shallow, won't trigger re-render)
    updateURL({ page });

    // Convert "__all__" to empty string for API
    const apiCountry = selectedCountry === "__all__" ? "" : selectedCountry;
    const apiPlatform = selectedPlatform === "__all__" ? "" : selectedPlatform;
    const apiSource = selectedSource === "__all__" ? "" : selectedSource;
    const apiEmailStatus = selectedEmailStatus === "__all__" ? "" : selectedEmailStatus;

    fetchLeads(
      page,
      searchTerm,
      apiCountry,
      apiEmailStatus,
      undefined,
      apiPlatform,
      apiSource,
      dateFilterField,
      dateFrom,
      dateTo,
      minEmailsSent,
      maxEmailsSent
    );
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
      dateFilterField,
      dateFrom,
      dateTo
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
      dateFilterField,
      dateFrom,
      dateTo
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
      dateFilterField,
      dateFrom,
      dateTo
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
      dateFilterField,
      dateFrom,
      dateTo
    );
  };

  const applyDateRange = (
    fromValue: string = dateFrom,
    toValue: string = dateTo,
    field: "last_email" | "updated_at" = dateFilterField
  ) => {
    setDateFrom(fromValue);
    setDateTo(toValue);
    setDateFilterField(field);
    setCurrentPage(1);

    // Clear selections when filters change
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    updateURL({
      dateField: field,
      dateFrom: fromValue,
      dateTo: toValue,
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
      field,
      fromValue,
      toValue
    );
  };

  const handleDateFieldChange = (field: "last_email" | "updated_at") => {
    if (field === dateFilterField) return; // No change

    setDateFilterField(field);

    // Only update URL and refetch if there are actual date values set
    // Otherwise just update local state - no need to touch URL or refetch
    if (dateFrom || dateTo) {
      applyDateRange(dateFrom, dateTo, field);
    }
  };

  const handleEmailsSentRangeInput = (
    type: "min" | "max",
    value: string
  ) => {
    if (type === "min") {
      setMinEmailsSent(value);
      setEverEmailedOnly(value.trim() === "1" && maxEmailsSent.trim() === "");
    } else {
      setMaxEmailsSent(value);
      setEverEmailedOnly(minEmailsSent.trim() === "1" && value.trim() === "");
    }
  };

  const applyEmailsSentRange = () => {
    setCurrentPage(1);

    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    updateURL({
      minEmailsSent: minEmailsSent,
      maxEmailsSent: maxEmailsSent,
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
      dateFilterField,
      dateFrom,
      dateTo,
      minEmailsSent,
      maxEmailsSent
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
      dateFilterField,
      dateFrom,
      dateTo,
      nextMin,
      nextMax
    );
  };

  // Check if any filters are active
  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedCountry !== "__all__" ||
    selectedPlatform !== "__all__" ||
    selectedSource !== "__all__" ||
    selectedEmailStatus !== "__all__" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    minEmailsSent !== "" ||
    maxEmailsSent !== "" ||
    everEmailedOnly;

  // Clear all filters
  const handleClearFilters = () => {
    // Reset all filter states
    setSearchTerm("");
    setSearchInput("");
    setSelectedCountry("__all__");
    setSelectedPlatform("__all__");
    setSelectedSource("__all__");
    setSelectedEmailStatus("__all__");
    setDateFilterField("last_email");
    setDateFrom("");
    setDateTo("");
    setMinEmailsSent("");
    setMaxEmailsSent("");
    setEverEmailedOnly(false);
    setCurrentPage(1);
    setSortField("last_email");
    setSortDirection("desc");

    // Clear selections
    setSelectedLeads(new Set());
    setIsAllFilteredSelected(false);
    setAllFilteredLeads([]);

    // Clear URL parameters
    router.push("/crm", { scroll: false });

    // Fetch leads with default parameters
    fetchLeads(1, "", "", "", undefined, "", "", "last_email", "", "", "", "", "last_email", "desc");
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
      dateFilterField,
      dateFrom,
      dateTo
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
        sort: sortField,
        dir: sortDirection,
        ...(minEmailsSent.trim() && { minEmailsSent: minEmailsSent.trim() }),
        ...(maxEmailsSent.trim() && { maxEmailsSent: maxEmailsSent.trim() }),
      });

      // Add date range filters based on selected date field
      if (dateFrom.trim()) {
        if (dateFilterField === "updated_at") {
          params.set("updatedFrom", dateFrom.trim());
        } else {
          params.set("lastEmailFrom", dateFrom.trim());
        }
      }
      if (dateTo.trim()) {
        if (dateFilterField === "updated_at") {
          params.set("updatedTo", dateTo.trim());
        } else {
          params.set("lastEmailTo", dateTo.trim());
        }
      }

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
        const leadsData = result.data.leads || [];
        setAllFilteredLeads(leadsData);
        return leadsData;
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

  const onBulkEnrich = () => {
    // Get the selected leads from both visible and allFilteredLeads
    const selectedIds = Array.from(selectedLeads);
    const leadsToEnrich = isAllFilteredSelected
      ? allFilteredLeads.filter((l) => selectedIds.includes(l.id))
      : leads.filter((l) => selectedIds.includes(l.id));

    if (leadsToEnrich.length === 0) {
      toast({
        title: "No leads selected",
        description: "Please select leads to enrich",
        variant: "destructive",
      });
      return;
    }

    if (leadsToEnrich.length > 10) {
      toast({
        title: "Too many leads selected",
        description: "Please select 10 or fewer leads for bulk enrichment",
        variant: "destructive",
      });
      return;
    }

    // Open the bulk review modal
    openBulkReviewModal(leadsToEnrich);
  };

  const handleBulkEnrichLeadsUpdated = (updatedLeadsMap: Map<string, Lead>) => {
    setLeads((prev) =>
      prev.map((lead) => updatedLeadsMap.get(lead.id) || lead)
    );
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
      urlFilters.dateField,
      urlFilters.dateFrom,
      urlFilters.dateTo,
      urlFilters.minEmailsSent,
      urlFilters.maxEmailsSent
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - URL changes handled by individual handlers

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCSV(leads.filter(lead => selectedLeads.has(lead.id)))}
                className="h-9 text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                CSV ({selectedLeads.size})
              </Button>
              {selectedLeads.size <= 10 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkEnrich}
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

      {/* Filters Bar - Organized into logical groups */}
      <div className="flex flex-col gap-2 mb-3 flex-shrink-0">
        {/* Row 1: Lead filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedCountry} onValueChange={handleCountryChange}>
            <SelectTrigger className="w-40 h-8 text-xs bg-background">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="__all__">All Countries</SelectItem>
              {availableCountries.filter((c) => c && c.trim()).map((country) => (
                <SelectItem key={country} value={country}>{getCountryName(country)}</SelectItem>
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

          <div className="h-6 w-px bg-border mx-1" />

          <Select value={selectedEmailStatus} onValueChange={handleEmailStatusChange}>
            <SelectTrigger className="w-32 h-8 text-xs bg-background" title="Email status">
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

          <div className="flex items-center gap-1.5 h-8 px-2 border border-input rounded-md bg-background">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Emails:</span>
            <Input
              type="number"
              min={0}
              value={minEmailsSent}
              onChange={(e) => handleEmailsSentRangeInput("min", e.target.value)}
              onBlur={applyEmailsSentRange}
              onKeyDown={(e) => e.key === "Enter" && applyEmailsSentRange()}
              className="h-6 w-12 text-xs bg-transparent border-0 p-0 text-center"
              placeholder="0"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              min={0}
              value={maxEmailsSent}
              onChange={(e) => handleEmailsSentRangeInput("max", e.target.value)}
              onBlur={applyEmailsSentRange}
              onKeyDown={(e) => e.key === "Enter" && applyEmailsSentRange()}
              className="h-6 w-12 text-xs bg-transparent border-0 p-0 text-center"
              placeholder="Any"
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
              Ever emailed
            </Label>
          </div>
        </div>

        {/* Row 2: Date filter with field selector + Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Filter Group - visually distinct */}
          <div className="flex items-center gap-1.5 h-8 px-2 border border-input rounded-md bg-muted/30">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Filter by</span>
            <div className="flex rounded-md overflow-hidden border border-input">
              <button
                onClick={() => handleDateFieldChange("last_email")}
                className={`px-2 py-1 text-xs transition-colors ${
                  dateFilterField === "last_email"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Last Email
              </button>
              <button
                onClick={() => handleDateFieldChange("updated_at")}
                className={`px-2 py-1 text-xs transition-colors ${
                  dateFilterField === "updated_at"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Updated
              </button>
            </div>
            <DatePicker
              value={dateFrom}
              onChange={(value) => applyDateRange(value, dateTo)}
              placeholder="From"
              className="h-6 w-[120px] text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <DatePicker
              value={dateTo}
              onChange={(value) => applyDateRange(dateFrom, value)}
              placeholder="To"
              className="h-6 w-[120px] text-xs"
            />
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Sort */}
          <div className="flex items-center gap-2 h-8 px-2 border border-input rounded-md bg-background">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Sort
            </span>
            <Select
              value={sortField}
              onValueChange={(value) =>
                handleSortFieldChange(value as "updated_at" | "last_email")
              }
            >
              <SelectTrigger className="w-[100px] h-6 text-xs bg-transparent border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_email">Last Email</SelectItem>
                <SelectItem value="updated_at">Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Clear filters
            </Button>
          )}
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
            <LeadsTable
              leads={leads}
              emailStatus={emailStatus}
              selectedLeads={selectedLeads}
              isAllFilteredSelected={isAllFilteredSelected}
              sortField={sortField}
              sortDirection={sortDirection}
              onSelectLead={handleSelectLead}
              onSelectAllVisible={handleSelectAllVisible}
              onSelectAllFiltered={handleSelectAllFiltered}
              onToggleSort={toggleSort}
              onEditLead={openEditDialog}
              onEnrichLead={openEnrichModal}
              onViewEmailEvents={handleViewEmailEvents}
              onGenerateEmail={handleGenerateEmail}
            />
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
        onOpenChange={(open) => !open && closeEnrichModal()}
        onLeadUpdated={handleLeadUpdated}
      />

      {/* Bulk Enrichment Review Modal */}
      <BulkEnrichmentReviewModal
        selectedLeads={bulkReviewLeads}
        isOpen={bulkReviewOpen}
        onOpenChange={(open) => !open && closeBulkReviewModal()}
        onLeadsUpdated={handleBulkEnrichLeadsUpdated}
      />

      {/* Cold Email Preview Modal */}
      <ColdEmailPreviewModal
        lead={coldEmailLead}
        onClose={() => setColdEmailLead(null)}
      />
    </div>
  );
}
