export type Currency = string; // ISO 4217 code, e.g. "USD"

export interface User {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  is_registered: boolean;
  auth_id: string | null;
  claimed_from_guest_id: string | null;
  preferred_currency: Currency;
  theme_preference: "system" | "light" | "dark";
  created_at: string;
}

export interface Trip {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  default_currency: Currency;
  invite_link_token: string;
  location_name: string | null;
  location_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  cover_photo_url: string | null;
  cover_photo_attribution: string | null;
  last_activity_at: string;
}

export type MembershipRole = "owner" | "member";

export interface Membership {
  id: string;
  trip_id: string;
  user_id: string;
  joined_at: string;
  role: MembershipRole;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export type PaymentAccountType = "cash" | "bank" | "other";

export interface PaymentAccount {
  id: string;
  user_id: string;
  type: PaymentAccountType;
  label: string;
  currency: Currency;
  is_shared: boolean;
}

export type EntryStatus = "active" | "deleted";
export type SyncStatus = "pending" | "synced";

export interface Entry {
  id: string;
  trip_id: string;
  description: string;
  date: string;
  currency: Currency;
  exchange_rate_to_trip_default: number;
  rate_is_estimated: boolean;
  category_id: string | null;
  payee: string | null;
  status: EntryStatus;
  created_by: string;
  created_at: string;
  server_created_at: string;
  last_edited_by: string | null;
  last_edited_at: string | null;
  sync_status: SyncStatus;
}

export interface EntryAttachment {
  id: string;
  entry_id: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
  server_uploaded_at: string;
  sync_status: SyncStatus;
}

export interface Payment {
  id: string;
  entry_id: string;
  user_id: string;
  amount_paid: number;
  payment_account_id: string | null;
}

export interface LineItem {
  id: string;
  entry_id: string;
  description: string;
  amount: number;
}

export type ShareType = "equal" | "exact" | "percent" | "shares";

export interface LineItemShare {
  id: string;
  line_item_id: string;
  user_id: string;
  share_type: ShareType;
  share_value: number | null;
  owed_amount: number;
}

export type AdjustmentType = "tax" | "tip" | "service_charge";
export type AdjustmentMode = "proportional" | "own_item";

export interface Adjustment {
  id: string;
  entry_id: string;
  type: AdjustmentType;
  mode: AdjustmentMode;
  amount: number;
}

export interface AdjustmentShare {
  id: string;
  adjustment_id: string;
  user_id: string;
  owed_amount: number;
}

export interface Settlement {
  id: string;
  trip_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  date: string;
  created_by: string;
  payment_account_id: string | null;
}

export interface ExchangeRateCache {
  id: string;
  base_currency: Currency;
  target_currency: Currency;
  rate: number;
  fetched_at: string;
}

export type SyncQueueEntityType = "entry" | "attachment";
export type SyncQueueStatus = "pending" | "syncing" | "failed" | "done";

export interface SyncQueueOp {
  op_id: string;
  entity_type: SyncQueueEntityType;
  entity_id: string;
  payload: unknown;
  created_at: string;
  status: SyncQueueStatus;
}

// ---- View-model helpers (derived, not stored as-is) ----

export interface TripSummary extends Trip {
  memberCount: number;
  memberAvatars: Pick<User, "id" | "name" | "avatar_url">[];
  /** Positive = you're owed; negative = you owe; 0 = settled. */
  yourBalance: number;
}
