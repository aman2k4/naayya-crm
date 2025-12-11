import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SupabaseClient } from '@supabase/supabase-js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function calculateDuration(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase();
}

function slugify(text: string): string {
  return text
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes
}

export function generateTeacherSlug(teacherName: string): string {
  const name = teacherName ?? '';
  const normalized = normalizeName(name);
  return slugify(normalized);
}

export async function generateUniqueTeacherSlug(
  name: string,
  supabase: SupabaseClient
): Promise<string> {
  const normalized = normalizeName(name || 'teacher'); // Use fallback if name is empty
  const baseSlug = slugify(normalized);

  let potentialSlug = baseSlug;
  let counter = 1; // Start counter at 1 (first check is baseSlug, then baseSlug-2, etc.)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Check if the potential slug exists
    const { data, error } = await supabase
      .from('teachers')
      .select('id') // Select minimal data
      .eq('slug', potentialSlug)
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 result without error

    if (error) {
      console.error('Error checking slug uniqueness:', error);
      // Fallback: append a timestamp or random string in case of db error
      return `${baseSlug}-${Date.now()}`;
    }

    // If data is null, the slug doesn't exist, it's unique
    if (!data) {
      return potentialSlug;
    }

    // If slug exists, increment counter and try again
    counter++;
    potentialSlug = `${baseSlug}-${counter}`;
  }
}
