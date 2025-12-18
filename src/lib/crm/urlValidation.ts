/**
 * URL validation utilities for websites and social media profiles
 */

export interface WebsiteValidationResult {
  valid: boolean;
  status?: number;
  error?: string;
  finalUrl?: string;
}

export interface SocialValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a website URL by making a HEAD request
 */
export async function validateWebsite(url: string): Promise<WebsiteValidationResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    return {
      valid: response.ok,
      status: response.status,
      finalUrl: response.url !== url ? response.url : undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { valid: false, error: 'timeout' };
      }
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'unknown error' };
  }
}

/**
 * Validates a social media URL (Instagram or Facebook)
 * Returns detailed result with error info
 */
export async function validateSocialUrl(
  url: string,
  platform: 'instagram' | 'facebook'
): Promise<SocialValidationResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeout);

    if (platform === 'instagram') {
      // Instagram returns 200 but redirects to login for non-existent profiles
      if (response.url.includes('/accounts/login') || response.url.includes('/challenge/')) {
        return { valid: false, error: 'profile not found (redirected to login)' };
      }
      if (response.status === 404) {
        return { valid: false, error: 'profile not found' };
      }
      const text = await response.text();
      if (text.includes("Sorry, this page isn't available") || text.includes('Page Not Found')) {
        return { valid: false, error: 'profile not found' };
      }
      return { valid: response.ok };
    }

    if (platform === 'facebook') {
      if (response.status === 404) {
        return { valid: false, error: 'page not found' };
      }
      const text = await response.text();
      if (
        text.includes("This content isn't available") ||
        text.includes('Page Not Found') ||
        text.includes("Sorry, this content isn't available")
      ) {
        return { valid: false, error: 'page not found' };
      }
      return { valid: response.ok };
    }

    return { valid: response.ok };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { valid: false, error: 'timeout' };
      }
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'unknown error' };
  }
}

/**
 * Simple boolean check for social URL validity
 * Use this when you just need a quick valid/invalid check
 */
export async function isSocialUrlValid(url: string, platform: 'instagram' | 'facebook'): Promise<boolean> {
  const result = await validateSocialUrl(url, platform);
  return result.valid;
}
