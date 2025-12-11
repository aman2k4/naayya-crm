"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Lead } from "@/types/crm"
import { useToast } from "@/hooks/use-toast"
import { BlobProvider } from '@react-pdf/renderer'
import { ColdCallListDocument } from './ColdCallListDocument'
import { FileText, Loader2 } from 'lucide-react'

interface ExportPdfButtonProps {
  leads: Lead[]
  disabled?: boolean
}

export function ExportPdfButton({ leads, disabled }: ExportPdfButtonProps) {
  const { toast } = useToast()

  const handleDownload = (blob: Blob | null, url: string | null) => {
    if (!blob || !url) {
      toast({
        title: "Error",
        description: "PDF is still generating. Please wait.",
        variant: "destructive",
      })
      return
    }

    const a = document.createElement('a')
    a.href = url
    a.download = `cold-call-list-${format(new Date(), 'yyyy-MM-dd')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    toast({
      title: "Downloaded",
      description: `PDF with ${leads.length} leads exported`,
    })
  }

  if (leads.length === 0) {
    return null
  }

  return (
    <BlobProvider document={<ColdCallListDocument leads={leads} />}>
      {({ blob, url, loading, error }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownload(blob, url)}
          disabled={disabled || loading}
          className="h-9 text-xs"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <FileText className="w-3 h-3 mr-1" />
          )}
          {loading ? 'Generating...' : `PDF (${leads.length})`}
        </Button>
      )}
    </BlobProvider>
  )
}
