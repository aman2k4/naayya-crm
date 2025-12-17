"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Lead } from "@/types/crm"
import { useToast } from "@/hooks/use-toast"
import { FileText, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

interface ExportPdfButtonProps {
  leads: Lead[]
  disabled?: boolean
}

// Dynamically import react-pdf components to avoid SSR issues
const BlobProvider = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.BlobProvider),
  { ssr: false }
)

const ColdCallListDocument = dynamic(
  () => import('./ColdCallListDocument').then((mod) => mod.ColdCallListDocument),
  { ssr: false }
)

export function ExportPdfButton({ leads, disabled }: ExportPdfButtonProps) {
  const { toast } = useToast()
  const [isClient, setIsClient] = useState(false)

  React.useEffect(() => {
    setIsClient(true)
  }, [])

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

  // Show loading state until client-side hydration is complete
  if (!isClient) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="h-9 text-xs"
      >
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Loading...
      </Button>
    )
  }

  return (
    <BlobProvider document={<ColdCallListDocument leads={leads} />}>
      {({ blob, url, loading }: { blob: Blob | null; url: string | null; loading: boolean }) => (
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
