import {
  Mail,
  MailCheck,
  MailX,
  AlertTriangle,
  MousePointer,
  Eye,
  CheckCircle,
  XCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Type definition for email status object
export interface EmailStatus {
  contacted: boolean;
  lastEventType?: string;
  lastEventTimestamp?: string;
  eventCount: number;
  status: 'not_sent' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
  allEvents: string[];
  unsubscribed?: boolean;
  unsubscribeChecked?: boolean;
  emailsSentCount?: number;
}

// Type for the status display information returned by getStatusDisplay
export interface StatusDisplay {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  label: string;
  description: string;
}

/**
 * Helper function to get status display information for email contacts
 * @param status - The email status object for a contact
 * @returns StatusDisplay object with icon, colors, label and description
 */
export const getStatusDisplay = (status?: EmailStatus): StatusDisplay => {
  if (!status || !status.contacted) {
    return {
      icon: Mail,
      color: 'text-gray-400',
      bgColor: 'bg-gray-100',
      label: 'Not Sent',
      description: 'No emails sent to this address'
    };
  }

  // Check if unsubscribed (highest priority status)
  if (status.unsubscribed) {
    return {
      icon: MailX,
      color: 'text-red-700',
      bgColor: 'bg-red-200',
      label: 'Unsubscribed',
      description: 'Contact has unsubscribed from emails'
    };
  }

  switch (status.status) {
    case 'clicked':
      return {
        icon: MousePointer,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        label: 'Clicked',
        description: 'Email was clicked - highly engaged!'
      };
    case 'opened':
      return {
        icon: Eye,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        label: 'Opened',
        description: 'Email was opened'
      };
    case 'delivered':
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'Delivered',
        description: 'Email was successfully delivered'
      };
    case 'sent':
      return {
        icon: MailCheck,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        label: 'Sent',
        description: 'Email was sent'
      };
    case 'bounced':
      return {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'Bounced',
        description: 'Email bounced - invalid address'
      };
    case 'complained':
      return {
        icon: AlertTriangle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        label: 'Complained',
        description: 'Marked as spam'
      };
    case 'failed':
      return {
        icon: MailX,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'Failed',
        description: 'Email failed to send'
      };
    default:
      return {
        icon: Mail,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        label: 'Unknown',
        description: 'Unknown status'
      };
  }
};