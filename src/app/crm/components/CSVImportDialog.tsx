"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Lead } from "@/types/crm";

type ConflictResolution = 'skip' | 'update' | 'merge' | 'replace';

interface ConflictInfo {
  email: string;
  existing: any;
  incoming: any;
}

interface CSVImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (newLeads: Lead[]) => void;
}

const CRM_FIELDS = [
  { field: 'email', label: 'Email', required: true, allowDefault: false },
  { field: 'first_name', label: 'First Name', required: false, allowDefault: false },
  { field: 'last_name', label: 'Last Name', required: false, allowDefault: false },
  { field: 'phone_number', label: 'Phone Number', required: false, allowDefault: false },
  { field: 'studio_name', label: 'Studio Name', required: false, allowDefault: false },
  { field: 'lead_source', label: 'Lead Source', required: false, allowDefault: true },
  { field: 'current_platform', label: 'Current Platform', required: false, allowDefault: true },
  { field: 'city', label: 'City', required: false, allowDefault: true },
  { field: 'state', label: 'State/Region', required: false, allowDefault: true },
  { field: 'country_code', label: 'Country Code', required: false, allowDefault: true },
  { field: 'response_status', label: 'Response Status', required: false, allowDefault: true },
  { field: 'notes', label: 'Notes', required: false, allowDefault: false },
  { field: 'additional_info', label: 'Additional Info', required: false, allowDefault: false }
];

export default function CSVImportDialog({ isOpen, onOpenChange, onImportComplete }: CSVImportDialogProps) {
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [conflictDecisions, setConflictDecisions] = useState<Record<string, ConflictResolution>>({});
  const [globalConflictResolution, setGlobalConflictResolution] = useState<ConflictResolution>('skip');
  const [showConflicts, setShowConflicts] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const { toast } = useToast();

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      
      // Proper CSV parsing function
      const parseCSV = (csvText: string): string[][] => {
        const result: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let insideQuotes = false;
        let i = 0;
        
        while (i < csvText.length) {
          const char = csvText[i];
          const nextChar = csvText[i + 1];
          
          if (char === '"') {
            if (insideQuotes && nextChar === '"') {
              // Escaped quote
              currentField += '"';
              i += 2;
              continue;
            } else {
              // Toggle quote state
              insideQuotes = !insideQuotes;
            }
          } else if (char === ',' && !insideQuotes) {
            // Field separator
            currentRow.push(currentField.trim());
            currentField = '';
          } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            // Row separator
            if (currentField || currentRow.length > 0) {
              currentRow.push(currentField.trim());
              if (currentRow.some(field => field !== '')) {
                result.push(currentRow);
              }
              currentRow = [];
              currentField = '';
            }
            // Skip \r\n combination
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
          } else {
            currentField += char;
          }
          
          i++;
        }
        
        // Handle last field/row
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          if (currentRow.some(field => field !== '')) {
            result.push(currentRow);
          }
        }
        
        return result;
      };
      
      const parsedData = parseCSV(text);
      
      if (parsedData.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV must have at least a header row and one data row",
          variant: "destructive"
        });
        return;
      }
      
      const headers = parsedData[0];
      const data = parsedData.slice(1);
      
      // Validate CSV structure
      const expectedColumnCount = headers.length;
      const inconsistentRows = data.filter(row => row.length !== expectedColumnCount);
      
      if (inconsistentRows.length > 0) {
        console.warn(`Found ${inconsistentRows.length} rows with inconsistent column count:`, {
          expectedColumns: expectedColumnCount,
          headers: headers,
          inconsistentRows: inconsistentRows.slice(0, 3) // Show first 3 problematic rows
        });
        
        toast({
          title: "CSV Structure Warning",
          description: `${inconsistentRows.length} rows have different column counts. This may cause parsing issues.`,
          variant: "destructive"
        });
      }
      
      // Log parsing results for debugging
      console.log('CSV parsing results:', {
        totalRows: data.length,
        headers: headers,
        headerCount: headers.length,
        sampleData: data.slice(0, 3),
        inconsistentRowCount: inconsistentRows.length
      });

      setCsvHeaders(headers);
      setCsvData(data);
      
      // Auto-map common column names (CRM field -> CSV column index)
      const autoMapping: Record<string, string> = {};
      headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('email') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['email'] = index.toString();
        } else if (lowerHeader.includes('first') && lowerHeader.includes('name') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['first_name'] = index.toString();
        } else if (lowerHeader.includes('last') && lowerHeader.includes('name') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['last_name'] = index.toString();
        } else if (lowerHeader.includes('phone') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['phone_number'] = index.toString();
        } else if (lowerHeader.includes('studio') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['studio_name'] = index.toString();
        } else if (lowerHeader.includes('source') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['lead_source'] = index.toString();
        } else if (lowerHeader.includes('platform') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['current_platform'] = index.toString();
        } else if (lowerHeader.includes('city') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['city'] = index.toString();
        } else if ((lowerHeader.includes('state') || lowerHeader.includes('region') || lowerHeader.includes('province')) && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['state'] = index.toString();
        } else if ((lowerHeader.includes('country') && (lowerHeader.includes('code') || lowerHeader.length === 2)) && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['country_code'] = index.toString();
        } else if ((lowerHeader.includes('response') && lowerHeader.includes('status')) || lowerHeader === 'status' && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['response_status'] = index.toString();
        } else if (lowerHeader.includes('note') && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['notes'] = index.toString();
        } else if ((lowerHeader.includes('additional') && lowerHeader.includes('info')) || lowerHeader === 'additional_info' && !Object.values(autoMapping).includes(index.toString())) {
          autoMapping['additional_info'] = index.toString();
        }
      });
      
      setColumnMapping(autoMapping);
    };

    reader.readAsText(file);
    // Reset the input value so the same file can be uploaded again
    event.target.value = '';
  };

  const handleColumnMapping = (crmField: string, csvColumnIndex: string) => {
    setColumnMapping(prev => {
      const newMapping = { ...prev };
      
      // Remove this CRM field's previous mapping
      delete newMapping[crmField];
      
      // Remove any other CRM field that was mapped to this CSV column
      Object.keys(newMapping).forEach(key => {
        if (newMapping[key] === csvColumnIndex) {
          delete newMapping[key];
        }
      });
      
      // Add new mapping if not "skip"
      if (csvColumnIndex !== 'skip') {
        newMapping[crmField] = csvColumnIndex;
      }
      
      return newMapping;
    });
  };

  const handleDefaultValueChange = (field: string, value: string) => {
    setDefaultValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const checkForConflicts = async () => {
    // Check if email field is mapped
    if (!columnMapping['email']) {
      toast({
        title: "Email mapping required",
        description: "Please map the Email field to a CSV column",
        variant: "destructive"
      });
      return;
    }

    setIsCheckingConflicts(true);

    try {
      const leadsToCheck = csvData.map(row => {
        const lead: any = {};
        
        // First, apply mapped CSV columns
        Object.keys(columnMapping).forEach(crmField => {
          const csvColumnIndex = columnMapping[crmField];
          if (csvColumnIndex && csvColumnIndex !== 'skip') {
            lead[crmField] = row[parseInt(csvColumnIndex)] || '';
          }
        });
        
        // Then, apply default values for empty fields
        Object.keys(defaultValues).forEach(field => {
          const defaultValue = defaultValues[field];
          if (defaultValue && (!lead[field] || lead[field].trim() === '')) {
            lead[field] = defaultValue;
          }
        });
        
        return lead;
      }).filter(lead => lead.email && lead.email.trim() !== '');

      const response = await fetch('/api/crm/leads/conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads: leadsToCheck }),
      });

      if (!response.ok) {
        throw new Error('Failed to check for conflicts');
      }

      const result = await response.json();
      setConflicts(result.conflicts || []);
      
      if (result.conflicts.length > 0) {
        setShowConflicts(true);
        toast({
          title: "Conflicts detected",
          description: `Found ${result.conflicts.length} duplicate email(s). Please choose how to handle them.`,
        });
      } else {
        // No conflicts, proceed with import
        toast({
          title: "No conflicts found",
          description: "All leads are new. Proceeding with import...",
        });
        processImport();
      }
    } catch (error) {
      console.error('Conflict check error:', error);
      toast({
        title: "Error checking conflicts",
        description: "An error occurred while checking for duplicates. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleConflictDecision = (email: string, decision: ConflictResolution) => {
    setConflictDecisions(prev => ({
      ...prev,
      [email]: decision
    }));
  };

  const applyGlobalResolution = () => {
    const newDecisions: Record<string, ConflictResolution> = {};
    conflicts.forEach(conflict => {
      newDecisions[conflict.email] = globalConflictResolution;
    });
    setConflictDecisions(newDecisions);
  };

  const processImport = async () => {
    setIsImporting(true);
    setImportProgress(0);

    try {
      const leadsToImport = csvData.map(row => {
        const lead: any = {};
        
        // First, apply mapped CSV columns
        Object.keys(columnMapping).forEach(crmField => {
          const csvColumnIndex = columnMapping[crmField];
          if (csvColumnIndex && csvColumnIndex !== 'skip') {
            lead[crmField] = row[parseInt(csvColumnIndex)] || '';
          }
        });
        
        // Then, apply default values for empty fields
        Object.keys(defaultValues).forEach(field => {
          const defaultValue = defaultValues[field];
          if (defaultValue && (!lead[field] || lead[field].trim() === '')) {
            lead[field] = defaultValue;
          }
        });
        
        return lead;
      }).filter(lead => lead.email && lead.email.trim() !== '');

      const response = await fetch('/api/crm/leads/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          leads: leadsToImport,
          conflictResolution: globalConflictResolution,
          conflictDecisions: conflictDecisions
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'Validation failed' && errorData.details) {
          // Handle validation errors specifically
          const validationErrors = Array.isArray(errorData.details) 
            ? errorData.details.slice(0, 5).join('; ') 
            : errorData.details;
          throw new Error(`Validation failed: ${validationErrors}`);
        }
        throw new Error(errorData.message || 'Import failed');
      }

      const result = await response.json();
      
      // Fetch updated leads list
      const leadsResponse = await fetch('/api/crm/leads-with-count');
      if (leadsResponse.ok) {
        const leadsResult = await leadsResponse.json();
        // Handle new API response structure
        const leadsData = leadsResult.success ? leadsResult.data.leads : [];
        onImportComplete(leadsData);
      }

      handleClose();

      toast({
        title: "Import completed",
        description: result.message,
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: "An error occurred during import. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setDefaultValues({});
    setConflicts([]);
    setConflictDecisions({});
    setShowConflicts(false);
    setGlobalConflictResolution('skip');
    setImportProgress(0);
  };


  const triggerFileUpload = () => {
    document.getElementById('csv-upload-dialog')?.click();
  };

  return (
    <>
      <input
        id="csv-upload-dialog"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvUpload}
      />
      
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {csvData.length > 0 ? `Import ${csvData.length} Leads from CSV` : 'Import Leads from CSV'}
            </DialogTitle>
          </DialogHeader>
          
          {csvHeaders.length === 0 ? (
            <div className="text-center py-6">
              <div className="mx-auto w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">Upload CSV file</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose a CSV file with leads data. First row should contain headers.
              </p>
              <Button onClick={triggerFileUpload}>
                Choose CSV File
              </Button>
            </div>
          ) : showConflicts ? (
            // Conflict Resolution Interface
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Resolve Conflicts</h3>
                  <p className="text-xs text-gray-500">
                    {conflicts.length} duplicate email(s) found. Choose resolution.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConflicts(false)}
                  disabled={isImporting || isCheckingConflicts}
                >
                  ← Back
                </Button>
              </div>

              {/* Global Resolution */}
              <div className="bg-blue-50 p-2.5 rounded border border-blue-200">
                <h4 className="text-xs font-medium text-blue-900 mb-2">Apply to All</h4>
                <div className="flex items-center space-x-2">
                  <Select value={globalConflictResolution} onValueChange={(value: ConflictResolution) => setGlobalConflictResolution(value)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="merge">Merge</SelectItem>
                      <SelectItem value="replace">Replace</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={applyGlobalResolution} variant="outline" className="h-7 px-2 text-xs">
                    Apply
                  </Button>
                </div>
              </div>

              {/* Individual Conflicts */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {conflicts.map((conflict, index) => (
                  <div key={`${conflict.email}-${index}`} className="border rounded p-2.5 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{conflict.email}</span>
                      <Select
                        value={conflictDecisions[conflict.email] || globalConflictResolution}
                        onValueChange={(value: ConflictResolution) => handleConflictDecision(conflict.email, value)}
                      >
                        <SelectTrigger className="h-6 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          <SelectItem value="update">Update</SelectItem>
                          <SelectItem value="merge">Merge</SelectItem>
                          <SelectItem value="replace">Replace</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 p-1.5 rounded">
                        <div className="font-medium text-gray-700 mb-1">Existing</div>
                        <div className="text-gray-600 space-y-0.5">
                          <div>{conflict.existing.first_name} {conflict.existing.last_name}</div>
                          <div>{conflict.existing.studio_name || 'No studio'}</div>
                        </div>
                      </div>
                      <div className="bg-blue-50 p-1.5 rounded">
                        <div className="font-medium text-blue-700 mb-1">CSV</div>
                        <div className="text-blue-600 space-y-0.5">
                          <div>{conflict.incoming.first_name} {conflict.incoming.last_name}</div>
                          <div>{conflict.incoming.studio_name || 'No studio'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerFileUpload}
                  disabled={isImporting || isCheckingConflicts}
                  className="h-8 px-3 text-xs"
                >
                  Different File
                </Button>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    disabled={isImporting || isCheckingConflicts}
                    className="h-8 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={processImport}
                    disabled={isImporting || isCheckingConflicts}
                    className="h-8 px-3 text-xs"
                  >
                    {isImporting ? 'Processing...' : `Import ${csvData.length}`}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Mapping interface
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold mb-1 text-gray-900">Map Fields</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Email required. Map CRM fields to CSV columns.
                </p>
                
                <div className="space-y-1.5">
                  {CRM_FIELDS.map((crmField) => (
                    <div key={crmField.field} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-xs">
                          {crmField.label}
                          {crmField.required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                      </div>
                      <div className="mx-2 text-gray-400 text-xs">→</div>
                      <div className="flex-1 min-w-0">
                        <Select
                          value={columnMapping[crmField.field] || 'skip'}
                          onValueChange={(value) => handleColumnMapping(crmField.field, value)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Choose column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">
                              <span className="text-gray-500">Skip</span>
                            </SelectItem>
                            {csvHeaders.map((header, index) => {
                              const isUsed = Object.values(columnMapping).includes(index.toString()) && 
                                            columnMapping[crmField.field] !== index.toString();
                              return (
                                <SelectItem 
                                  key={index} 
                                  value={index.toString()}
                                  disabled={isUsed}
                                >
                                  <div className="flex flex-col">
                                    <span className={isUsed ? 'text-gray-400' : ''}>{header}</span>
                                    <span className="text-xs text-gray-500">
                                      {csvData[0]?.[index] ? `"${csvData[0][index]}"` : 'No data'}
                                      {isUsed && ' (mapped)'}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Default Values Section */}
              <div>
                <h3 className="text-sm font-semibold mb-1 text-gray-900">Default Values</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Set default values for when CSV fields are empty or not mapped.
                </p>
                
                <div className="space-y-2">
                  {CRM_FIELDS.filter(field => field.allowDefault).map((crmField) => (
                    <div key={`default-${crmField.field}`} className="flex items-center space-x-3">
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`default-${crmField.field}`} className="text-xs font-medium text-gray-700">
                          {crmField.label}
                        </Label>
                      </div>
                      <div className="flex-2 min-w-0">
                        <Input
                          id={`default-${crmField.field}`}
                          placeholder={`Default ${crmField.label.toLowerCase()}`}
                          value={defaultValues[crmField.field] || ''}
                          onChange={(e) => handleDefaultValueChange(crmField.field, e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded p-2">
                <h3 className="text-xs font-semibold mb-1.5 text-gray-900">Preview with Defaults</h3>
                <div className="space-y-1 text-xs">
                  {csvData.slice(0, 2).map((row, rowIndex) => {
                    // Show how this row will look with mappings and defaults applied
                    const previewLead: any = {};
                    
                    // Apply mappings
                    Object.keys(columnMapping).forEach(crmField => {
                      const csvColumnIndex = columnMapping[crmField];
                      if (csvColumnIndex && csvColumnIndex !== 'skip') {
                        previewLead[crmField] = row[parseInt(csvColumnIndex)] || '';
                      }
                    });
                    
                    // Apply defaults
                    Object.keys(defaultValues).forEach(field => {
                      const defaultValue = defaultValues[field];
                      if (defaultValue && (!previewLead[field] || previewLead[field].trim() === '')) {
                        previewLead[field] = defaultValue;
                      }
                    });
                    
                    return (
                      <div key={rowIndex} className="bg-white p-2 rounded border text-xs">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-mono w-4 text-gray-500 text-xs">{rowIndex + 1}:</span>
                          <span className="font-medium text-gray-900">{previewLead.email || 'No email'}</span>
                        </div>
                        <div className="ml-6 text-gray-600 space-y-0.5">
                          {Object.entries(previewLead).slice(1).map(([field, value]) => {
                            const stringValue = String(value || '');
                            const isDefault = stringValue && defaultValues[field] === stringValue;
                            return (
                              <div key={field} className="flex">
                                <span className="w-20 text-gray-500 capitalize">{field.replace('_', ' ')}:</span>
                                <span className={isDefault ? 'text-blue-600 font-medium' : ''}>
                                  {stringValue || '-'}
                                  {isDefault && <span className="text-blue-500 ml-1">(default)</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Importing leads...</span>
                    <span>{Math.round(importProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerFileUpload}
                  disabled={isImporting || isCheckingConflicts}
                  className="h-8 px-3 text-xs"
                >
                  Different File
                </Button>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    disabled={isImporting || isCheckingConflicts}
                    className="h-8 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={checkForConflicts}
                    disabled={isCheckingConflicts || isImporting || !columnMapping['email']}
                    className="h-8 px-3 text-xs"
                  >
                    {isCheckingConflicts ? 'Checking...' : `Import ${csvData.length}`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}