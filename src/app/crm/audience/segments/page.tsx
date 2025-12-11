"use client"

import { useEffect, useState } from "react"
import { SegmentsTable } from "./components/SegmentsTable"
import { CreateSegmentDialog } from "./components/CreateSegmentDialog"
import { DeleteSegmentDialog } from "./components/DeleteSegmentDialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Segment {
  id: string
  name: string
  created_at: string
  object?: string
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [filteredSegments, setFilteredSegments] = useState<Segment[]>([])
  const [selectedSegments, setSelectedSegments] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingSegments, setDeletingSegments] = useState<Segment[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const fetchSegments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/crm/segments')

      if (!response.ok) {
        throw new Error('Failed to fetch segments')
      }

      const data = await response.json()
      const segmentsList = data.segments?.data || []
      setSegments(segmentsList)
      setFilteredSegments(segmentsList)
    } catch (error) {
      console.error('Error fetching segments:', error)
      setSegments([])
      setFilteredSegments([])
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch segments. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSegments()
  }, [])

  // Filter segments based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSegments(segments)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = segments.filter(segment =>
        segment.name.toLowerCase().includes(query) ||
        segment.id.toLowerCase().includes(query)
      )
      setFilteredSegments(filtered)
    }
  }, [searchQuery, segments])

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      await fetchSegments()
      toast({
        title: "Refreshed",
        description: "Segments list has been updated.",
      })
    } catch (error) {
      console.error('Error refreshing segments:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh segments.",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSegmentCreated = () => {
    fetchSegments()
  }

  const handleDelete = (segment: Segment) => {
    setDeletingSegments([segment])
    setIsDeleteDialogOpen(true)
  }

  const handleBulkDelete = () => {
    const segmentsToDelete = segments.filter(s => selectedSegments.includes(s.id))
    setDeletingSegments(segmentsToDelete)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (deletingSegments.length === 0) return

    setIsDeleting(true)
    try {
      // Delete segments one by one with delay to avoid rate limits
      const results = []
      let successCount = 0
      let failureCount = 0

      for (let i = 0; i < deletingSegments.length; i++) {
        const segment = deletingSegments[i]

        try {
          const response = await fetch(`/api/crm/segments?segmentId=${segment.id}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            successCount++
          } else {
            failureCount++
            console.error(`Failed to delete segment ${segment.name}:`, await response.text())
          }
        } catch (err) {
          failureCount++
          console.error(`Error deleting segment ${segment.name}:`, err)
        }

        // Add 500ms delay between requests to avoid rate limiting (except for last item)
        if (i < deletingSegments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      if (failureCount === 0) {
        toast({
          title: deletingSegments.length === 1 ? "Segment Deleted" : "Segments Deleted",
          description: `Successfully deleted ${successCount} ${successCount === 1 ? 'segment' : 'segments'}.`,
        })
      } else if (successCount > 0) {
        toast({
          variant: "destructive",
          title: "Partial Success",
          description: `Deleted ${successCount} of ${deletingSegments.length} segments. ${failureCount} failed.`,
        })
      } else {
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: `Failed to delete all segments. Please try again.`,
        })
      }

      // Close dialog and refresh segments list
      setIsDeleteDialogOpen(false)
      setDeletingSegments([])
      setSelectedSegments([])
      fetchSegments()
    } catch (error) {
      console.error('Error deleting segments:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete segments. Please try again.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleView = (segment: Segment) => {
    toast({
      title: "Segment Details",
      description: `Viewing details for "${segment.name}"`,
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Create Button and Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-1">Audience Segments</h3>
          <p className="text-xs text-muted-foreground">
            Organize your contacts into segments for targeted communication
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedSegments.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className="h-9 px-4 text-sm rounded-lg font-medium"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete ({selectedSegments.length})
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 w-9"
            title="Refresh segments"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary h-9 px-4 text-sm rounded-lg font-medium"
          >
            <Plus className="h-4 w-4 mr-1 text-primary-foreground" />
            Create Segment
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Segments Table */}
      {isLoading ? (
        <div className="border border-border rounded-lg p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SegmentsTable
          segments={filteredSegments}
          selectedSegments={selectedSegments}
          onSelectionChange={setSelectedSegments}
          onDelete={handleDelete}
          onView={handleView}
        />
      )}

      {/* Create Segment Dialog */}
      <CreateSegmentDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSegmentCreated={handleSegmentCreated}
      />

      {/* Delete Segment Dialog */}
      <DeleteSegmentDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setDeletingSegments([])
        }}
        segments={deletingSegments}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  )
}
