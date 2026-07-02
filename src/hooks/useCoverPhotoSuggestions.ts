import { useEffect, useState } from "react";
import { searchCoverPhotos, type UnsplashPhoto } from "@/lib/unsplash";

export function useCoverPhotoSuggestions(query: string) {
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (query.trim().length === 0) {
      setPhotos([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchCoverPhotos(query, page)
      .then((results) => {
        if (!cancelled) {
          setPhotos(results);
          setError(null);
        }
      })
      .catch((searchError: unknown) => {
        if (!cancelled) {
          setError(searchError instanceof Error ? searchError.message : "Photo search failed.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, page]);

  function shuffle() {
    setPage((current) => current + 1);
  }

  return { photos, loading, error, shuffle };
}
