import { useState, useCallback } from 'react';
import { Upload, FileImage, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { endpoints } from '@/config/api';
import type { UploadStatus, ReceiptItem } from '@/types/receipt';

interface UploadZoneProps {
  onUploadSuccess: (data: {
    items: ReceiptItem[];
    subtotal: number;
    tax: number;
    total: number;
  }) => void;
  sessionId: string;
}

const statusMessages: Record<UploadStatus, string> = {
  idle: 'Drag & drop your receipt or click to upload',
  uploading: 'Uploading receipt...',
  processing: 'Analyzing receipt with AI...',
  success: 'Receipt processed successfully!',
  error: 'Failed to process receipt',
};

export function UploadZone({ onUploadSuccess, sessionId }: UploadZoneProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'application/pdf'];
    
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPEG or PDF file');
      setStatus('error');
      return;
    }
  
    // Handle Preview (Images only)
    if (file.type.startsWith('application/pdf')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null); 
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setStatus('uploading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('receipt', file);
      formData.append('session', sessionId);

      const response = await fetch(`${endpoints.upload}?session=${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setStatus('processing');

      const data = await response.json();
      
      // Transform backend response to our format
      const items: ReceiptItem[] = (data.items || []).map((item: any, index: number) => ({
        id: crypto.randomUUID(),
        name: item.item_name || `Item ${index + 1}`, 
        price: item.price || 0,
        assignedTo: [],
      }));

      setStatus('success');
      
      onUploadSuccess({
        items,
        subtotal: data.subtotal || 0,
        tax: data.tax || 0,
        total: data.total || 0,
      });

      // Reset after success
      setTimeout(() => {
        setStatus('idle');
        setPreview(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
    }
  }, [sessionId, onUploadSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const isProcessing = status === 'uploading' || status === 'processing';

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'relative border-2 border-dashed rounded-lg p-8 transition-all duration-300',
        'flex flex-col items-center justify-center min-h-[200px]',
        isDragging && 'border-primary bg-primary/5 scale-[1.02]',
        status === 'idle' && !isDragging && 'border-border hover:border-primary/50 hover:bg-muted/50',
        status === 'success' && 'border-success bg-success/5',
        status === 'error' && 'border-destructive bg-destructive/5',
        isProcessing && 'border-primary animate-pulse-border',
      )}
    >
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />

      {preview && isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <img 
            src={preview} 
            alt="Receipt preview" 
            className="max-h-32 rounded opacity-50"
          />
        </div>
      )}

      <div className="flex flex-col items-center gap-3 text-center z-10">
        {status === 'idle' && (
          <>
            <div className="p-4 rounded-full bg-muted">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">{statusMessages.idle}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports JPG, PNG, PDF up to 10MB
              </p>
            </div>
          </>
        )}

        {status === 'uploading' && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="font-medium text-foreground">{statusMessages.uploading}</p>
          </>
        )}

        {status === 'processing' && (
          <>
            <div className="relative">
              <FileImage className="w-10 h-10 text-primary" />
              <Loader2 className="w-5 h-5 text-primary animate-spin absolute -bottom-1 -right-1" />
            </div>
            <p className="font-medium text-foreground">{statusMessages.processing}</p>
            <p className="text-sm text-muted-foreground">This may take a few seconds...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-success" />
            <p className="font-medium text-success">{statusMessages.success}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="font-medium text-destructive">{error || statusMessages.error}</p>
            <button 
              onClick={() => setStatus('idle')}
              className="text-sm text-primary hover:underline mt-2"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
