import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';
import { absoluteUrl } from '@/config/site';

interface LegalPageProps {
  title: string;
  description: string;
  path: string;
  updatedAt: string;
  children: ReactNode;
}

// Both legal documents share this shell so each page file holds nothing but
// its own copy.
export const LegalPage = ({ title, description, path, updatedAt, children }: LegalPageProps) => (
  <div className="flex min-h-screen flex-col bg-background">
    <Helmet>
      <title>{`${title} | ניהול שכירות`}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={absoluteUrl(path)} />
      <meta property="og:url" content={absoluteUrl(path)} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
    </Helmet>

    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
      <span className="font-display text-xl">ניהול שכירות</span>
      <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        חזרה לדף הבית
      </Link>
    </header>

    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16">
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">עודכן לאחרונה: {updatedAt}</p>
      <div className="prose prose-slate mt-8 max-w-none prose-headings:font-display prose-headings:text-foreground prose-a:text-primary">
        {children}
      </div>
    </main>

    <SiteFooter />
  </div>
);
