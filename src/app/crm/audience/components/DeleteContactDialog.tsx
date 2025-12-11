import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertTriangle } from "lucide-react"

interface Contact {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  resend_contact_id: string
  audiences: Array<{
    id: string
    name: string
  }>
}

interface DeleteContactDialogProps {
  open: boolean
  contact: Contact | null
  onOpenChange: (open: boolean) => void
  onContactDeleted: () => void
}

export function DeleteContactDialog({
  open,
  contact,
  onOpenChange,
  onContactDeleted
}: DeleteContactDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!contact) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/crm/contacts/${contact.resend_contact_id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to delete contact')
      }

      toast({
        title: "Success",
        description: "Contact deleted successfully.",
      })

      onOpenChange(false)
      onContactDeleted()

    } catch (error: any) {
      console.error('Error deleting contact:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete contact. Please try again.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (!contact) return null

  const displayName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(' ') || contact.email

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Delete Contact</DialogTitle>
              <DialogDescription>
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this contact? This will permanently remove them from Resend and your local database.
          </p>

          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Name:</span>
              <span>{displayName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">Email:</span>
              <span>{contact.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">Segments:</span>
              <span>{contact.audiences.length > 0
                ? contact.audiences.map(a => a.name).join(', ')
                : 'No segments'}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
