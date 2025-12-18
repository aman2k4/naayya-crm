// Email sender configuration
// Add new senders here as needed

export interface EmailSender {
  id: string;
  name: string;
  fromEmail: string;    // email.naayya.com domain (for sending)
  replyToEmail: string; // naayya.com domain (for replies)
}

export const EMAIL_SENDERS: EmailSender[] = [
  { id: "sally", name: "Sally Grüneisen", fromEmail: "sally@email.naayya.com", replyToEmail: "sally@naayya.com" },
  { id: "aman", name: "Aman", fromEmail: "aman@email.naayya.com", replyToEmail: "aman@naayya.com" },
];

// Default sender
export const DEFAULT_SENDER_ID = "sally";
export const DEFAULT_REPLY_TO_ID = "sally";
