import { createClient } from '@supabase/supabase-js';

// כתובת הפרויקט שלך ב-Supabase
const supabaseUrl = 'https://sdjgcirhmvlihgoafxxi.supabase.co';
// המפתח הציבורי (anon key) של הפרויקט
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkamdjaXJobXZsaWhnb2FmeHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzczMDUsImV4cCI6MjA2NjQxMzMwNX0.E0-iz3bJ_qu-YNXSiothblVpxs9luiCaaR-jOpODPTo';

export const supabase = createClient(supabaseUrl, supabaseKey);