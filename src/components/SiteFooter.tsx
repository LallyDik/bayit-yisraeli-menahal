import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FeedbackDialog } from '@/components/FeedbackDialog';

// Compact, colorful footer: a soft brand-gradient band with the links on one
// wrapping row and a copyright line beneath. Rendered on the landing page, the
// signed-in app and both legal pages.
export const SiteFooter = () => {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="border-t bg-gradient-to-r from-primary/10 via-secondary/15 to-accent/10 px-5 py-5 text-xs">
      <nav
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-foreground/70"
        aria-label="ניווט תחתון"
      >
        <span className="font-semibold text-primary">ניהול שכירות</span>
        <span aria-hidden="true" className="text-foreground/25">·</span>
        <Link to="/terms" className="rounded hover:text-primary hover:underline">תנאי שימוש</Link>
        <span aria-hidden="true" className="text-foreground/25">·</span>
        <Link to="/privacy" className="rounded hover:text-primary hover:underline">מדיניות פרטיות</Link>
        <span aria-hidden="true" className="text-foreground/25">·</span>
        <button
          type="button"
          className="rounded hover:text-primary hover:underline"
          onClick={() => setFeedbackOpen(true)}
        >
          שליחת משוב
        </button>
        <span aria-hidden="true" className="text-foreground/25">·</span>
        <a
          href="https://leahdick-dev.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded font-medium text-primary hover:underline"
        >
          פותח על ידי לאה דיקמן
        </a>
      </nav>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        © 2026 ניהול שכירות · כל הזכויות שמורות
      </p>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  );
};
