// Domain-specific API functions, grouped by resource. Screens import from here
// rather than constructing paths themselves.

import { api } from "./client";
import type {
  Campaign,
  CampaignStats,
  Communication,
  CustomerSummary,
  DraftResponse,
  IntentResponse,
  SegmentFilter,
  SegmentPreview,
  SendResponse,
} from "../lib/types";

// --- AI --------------------------------------------------------------------
export const ai = {
  intentToSegment: (text: string) =>
    api.post<IntentResponse>("/api/ai/intent-to-segment", { text }),
  draftMessage: (goal: string, channel: string, segment_summary: string) =>
    api.post<DraftResponse>("/api/ai/draft-message", {
      goal,
      channel,
      segment_summary,
    }),
};

// --- Segments --------------------------------------------------------------
export const segments = {
  preview: (filter: SegmentFilter) =>
    api.post<SegmentPreview>("/api/segments/preview", { filter }),
};

// --- Campaigns -------------------------------------------------------------
export const campaigns = {
  list: () => api.get<Campaign[]>("/api/campaigns"),
  get: (id: number) => api.get<Campaign>(`/api/campaigns/${id}`),
  create: (body: {
    name: string;
    goal: string;
    channel: string;
    segment_definition: SegmentFilter;
    message_template: string;
  }) => api.post<Campaign>("/api/campaigns", body),
  send: (id: number) => api.post<SendResponse>(`/api/campaigns/${id}/send`),
  communications: (id: number) =>
    api.get<Communication[]>(`/api/campaigns/${id}/communications`),
  stats: (id: number, withAi = true) =>
    api.get<CampaignStats>(`/api/campaigns/${id}/stats?ai=${withAi}`),
};

// --- Customers -------------------------------------------------------------
export const customers = {
  // Reuses the segment preview with an always-true-ish filter to page the base.
  // (A dedicated /api/customers endpoint is added in the backend for this.)
  list: () => api.get<CustomerSummary[]>("/api/customers"),
};

// --- Stats -----------------------------------------------------------------
export const stats = {
  overview: () => api.get<CampaignStats>("/api/stats/overview"),
};
