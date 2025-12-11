import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Contact {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  unsubscribed: boolean
  resend_contact_id: string
  audiences: Array<{
    id: string
    name: string
  }>
}

interface EditContactDialogProps {
  open: boolean
  contact: Contact | null
  onOpenChange: (open: boolean) => void
  onContactUpdated: () => void
}

export function EditContactDialog({
  open,
  contact,
  onOpenChange,
  onContactUpdated
}: EditContactDialogProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [unsubscribed, setUnsubscribed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Populate form when contact changes
  useEffect(() => {
    if (contact) {
      setFirstName(contact.first_name || "")
      setLastName(contact.last_name || "")
      setUnsubscribed(contact.unsubscribed)
    }
  }, [contact])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!contact) return

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/crm/contacts/${contact.resend_contact_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          unsubscribed
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to update contact')
      }

      toast({
        title: "Success",
        description: "Contact updated successfully.",
      })

      onOpenChange(false)
      onContactUpdated()

    } catch (error: any) {
      console.error('Error updating contact:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update contact. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!contact) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Email (read-only) */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={contact.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            {/* Audiences (read-only) */}
            <div className="grid gap-2">
              <Label htmlFor="audiences">Segments</Label>
              <Input
                id="audiences"
                value={contact.audiences.length > 0
                  ? contact.audiences.map(a => a.name).join(', ')
                  : 'No segments'}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Segment membership cannot be changed here
              </p>
            </div>

            {/* First Name */}
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            {/* Last Name */}
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            {/* Unsubscribed */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="unsubscribed">Unsubscribed</Label>
                <div className="text-sm text-muted-foreground">
                  Mark this contact as unsubscribed
                </div>
              </div>
              <Switch
                id="unsubscribed"
                checked={unsubscribed}
                onCheckedChange={setUnsubscribed}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
