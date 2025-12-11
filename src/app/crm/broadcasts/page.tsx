"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { Broadcast, BroadcastStatus } from "@/types/crm";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, RefreshCw, Radio, Calendar, Send, Clock, XCircle, AlertTriangle } from "lucide-react";
import BroadcastTable from "../components/BroadcastTable";

const BROADCAST_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', icon: Radio, color: 'bg-gray-100 text-gray-800' },
  { value: 'scheduled', label: 'Scheduled', icon: Clock, color: 'bg-blue-100 text-blue-800' },
  { value: 'sending', label: 'Sending', icon: Send, color: 'bg-yellow-100 text-yellow-800' },
  { value: 'sent', label: 'Sent', icon: Send, color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-800' },
  { value: 'failed', label: 'Failed', icon: AlertTriangle, color: 'bg-red-100 text-red-800' }
];

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('__all__');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Function to update URL with current filter state
  const updateURL = useCallback((filters: {
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams(searchParams);

    // Update or remove status parameter
    if (filters.status !== undefined) {
      if (filters.status && filters.status !== '__all__') {
        params.set('status', filters.status);
      } else {
        params.delete('status');
      }
    }

    // Update or remove page parameter
    if (filters.page !== undefined) {
      if (filters.page > 1) {
        params.set('page', filters.page.toString());
      } else {
        params.delete('page');
      }
    }

    // Update or remove limit parameter
    if (filters.limit !== undefined) {
      if (filters.limit !== 20) { // 20 is the default
        params.set('limit', filters.limit.toString());
      } else {
        params.delete('limit');
      }
    }

    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.push(`/crm/broadcasts${newURL}`, { scroll: false });
  }, [router, searchParams]);

  // Function to initialize filters from URL parameters
  const initializeFiltersFromURL = useCallback(() => {
    const urlStatus = searchParams.get('status') || '__all__';
    const urlPage = parseInt(searchParams.get('page') || '1');
    const urlLimit = parseInt(searchParams.get('limit') || '20');

    setSelectedStatus(urlStatus);
    setCurrentPage(urlPage);
    setRowsPerPage(urlLimit);

    return {
      status: urlStatus,
      page: urlPage,
      limit: urlLimit
    };
  }, [searchParams]);

  const fetchBroadcasts = async (page = 1, status = '', limit?: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(limit && { limit: limit.toString() }),
      });

      const response = await fetch(`/api/crm/broadcasts?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch broadcasts');
      }

      const result = await response.json();

      if (result.success && result.data) {
        let filteredBroadcasts = result.data.broadcasts || [];

        // Apply status filter on client side
        if (status && status !== '__all__') {
          filteredBroadcasts = filteredBroadcasts.filter((broadcast: Broadcast) =>
            broadcast.status === status
          );
        }

        setBroadcasts(filteredBroadcasts);
        setPagination({
          page,
          limit: limit || rowsPerPage,
          total: filteredBroadcasts.length,
          hasMore: result.data.has_more
        });
        setCurrentPage(page);
      } else {
        console.error('API response error:', result);
        throw new Error(result.error || 'Failed to fetch broadcasts');
      }
    } catch (err) {
      setError('Failed to fetch broadcasts');
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to fetch broadcasts. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);

    updateURL({ status, page: 1 });

    const apiStatus = status === '__all__' ? '' : status;
    fetchBroadcasts(1, apiStatus);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateURL({ page });

    const apiStatus = selectedStatus === '__all__' ? '' : selectedStatus;
    fetchBroadcasts(page, apiStatus);
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage);
    setCurrentPage(1);

    updateURL({ page: 1, limit: newRowsPerPage });

    const apiStatus = selectedStatus === '__all__' ? '' : selectedStatus;
    fetchBroadcasts(1, apiStatus, newRowsPerPage);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const apiStatus = selectedStatus === '__all__' ? '' : selectedStatus;
    await fetchBroadcasts(currentPage, apiStatus);
    setIsRefreshing(false);

    toast({
      title: "Refreshed",
      description: "Broadcasts have been refreshed successfully."
    });
  };


  useEffect(() => {
    const urlFilters = initializeFiltersFromURL();
    const apiStatus = urlFilters.status === '__all__' ? '' : urlFilters.status;
    fetchBroadcasts(urlFilters.page, apiStatus, urlFilters.limit);
  }, [initializeFiltersFromURL]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-4 flex-shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Broadcasts
          </h1>
          <p className="text-sm text-gray-600">
            View and manage email broadcasts sent through Resend.
          </p>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="relative"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <Card className="border border-gray-100 shadow-sm bg-white mb-2 flex-shrink-0">
        <CardHeader className="pb-1 pt-3">
          <div className="flex justify-between items-center">
            <CardTitle>Total Broadcasts</CardTitle>
            <div className="flex items-center space-x-2">
              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {BROADCAST_STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4 text-gray-500" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-semibold text-gray-900">{pagination?.total || 0}</div>
        </CardContent>
      </Card>

      {/* Broadcasts Table */}
      <BroadcastTable
        broadcasts={broadcasts}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
    </div>
  );
}