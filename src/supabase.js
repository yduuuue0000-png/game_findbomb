import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
export const isConfigured = Boolean(supabase);

function client() {
  if (!supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  return supabase;
}

export async function saveScore(row) {
  const { error } = await client().from('scores').insert(row);
  if (error) throw error;
}

export async function fetchLeaderboard(difficulty, limit = 20) {
  const { data, error } = await client()
    .from('scores')
    .select('id, nickname, score, won, time_seconds, created_at')
    .eq('difficulty', difficulty)
    .order('score', { ascending: false })
    .order('time_seconds', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function fetchReviews(limit = 50) {
  const { data, error } = await client()
    .from('reviews')
    .select('id, nickname, rating, content, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function addReview(row) {
  const { error } = await client().from('reviews').insert(row);
  if (error) throw error;
}
