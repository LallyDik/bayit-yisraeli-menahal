import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';
import { validateFeedback } from './validate.ts';

// Feedback is written here with the service role rather than from the browser:
// the feedback table has RLS on and no policies, so the anon key that ships in
// the client bundle cannot reach it. Validation happens before the insert.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const validated = validateFeedback(body);
  if (!validated.ok) {
    // The honeypot answers 200 so a bot cannot tell it was caught.
    if (validated.error === 'rejected') return json({ ok: true });
    return json({ error: validated.error }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Identify the sender from their JWT when there is one; anonymous feedback
  // from the landing page is still accepted.
  let userId: string | null = null;
  let userEmail: string | null = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    userId = data.user?.id ?? null;
    userEmail = data.user?.email ?? null;
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    email: validated.email ?? userEmail,
    message: validated.message,
    page: validated.page,
    user_agent: req.headers.get('User-Agent')?.slice(0, 500) ?? null,
  });
  if (error) {
    console.error('feedback insert failed', error);
    return json({ error: 'could not save feedback' }, 500);
  }

  // The row is already safe. A mail failure must not turn a saved submission
  // into an error the user sees and retries.
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (gmailUser && gmailPass) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    try {
      await transporter.sendMail({
        from: `"ניהול שכירות" <${gmailUser}>`,
        to: gmailUser,
        replyTo: validated.email ?? userEmail ?? undefined,
        subject: 'משוב חדש מהמערכת',
        text: [
          validated.message,
          '',
          `מאת: ${validated.email ?? userEmail ?? 'לא צוין'}`,
          `מסך: ${validated.page ?? 'לא צוין'}`,
        ].join('\n'),
      });
    } catch (e) {
      console.error('feedback mail failed', e);
    } finally {
      transporter.close?.();
    }
  }

  return json({ ok: true });
});
