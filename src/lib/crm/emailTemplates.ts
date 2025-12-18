import React from "react";
import { Lead } from "@/types/crm";
import { render } from "@react-email/components";
import { MindbodyEnterpriseOfferV1 } from "@/app/crm/components/emails/MindbodyEnterpriseOfferV1";
import { StudioOwnerOutreach } from "@/app/crm/components/emails/StudioOwnerOutreach";
import { StudioOwnerOutreachV3 } from "@/app/crm/components/emails/StudioOwnerOutreachV3";
import { StudioOwnerOutreachV4 } from "@/app/crm/components/emails/StudioOwnerOutreachV4";
import { MindbodyPartnershipOutreach } from "@/app/crm/components/emails/MindbodyPartnershipOutreach";
import { EversportsMigrationOutreach } from "@/app/crm/components/emails/EversportsMigrationOutreach";
import { YogaMindbodyOutreachV1 } from "@/app/crm/components/emails/YogaMindbodyOutreachV1";
import { YogaMindbodyOutreachV2 } from "@/app/crm/components/emails/YogaMindbodyOutreachV2";
import { YogaMindbodyOutreachV3 } from "@/app/crm/components/emails/YogaMindbodyOutreachV3";
import { YogaMindbodyOutreachV4 } from "@/app/crm/components/emails/YogaMindbodyOutreachV4";
import { EversportsGenericOutreachV1 } from "@/app/crm/components/emails/EversportsGenericOutreachV1";
import { EversportsOfferOutreachV1 } from "@/app/crm/components/emails/EversportsOfferOutreachV1";
import { EversportsOfferOutreachV2 } from "@/app/crm/components/emails/EversportsOfferOutreachV2";
import { GenericFollowUpV1 } from "@/app/crm/components/emails/GenericFollowUpV1";
import { GenericFollowUpV2 } from "@/app/crm/components/emails/GenericFollowUpV2";
import { MerrithewPilatesOutreachV1 } from "@/app/crm/components/emails/MerrithewPilatesOutreachV1";
import { MerrithewPilatesOutreachV2 } from "@/app/crm/components/emails/MerrithewPilatesOutreachV2";
import { EversportsSallyFollowUpV2 as EversportsSallyFollowUp } from "@/app/crm/components/emails/EversportsSallyFollowUpV2";
import { EversportsSallyFollowUpDE } from "@/app/crm/components/emails/EversportsSallyFollowUpDE";

export type EmailTemplateCategory = "First Email" | "First Follow Up" | "Second Follow Up";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: EmailTemplateCategory;
  reactComponent: (props: any) => React.ReactElement;
}

// Hardcoded email templates
const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "template-1",
    name: "Template 1 - Mindbody Enterprise Offer (US) - 6 Months Free",
    subject: "Better Mindbody alternative for {{studio_name}}",
    category: "First Email",
    reactComponent: MindbodyEnterpriseOfferV1,
  },
  {
    id: "template-2",
    name: "Template 2 - Studio Owner Platform Outreach",
    subject: "Quick question about your studio",
    category: "First Email",
    reactComponent: StudioOwnerOutreach,
  },
  {
    id: "template-3",
    name: "Template 3 - Studio Owner Professional Outreach",
    subject: "Quick question about your studio",
    category: "First Email",
    reactComponent: StudioOwnerOutreachV3,
  },
  {
    id: "template-4",
    name: "Template 4 - Studio Owner Personal Email",
    subject: "Quick question about your studio",
    category: "First Email",
    reactComponent: StudioOwnerOutreachV4,
  },
  {
    id: "template-5",
    name: "Template 5 - Mindbody Partnership Outreach",
    subject: "Partnership opportunity for {{studio_name}}",
    category: "First Email",
    reactComponent: MindbodyPartnershipOutreach,
  },
  {
    id: "template-6",
    name: "Template 6 - Eversports Migration Outreach",
    subject: "Switch from Eversports - Save 57% + Free Migration",
    category: "First Email",
    reactComponent: EversportsMigrationOutreach,
  },
  {
    id: "template-7",
    name: "Template 7 - Yoga Studio (Mindbody) - Direct (With Link)",
    subject: "Quick question about {{studio_name}}",
    category: "First Email",
    reactComponent: YogaMindbodyOutreachV1,
  },
  {
    id: "template-8",
    name: "Template 8 - Yoga Studio (Mindbody) - Benefit Focused (No Link)",
    subject: "Mindbody alternative for {{studio_name}}?",
    category: "First Email",
    reactComponent: YogaMindbodyOutreachV2,
  },
  {
    id: "template-9",
    name: "Template 9 - Yoga Studio (Mindbody) - Friendly (With Link)",
    subject: "Simpler booking for {{studio_name}}",
    category: "First Email",
    reactComponent: YogaMindbodyOutreachV3,
  },
  {
    id: "template-10",
    name: "Template 10 - Yoga Studio (Mindbody) - Curiosity (No Link)",
    subject: "Quick idea for {{studio_name}}",
    category: "First Email",
    reactComponent: YogaMindbodyOutreachV4,
  },
  {
    id: "template-11",
    name: "Template 11 - General Studio (Eversports) - Direct (With Link)",
    subject: "Quick question about {{studio_name}}",
    category: "First Email",
    reactComponent: EversportsGenericOutreachV1,
  },
  {
    id: "template-12",
    name: "Template 12 - Eversports Switch Offer (Save €1200) - Direct",
    subject: "Offer for {{studio_name}} (Save €1,200)",
    category: "First Email",
    reactComponent: EversportsOfferOutreachV1,
  },
  {
    id: "template-13",
    name: "Template 13 - Eversports Switch Offer (Save €1200) - Question",
    subject: "Quick idea for {{studio_name}}",
    category: "First Email",
    reactComponent: EversportsOfferOutreachV2,
  },
  {
    id: "template-14",
    name: "Template 14 - Generic Follow Up - Pain Point Focus",
    subject: "Re: Following up on {{studio_name}}",
    category: "First Follow Up",
    reactComponent: GenericFollowUpV1,
  },
  {
    id: "template-15",
    name: "Template 15 - Generic Follow Up - Value Proposition",
    subject: "Re: Quick thought for {{studio_name}}",
    category: "First Follow Up",
    reactComponent: GenericFollowUpV2,
  },
  {
    id: "template-16",
    name: "Template 16 - Merrithew Pilates Support Program - Direct",
    subject: "Support program for Merrithew-certified instructors",
    category: "First Email",
    reactComponent: MerrithewPilatesOutreachV1,
  },
  {
    id: "template-17",
    name: "Template 17 - Merrithew Pilates Support Program - Question",
    subject: "Quick question about your Pilates teaching",
    category: "First Email",
    reactComponent: MerrithewPilatesOutreachV2,
  },
  {
    id: "template-18",
    name: "Template 18 - Eversports Sally Follow-Up",
    subject: "Re: Quick follow-up for {{studio_name}}",
    category: "First Follow Up",
    reactComponent: EversportsSallyFollowUp,
  },
  {
    id: "template-19",
    name: "Template 19 - Eversports Sally Follow-Up (German)",
    subject: "Angebot für Eversports-Studios (nur bis 31.12.)",
    category: "First Follow Up",
    reactComponent: EversportsSallyFollowUpDE,
  },
];

/**
 * Replace template variables with actual lead data
 */
export function replaceVariables(template: string, lead: Lead): string {
  let result = template;

  // Replace {{first_name}}
  result = result.replace(
    /\{\{first_name\}\}/g,
    lead.first_name || ""
  );

  // Replace {{last_name}}
  result = result.replace(
    /\{\{last_name\}\}/g,
    lead.last_name || ""
  );

  // Replace {{studio_name}}
  result = result.replace(
    /\{\{studio_name\}\}/g,
    lead.studio_name || "your studio"
  );

  // Replace {{city}}
  result = result.replace(
    /\{\{city\}\}/g,
    lead.city || "your area"
  );

  // Replace {{country_code}}
  result = result.replace(
    /\{\{country_code\}\}/g,
    lead.country_code || ""
  );

  return result;
}

/**
 * Get all available templates
 */
export function getTemplates(): EmailTemplate[] {
  return EMAIL_TEMPLATES;
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Render a React Email template to HTML
 */
export async function renderEmailTemplate(
  template: EmailTemplate,
  lead: Lead
): Promise<{ html: string; text: string; subject: string }> {
  const props = {
    firstName: lead.first_name || undefined,
    studioName: lead.studio_name || "your studio",
  };

  const html = await render(template.reactComponent(props));
  const text = await render(template.reactComponent(props), { plainText: true });
  const subject = replaceVariables(template.subject, lead);

  return { html, text, subject };
}
