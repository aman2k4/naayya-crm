import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Mail, MailCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

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

interface ContactsTableProps {
  contacts: Contact[]
  selectedContacts: string[]
  onSelectContact: (contactId: string) => void
  onSelectAll: (selected: boolean) => void
  onEditContact: (contact: Contact) => void
  onDeleteContact: (contact: Contact) => void
}

export function ContactsTable({
  contacts,
  selectedContacts,
  onSelectContact,
  onSelectAll,
  onEditContact,
  onDeleteContact
}: ContactsTableProps) {
  const allSelected = contacts.length > 0 && selectedContacts.length === contacts.length

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                aria-label="Select all contacts"
              />
            </TableHead>
            <TableHead>Email</TableHead>
            <TableHead>First Name</TableHead>
            <TableHead>Last Name</TableHead>
            <TableHead>Segments</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No contacts found
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedContacts.includes(contact.id)}
                    onCheckedChange={() => onSelectContact(contact.id)}
                    aria-label={`Select ${contact.email}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {contact.unsubscribed ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MailCheck className="h-4 w-4 text-green-600" />
                    )}
                    {contact.email}
                  </div>
                </TableCell>
                <TableCell>{contact.first_name || '-'}</TableCell>
                <TableCell>{contact.last_name || '-'}</TableCell>
                <TableCell>
                  {contact.audiences.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {contact.audiences.map((audience) => (
                        <Badge key={audience.id} variant="outline" className="text-xs">
                          {audience.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      No segments
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {!contact.is_active && (
                      <Badge variant="secondary" className="text-xs w-fit">
                        Deleted from Resend
                      </Badge>
                    )}
                    {contact.unsubscribed ? (
                      <Badge variant="destructive" className="text-xs w-fit">
                        Unsubscribed
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs bg-green-600 w-fit">
                        Subscribed
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditContact(contact)}
                      className="h-8 w-8 p-0"
                      disabled={!contact.is_active}
                      title={!contact.is_active ? "Cannot edit deleted contacts" : "Edit contact"}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteContact(contact)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      disabled={!contact.is_active}
                      title={!contact.is_active ? "Already deleted from Resend" : "Delete contact"}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
