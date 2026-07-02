import { useOutletContext } from "react-router-dom";
import type { TripWithMembers } from "@/hooks/useTrip";

export function useTripLayout() {
  return useOutletContext<TripWithMembers>();
}
