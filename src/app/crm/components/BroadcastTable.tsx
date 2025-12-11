"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyableCell } from "@/components/ui/copyable-cell";
import { Mail, Clock, CheckCircle, XCircle, Calendar, Send, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { Broadcast, BroadcastStatus } from "@/types/crm";

const BROADCAST_STATUS_CONFIG: Record<BroadcastStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: Mail
  },
  scheduled: {
    label: 'Scheduled',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: Clock
  },
  sending: {
    label: 'Sending',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: Send
  },
  sent: {
    label: 'Sent',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    icon: Pause
  },
  failed: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: XCircle
  }
};

interface BroadcastTableProps {
  broadcasts: Broadcast[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
}

export default function BroadcastTable({
  broadcasts,
  loading = false,
  pagination,
  onPageChange,
  onRowsPerPageChange
}: BroadcastTableProps) {
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Helper component for truncated text with tooltip
  const TruncatedText = ({ text, maxWidth = "max-w-32" }: { text: string; maxWidth?: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`truncate block ${maxWidth} cursor-help`} title={text}>
          {text || '-'}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="break-words">{text || 'No data'}</p>
      </TooltipContent>
    </Tooltip>
  );

  const StatusBadge = ({ status }: { status: BroadcastStatus }) => {
    const config = BROADCAST_STATUS_CONFIG[status] || {
      label: status || 'Unknown',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      icon: Mail
    };
    const Icon = config.icon;

    return (
      <div className="flex items-center space-x-1">
        <div className={`p-1 rounded-full ${config.bgColor}`}>
          <Icon className={`w-3 h-3 ${config.color}`} />
        </div>
        <span className={`text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateUUID = (uuid: string | null | undefined) => {
    if (!uuid) return '-';
    return `${uuid.substring(0, 8)}...`;
  };

  const sortBroadcasts = () => {
    const sorted = [...broadcasts].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    return sorted;
  };

  if (loading) {
    return (
      <Card className="border border-gray-100 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="text-center text-gray-500">Loading broadcasts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-100 shadow-sm bg-white">
      <CardHeader className="pb-2 pt-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Broadcasts</CardTitle>
          <div className="text-xs text-gray-500">
            {broadcasts.length} broadcast{broadcasts.length !== 1 ? 's' : ''}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <TooltipProvider>
            <table className="w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 w-16">
                    Name
                  </th>
                  <th className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 w-20">
                    Subject
                  </th>
                  <th className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 w-24">
                    Preview
                  </th>
                  <th className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 w-16">
                    From
                  </th>
                  <th className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 w-12">
                    Status
                  </th>
                  <th
                    className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors w-12"
                    onClick={sortBroadcasts}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Created</span>
                      <span className="text-gray-400 text-xs">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    </div>
                  </th>
                  <th className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 w-12">
                    Scheduled
                  </th>
                  <th className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 w-12">
                    Sent
                  </th>
                  <th className="px-1 py-0.5 text-left text-xs font-semibold text-gray-600 w-12">
                    IDs
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {broadcasts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-2 py-8 text-center text-gray-500 text-sm">
                      No broadcasts found
                    </td>
                  </tr>
                ) : (
                  broadcasts.map((broadcast) => (
                    <tr
                      key={broadcast.id}
                      className="group hover:bg-gray-25 transition-all duration-200"
                    >
                      <td className="px-1 py-0.5 text-xs text-gray-900 font-medium min-w-0">
                        <div className="truncate max-w-16" title={broadcast.name || 'No name'}>
                          {broadcast.name || <span className="text-gray-400 italic">No name</span>}
                        </div>
                      </td>
                      <td className="px-1 py-0.5 text-xs text-gray-900 min-w-0">
                        <div className="truncate max-w-20" title={broadcast.subject || 'No subject'}>
                          {broadcast.subject || <span className="text-gray-400 italic">No subject</span>}
                        </div>
                      </td>
                      <td className="px-1 py-0.5 text-xs text-gray-600 min-w-0">
                        <div className="truncate max-w-24" title={broadcast.preview_text || 'No preview'}>
                          {broadcast.preview_text || <span className="text-gray-400 italic">No preview</span>}
                        </div>
                      </td>
                      <td className="px-1 py-0.5 text-xs text-gray-900 min-w-0">
                        <div className="truncate max-w-16" title={broadcast.from || 'No sender'}>
                          {broadcast.from || <span className="text-gray-400 italic">No sender</span>}
                        </div>
                      </td>
                      <td className="px-1 py-0.5">
                        <StatusBadge status={broadcast.status} />
                      </td>
                      <td className="px-1 py-0.5 text-xs text-gray-500 font-mono">
                        {formatDate(broadcast.created_at)}
                      </td>
                      <td className="px-1 py-0.5 text-xs text-gray-500 font-mono">
                        {broadcast.scheduled_at ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-blue-500" />
                            <span>{formatDate(broadcast.scheduled_at)}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-1 py-0.5 text-xs text-gray-500 font-mono">
                        {broadcast.sent_at ? (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span>{formatDate(broadcast.sent_at)}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-1 py-0.5 text-xs">
                        <div className="space-y-0.5">
                          <CopyableCell
                            value={broadcast.id}
                            displayValue={truncateUUID(broadcast.id)}
                            className="text-xs font-mono text-gray-600 block"
                          />
                          <CopyableCell
                            value={broadcast.audience_id}
                            displayValue={truncateUUID(broadcast.audience_id)}
                            className="text-xs font-mono text-gray-500 block"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TooltipProvider>
        </div>

        {/* Pagination */}
        {pagination && (onPageChange || onRowsPerPageChange) && (
          <div className="flex items-center justify-between px-2 py-1 border-t border-gray-100 flex-shrink-0 bg-gray-50">
            <div className="flex items-center space-x-2">
              <div className="text-xs text-gray-500">
                Showing {broadcasts.length} of {pagination.total} broadcasts
              </div>

              {/* Rows per page selector */}
              {onRowsPerPageChange && (
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-gray-500">Per page:</span>
                  <Select value={pagination.limit.toString()} onValueChange={(value) => onRowsPerPageChange(parseInt(value))}>
                    <SelectTrigger className="w-12 h-5 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {onPageChange && pagination.total > pagination.limit && (
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page === 1 || loading}
                  className="h-5 px-2 text-xs"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>

                <span className="text-xs text-gray-500">
                  Page {pagination.page}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={!pagination.hasMore || loading}
                  className="h-5 px-2 text-xs"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}