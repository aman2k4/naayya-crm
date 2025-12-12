"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

interface CopyableCellProps {
  value: string
  displayValue?: string
  className?: string
}

export function CopyableCell({ value, displayValue, className }: CopyableCellProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div 
      className={cn(
        "flex min-w-0 items-center gap-2 group cursor-pointer",
        className
      )}
      onClick={copyToClipboard}
    >
      <span className="truncate flex-1 min-w-0">{displayValue || value}</span>
      <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-gray-500" />
        )}
      </span>
    </div>
  )
} 