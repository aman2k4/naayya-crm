import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { Lead } from '@/types/crm'

interface ColdCallListDocumentProps {
  leads: Lead[]
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingBottom: 50,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '2pt solid #111827',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  headerRight: {
    textAlign: 'right',
  },
  headerDate: {
    fontSize: 9,
    color: '#374151',
  },
  headerCount: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
  leadCard: {
    marginBottom: 12,
    border: '1pt solid #D1D5DB',
    borderRadius: 4,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderBottom: '1pt solid #D1D5DB',
  },
  leadNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  leadName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  leadStudio: {
    fontSize: 10,
    color: '#374151',
  },
  leadBody: {
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 80,
    fontSize: 8,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  value: {
    flex: 1,
    fontSize: 9,
    color: '#111827',
  },
  valueBold: {
    flex: 1,
    fontSize: 9,
    color: '#111827',
    fontWeight: 'bold',
  },
  notesSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1pt solid #E5E7EB',
  },
  notesLabel: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 8,
    color: '#374151',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1pt solid #D1D5DB',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#9CA3AF',
  },
  pageNumber: {
    fontSize: 7,
    color: '#9CA3AF',
  },
})

export function ColdCallListDocument({ leads }: ColdCallListDocumentProps) {
  const formatLocation = (lead: Lead) => {
    const parts = [lead.city, lead.state, lead.country_code].filter(Boolean)
    return parts.join(', ') || '-'
  }

  const formatName = (lead: Lead) => {
    const parts = [lead.first_name, lead.last_name].filter(Boolean)
    return parts.join(' ') || '-'
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Cold Call List</Text>
            <Text style={styles.subtitle}>Lead contact information for outreach</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>Generated: {format(new Date(), 'dd MMM yyyy, HH:mm')}</Text>
            <Text style={styles.headerCount}>Total Leads: {leads.length}</Text>
          </View>
        </View>

        {/* Lead Cards */}
        {leads.map((lead, index) => (
          <View key={lead.id} style={styles.leadCard} wrap={false}>
            {/* Card Header */}
            <View style={styles.leadHeader}>
              <View>
                <Text style={styles.leadNumber}>#{index + 1}</Text>
                <Text style={styles.leadName}>{formatName(lead)}</Text>
                {lead.studio_name && <Text style={styles.leadStudio}>{lead.studio_name}</Text>}
              </View>
            </View>

            {/* Card Body */}
            <View style={styles.leadBody}>
              {/* Phone */}
              <View style={styles.row}>
                <Text style={styles.label}>Phone:</Text>
                <Text style={styles.valueBold}>{lead.phone_number || '-'}</Text>
              </View>

              {/* Email */}
              <View style={styles.row}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{lead.email}</Text>
              </View>

              {/* Location */}
              <View style={styles.row}>
                <Text style={styles.label}>Location:</Text>
                <Text style={styles.value}>{formatLocation(lead)}</Text>
              </View>

              {/* Platform */}
              <View style={styles.row}>
                <Text style={styles.label}>Platform:</Text>
                <Text style={styles.value}>{lead.current_platform || '-'}</Text>
              </View>

              {/* Notes */}
              {lead.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>Notes:</Text>
                  <Text style={styles.notesText}>{lead.notes}</Text>
                </View>
              )}

              {/* Additional Info */}
              {lead.additional_info && (
                <View style={lead.notes ? {} : styles.notesSection}>
                  <Text style={styles.notesLabel}>Additional Info:</Text>
                  <Text style={styles.notesText}>{lead.additional_info}</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Naayya CRM - Confidential</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
