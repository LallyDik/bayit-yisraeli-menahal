import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FeedbackDialog } from '@/components/FeedbackDialog';

// Rendered on the landing page, inside the signed-in app and on both legal
// pages, so the terms stay one click away no matter where the visitor is.
export const SiteFooter = () => {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
      <p>ניהול שכירות - מערכת לניהול נכסים, שוכרים ותשלומים לבעלי דירות.</p>

      <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2" aria-label="קישורים משפטיים">
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
      </nav>

      <p className="mt-4">
        <a
          href="https://leahdick-dev.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded hover:text-foreground hover:underline"
        >
          פותח על ידי לאה דיקמן
        </a>
      </p>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  );
};
