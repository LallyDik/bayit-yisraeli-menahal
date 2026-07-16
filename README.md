# מערכת ניהול שכירות

מערכת RTL לניהול יחידות, שוכרים, תקופות שכירות ותשלומים. המערכת כוללת מעקב שכירות חודשי, תשלומים חלקיים, חשמל ומים לפי מונה, חיובים קבועים וארכיון השומר את היסטוריית השכירות.

## פיתוח מקומי

נדרשים Node.js ו־npm.

```sh
npm install
npm run dev
```

בדיקות ובניית production:

```sh
npm test
npx tsc --noEmit
npm run build
```

## טכנולוגיות

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase Auth, Postgres, Storage ו־RLS
- TanStack Query

## משתני סביבה

יש להגדיר בקובץ `.env` מקומי:

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

אין לשמור מפתחות סודיים או `service_role` בקוד הלקוח.
