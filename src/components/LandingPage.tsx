import { Users, WalletCards, Gauge, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Auth } from '@/components/Auth';

const scrollTo = (id: string) => () => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

const FEATURES = [
  {
    icon: Users,
    title: 'שוכרים ויחידות במקום אחד',
    body: 'כל דירה, כל שוכר וכל שיוך — מסודר וברור. רואים מי גר איפה, מה שכר הדירה ומתי מתחיל החוזה.',
  },
  {
    icon: WalletCards,
    title: 'מעקב תשלומי שכר דירה',
    body: 'מי שילם, כמה נשאר ומתי מגיע החיוב הבא — עם פס התקדמות לכל תשלום, בלי גיליונות אקסל.',
  },
  {
    icon: Gauge,
    title: 'חשמל, מים וגז לפי מונה',
    body: 'מזינים קריאת מונה והמערכת מחשבת את החיוב אוטומטית — או סכום קבוע, כפי שנוח לכם.',
  },
  {
    icon: CalendarClock,
    title: 'לוח שנה עברי ולועזי',
    body: 'מועדי חיוב לפי הלוח שמתאים לכם — עברי או לועזי — עם ציון המועד הבא לכל תשלום.',
  },
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
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl leading-tight sm:text-6xl">מערכת ניהול שכירות<br />לבעלי דירות</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-foreground/70">
            שוכרים, יחידות ותשלומים — שכר דירה, חשמל, מים וגז — הכול במקום אחד, פשוט ובעברית.
            רואים מי שילם, מה נשאר ומתי מגיע החיוב הבא.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="rounded-full" onClick={scrollTo('login')}>התחילו עכשיו — בחינם</Button>
            <Button size="lg" variant="outline" className="rounded-full bg-white/70" onClick={scrollTo('features')}>איך זה עובד</Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-12">
        <h2 className="text-center font-display text-3xl">כל ניהול השכירות — בלי אקסל</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
          מערכת אחת שמחליפה את הפתקים והגיליונות: ניהול נכסים, שוכרים ומעקב תשלומים שוטף.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="flex gap-4 rounded-2xl border bg-card p-5 shadow-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
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

      {/* Login */}
      <section id="login" className="scroll-mt-6 px-5 py-12">
        <h2 className="mb-6 text-center font-display text-3xl">מתחילים לעשות סדר</h2>
        <Auth />
      </section>
    </main>

    <footer className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
      <p>ניהול שכירות — מערכת לניהול נכסים, שוכרים ותשלומים לבעלי דירות.</p>
    </footer>
  </div>
);
