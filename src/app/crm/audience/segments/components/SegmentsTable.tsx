"use client"

import { formatDistanceToNow } from "date-fns"
import { MoreHorizontal, Eye, Trash2, Users } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"

interface Segment {
  id: string
  name: string
  created_at: string
  object?: string
}

interface SegmentsTableProps {
  segments: Segment[]
  selectedSegments: string[]
  onSelectionChange: (selectedIds: string[]) => void
  onDelete?: (segment: Segment) => void
  onView?: (segment: Segment) => void
}

export function SegmentsTable({ segments, selectedSegments, onSelectionChange, onDelete, onView }: SegmentsTableProps) {
  const isAllSelected = segments.length > 0 && selectedSegments.length === segments.length
  const isSomeSelected = selectedSegments.length > 0 && selectedSegments.length < segments.length

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(segments.map(s => s.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectSegment = (segmentId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedSegments, segmentId])
    } else {
      onSelectionChange(selectedSegments.filter(id => id !== segmentId))
    }
  }

  if (segments.length === 0) {
    return (
      <div className="border border-border rounded-lg p-12 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium text-muted-foreground">No segments found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Create your first segment to organize your audience
        </p>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
                className={isSomeSelected && !isAllSelected ? "data-[state=checked]:bg-primary" : ""}
              />
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Segment ID</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Contacts</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Created</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {segments.map((segment) => (
            <TableRow key={segment.id}>
              <TableCell>
                <Checkbox
                  checked={selectedSegments.includes(segment.id)}
                  onCheckedChange={(checked) => handleSelectSegment(segment.id, checked as boolean)}
                  aria-label={`Select ${segment.name}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {segment.name}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {segment.id}
                </code>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">-</span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(segment.created_at), { addSuffix: true })}
                </span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onView && (
                      <DropdownMenuItem onClick={() => onView(segment)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDelete(segment)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Segment
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
