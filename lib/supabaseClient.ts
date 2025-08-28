import { createClient } from '@supabase/supabase-js';

// ** IMPORTANT: Replace with your actual Supabase project URL and public API key **
// ** สำคัญ: กรุณาเปลี่ยนค่าด้านล่างเป็น URL และ Public API Key จากโปรเจกต์ Supabase ของคุณ **
const SUPABASE_URL = 'https://ehwhaqkbtjaioarwcwzo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVod2hhcWtidGphaW9hcndjd3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTAzMDMsImV4cCI6MjA3MTk2NjMwM30._5YV-vlBl8m6HvOOAIAFkL5yL5O-m0hx72NWuJjTpMM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);