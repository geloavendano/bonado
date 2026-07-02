// https://unsplash.com/documentation — demo apps are capped at 50 req/hour.

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined;

export const isUnsplashConfigured = Boolean(ACCESS_KEY);

export interface UnsplashPhoto {
  id: string;
  url: string;
  downloadLocation: string;
  attribution: string;
}

interface UnsplashSearchResult {
  results: {
    id: string;
    urls: { regular: string };
    links: { download_location: string };
    user: { name: string; links: { html: string } };
  }[];
}

export async function searchCoverPhotos(query: string, page = 1): Promise<UnsplashPhoto[]> {
  if (!ACCESS_KEY || query.trim().length === 0) return [];

  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=4&page=${page}&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } },
  );

  if (!response.ok) {
    throw new Error("Photo search is temporarily unavailable.");
  }

  const data = (await response.json()) as UnsplashSearchResult;
  return data.results.map((photo) => ({
    id: photo.id,
    url: photo.urls.regular,
    downloadLocation: photo.links.download_location,
    attribution: `Photo by ${photo.user.name} on Unsplash`,
  }));
}

/**
 * Unsplash's API guidelines require triggering this endpoint whenever a
 * photo is actually used (not just displayed in search results) —
 * https://help.unsplash.com/en/articles/2511258
 */
export function trackDownload(downloadLocation: string) {
  if (!ACCESS_KEY) return;
  void fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  });
}
