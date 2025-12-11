"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface CreateSegmentDialogProps {
  isOpen: boolean
  onClose: () => void
  onSegmentCreated: () => void
}

export function CreateSegmentDialog({ isOpen, onClose, onSegmentCreated }: CreateSegmentDialogProps) {
  const [segmentName, setSegmentName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const handleCreate = async () => {
    if (!segmentName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a segment name",
      })
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/crm/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: segmentName }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || "Failed to create segment")
      }

      toast({
        title: "Segment Created",
        description: `Successfully created segment "${segmentName}"`,
      })

      setSegmentName("")
      onClose()
      onSegmentCreated()
    } catch (error: any) {
      console.error("Error creating segment:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create segment. Please try again.",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Segment</DialogTitle>
          <DialogDescription>
            Create a new audience segment to organize your contacts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="segment-name">Segment Name</Label>
            <Input
              id="segment-name"
              placeholder="e.g., Newsletter Subscribers"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isCreating) {
                  handleCreate()
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !segmentName.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Segment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
