"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, X, Eye, Loader2, Send, XCircle, Mail } from "lucide-react";
import { Lead } from "@/types/crm";
import { getTemplates } from "@/lib/crm/emailTemplates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SendEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [fromEmail, setFromEmail] = useState("Aman <aman@email.naayya.com>");
  const [replyTo, setReplyTo] = useState("aman@naayya.com");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState(false);

  const templates = getTemplates();

  // Get lead IDs from URL
  const leadIds = searchParams.get("ids")?.split(",") || [];

  // Fetch lead details
  useEffect(() => {
    if (leadIds.length === 0) {
      toast({
        title: "No recipients",
        description: "No leads selected. Redirecting to CRM...",
        variant: "destructive",
      });
      router.push("/crm");
      return;
    }

    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/crm/leads-with-count?ids=${leadIds.join(",")}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch leads");
      }

      const result = await response.json();

      if (result.success && result.data) {
        const leadsData = result.data.leads || [];
        setLeads(leadsData);

        // Set first lead for preview
        if (leadsData.length > 0) {
          setPreviewLead(leadsData[0]);
        }

        // Auto-select template 4 as default
        const template4 = templates.find((t) => t.id === "template-4");
        if (template4) {
          setSelectedTemplate("template-4");
          setSubject(template4.subject);
          setUsingTemplate(true);
        }
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
      toast({
        title: "Error",
        description: "Failed to fetch lead details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setUsingTemplate(true);
      setBody(""); // Clear body when using template
    }
  };

  const handleClearTemplate = () => {
    setSelectedTemplate("");
    setUsingTemplate(false);
    setSubject("");
    setBody("");
    setPreviewHtml("");
  };

  const handleRemoveRecipient = (leadId: string) => {
    const newLeads = leads.filter((l) => l.id !== leadId);
    setLeads(newLeads);

    if (newLeads.length === 0) {
      toast({
        title: "No recipients",
        description: "All recipients removed. Redirecting to CRM...",
      });
      router.push("/crm");
    }
  };

  const handlePreview = async () => {
    if (!previewLead) {
      toast({
        title: "No preview available",
        description: "No leads available for preview",
        variant: "destructive",
      });
      return;
    }

    // If using a template, render the HTML via API
    if (usingTemplate && selectedTemplate) {
      setIsLoadingPreview(true);
      try {
        const response = await fetch("/api/crm/preview-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            templateId: selectedTemplate,
            leadId: previewLead.id,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to render preview");
        }

        const result = await response.json();
        if (result.success) {
          setPreviewHtml(result.html);
        } else {
          throw new Error(result.error || "Failed to render preview");
        }
      } catch (error: any) {
        console.error("Error rendering preview:", error);
        toast({
          title: "Preview error",
          description: error.message || "Failed to render email preview",
          variant: "destructive",
        });
      } finally {
        setIsLoadingPreview(false);
      }
    } else {
      setPreviewHtml("");
    }

    setPreviewDialogOpen(true);
  };

  const handleSend = async () => {
    // Validation
    if (leads.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one recipient",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please enter an email subject",
        variant: "destructive",
      });
      return;
    }

    if (!usingTemplate && !body.trim()) {
      toast({
        title: "Body required",
        description: "Please enter email body content or select a template",
        variant: "destructive",
      });
      return;
    }

    // Confirmation
    const confirmed = window.confirm(
      `Send email to ${leads.length} recipient(s)?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setSending(true);

    try {
      const response = await fetch("/api/crm/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromEmail,
          replyTo,
          leadIds: leads.map((l) => l.id),
          subject,
          body,
          templateId: selectedTemplate || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send emails");
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Emails sent successfully!",
          description: result.message || `Sent ${result.sent} email(s)`,
        });

        // Show errors if any
        if (result.errors && result.errors.length > 0) {
          console.error("Failed emails:", result.errors);
          toast({
            title: "Some emails failed",
            description: `${result.failed} email(s) failed to send. Check console for details.`,
            variant: "destructive",
          });
        }

        // Redirect back to CRM after a delay
        setTimeout(() => {
          router.push("/crm");
        }, 2000);
      } else {
        throw new Error(result.error || "Failed to send emails");
      }
    } catch (error: any) {
      console.error("Error sending emails:", error);
      toast({
        title: "Failed to send emails",
        description: error.message || "An error occurred while sending emails",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/crm")}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to CRM
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Send Email
                </h1>
                <p className="text-sm text-gray-600">
                  Compose and send email to selected leads
                </p>
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || leads.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* From Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Email Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">From</Label>
              <Input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="your-email@domain.com"
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Reply-To</Label>
              <Input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="reply-to@domain.com"
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Recipients Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recipients</CardTitle>
              <Badge variant="secondary" className="text-base px-3 py-1">
                {leads.length} recipient{leads.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRecipients(!showRecipients)}
              className="mb-3"
            >
              {showRecipients ? "Hide" : "Show"} Recipients
            </Button>

            {showRecipients && (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <p className="text-xs text-gray-600">{lead.email}</p>
                      <p className="text-xs text-gray-500">{lead.studio_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRecipient(lead.id)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Template Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Email Template (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            {usingTemplate ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Using Template
                      </p>
                      <p className="text-xs text-blue-700">
                        {templates.find((t) => t.id === selectedTemplate)?.name}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearTemplate}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Template emails use pre-designed HTML formatting with personalized content for each recipient.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template for professional HTML emails" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Or write a custom email below
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subject */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Body */}
        {!usingTemplate && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Email Body (Custom)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your email message here..."
                rows={12}
                className="w-full font-mono text-sm"
              />
            </CardContent>
          </Card>
        )}

        {/* Preview Button */}
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePreview}
              disabled={!previewLead || !subject || (!usingTemplate && !body)}
              className="w-full"
            >
              {isLoadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading Preview...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewLead && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  Preview for: {previewLead.first_name} {previewLead.last_name} (
                  {previewLead.email})
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Subject:</Label>
                <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                  {subject.replace(/\{\{first_name\}\}/g, previewLead.first_name || "there")
                    .replace(/\{\{last_name\}\}/g, previewLead.last_name || "")
                    .replace(/\{\{studio_name\}\}/g, previewLead.studio_name || "your studio")
                    .replace(/\{\{city\}\}/g, previewLead.city || "your area")}
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Body:</Label>
                {usingTemplate && previewHtml ? (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-[500px] bg-white"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="text-sm mt-1 p-4 bg-gray-50 rounded whitespace-pre-wrap">
                    {body
                      .replace(/\{\{first_name\}\}/g, previewLead.first_name || "there")
                      .replace(/\{\{last_name\}\}/g, previewLead.last_name || "")
                      .replace(/\{\{studio_name\}\}/g, previewLead.studio_name || "your studio")
                      .replace(/\{\{city\}\}/g, previewLead.city || "your area")}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Fixed Send Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden">
        <Button
          onClick={handleSend}
          disabled={sending || leads.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send to {leads.length} recipient{leads.length !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
