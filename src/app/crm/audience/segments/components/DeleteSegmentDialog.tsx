"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Loader2 } from "lucide-react"

interface Segment {
  id: string
  name: string
  created_at: string
}

interface DeleteSegmentDialogProps {
  isOpen: boolean
  onClose: () => void
  segments: Segment[]
  onConfirm: () => Promise<void>
  isDeleting: boolean
}

export function DeleteSegmentDialog({
  isOpen,
  onClose,
  segments,
  onConfirm,
  isDeleting,
}: DeleteSegmentDialogProps) {
  const [confirmText, setConfirmText] = useState("")
  const isConfirmValid = confirmText === "DELETE"
  const isMultiple = segments.length > 1

  // Reset confirmation text when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText("")
    }
  }, [isOpen])

  if (segments.length === 0) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Delete {isMultiple ? 'Segments' : 'Segment'}</DialogTitle>
              <DialogDescription className="mt-1">
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {isMultiple ? (
              <>
                Are you sure you want to delete <span className="font-medium text-foreground">{segments.length} segments</span>?
              </>
            ) : (
              <>
                Are you sure you want to delete the segment{" "}
                <span className="font-medium text-foreground">"{segments[0].name}"</span>?
              </>
            )}
          </p>
          {isMultiple && (
            <div className="max-h-32 overflow-y-auto border border-border rounded-md p-2">
              <ul className="text-xs space-y-1">
                {segments.map((segment) => (
                  <li key={segment.id} className="text-muted-foreground">
                    • {segment.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            This will remove the {isMultiple ? 'segments' : 'segment'} from Resend, but will not delete any contacts.
          </p>

          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm font-medium">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting || !isConfirmValid}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete ${isMultiple ? `${segments.length} Segments` : 'Segment'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
