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
