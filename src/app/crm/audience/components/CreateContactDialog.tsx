import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Audience {
  id: string
  name: string
}

interface CreateContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactCreated: () => void
}

export function CreateContactDialog({
  open,
  onOpenChange,
  onContactCreated
}: CreateContactDialogProps) {
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [audienceId, setAudienceId] = useState("")
  const [unsubscribed, setUnsubscribed] = useState(false)
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [isLoadingAudiences, setIsLoadingAudiences] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Fetch audiences when dialog opens
  useEffect(() => {
    if (open) {
      fetchAudiences()
    }
  }, [open])

  const fetchAudiences = async () => {
    setIsLoadingAudiences(true)
    try {
      const response = await fetch('/api/crm/audiences')
      if (!response.ok) {
        throw new Error('Failed to fetch audiences')
      }
      const data = await response.json()
      setAudiences(data.audiences?.data || [])
    } catch (error) {
      console.error('Error fetching audiences:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch audiences. Please try again.",
      })
    } finally {
      setIsLoadingAudiences(false)
    }
  }

  const resetForm = () => {
    setEmail("")
    setFirstName("")
    setLastName("")
    setAudienceId("")
    setUnsubscribed(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !audienceId) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Email and audience are required.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          audienceId,
          unsubscribed
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to create contact')
      }

      toast({
        title: "Success",
        description: "Contact created successfully.",
      })

      resetForm()
      onOpenChange(false)
      onContactCreated()

    } catch (error: any) {
      console.error('Error creating contact:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create contact. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
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

            {/* Audience */}
            <div className="grid gap-2">
              <Label htmlFor="audience">
                Audience <span className="text-destructive">*</span>
              </Label>
              <Select
                value={audienceId}
                onValueChange={setAudienceId}
                disabled={isLoadingAudiences}
              >
                <SelectTrigger id="audience">
                  <SelectValue placeholder={isLoadingAudiences ? "Loading audiences..." : "Select an audience"} />
                </SelectTrigger>
                <SelectContent>
                  {audiences.map((audience) => (
                    <SelectItem key={audience.id} value={audience.id}>
                      {audience.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              Create Contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
