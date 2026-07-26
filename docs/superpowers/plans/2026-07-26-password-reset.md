# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user who forgot their password reset it: a "forgot password" link on the Auth screen, a Supabase reset email, and a `/reset-password` page to set a new password.

**Architecture:** Two thin `useAuth` methods wrap `supabase.auth.resetPasswordForEmail` and `supabase.auth.updateUser`. The Auth card gains a third `mode` ('login' | 'signup' | 'reset') for the request form. A dedicated `/reset-password` route renders a page that relies on the temporary session Supabase opens from the recovery link, then calls `updatePassword`.

**Tech Stack:** React 18 + TypeScript + Vite, react-router-dom v6, react-helmet-async, shadcn/ui, sonner (toasts), Supabase Auth.

## Global Constraints

- **Language/direction:** all UI strings Hebrew, app is RTL. Use logical CSS props (`ps-`/`pe-`/`start-`/`end-`), never `pl-`/`pr-`/`left-`/`right-`.
- **Supabase client import:** `import { supabase } from '@/lib/supabase';` (NOT `@/integrations/...`).
- **Neutral reset-request message (verbatim):** `אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס.` — shown on success regardless of whether the email exists (no account enumeration).
- **redirectTo is runtime-derived:** `` `${window.location.origin}/reset-password` `` — never hardcode the domain, so the link always targets the current host.
- **Password minimum:** 6 characters (matches `Auth.tsx` signup: `minLength={6}`).
- **Routes go ABOVE the catch-all** `<Route path="*">` in `src/App.tsx`.
- **No React unit-test harness** in this repo (Vitest `environment: 'node'`, no jsdom/RTL — do NOT add them). Verification is `npx tsc --noEmit`, `npm run build`, and manual end-to-end. `npx tsc --noEmit` type-checks `src/` only.

---

### Task 1: useAuth methods + Auth.tsx reset-request mode

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/components/Auth.tsx`

**Interfaces:**
- Consumes: the existing `supabase` client and `useAuth()` context.
- Produces: `requestPasswordReset(email: string): Promise<void>` and `updatePassword(password: string): Promise<void>` on the auth context (Task 2's page uses `updatePassword`).

- [ ] **Step 1: Add the two methods to `useAuth.ts`**

In `src/hooks/useAuth.ts`, add to the `AuthContextType` interface (after `signUp`):

```ts
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
```

In `useAuthProvider`, add these two functions next to `signUp`:

```ts
  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };
```

And add both to the returned object:

```ts
  return { user, loading, signIn, signInWithGoogle, signUp, requestPasswordReset, updatePassword, completeOnboarding, signOut };
```

- [ ] **Step 2: Convert Auth.tsx from `isLogin` to a three-way `mode`**

In `src/components/Auth.tsx`, replace the `isLogin` state with:

```tsx
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [resetSent, setResetSent] = useState(false);
```

Pull the new context method in the destructure:

```tsx
  const { signIn, signInWithGoogle, signUp, requestPasswordReset } = useAuth();
```

- [ ] **Step 3: Handle the three submit paths**

Replace `handleSubmit` so it branches on `mode`. For `reset` it always shows the neutral message:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'reset') {
        await requestPasswordReset(email);
        setResetSent(true);
        toast.success('אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס.');
      } else if (mode === 'login') {
        await signIn(email, password);
        toast.success('התחברת בהצלחה');
      } else {
        await signUp(email, password);
        toast.success('החשבון נוצר בהצלחה');
      }
    } catch (error) {
      // A reset request must not reveal whether the address exists: show the
      // same neutral confirmation even on error (rate-limit errors excepted are
      // not worth leaking either).
      if (mode === 'reset') {
        setResetSent(true);
        toast.success('אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס.');
      } else {
        toast.error(authErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 4: Render the reset mode**

Update the JSX. The subtitle line and the password field are conditioned on mode; the Google button and divider show only for login/signup (not reset). Concretely:

- Subtitle (`<p className="text-muted-foreground">`):

```tsx
            {mode === 'login' && 'רואים מי שילם ומה עדיין נשאר פתוח.'}
            {mode === 'signup' && 'פותחים חשבון ומתחילים לעשות סדר.'}
            {mode === 'reset' && 'הזינו את כתובת המייל ונשלח קישור לאיפוס הסיסמה.'}
```

- Wrap the Google button + the "או עם מייל" divider so they render only when `mode !== 'reset'`.

- After the email field, render the password field only when `mode !== 'reset'`:

```tsx
            {mode !== 'reset' && (
              <div className="space-y-2">
                {/* existing password label + input block, unchanged */}
              </div>
            )}
```

- The submit button label:

```tsx
              {loading ? 'מעבד...' : mode === 'login' ? 'התחבר' : mode === 'signup' ? 'צור חשבון' : 'שליחת קישור לאיפוס'}
```

- When `mode === 'reset' && resetSent`, replace the form body with the confirmation and a back link (so the user isn't left staring at the form):

```tsx
          {mode === 'reset' && resetSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס. בדקו את תיבת הדואר (וגם את הספאם).</p>
              <Button type="button" variant="link" className="text-primary" onClick={() => { setMode('login'); setResetSent(false); }}>
                חזרה להתחברות
              </Button>
            </div>
          ) : (
            /* the <form> ... </form> */
          )}
```

- [ ] **Step 5: Add the mode-switch links at the bottom**

Replace the single toggle link block with mode-aware links:

```tsx
          <div className="mt-4 space-y-1 text-center">
            {mode === 'login' && (
              <>
                <Button variant="link" onClick={() => setMode('signup')} className="text-primary">אין לך חשבון? צור חשבון חדש</Button>
                <div>
                  <Button variant="link" onClick={() => { setMode('reset'); setResetSent(false); }} className="text-muted-foreground">שכחתי סיסמה</Button>
                </div>
              </>
            )}
            {mode === 'signup' && (
              <Button variant="link" onClick={() => setMode('login')} className="text-primary">יש לך חשבון? התחבר</Button>
            )}
            {mode === 'reset' && !resetSent && (
              <Button variant="link" onClick={() => setMode('login')} className="text-primary">חזרה להתחברות</Button>
            )}
          </div>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass. Then `npm run dev`, open the Auth screen (sign out first if needed), confirm: "שכחתי סיסמה" appears in login mode; clicking it hides the password field + Google button and shows the email-only reset form; submitting a real address shows the neutral message and (check inbox) sends a reset email. The email link will 404 until Task 2 — expected.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useAuth.ts src/components/Auth.tsx
git commit -m "feat(auth): forgot-password request flow on the sign-in screen"
```

---

### Task 2: /reset-password page and route

**Files:**
- Create: `src/pages/ResetPassword.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `updatePassword` from `useAuth` (Task 1); the `supabase` client for session detection.
- Produces: route `/reset-password`.

- [ ] **Step 1: Create the page**

Create `src/pages/ResetPassword.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Reached from the reset link in the email. Supabase parses the recovery token
// from the URL, opens a temporary session and fires PASSWORD_RECOVERY; this page
// then lets the user set a new password via updateUser.
const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('הסיסמה חייבת לכלול לפחות 6 תווים.'); return; }
    if (password !== confirm) { toast.error('הסיסמאות אינן תואמות.'); return; }
    setSaving(true);
    try {
      await updatePassword(password);
      toast.success('הסיסמה עודכנה. אתם מחוברים.');
      navigate('/');
    } catch {
      toast.error('לא הצלחנו לעדכן את הסיסמה. ייתכן שהקישור פג. בקשו איפוס חדש.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Helmet>
        <title>איפוס סיסמה | ניהול שכירות</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Card className="w-full max-w-md rounded-[2rem] border-border border-t-4 border-t-primary shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display text-foreground">איפוס סיסמה</CardTitle>
        </CardHeader>
        <CardContent>
          {checking ? (
            <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : !ready ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">הקישור לאיפוס אינו תקין או שפג תוקפו.</p>
              <Button asChild variant="link" className="text-primary">
                <Link to="/">חזרה למסך ההתחברות</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">סיסמה חדשה</Label>
                <div className="relative">
                  <Input
                    id="new-password" type={showPassword ? 'text' : 'password'} value={password}
                    required minLength={6} autoComplete="new-password" className="pe-11 text-right"
                    onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 6 תווים"
                  />
                  <button
                    type="button"
                    className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">אימות סיסמה</Label>
                <Input
                  id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirm}
                  required minLength={6} autoComplete="new-password" className="text-right"
                  onChange={(e) => setConfirm(e.target.value)} placeholder="הקלידו שוב"
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving} aria-busy={saving}>
                {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {saving ? 'מעדכן...' : 'עדכון סיסמה'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
```

- [ ] **Step 2: Register the route**

In `src/App.tsx`, add the import next to the other page imports (`Terms`, `Privacy`):

```ts
import ResetPassword from "./pages/ResetPassword";
```

Add the route above the catch-all, alongside `/terms` and `/privacy`:

```tsx
              <Route path="/reset-password" element={<ResetPassword />} />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ResetPassword.tsx src/App.tsx
git commit -m "feat(auth): /reset-password page to set a new password"
```

---

## Supabase dashboard config (performed by the user)

Hand the user these steps — they are not code:

1. **Redirect URLs** — already include `https://nihulschirut.com/**`, which covers `/reset-password`. No change needed.
2. **Hebrew reset email** — Supabase dashboard → Authentication → Email Templates → **Reset Password** → set:
   - **Subject:** `איפוס סיסמה — ניהול שכירות`
   - **Message body (HTML):**

```html
<h2>איפוס סיסמה</h2>
<p>קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך במערכת ניהול שכירות.</p>
<p><a href="{{ .ConfirmationURL }}">לחצו כאן כדי לקבוע סיסמה חדשה</a></p>
<p>אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מההודעה הזו — הסיסמה לא תשתנה.</p>
```

   Keep `{{ .ConfirmationURL }}` exactly — Supabase substitutes the recovery link there.

---

## Final verification (manual, end-to-end)

- [ ] On `nihulschirut.com`, sign out → Auth screen → "שכחתי סיסמה" → enter your email → neutral message shown.
- [ ] Reset email arrives (in Hebrew, after the template step).
- [ ] Click the link → lands on `/reset-password` with the new-password form.
- [ ] Enter a new password + confirm → success toast → redirected to the app, signed in.
- [ ] Sign out and sign in with the new password → works.
- [ ] Open `/reset-password` directly (no token) → shows the "link invalid/expired" message.
