import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

if (!url || !key) {
  throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_KEY — copy .env.example thành .env')
}

// Mọi truy vấn đi qua RPC trong schema app_inventory
export const db = createClient(url, key, { auth: { persistSession: false } }).schema('app_inventory')
