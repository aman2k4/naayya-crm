"use client"

import { useEffect, useState } from "react"
import { ContactsTable } from "./components/ContactsTable"
import { CreateContactDialog } from "./components/CreateContactDialog"
import { EditContactDialog } from "./components/EditContactDialog"
import { DeleteContactDialog } from "./components/DeleteContactDialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Contact {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  unsubscribed: boolean
  resend_contact_id: string
  contact_created_at: string
  synced_at: string
  is_active: boolean
  audiences: Array<{
    id: string
    name: string
  }>
}

interface Audience {
  id: string
  name: string
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAudience, setSelectedAudience] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalContacts, setTotalContacts] = useState(0)
  const [limit, setLimit] = useState(25)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchAudiences()
  }, [])

  useEffect(() => {
    fetchContacts()
  }, [searchQuery, selectedAudience, selectedStatus, currentPage, limit])

  const fetchAudiences = async () => {
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
        description: "Failed to fetch audiences.",
      })
    }
  }

  const fetchContacts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })

      if (searchQuery) {
        params.append('search', searchQuery)
      }

      if (selectedAudience && selectedAudience !== 'all') {
        params.append('audienceId', selectedAudience)
      }

      if (selectedStatus) {
        params.append('status', selectedStatus)
      }

      const response = await fetch(`/api/crm/contacts?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }

      const data = await response.json()
      setContacts(data.contacts || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalContacts(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error fetching contacts:', error)
      setContacts([])
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch contacts. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedContacts(selected ? contacts.map(c => c.id) : [])
  }

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact)
    setIsEditDialogOpen(true)
  }

  const handleDeleteContact = (contact: Contact) => {
    setSelectedContact(contact)
    setIsDeleteDialogOpen(true)
  }

  const handleContactCreated = () => {
    fetchContacts()
    setSelectedContacts([])
  }

  const handleContactUpdated = () => {
    fetchContacts()
    setSelectedContacts([])
  }

  const handleContactDeleted = () => {
    fetchContacts()
    setSelectedContacts([])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your Resend contacts and audiences
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={selectedStatus}
          onValueChange={(value) => {
            setSelectedStatus(value)
            setCurrentPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active in Resend</SelectItem>
            <SelectItem value="deleted">Deleted from Resend</SelectItem>
            <SelectItem value="all">All Contacts</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedAudience}
          onValueChange={(value) => {
            setSelectedAudience(value)
            setCurrentPage(1)
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Audiences" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Audiences</SelectItem>
            {audiences.map((audience) => (
              <SelectItem key={audience.id} value={audience.id}>
                {audience.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={limit.toString()}
          onValueChange={(value) => {
            setLimit(parseInt(value))
            setCurrentPage(1)
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          selectedStatus === 'active'
            ? `Showing ${contacts.length} of ${totalContacts} active contacts`
            : selectedStatus === 'deleted'
            ? `Showing ${contacts.length} of ${totalContacts} deleted contacts`
            : `Showing ${contacts.length} of ${totalContacts} contacts (all statuses)`
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <ContactsTable
          contacts={contacts}
          selectedContacts={selectedContacts}
          onSelectContact={handleSelectContact}
          onSelectAll={handleSelectAll}
          onEditContact={handleEditContact}
          onDeleteContact={handleDeleteContact}
        />
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateContactDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onContactCreated={handleContactCreated}
      />

      <EditContactDialog
        open={isEditDialogOpen}
        contact={selectedContact}
        onOpenChange={setIsEditDialogOpen}
        onContactUpdated={handleContactUpdated}
      />

      <DeleteContactDialog
        open={isDeleteDialogOpen}
        contact={selectedContact}
        onOpenChange={setIsDeleteDialogOpen}
        onContactDeleted={handleContactDeleted}
      />
    </div>
  )
}
