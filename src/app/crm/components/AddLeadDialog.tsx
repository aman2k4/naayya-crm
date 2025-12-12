"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CreateLeadInput, ResponseStatus } from "@/types/crm";

const RESPONSE_STATUS_OPTIONS: Array<{ value: ResponseStatus; label: string; color: string }> = [
  { value: 'interested', label: '✅ Interested', color: 'text-green-600' },
  { value: 'not_interested', label: '❌ Not Interested', color: 'text-red-600' },
  { value: 'interested_later', label: '⏰ Interested Later', color: 'text-yellow-600' },
  { value: 'follow_up_needed', label: '📞 Follow Up Needed', color: 'text-blue-600' },
  { value: 'qualified', label: '🎯 Qualified', color: 'text-purple-600' },
  { value: 'converted', label: '🚀 Converted', color: 'text-green-700' }
];

interface AddLeadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadCreated: () => void;
  availableCountries: Array<{name: string; count: number}>;
  children?: React.ReactNode;
}

export default function AddLeadDialog({
  isOpen,
  onOpenChange,
  onLeadCreated,
  availableCountries,
  children
}: AddLeadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<CreateLeadInput>({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    website: '',
    instagram: '',
    facebook: '',
    business_type: '',
    studio_name: '',
    lead_source: '',
    current_platform: '',
    city: '',
    state: '',
    country_code: '',
    response_status: 'interested',
    notes: '',
    additional_info: ''
  });

  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone_number: '',
      website: '',
      instagram: '',
      facebook: '',
      business_type: '',
      studio_name: '',
      lead_source: '',
      current_platform: '',
      city: '',
      state: '',
      country_code: '',
      response_status: 'interested',
      notes: '',
      additional_info: ''
    });
  };

  const handleInputChange = (field: keyof CreateLeadInput, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/crm/leads-with-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'Validation failed' && errorData.details) {
          throw new Error(`Validation failed: ${errorData.details}`);
        }
        throw new Error(errorData.message || 'Failed to create lead');
      }

      await response.json();
      onLeadCreated();
      onOpenChange(false);
      resetForm();

      toast({
        title: "Success",
        description: "Lead created successfully"
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: "Error",
        description: "Failed to create lead. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studio_name">Studio Name</Label>
              <Input
                id="studio_name"
                value={formData.studio_name}
                onChange={(e) => handleInputChange('studio_name', e.target.value)}
                placeholder="Enter studio name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              type="tel"
              value={formData.phone_number}
              onChange={(e) => handleInputChange('phone_number', e.target.value)}
              placeholder="Enter phone number"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website || ""}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_type">Business Type</Label>
              <Input
                id="business_type"
                value={formData.business_type || ""}
                onChange={(e) => handleInputChange("business_type", e.target.value)}
                placeholder="e.g., yoga studio, pilates studio"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={formData.instagram || ""}
                onChange={(e) => handleInputChange("instagram", e.target.value)}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                value={formData.facebook || ""}
                onChange={(e) => handleInputChange("facebook", e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead_source">Lead Source</Label>
              <Input
                id="lead_source"
                value={formData.lead_source}
                onChange={(e) => handleInputChange('lead_source', e.target.value)}
                placeholder="e.g., Website, Referral, Social Media"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_platform">Current Platform</Label>
              <Input
                id="current_platform"
                value={formData.current_platform}
                onChange={(e) => handleInputChange('current_platform', e.target.value)}
                placeholder="e.g., Mindbody, ClassPass, etc."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Enter city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State/Region</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                placeholder="Enter state or region"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country_code">Country Code</Label>
            <Input
              id="country_code"
              value={formData.country_code}
              onChange={(e) => handleInputChange('country_code', e.target.value.toUpperCase())}
              placeholder="e.g., US, CA, GB, IN"
              maxLength={2}
            />
            <p className="text-xs text-gray-500">2-letter ISO country code</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="response_status">Response Status</Label>
            <Select value={formData.response_status || 'interested'} onValueChange={(value) => handleInputChange('response_status', value as ResponseStatus)}>
              <SelectTrigger id="response_status">
                <SelectValue placeholder="Select response status" />
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

          <div className="space-y-2">
            <Label htmlFor="additional_info">Additional Info</Label>
            <Textarea
              id="additional_info"
              value={formData.additional_info}
              onChange={(e) => handleInputChange('additional_info', e.target.value)}
              placeholder="Additional supporting information about the lead (few lines of text)..."
              className="min-h-[60px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Internal notes about this lead..."
              className="min-h-[60px]"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}