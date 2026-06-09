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
  error?: string;
}

export interface DraftResponse {
  ok: boolean;
  message: string;
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
  ai_summary?: string | null;
}
