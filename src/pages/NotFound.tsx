import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight, Home } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <>
    <Helmet>
      <title>עמוד לא נמצא | ניהול שכירות</title>
      <meta name="description" content="העמוד המבוקש לא נמצא במערכת ניהול השכירות. חזרו לעמוד הראשי כדי להמשיך." />
      <meta name="robots" content="noindex, follow" />
      <link rel="canonical" href={`https://nihul-schhirut.lovable.app${location.pathname}`} />
      <meta property="og:title" content="עמוד לא נמצא | ניהול שכירות" />
      <meta property="og:description" content="העמוד המבוקש לא נמצא במערכת ניהול השכירות." />
      <meta property="og:url" content={`https://nihul-schhirut.lovable.app${location.pathname}`} />
    </Helmet>
    <div className="flex min-h-screen items-center justify-center bg-background page-confetti px-5" dir="rtl">
      <div className="w-full max-w-lg rounded-[2rem] border bg-card p-8 text-center shadow-sm sm:p-12">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary"><Home className="h-7 w-7" /></span>
        <p className="font-display text-5xl nums">404</p>
        <h1 className="mt-3 font-display text-2xl">העמוד הזה לא נמצא</h1>
        <p className="mt-2 text-muted-foreground">יכול להיות שהקישור השתנה או שהכתובת אינה נכונה.</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/"><ArrowRight className="h-4 w-4" />חזרה למערכת</Link>
        </Button>
      </div>
    </div>
    </>
  );
};

export default NotFound;
