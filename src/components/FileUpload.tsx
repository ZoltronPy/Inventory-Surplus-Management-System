import { useState, useRef } from 'react'
import { Upload, FileType, CheckCircle2, AlertCircle, X } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { cn } from '../lib/utils'

interface FileUploadProps {
  onDataLoaded: (data: any[], type: string) => void
  type: 'items' | 'stock' | 'orders' | 'forecast'
  title: string
  description: string
}

export default function FileUpload({ onDataLoaded, type, title, description }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) processFile(droppedFile)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) processFile(selectedFile)
  }

  const processFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension !== 'csv' && extension !== 'xlsx' && extension !== 'xls') {
      setStatus('error')
      setErrorMessage('Please upload a CSV or Excel file.')
      return
    }

    setFile(file)
    setStatus('parsing')
    
    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          onDataLoaded(results.data, type)
          setStatus('success')
        },
        error: (err) => {
          setStatus('error')
          setErrorMessage(`Error parsing CSV: ${err.message}`)
        }
      })
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          onDataLoaded(jsonData, type)
          setStatus('success')
        } catch (err) {
          setStatus('error')
          setErrorMessage('Error parsing Excel file.')
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const reset = () => {
    setFile(null)
    setStatus('idle')
    setErrorMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b bg-muted/30">
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      
      <div 
        className={cn(
          "p-8 flex flex-col items-center justify-center border-2 border-dashed m-4 rounded-lg transition-all",
          isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50",
          status === 'success' && "border-green-500/50 bg-green-500/5",
          status === 'error' && "border-destructive/50 bg-destructive/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => status === 'idle' && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
        />

        {status === 'idle' && (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Click or drag file to upload</p>
            <p className="text-xs text-muted-foreground mt-1">Supports CSV, XLSX</p>
          </>
        )}

        {status === 'parsing' && (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium">Processing {file?.name}...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
            <p className="text-sm font-medium">{file?.name} loaded successfully</p>
            <button 
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="mt-4 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Remove and try again
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center text-center px-4">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-sm font-medium text-destructive">{errorMessage}</p>
            <button 
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="mt-4 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
