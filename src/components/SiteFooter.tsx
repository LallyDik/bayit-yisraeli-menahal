import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FeedbackDialog } from '@/components/FeedbackDialog';

// Compact single-row footer: brand, legal links, feedback trigger and credit
// sit on one line and wrap only when the viewport is too narrow. Rendered on
// the landing page, the signed-in app and both legal pages.
export const SiteFooter = () => {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="border-t px-5 py-4 text-xs text-muted-foreground">
      <nav
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1"
        aria-label="ניווט תחתון"
      >
        <span className="font-medium text-foreground/80">ניהול שכירות</span>
        <span aria-hidden="true">·</span>
        <Link to="/terms" className="rounded hover:text-foreground hover:underline">תנאי שימוש</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="rounded hover:text-foreground hover:underline">מדיניות פרטיות</Link>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="rounded hover:text-foreground hover:underline"
          onClick={() => setFeedbackOpen(true)}
        >
          שליחת משוב
        </button>
        <span aria-hidden="true">·</span>
        <a
          href="https://leahdick-dev.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded hover:text-foreground hover:underline"
        >
          פותח על ידי לאה דיקמן
        </a>
      </nav>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  );
};
