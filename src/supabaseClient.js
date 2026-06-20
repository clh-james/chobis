import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nitcqpozvppyhslruhum.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pdGNxcG96dnBweWhzbHJ1aHVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTY3MzQxMCwiZXhwIjoyMDk3MjQ5NDEwfQ.gsEVCwD62L83g20Q6i-44VM6NtDCwTNsWe_Wf3L-gXs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper to get current user role
export const getCurrentUserRole = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.app_metadata?.role || null;
};