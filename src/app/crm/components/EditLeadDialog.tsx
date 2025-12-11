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

const RESPONSE_STATUS_OPTIONS: Array<{
  value: ResponseStatus;
  label: string;
  color: string;
}> = [
  { value: "interested", label: "Interested", color: "text-green-600" },
  { value: "not_interested", label: "Not Interested", color: "text-red-600" },
  { value: "interested_later", label: "Interested Later", color: "text-yellow-600" },
  { value: "follow_up_needed", label: "Follow Up Needed", color: "text-blue-600" },
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
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (lead) {
      setFormData({
        first_name: lead.first_name,
        last_name: lead.last_name,
        studio_name: lead.studio_name,
        lead_source: lead.lead_source,
        current_platform: lead.current_platform,
        city: lead.city,
        state: lead.state,
        country_code: lead.country_code,
        response_status: lead.response_status,
        notes: lead.notes,
        phone_number: lead.phone_number,
        additional_info: lead.additional_info,
      });
    }
  }, [lead]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!lead) return;

    setIsUpdating(true);

    try {
      const response = await fetch("/api/crm/leads-with-count", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: lead.id,
          ...formData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update lead");
      }

      const updatedLead = await response.json();
      onLeadUpdated(updatedLead);
      onOpenChange(false);

      toast({
        title: "Success",
        description: "Lead updated successfully",
      });
    } catch (error) {
      console.error("Error updating lead:", error);
      toast({
        title: "Error",
        description: "Failed to update lead. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Studio Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="studio_name" className="text-right text-sm">
              Studio
            </Label>
            <Input
              id="studio_name"
              value={formData.studio_name || ""}
              onChange={(e) => handleInputChange("studio_name", e.target.value)}
              className="col-span-3"
              placeholder="Studio name"
            />
          </div>

          {/* Contact Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="first_name" className="text-right text-sm">
              Name
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="first_name"
                value={formData.first_name || ""}
                onChange={(e) => handleInputChange("first_name", e.target.value)}
                placeholder="First name"
              />
              <Input
                id="last_name"
                value={formData.last_name || ""}
                onChange={(e) => handleInputChange("last_name", e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-sm">Email</Label>
            <Input
              value={lead.email}
              disabled
              className="col-span-3 bg-muted"
            />
          </div>

          {/* Phone */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone_number" className="text-right text-sm">
              Phone
            </Label>
            <Input
              id="phone_number"
              value={formData.phone_number || ""}
              onChange={(e) => handleInputChange("phone_number", e.target.value)}
              className="col-span-3"
              placeholder="Phone number"
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="city" className="text-right text-sm">
              Location
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="city"
                value={formData.city || ""}
                onChange={(e) => handleInputChange("city", e.target.value)}
                placeholder="City"
                className="flex-1"
              />
              <Input
                id="state"
                value={formData.state || ""}
                onChange={(e) => handleInputChange("state", e.target.value)}
                placeholder="State"
                className="w-24"
              />
              <Input
                id="country_code"
                value={formData.country_code || ""}
                onChange={(e) => handleInputChange("country_code", e.target.value)}
                placeholder="CC"
                className="w-16"
              />
            </div>
          </div>

          {/* Response Status */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="response_status" className="text-right text-sm">
              Status
            </Label>
            <Select
              value={formData.response_status || "interested"}
              onValueChange={(value) => handleInputChange("response_status", value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className={option.color}>{option.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lead_source" className="text-right text-sm">
              Source
            </Label>
            <Input
              id="lead_source"
              value={formData.lead_source || ""}
              onChange={(e) => handleInputChange("lead_source", e.target.value)}
              className="col-span-3"
              placeholder="Lead source"
            />
          </div>

          {/* Platform */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current_platform" className="text-right text-sm">
              Platform
            </Label>
            <Input
              id="current_platform"
              value={formData.current_platform || ""}
              onChange={(e) => handleInputChange("current_platform", e.target.value)}
              className="col-span-3"
              placeholder="Current platform"
            />
          </div>

          {/* Notes */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right text-sm pt-2">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              className="col-span-3"
              placeholder="Notes..."
              rows={3}
            />
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="additional_info" className="text-right text-sm pt-2">
              Additional
            </Label>
            <Textarea
              id="additional_info"
              value={formData.additional_info || ""}
              onChange={(e) => handleInputChange("additional_info", e.target.value)}
              className="col-span-3"
              placeholder="Additional info..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
