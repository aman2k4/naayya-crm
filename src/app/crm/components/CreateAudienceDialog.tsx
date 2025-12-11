"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Lead } from "@/types/crm";

interface CreateAudienceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: Set<string>;
  isAllFilteredSelected: boolean;
  allFilteredLeads: Lead[];
  visibleLeads: Lead[];
  onSuccess?: () => void;
}

export default function CreateAudienceDialog({
  isOpen,
  onOpenChange,
  selectedLeads,
  isAllFilteredSelected,
  allFilteredLeads,
  visibleLeads,
  onSuccess
}: CreateAudienceDialogProps) {
  const [audienceName, setAudienceName] = useState('');
  const [isCreatingAudience, setIsCreatingAudience] = useState(false);
  const { toast } = useToast();

  const handleCreateAudience = async () => {
    if (selectedLeads.size === 0) {
      toast({
        title: "No leads selected",
        description: "Please select leads to create an audience",
        variant: "destructive"
      });
      return;
    }

    if (!audienceName.trim()) {
      toast({
        title: "Audience name required",
        description: "Please enter a name for the audience",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingAudience(true);

    try {
      // Get full lead objects of selected leads
      let selectedLeads_data: Lead[];

      if (isAllFilteredSelected && allFilteredLeads.length > 0) {
        // Use all filtered leads
        selectedLeads_data = allFilteredLeads.filter(lead => lead.email);
      } else {
        // Use only visible selected leads
        selectedLeads_data = visibleLeads
          .filter(lead => selectedLeads.has(lead.id))
          .filter(lead => lead.email); // Ensure email exists
      }

      const response = await fetch('/api/crm/audiences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: audienceName.trim(),
          leads: selectedLeads_data
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create audience');
      }

      const result = await response.json();

      onOpenChange(false);
      setAudienceName('');

      // Show detailed success message
      let description = result.message;
      if (result.failedContacts > 0) {
        description += ` Check console for details on failed contacts.`;
        console.warn('Failed contacts:', result.failedContactsDetails);
      }

      toast({
        title: "Audience Created!",
        description: description || `Successfully created audience "${audienceName}" with ${selectedLeads_data.length} contacts`,
      });

      // Call success callback to clear selections
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating audience:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create audience. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCreatingAudience(false);
    }
  };

  const selectedLeadsData = isAllFilteredSelected && allFilteredLeads.length > 0
    ? allFilteredLeads
    : visibleLeads.filter(lead => selectedLeads.has(lead.id));
  const withNames = selectedLeadsData.filter(lead => lead.first_name?.trim() || lead.last_name?.trim()).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create Audience</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>You are about to create an audience with <strong>{selectedLeads.size}</strong> selected contacts.</p>
            {isAllFilteredSelected && (
              <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-xs text-blue-800 font-medium">
                  All filtered results selected: This includes leads from all pages that match your current filters.
                </p>
              </div>
            )}
            <div className="mt-3 p-2 bg-gray-50 rounded-md">
              <p className="text-xs font-medium text-gray-700 mb-1">Contact data to be included:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Email addresses (required)</li>
                <li>• First names (when available)</li>
                <li>• Last names (when available)</li>
              </ul>
              {withNames > 0 ? (
                <p className="text-xs text-green-600 mt-2">
                  ✓ {withNames} out of {selectedLeadsData.length} contacts have name information
                </p>
              ) : (
                <p className="text-xs text-yellow-600 mt-2">
                  ⚠ None of the selected contacts have name information
                </p>
              )}
            </div>
            {selectedLeads.size > 100 && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md border border-amber-200">
                <p className="text-xs text-amber-800">
                  ⚠️ Large audience: Creating audiences with many contacts may take several minutes. Please be patient.
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience-name">Audience Name *</Label>
            <Input
              id="audience-name"
              value={audienceName}
              onChange={(e) => setAudienceName(e.target.value)}
              placeholder="Enter audience name (e.g., 'Q1 2024 Leads')"
              disabled={isCreatingAudience}
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setAudienceName('');
              }}
              disabled={isCreatingAudience}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAudience}
              disabled={isCreatingAudience || !audienceName.trim()}
            >
              {isCreatingAudience ? 'Creating...' : 'Create Audience'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
