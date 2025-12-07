import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { parseCsvData, Candle } from '@/lib/trading';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
interface CsvUploaderProps {
  onDataLoaded: (candles: Candle[]) => void;
}
export function CsvUploader({ onDataLoaded }: CsvUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Candle[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv') {
        toast.error('Invalid File Type', { description: 'Please upload a CSV file.' });
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const candles = parseCsvData(text);
          if (candles.length < 10) {
            toast.warning('Not Enough Data', { description: 'CSV should contain at least 10 data rows.' });
          }
          setPreview(candles.slice(0, 10));
        } catch (error) {
          toast.error('Parsing Error', { description: 'Could not parse the CSV file. Check format.' });
          setPreview([]);
        }
      };
      reader.readAsText(selectedFile);
    }
  };
  const handleUpload = () => {
    if (!file) {
      toast.info('No file selected.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const candles = parseCsvData(text);
      if (candles.length < 100) {
        toast.error('Insufficient Data', { description: 'A minimum of 100 candles is required for a meaningful backtest.' });
        return;
      }
      onDataLoaded(candles);
      toast.success('Data Loaded', { description: `${candles.length} candles have been imported.` });
    };
    reader.readAsText(file);
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Upload CSV</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Import Historical Data from CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => inputRef.current?.click()}>
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{file ? file.name : 'Click to browse or drag & drop'}</p>
            <Input id="csv-upload" type="file" accept=".csv" ref={inputRef} onChange={handleFileChange} className="hidden" />
          </div>
          {preview.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Data Preview</h4>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Open</TableHead><TableHead>High</TableHead><TableHead>Low</TableHead><TableHead>Close</TableHead></TableRow></TableHeader>
                <TableBody>
                  {preview.map((candle) => (
                    <TableRow key={candle.timestamp}>
                      <TableCell>{new Date(candle.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell>{candle.open.toFixed(2)}</TableCell>
                      <TableCell>{candle.high.toFixed(2)}</TableCell>
                      <TableCell>{candle.low.toFixed(2)}</TableCell>
                      <TableCell>{candle.close.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
          <DialogClose asChild><Button onClick={handleUpload} disabled={!file}>Load Data</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}