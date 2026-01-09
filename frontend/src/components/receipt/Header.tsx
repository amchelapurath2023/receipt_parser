import { Receipt } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Receipt className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Receipt Splitter</h1>
            <p className="text-sm text-muted-foreground">Split bills with friends, fairly</p>
          </div>
        </div>
      </div>
    </header>
  );
}
