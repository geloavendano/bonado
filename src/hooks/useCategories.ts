import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types/schema";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("categories")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (!cancelled) {
          setCategories((data as Category[] | null) ?? []);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading };
}
