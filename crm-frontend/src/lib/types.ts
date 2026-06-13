// Type definitions mirroring the backend's Pydantic schemas (api/app/schemas.py).
// Keeping these in one file gives the whole app a single, typed contract with
// the API — if the backend changes a field, TypeScript flags every usage.

export type Channel = "WHATSAPP" | "SMS" | "EMAIL" | "RCS";

export type CampaignStatus = "DRAFT" | "SENDING" | "SENT";

export type CommStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "READ"
  | "CLICKED"
  | "FAILED"
  | "CONVERTED";

// The structured segment filter — the same {all|any:[...]} grammar the AI emits
// and the backend validates/compiles.
export interface SegmentCondition {
  field: string;
  op: string;
  value: unknown;
}
export interface SegmentFilter {
  all?: SegmentCondition[];
  any?: SegmentCondition[];
}

export interface CustomerSummary {
  id: number;
  name: string;
  email: string;
  city: string;
  tags: string[];
  total_spend: number;
  order_count: number;
  last_order_at: string | null;
}

export interface SegmentPreview {
  count: number;
  sample: CustomerSummary[];
}

export interface IntentResponse {
  ok: boolean;
  filter?: SegmentFilter;
  preview?: SegmentPreview;
  // One-line plain-English explanation of the proposed segment. Optional: the
  // model may omit it, or AI may have failed — the UI just shows nothing then.
  rationale?: string | null;
  error?: string;
}

export interface DraftResponse {
  ok: boolean;
  // Up to three distinct copy variants the marketer can choose between.
  messages: string[];
  // First variant, kept for back-compat with older call sites.
  message: string;
  note?: string | null;
}

export interface TitleResponse {
  ok: boolean;
  // Short, complete campaign title for the name field.
  title: string;
  // Set only when a fallback (trimmed) title was used instead of the LLM's.
  note?: string | null;
}

export interface Campaign {
  id: number;
  name: string;
  goal: string;
  channel: Channel;
  segment_definition: SegmentFilter;
  message_template: string;
  status: CampaignStatus;
  created_at: string;
}

export interface SendResponse {
  campaign_id: number;
  status: CampaignStatus;
  queued: number;
  channel_accepted: boolean;
  note?: string | null;
}

export interface Communication {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  channel: Channel;
  rendered_message: string;
  status: CommStatus;
  converted_order_id?: number | null;
  attributed_amount?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  campaign_id: number | null;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  read: number;
  clicked: number;
  converted: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
  // Total INR attributed to conversions in scope. Defaults to 0 server-side, so
  // old / zero-conversion campaigns are a safe 0 rather than undefined.
  attributed_revenue: number;
  ai_summary?: string | null;
}
