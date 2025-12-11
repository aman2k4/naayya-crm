"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail, MailCheck, MailX, AlertTriangle, MousePointer, Eye, CheckCircle, XCircle, FileText, ExternalLink } from "lucide-react";

interface EmailEventsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  emailAddress: string;
}

export default function EmailEventsModal({ isOpen, onOpenChange, emailAddress }: EmailEventsModalProps) {
  const [emailEvents, setEmailEvents] = useState<any[]>([]);
  const [isLoadingEmailEvents, setIsLoadingEmailEvents] = useState(false);
  const [emailDetails, setEmailDetails] = useState<Record<string, any>>({});
  const [loadingEmailDetails, setLoadingEmailDetails] = useState<Set<string>>(new Set());
  const [selectedEmailId, setSelectedEmailId] = useState<string>('');
  const { toast } = useToast();

  // Helper function to get status display information
  const getStatusDisplay = (status?: {
    contacted: boolean;
    status: 'not_sent' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
    lastEventType?: string;
    lastEventTimestamp?: string;
    eventCount: number;
    allEvents: string[];
  }) => {
    if (!status || !status.contacted) {
      return {
        icon: Mail,
        color: 'text-gray-400',
        bgColor: 'bg-gray-100',
        label: 'Not Sent',
        description: 'No emails sent to this address'
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

  const fetchEmailEvents = async (email: string) => {
    try {
      setIsLoadingEmailEvents(true);
      const response = await fetch(`/api/admin/email-events/by-recipient?to=${encodeURIComponent(email)}&limit=100`);

      if (!response.ok) {
        throw new Error('Failed to fetch email events');
      }

      const result = await response.json();
      // Sort events with latest first (descending order)
      const sortedEvents = (result.data || []).sort((a: any, b: any) => 
        new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
      );
      setEmailEvents(sortedEvents);
    } catch (err) {
      console.error('Error fetching email events:', err);
      toast({
        title: "Error",
        description: "Failed to fetch email events",
        variant: "destructive"
      });
    } finally {
      setIsLoadingEmailEvents(false);
    }
  };

  const fetchEmailDetails = async (emailId: string) => {
    if (emailDetails[emailId] || loadingEmailDetails.has(emailId)) {
      return; // Already loaded or loading
    }

    try {
      setLoadingEmailDetails(prev => new Set(prev).add(emailId));
      
      const response = await fetch(`/api/crm/email-details?emailId=${encodeURIComponent(emailId)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // Email not found in Resend, skip silently
          return;
        }
        throw new Error('Failed to fetch email details');
      }

      const result = await response.json();
      setEmailDetails(prev => ({
        ...prev,
        [emailId]: result.email
      }));
    } catch (err) {
      console.error('Error fetching email details:', err);
      // Don't show error toast as this is supplementary data
    } finally {
      setLoadingEmailDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(emailId);
        return newSet;
      });
    }
  };

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmailId(emailId);
    fetchEmailDetails(emailId);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && emailAddress) {
      setSelectedEmailId('');
      setEmailEvents([]);
      setEmailDetails({});
      setLoadingEmailDetails(new Set());
      fetchEmailEvents(emailAddress);
    }
  }, [isOpen, emailAddress]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Email Events for {emailAddress}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {isLoadingEmailEvents ? (
            <div className="flex items-center justify-center py-8 flex-1">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              <span className="ml-2 text-sm text-gray-600">Loading email events...</span>
            </div>
          ) : emailEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 flex-1">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No email events found for this address</p>
            </div>
          ) : (
            <>
              {/* Left Sidebar - Email List */}
              <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                <div className="p-3 border-b border-gray-200 bg-white">
                  <h3 className="text-sm font-semibold text-gray-900">Emails Sent</h3>
                  <p className="text-xs text-gray-500">
                    {(() => {
                      const groupedEvents: Record<string, any[]> = {};
                      emailEvents.forEach(event => {
                        const emailId = event.email_id || 'unknown';
                        if (!groupedEvents[emailId]) {
                          groupedEvents[emailId] = [];
                        }
                        groupedEvents[emailId].push(event);
                      });
                      return Object.keys(groupedEvents).length;
                    })()} unique emails
                  </p>
                </div>
                
                <div className="p-2">
                  {(() => {
                    // Group events by email_id
                    const groupedEvents: Record<string, any[]> = {};
                    emailEvents.forEach(event => {
                      const emailId = event.email_id || 'unknown';
                      if (!groupedEvents[emailId]) {
                        groupedEvents[emailId] = [];
                      }
                      groupedEvents[emailId].push(event);
                    });

                    // Sort groups by the latest event timestamp
                    const sortedGroups = Object.entries(groupedEvents).sort(([, eventsA], [, eventsB]) => {
                      const latestA = Math.max(...eventsA.map(e => new Date(e.event_timestamp).getTime()));
                      const latestB = Math.max(...eventsB.map(e => new Date(e.event_timestamp).getTime()));
                      return latestB - latestA;
                    });

                    return sortedGroups.map(([emailId, events]) => {
                      const sortedEvents = events.sort((a, b) => 
                        new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
                      );
                      const latestEvent = sortedEvents[0];
                      const subject = latestEvent.subject || 'No subject';
                      
                      // Get the most advanced status from all events in this group
                      const statusPriority = {
                        'clicked': 6,
                        'opened': 5,
                        'delivered': 4,
                        'sent': 3,
                        'complained': 2,
                        'bounced': 1,
                        'failed': 0
                      };
                      
                      const groupStatus = events.reduce((bestStatus, event) => {
                        const eventStatus = event.event_type.includes('click') ? 'clicked' :
                                           event.event_type.includes('open') ? 'opened' :
                                           event.event_type.includes('deliver') ? 'delivered' :
                                           event.event_type.includes('bounce') ? 'bounced' :
                                           event.event_type.includes('complaint') || event.event_type.includes('spam') ? 'complained' :
                                           event.event_type.includes('failed') ? 'failed' :
                                           'sent';
                        
                        return (statusPriority[eventStatus as keyof typeof statusPriority] || 0) > (statusPriority[bestStatus as keyof typeof statusPriority] || 0) ? eventStatus : bestStatus;
                      }, 'sent');

                      const groupStatusDisplay = getStatusDisplay({ 
                        contacted: true, 
                        status: groupStatus as any,
                        lastEventType: latestEvent.event_type,
                        lastEventTimestamp: latestEvent.event_timestamp,
                        eventCount: events.length,
                        allEvents: []
                      });
                      const GroupStatusIcon = groupStatusDisplay.icon;

                      const isSelected = selectedEmailId === emailId;

                      return (
                        <div 
                          key={emailId} 
                          className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors border ${
                            isSelected 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => handleSelectEmail(emailId)}
                        >
                          <div className="flex items-start space-x-2">
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${groupStatusDisplay.bgColor}`}>
                              <GroupStatusIcon className={`w-3 h-3 ${groupStatusDisplay.color}`} />
                              <span className={groupStatusDisplay.color}>{groupStatusDisplay.label}</span>
                            </div>
                          </div>
                          
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {subject}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {events.length} event{events.length !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-gray-400 font-mono mt-1 truncate">
                              {emailId}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(latestEvent.event_timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {selectedEmailId ? (
                  <>
                    {/* Selected Email Content */}
                    <div className="flex-1 overflow-y-auto">
                      {(() => {
                        // Find the selected email's events
                        const selectedEvents = emailEvents.filter(e => e.email_id === selectedEmailId);
                        const sortedEvents = selectedEvents.sort((a, b) => 
                          new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
                        );

                        return (
                          <div className="h-full flex flex-col">
                            {/* Event Timeline - Top Section (Small) */}
                            <div className="p-4 border-b border-gray-200 bg-gray-50">
                              <div className="flex items-center space-x-2 mb-2">
                                <div className="w-3 h-3 rounded-full bg-blue-100 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                                </div>
                                <h4 className="text-xs font-semibold text-gray-900">Event Timeline</h4>
                              </div>
                              
                              <div className="flex space-x-2 overflow-x-auto pb-2">
                                {sortedEvents.map((event, eventIndex) => {
                                  const eventStatusDisplay = getStatusDisplay({
                                    contacted: true,
                                    status: event.event_type.includes('click') ? 'clicked' :
                                           event.event_type.includes('open') ? 'opened' :
                                           event.event_type.includes('deliver') ? 'delivered' :
                                           event.event_type.includes('bounce') ? 'bounced' :
                                           event.event_type.includes('complaint') || event.event_type.includes('spam') ? 'complained' :
                                           event.event_type.includes('failed') ? 'failed' :
                                           'sent',
                                    lastEventType: event.event_type,
                                    lastEventTimestamp: event.event_timestamp,
                                    eventCount: 0,
                                    allEvents: []
                                  });
                                  const EventStatusIcon = eventStatusDisplay.icon;

                                  return (
                                    <div
                                      key={`${event.email_id}-${event.event_timestamp}-${eventIndex}`}
                                      className="flex-shrink-0 bg-white rounded border border-gray-200 p-2 min-w-0"
                                    >
                                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${eventStatusDisplay.bgColor}`}>
                                        <EventStatusIcon className={`w-3 h-3 ${eventStatusDisplay.color}`} />
                                        <span className={`${eventStatusDisplay.color} truncate`}>{eventStatusDisplay.label}</span>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1 truncate">
                                        {new Date(event.event_timestamp).toLocaleString()}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Email Content - Bottom Section (Large) */}
                            <div className="flex-1 p-4 bg-white overflow-y-auto">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-4 h-4 text-blue-600" />
                                  <h4 className="text-sm font-semibold text-gray-900">Email Content</h4>
                                </div>
                                {loadingEmailDetails.has(selectedEmailId) && (
                                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                                )}
                              </div>
                              
                              {emailDetails[selectedEmailId] ? (
                                <div className="space-y-4">
                                  {/* Email Info */}
                                  <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-3 rounded-lg">
                                    <div>
                                      <p className="font-medium text-gray-700">From:</p>
                                      <p className="text-gray-600">{emailDetails[selectedEmailId].from}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-700">Subject:</p>
                                      <p className="text-gray-600">{emailDetails[selectedEmailId].subject}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-700">Created:</p>
                                      <p className="text-gray-600">{new Date(emailDetails[selectedEmailId].created_at).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-700">Last Event:</p>
                                      <p className="text-gray-600 capitalize">{emailDetails[selectedEmailId].last_event}</p>
                                    </div>
                                  </div>

                                  {/* HTML Content */}
                                  {emailDetails[selectedEmailId].html && (
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="font-medium text-gray-700 text-sm">Rendered Email:</p>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const newWindow = window.open('', '_blank');
                                            if (newWindow) {
                                              newWindow.document.write(`
                                                <!DOCTYPE html>
                                                <html>
                                                <head>
                                                  <title>${emailDetails[selectedEmailId].subject}</title>
                                                  <meta charset="utf-8">
                                                  <meta name="viewport" content="width=device-width, initial-scale=1">
                                                </head>
                                                <body style="margin: 20px; font-family: Arial, sans-serif;">
                                                  ${emailDetails[selectedEmailId].html}
                                                </body>
                                                </html>
                                              `);
                                              newWindow.document.close();
                                            }
                                          }}
                                          className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          <span>Open in New Tab</span>
                                        </button>
                                      </div>
                                      
                                      <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
                                        <div className="p-4 overflow-y-auto" style={{ maxHeight: '400px' }}>
                                          <div 
                                            className="prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: emailDetails[selectedEmailId].html }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Text Content (fallback) */}
                                  {!emailDetails[selectedEmailId].html && emailDetails[selectedEmailId].text && (
                                    <div>
                                      <p className="font-medium text-gray-700 text-sm mb-3">Text Content:</p>
                                      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                                        <pre className="whitespace-pre-wrap text-sm text-gray-700">
                                          {emailDetails[selectedEmailId].text}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 text-center py-8">
                                  Loading email content from Resend...
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm">Select an email to view details</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}