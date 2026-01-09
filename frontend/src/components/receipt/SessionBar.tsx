import { useState } from 'react';
import { Copy, Check, Users, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface SessionBarProps {
  sessionId: string;
  connectedUsers: number;
  isConnected: boolean;
  onJoinSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionBar({ 
  sessionId, 
  connectedUsers, 
  isConnected, 
  onJoinSession,
  onNewSession,
}: SessionBarProps) {
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const copySessionCode = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinSession = () => {
    if (joinCode.trim()) {
      onJoinSession(joinCode.trim().toUpperCase());
      setJoinCode('');
      setDialogOpen(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-card rounded-lg border shadow-sm">
      <div className="flex items-center gap-4">
        {/* Session Code Display */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Session:</span>
          <button
            onClick={copySessionCode}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md font-mono text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            {sessionId}
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-success' : 'bg-destructive'
          )} />
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {connectedUsers} {connectedUsers === 1 ? 'user' : 'users'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Join Session Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Link2 className="w-4 h-4 mr-2" />
              Join Session
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Join a Session</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Enter the 6-character session code shared by your friend.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="font-mono text-lg tracking-wider uppercase"
                />
                <Button onClick={handleJoinSession} disabled={joinCode.length < 6}>
                  Join
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="ghost" size="sm" onClick={onNewSession}>
          New Session
        </Button>
      </div>
    </div>
  );
}
