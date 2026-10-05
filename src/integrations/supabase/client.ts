import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kirvvmriqraufhzvdjdd.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcnZ2bXJpcXJhdWZoenZkamRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODc0OTYsImV4cCI6MjA4NjY2MzQ5Nn0.tK4CDwZqV5PIE_mKu_1l3MtgJaGTBqW9zQJicpKy2SQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
