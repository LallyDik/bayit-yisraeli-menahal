import {
  Users, WalletCards, Gauge, CalendarClock, Mail, FileText,
  Home, UserPlus, CircleCheckBig,
  Languages, CalendarDays, BellRing,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Auth } from '@/components/Auth';
import { SiteFooter } from '@/components/SiteFooter';

const scrollTo = (id: string) => () => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
};

const FEATURES = [
  {
    icon: Users,
    tint: 'bg-primary/15 text-primary',
    title: 'שוכרים ודירות במקום אחד',
    body: 'כל דירה, כל שוכר וכל שיוך - מסודר וברור. רואים מי גר איפה, מה שכר הדירה ומתי מתחיל החוזה.',
  },
  {
    icon: WalletCards,
    tint: 'bg-secondary text-secondary-foreground',
    title: 'מעקב תשלומי שכר דירה',
    body: 'מי שילם, כמה נשאר ומתי מגיע החיוב הבא - עם פס התקדמות לכל תשלום, בלי גיליונות אקסל.',
  },
  {
    icon: Gauge,
    tint: 'bg-accent/60 text-accent-foreground',
    title: 'חשמל, מים וגז לפי מונה',
    body: 'מזינים קריאת מונה והמערכת מחשבת את החיוב אוטומטית - או סכום קבוע, כפי שנוח לכם.',
  },
  {
    icon: CalendarClock,
    tint: 'bg-primary/15 text-primary',
    title: 'לוח שנה עברי ולועזי',
    body: 'מועדי חיוב לפי הלוח שמתאים לכם - עברי או לועזי - עם ציון המועד הבא לכל תשלום.',
  },
  {
    icon: Mail,
    tint: 'bg-secondary text-secondary-foreground',
    title: 'תזכורות תשלום במייל',
    body: 'מקבלים מייל תקופתי על חיובים שהגיע מועדם ועדיין לא שולמו - כדי לא לפספס אף תשלום.',
  },
  {
    icon: FileText,
    tint: 'bg-accent/60 text-accent-foreground',
    title: 'מסמכים וחוזים במקום אחד',
    body: 'מצרפים חוזה, קבלה או כל מסמך לכל דירה ולכל שוכר - נגיש בדיוק כשצריך.',
  },
];

const BENEFITS = [
  { icon: Languages, label: 'בעברית מלאה' },
  { icon: CalendarDays, label: 'לוח עברי ולועזי' },
  { icon: BellRing, label: 'תזכורות אוטומטיות' },
];

const STEPS = [
  { icon: Home, title: 'מוסיפים דירה', body: 'רושמים את הדירות שלכם. שם הדירה זה כל מה שצריך כדי להתחיל.' },
  { icon: UserPlus, title: 'משייכים שוכר', body: 'מוסיפים שוכר, בוחרים דירה וקובעים שכר דירה ותאריך כניסה.' },
  { icon: CircleCheckBig, title: 'עוקבים ומסמנים', body: 'רואים מי שילם ומה נשאר, מסמנים תשלומים, ומקבלים תזכורת במייל.' },
];

export const LandingPage = () => (
  <div className="min-h-screen bg-background page-confetti">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <span className="font-display text-xl">ניהול שכירות</span>
      <Button variant="outline" size="sm" className="rounded-full bg-white/70" onClick={scrollTo('login')}>
        התחברות
      </Button>
    </header>

    <main>
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:pb-24 sm:pt-16">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/30" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/4 h-40 w-40 rotate-12 rounded-[2.5rem] bg-secondary/60" aria-hidden="true" />
        <div className="absolute -left-10 top-24 h-24 w-24 rounded-full bg-accent/50" aria-hidden="true" />
        <div className="absolute right-1/3 top-4 h-10 w-10 rotate-6 rounded-xl bg-primary/40" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-4 py-1.5 text-sm font-medium text-primary">
            <Home className="h-4 w-4" aria-hidden="true" />
            לבעלי דירות שמנהלים בעצמם
          </span>
          <h1 className="mt-5 font-display text-4xl leading-tight sm:text-6xl">מערכת ניהול שכירות<br />לבעלי דירות</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-foreground/70">
            שוכרים, דירות ותשלומים - שכר דירה, חשמל, מים וגז - הכול במקום אחד, פשוט ובעברית.
            רואים מי שילם, מה נשאר ומתי מגיע החיוב הבא.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="rounded-full" onClick={scrollTo('login')}>התחילו עכשיו</Button>
            <Button size="lg" variant="outline" className="rounded-full bg-white/70" onClick={scrollTo('features')}>איך זה עובד</Button>
          </div>
        </div>
      </section>

      {/* Benefits strip */}
      <section className="px-5">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 rounded-[2rem] bg-gradient-to-l from-primary/10 via-secondary/20 to-accent/15 p-4 sm:grid-cols-3 sm:gap-4 sm:p-5">
          {BENEFITS.map((item) => (
            <div key={item.label} className="flex items-center justify-center gap-2 rounded-2xl bg-white/60 px-3 py-3 text-center text-sm font-medium text-foreground/80">
              <item.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {item.label}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-14">
        <h2 className="text-center font-display text-3xl">כל ניהול השכירות - בלי אקסל</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
          מערכת אחת שמחליפה את הפתקים והגיליונות: ניהול נכסים, שוכרים ומעקב תשלומים שוטף.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="flex gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${feature.tint}`}>
                <feature.icon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-display text-lg leading-tight">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden bg-secondary/25 py-16">
        <div className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-primary/10" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5">
          <h2 className="text-center font-display text-3xl">שלושה צעדים ואתם מסודרים</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            מקימים את המערכת בכמה דקות - בלי הגדרות מסובכות.
          </p>
          <ol className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative rounded-3xl border bg-card p-6 shadow-sm">
                <span className="absolute -top-4 end-6 flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display text-lg text-primary-foreground shadow-md">
                  {index + 1}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/50 text-accent-foreground">
                  <step.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-display text-xl leading-tight">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-5 py-16">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-primary px-6 py-12 text-center text-primary-foreground sm:px-10 sm:py-14">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -bottom-14 left-1/4 h-40 w-40 rotate-12 rounded-[2.5rem] bg-white/10" aria-hidden="true" />
          <div className="relative">
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">מוכנים לעשות סדר בשכירות?</h2>
            <p className="mx-auto mt-3 max-w-lg text-primary-foreground/85">
              פותחים חשבון ומתחילים לנהל את הדירות, השוכרים והתשלומים במקום אחד.
            </p>
            <Button size="lg" variant="secondary" className="mt-7 rounded-full" onClick={scrollTo('login')}>
              התחילו עכשיו
            </Button>
          </div>
        </div>
      </section>

      {/* Login */}
      <section id="login" className="scroll-mt-6 px-5 pb-12">
        <h2 className="mb-6 text-center font-display text-3xl">מתחילים לעשות סדר</h2>
        <Auth />
      </section>
    </main>

    <SiteFooter />
  </div>
);
