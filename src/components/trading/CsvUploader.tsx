import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { parseCsvData, Candle } from '@/lib/trading';
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
    <Card className="shadow-soft rounded-2xl">
      <CardHeader>
        <CardTitle>Import Historical Data</CardTitle>
        <CardDescription>Upload a CSV file with OHLCV data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Label htmlFor="csv-upload" className="flex-1">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {file ? file.name : 'Click to browse or drag & drop'}
              </p>
            </div>
            <Input id="csv-upload" type="file" accept=".csv" ref={inputRef} onChange={handleFileChange} className="hidden" />
          </Label>
          <Button onClick={handleUpload} disabled={!file}>
            Load Data
          </Button>
        </div>
        {preview.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Data Preview</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>High</TableHead>
                  <TableHead>Low</TableHead>
                  <TableHead>Close</TableHead>
                </TableRow>
              </TableHeader>
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
      </CardContent>
    </Card>
  );
}