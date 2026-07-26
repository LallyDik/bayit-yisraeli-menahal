import { useState } from 'react';
import { toast } from 'sonner';
import { LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MAX_LENGTH = 2000;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedbackDialog = ({ open, onOpenChange }: FeedbackDialogProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (message.trim() === '') return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('submit-feedback', {
        body: {
          message,
          email: user ? undefined : email,
          page: `${window.location.pathname}${window.location.search}`,
          website,
        },
      });
      if (error) throw error;
      toast.success('תודה! המשוב נשלח.');
      setMessage('');
      setEmail('');
      onOpenChange(false);
    } catch {
      // The dialog stays open with the typed text intact so nothing is lost.
      toast.error('לא הצלחנו לשלוח את המשוב. נסו שוב.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">שליחת משוב</DialogTitle>
          <DialogDescription>
            מה עובד, מה חסר ומה מעצבן? כל הערה עוזרת.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-message">ההודעה שלך</Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_LENGTH}
              required
              rows={5}
              placeholder="כתבו כאן..."
            />
            <p className="text-end text-xs text-muted-foreground">{message.length} / {MAX_LENGTH}</p>
          </div>

          {!user && (
            <div className="space-y-2">
              <Label htmlFor="feedback-email">כתובת מייל (לא חובה)</Label>
              <Input
                id="feedback-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="כדי שנוכל לחזור אליכם"
              />
            </div>
          )}

          {/* Honeypot: hidden from people and from screen readers, visible to bots. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="feedback-website">Website</label>
            <input
              id="feedback-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={sending} aria-busy={sending}>
            {sending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {sending ? 'שולח...' : 'שליחה'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
