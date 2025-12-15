"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Lead, ResponseStatus } from "@/types/crm";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const leadSchema = z.object({
  studio_name: z.string().min(1, "Studio name is required"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone_number: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  business_type: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country_code: z.string().max(2, "Use 2-letter code").optional(),
  response_status: z.enum(["interested", "not_interested", "interested_later", "follow_up_needed", "qualified", "converted"]),
  lead_source: z.string().optional(),
  current_platform: z.string().optional(),
  notes: z.string().optional(),
  additional_info: z.string().optional(),
});

const RESPONSE_STATUS_OPTIONS: Array<{
  value: ResponseStatus;
  label: string;
  color: string;
}> = [
  { value: "interested", label: "Interested", color: "text-green-600" },
  { value: "not_interested", label: "Not Interested", color: "text-red-600" },
  { value: "interested_later", label: "Later", color: "text-yellow-600" },
  { value: "follow_up_needed", label: "Follow Up", color: "text-blue-600" },
  { value: "qualified", label: "Qualified", color: "text-purple-600" },
  { value: "converted", label: "Converted", color: "text-green-700" },
];

interface EditLeadDialogProps {
  lead: Lead | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated: (updatedLead: Lead) => void;
}

export default function EditLeadDialog({
  lead,
  isOpen,
  onOpenChange,
  onLeadUpdated,
}: EditLeadDialogProps) {
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (lead) {
      setFormData({
        first_name: lead.first_name ?? "",
        last_name: lead.last_name ?? "",
        studio_name: lead.studio_name ?? "",
        lead_source: lead.lead_source ?? "",
        current_platform: lead.current_platform ?? "",
        city: lead.city ?? "",
        state: lead.state ?? "",
        country_code: lead.country_code ?? "",
        response_status: lead.response_status,
        notes: lead.notes ?? "",
        phone_number: lead.phone_number ?? "",
        additional_info: lead.additional_info ?? "",
        website: lead.website ?? "",
        instagram: lead.instagram ?? "",
        facebook: lead.facebook ?? "",
        business_type: lead.business_type ?? "",
      });
      setErrors({});
    }
  }, [lead]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!lead) return;

    const result = leadSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch("/api/crm/leads-with-count", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, ...formData }),
      });

      if (!response.ok) throw new Error("Failed to update lead");

      const updatedLead = await response.json();
      onLeadUpdated(updatedLead.data);
      onOpenChange(false);
      toast({ title: "Success", description: "Lead updated" });
    } catch (error) {
      console.error("Error updating lead:", error);
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!lead) return null;

  const Field = ({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) => (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm font-medium">Edit Lead</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          {/* Column 1 */}
          <Field label="Studio" error={errors.studio_name}>
            <Input
              value={formData.studio_name || ""}
              onChange={(e) => handleInputChange("studio_name", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="First Name">
            <Input
              value={formData.first_name || ""}
              onChange={(e) => handleInputChange("first_name", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="Last Name">
            <Input
              value={formData.last_name || ""}
              onChange={(e) => handleInputChange("last_name", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          {/* Row 2 */}
          <Field label="Email">
            <Input value={lead.email} disabled className="h-7 text-xs bg-muted" />
          </Field>

          <Field label="Phone">
            <Input
              value={formData.phone_number || ""}
              onChange={(e) => handleInputChange("phone_number", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="Business Type">
            <Input
              value={formData.business_type || ""}
              onChange={(e) => handleInputChange("business_type", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          {/* Row 3 */}
          <Field label="Website" error={errors.website}>
            <Input
              value={formData.website || ""}
              onChange={(e) => handleInputChange("website", e.target.value)}
              className="h-7 text-xs"
              placeholder="https://..."
            />
          </Field>

          <Field label="Instagram">
            <Input
              value={formData.instagram || ""}
              onChange={(e) => handleInputChange("instagram", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="Facebook">
            <Input
              value={formData.facebook || ""}
              onChange={(e) => handleInputChange("facebook", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          {/* Row 4 */}
          <Field label="City">
            <Input
              value={formData.city || ""}
              onChange={(e) => handleInputChange("city", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="State">
            <Input
              value={formData.state || ""}
              onChange={(e) => handleInputChange("state", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="Country" error={errors.country_code}>
            <Input
              value={formData.country_code || ""}
              onChange={(e) => handleInputChange("country_code", e.target.value.toUpperCase())}
              className="h-7 text-xs"
              maxLength={2}
              placeholder="US"
            />
          </Field>

          {/* Row 5 */}
          <Field label="Status">
            <Select
              value={formData.response_status || "interested"}
              onValueChange={(value) => handleInputChange("response_status", value)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    <span className={opt.color}>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Source">
            <Input
              value={formData.lead_source || ""}
              onChange={(e) => handleInputChange("lead_source", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="Platform">
            <Input
              value={formData.current_platform || ""}
              onChange={(e) => handleInputChange("current_platform", e.target.value)}
              className="h-7 text-xs"
            />
          </Field>

          {/* Row 6: Notes spanning 2 cols, Additional 1 col */}
          <div className="col-span-2">
            <Field label="Notes">
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                className="text-xs h-16 resize-none"
              />
            </Field>
          </div>

          <Field label="Additional Info">
            <Textarea
              value={formData.additional_info || ""}
              onChange={(e) => handleInputChange("additional_info", e.target.value)}
              className="text-xs h-16 resize-none"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-1.5 pt-3 border-t mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            className="h-7 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isUpdating}
            className="h-7 text-xs"
          >
            {isUpdating ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
