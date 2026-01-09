import { Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PersonSummary, Person } from '@/types/receipt';

interface SplitSummaryProps {
  summaries: PersonSummary[];
  people: Person[];
  tax: number;
  total: number;
  onDownloadCSV: () => void;
}

export function SplitSummary({ 
  summaries, 
  people,
  tax, 
  total, 
  onDownloadCSV,
}: SplitSummaryProps) {
  const [copied, setCopied] = useState(false);

  const getColorIndex = (name: string) => 
    people.find(p => p.name === name)?.colorIndex || 1;

  const copyToClipboard = () => {
    const text = summaries
      .map(s => `${s.name}: $${s.total.toFixed(2)}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const grandTotal = summaries.reduce((sum, s) => sum + s.total, 0);

  if (summaries.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>Add items and assign them to people to see the split</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map((summary) => {
          const colorIndex = getColorIndex(summary.name);
          return (
            <Card 
              key={summary.name} 
              className="relative overflow-hidden"
            >
              <div 
                className="absolute top-0 left-0 right-0 h-1"
                style={{ 
                  backgroundColor: `hsl(var(--assignee-${colorIndex}))` 
                }}
              />
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  {summary.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold font-mono">
                  ${summary.total.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">${summary.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax share</span>
                    <span className="font-mono">${summary.taxShare.toFixed(2)}</span>
                  </div>
                </div>
                {summary.items.length > 0 && (
                  <div className="pt-2 border-t mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Items:</p>
                    <ul className="text-xs space-y-0.5">
                      {summary.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span className="truncate mr-2">{item.name}</span>
                          <span className="font-mono">
                            ${(item.price / item.split).toFixed(2)}
                            {item.split > 1 && (
                              <span className="text-muted-foreground ml-1">
                                (/{item.split})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Totals */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex gap-6 text-sm">
                <span className="text-muted-foreground">
                  Tax: <span className="font-mono text-foreground">${tax.toFixed(2)}</span>
                </span>
                <span className="text-muted-foreground">
                  Receipt Total: <span className="font-mono text-foreground">${total.toFixed(2)}</span>
                </span>
                <span className="text-muted-foreground">
                  Split Total: <span className="font-mono text-foreground">${grandTotal.toFixed(2)}</span>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button size="sm" onClick={onDownloadCSV}>
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
