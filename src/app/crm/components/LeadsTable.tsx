"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyableCell } from "@/components/ui/copyable-cell";
import { Lead, ResponseStatus } from "@/types/crm";
import { type EmailStatus } from "@/lib/crm/emailStatusHelpers";
import { Pencil, Sparkles, Info } from "lucide-react";
import { format, parseISO } from "date-fns";

const RESPONSE_STATUS_MAP: Record<ResponseStatus, { label: string; color: string }> = {
  interested: { label: "Interested", color: "text-green-600" },
  not_interested: { label: "Not Interested", color: "text-red-600" },
  interested_later: { label: "Later", color: "text-yellow-600" },
  follow_up_needed: { label: "Follow Up", color: "text-blue-600" },
  qualified: { label: "Qualified", color: "text-purple-600" },
  converted: { label: "Converted", color: "text-green-700" },
};

interface LeadsTableProps {
  leads: Lead[];
  emailStatus: Record<string, EmailStatus>;
  selectedLeads: Set<string>;
  isAllFilteredSelected: boolean;
  sortField: "updated_at" | "last_email";
  sortDirection: "asc" | "desc";
  onSelectLead: (leadId: string, checked: boolean) => void;
  onSelectAllVisible: (checked: boolean) => void;
  onSelectAllFiltered: () => void;
  onToggleSort: (field: "updated_at" | "last_email") => void;
  onEditLead: (lead: Lead) => void;
  onEnrichLead: (lead: Lead) => void;
  onViewEmailEvents: (email: string) => void;
}

export function LeadsTable({
  leads,
  emailStatus,
  selectedLeads,
  isAllFilteredSelected,
  sortField,
  sortDirection,
  onSelectLead,
  onSelectAllVisible,
  onSelectAllFiltered,
  onToggleSort,
  onEditLead,
  onEnrichLead,
  onViewEmailEvents,
}: LeadsTableProps) {
  const allVisibleSelected = selectedLeads.size === leads.length && leads.length > 0;

  return (
    <table className="w-full text-[10px]">
      <thead className="sticky top-0 bg-muted/50 border-b border-border z-10">
        <tr className="text-muted-foreground text-left">
          {/* Selection */}
          <th className="px-1.5 py-1.5 w-7">
            <Checkbox
              checked={isAllFilteredSelected || allVisibleSelected}
              onCheckedChange={(checked) => {
                if (isAllFilteredSelected) {
                  onSelectAllFiltered();
                } else {
                  onSelectAllVisible(checked as boolean);
                }
              }}
            />
          </th>

          {/* Identity Group */}
          <th className="px-1.5 py-1.5 w-[110px] font-medium border-l border-border/30">Studio</th>
          <th className="px-1.5 py-1.5 w-[90px] font-medium">Contact</th>
          <th className="px-1.5 py-1.5 w-[70px] font-medium">Type</th>

          {/* Contact Group */}
          <th className="px-1.5 py-1.5 w-[140px] font-medium border-l border-border/30">Email</th>
          <th className="px-1.5 py-1.5 w-[85px] font-medium">Phone</th>
          <th className="px-1.5 py-1.5 w-[90px] font-medium">Web</th>
          <th className="px-1.5 py-1.5 w-[70px] font-medium">Social</th>

          {/* Location Group */}
          <th className="px-1.5 py-1.5 w-[70px] font-medium border-l border-border/30">City</th>
          <th className="px-1.5 py-1.5 w-[50px] font-medium">St</th>
          <th className="px-1.5 py-1.5 w-[30px] font-medium">CC</th>

          {/* Business Group */}
          <th className="px-1.5 py-1.5 w-[70px] font-medium border-l border-border/30">Platform</th>
          <th className="px-1.5 py-1.5 w-[70px] font-medium">Source</th>
          <th className="px-1.5 py-1.5 w-[35px] font-medium text-center" title="Classes/week">Cls</th>
          <th className="px-1.5 py-1.5 w-[35px] font-medium text-center" title="Instructors">Ins</th>

          {/* Status */}
          <th className="px-1.5 py-1.5 w-[75px] font-medium border-l border-border/30">Status</th>

          {/* Email Activity Group */}
          <th className="px-1.5 py-1.5 w-[30px] font-medium text-center border-l border-border/30" title="Emails sent">#</th>
          <th
            className="px-1.5 py-1.5 w-[85px] font-medium cursor-pointer hover:bg-muted/80"
            onClick={() => onToggleSort("last_email")}
          >
            Last Email {sortField === "last_email" && (sortDirection === "asc" ? "^" : "v")}
          </th>

          {/* Timeline Group */}
          <th className="px-1.5 py-1.5 w-[60px] font-medium border-l border-border/30">Created</th>
          <th
            className="px-1.5 py-1.5 w-[60px] font-medium cursor-pointer hover:bg-muted/80"
            onClick={() => onToggleSort("updated_at")}
          >
            Updated {sortField === "updated_at" && (sortDirection === "asc" ? "^" : "v")}
          </th>

          {/* Notes Group */}
          <th className="px-1.5 py-1.5 w-[80px] font-medium border-l border-border/30" title="Your notes">Notes</th>
          <th className="px-1.5 py-1.5 w-[80px] font-medium" title="Additional info from imports/enrichment">Add. Info</th>

          {/* Actions */}
          <th className="px-1.5 py-1.5 w-[70px] font-medium border-l border-border/30"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/30">
        {leads.map((lead) => (
          <LeadRow
            key={lead.id}
            lead={lead}
            emailStatus={emailStatus[lead.email]}
            isSelected={selectedLeads.has(lead.id)}
            onSelect={(checked) => onSelectLead(lead.id, checked)}
            onEdit={() => onEditLead(lead)}
            onEnrich={() => onEnrichLead(lead)}
            onViewEmailEvents={() => onViewEmailEvents(lead.email)}
          />
        ))}
      </tbody>
    </table>
  );
}

interface LeadRowProps {
  lead: Lead;
  emailStatus?: EmailStatus;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onEnrich: () => void;
  onViewEmailEvents: () => void;
}

function LeadRow({
  lead,
  emailStatus,
  isSelected,
  onSelect,
  onEdit,
  onEnrich,
  onViewEmailEvents,
}: LeadRowProps) {
  const status = RESPONSE_STATUS_MAP[lead.response_status];
  const contactName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "-";
  const hasSocial = lead.instagram || lead.facebook;

  return (
    <tr className={`hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}>
      {/* Selection */}
      <td className="px-1.5 py-1">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </td>

      {/* Identity Group */}
      <td className="px-1.5 py-1 border-l border-border/30">
        <span className="truncate block max-w-[100px] font-medium" title={lead.studio_name}>
          {lead.studio_name || "-"}
        </span>
      </td>
      <td className="px-1.5 py-1">
        <span className="truncate block max-w-[85px]" title={contactName}>
          {contactName}
        </span>
      </td>
      <td className="px-1.5 py-1 text-muted-foreground">
        <span className="truncate block max-w-[65px]" title={lead.business_type || ""}>
          {lead.business_type || "-"}
        </span>
      </td>

      {/* Contact Group */}
      <td className="px-1.5 py-1 border-l border-border/30">
        <CopyableCell value={lead.email} className="max-w-[130px]" />
      </td>
      <td className="px-1.5 py-1">
        <span className="truncate block max-w-[80px]" title={lead.phone_number || ""}>
          {lead.phone_number || "-"}
        </span>
      </td>
      <td className="px-1.5 py-1">
        {lead.website ? (
          <a
            href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate block max-w-[85px] text-blue-600 hover:underline"
            title={lead.website}
          >
            {lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-1.5 py-1">
        {hasSocial ? (
          <div className="flex gap-1">
            {lead.instagram && (
              <a
                href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-600 hover:underline text-[9px]"
                title={lead.instagram}
              >
                IG
              </a>
            )}
            {lead.facebook && (
              <a
                href={lead.facebook.startsWith("http") ? lead.facebook : `https://facebook.com/${lead.facebook}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline text-[9px]"
                title={lead.facebook}
              >
                FB
              </a>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Location Group */}
      <td className="px-1.5 py-1 border-l border-border/30">
        <span className="truncate block max-w-[65px]" title={lead.city}>
          {lead.city || "-"}
        </span>
      </td>
      <td className="px-1.5 py-1">
        <span className="truncate block max-w-[45px]" title={lead.state || ""}>
          {lead.state || "-"}
        </span>
      </td>
      <td className="px-1.5 py-1 text-muted-foreground font-mono">
        {lead.country_code || "-"}
      </td>

      {/* Business Group */}
      <td className="px-1.5 py-1 border-l border-border/30">
        <span className="truncate block max-w-[65px]" title={lead.current_platform}>
          {lead.current_platform || "-"}
        </span>
      </td>
      <td className="px-1.5 py-1">
        <span className="truncate block max-w-[65px]" title={lead.lead_source}>
          {lead.lead_source || "-"}
        </span>
      </td>
      <td className="px-1.5 py-1 text-center text-muted-foreground font-mono">
        {lead.classes_per_week_estimate ?? "-"}
      </td>
      <td className="px-1.5 py-1 text-center text-muted-foreground font-mono">
        {lead.instructors_count_estimate ?? "-"}
      </td>

      {/* Status */}
      <td className="px-1.5 py-1 border-l border-border/30">
        <span className={status?.color || ""} title={status?.label}>
          {status?.label || lead.response_status || "-"}
        </span>
      </td>

      {/* Email Activity Group */}
      <td className="px-1.5 py-1 text-center border-l border-border/30">
        <span className="inline-flex items-center justify-center bg-primary/10 text-primary text-[9px] font-medium px-1 rounded-full">
          {emailStatus?.emailsSentCount || 0}
        </span>
      </td>
      <td className="px-1.5 py-1">
        {emailStatus?.lastEventType && emailStatus?.lastEventTimestamp ? (
          <div
            className="flex flex-col leading-tight"
            title={format(parseISO(emailStatus.lastEventTimestamp), "EEEE, MMMM d, yyyy 'at' h:mm a")}
          >
            <span className="text-[9px] font-mono bg-muted px-0.5 rounded w-fit">
              {emailStatus.lastEventType.replace("email.", "").substring(0, 4)}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {format(parseISO(emailStatus.lastEventTimestamp), "MMM d")}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Timeline Group */}
      <td
        className="px-1.5 py-1 text-muted-foreground font-mono border-l border-border/30"
        title={format(parseISO(lead.created_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
      >
        {format(parseISO(lead.created_at), "MMM d")}
      </td>
      <td
        className="px-1.5 py-1 text-muted-foreground font-mono"
        title={format(parseISO(lead.updated_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
      >
        {format(parseISO(lead.updated_at), "MMM d")}
      </td>

      {/* Notes Group */}
      <td className="px-1.5 py-1 border-l border-border/30">
        <span className="truncate block max-w-[75px]" title={lead.notes || ""}>
          {lead.notes || "-"}
        </span>
      </td>
      <td className="px-1.5 py-1 text-muted-foreground">
        <span className="truncate block max-w-[75px]" title={lead.additional_info || ""}>
          {lead.additional_info || "-"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-1.5 py-1 border-l border-border/30">
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={onEnrich} className="h-5 w-5 p-0" title="Enrich">
            <Sparkles className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-5 w-5 p-0" title="Edit">
            <Pencil className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onViewEmailEvents} className="h-5 w-5 p-0" title="Details">
            <Info className="w-3 h-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
