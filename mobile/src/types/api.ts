export interface EyeAnalysis {
  eye_shape: string;
  lash_density: string;
  lash_length_natural: string;
  eye_width: string;
  eye_size: string;
  eye_spacing: string;
  canthal_tilt: string;
  lid_exposure: string;
  under_eye_condition: string;
  eye_symmetry: string;
  natural_lash_curl: string;
  brow_shape: string;
  brow_spacing: string;
  brow_tail_length: string;
  brow_gap: string;
  brow_hair_direction: string;
  balance_score: number;
  notes: string;
  mock: boolean;
}

export type DifficultyLabel = 'Quick' | 'Standard' | 'Technical' | 'Expert-Level';

export interface LashHistoryEntry {
  lash_map_id: string;
  style: string;
  created_at: string;
  difficulty_score?: number;
  difficulty_label?: DifficultyLabel;
  estimated_minutes?: { min: number; max: number };
}

export interface ClientProfile {
  id: string;
  owner_user_id: string;
  name: string;
  photos: string[];
  eye_analysis: EyeAnalysis | null;
  lash_history: LashHistoryEntry[];
  notes: string | null;
  created_at: string;
}

export interface VisualMapZone {
  zone: 'inner' | 'inner_mid' | 'center' | 'outer_mid' | 'outer';
  length_mm: number;
  direction: 'outward' | 'vertical';
}

export interface ZoneRange {
  min: number;
  max: number;
}

export interface ZoneSummary {
  inner: ZoneRange;
  middle: ZoneRange;
  outer: ZoneRange;
}

export interface TexturedMap {
  base_layer: { zones: VisualMapZone[] };
  spike_layer: { zones: VisualMapZone[]; pattern: string };
}

export interface LashMap {
  id: string;
  client_profile_id: string;
  style: string;
  curl: string;
  lengths: Record<string, number>;
  diameter: string;
  fan_type: string;
  visual_map: { zones: VisualMapZone[] };
  retention_pct: number | null;
  created_at: string;
  technique: 'classic' | 'wispy';
  style_label: string;
  curl_label: string;
  spike_lengths?: number[];
  zone_summary: ZoneSummary;
  lash_set?: string;
  lash_style?: string;
  lash_set_label?: string;
  lash_style_label?: string;
  difficulty_score?: number;
  difficulty_label?: DifficultyLabel;
  estimated_minutes?: { min: number; max: number };
  textured_map?: TexturedMap;
}

export interface LashMapTemplate {
  id: string;
  owner_user_id: string;
  label: string;
  curl: 'C' | 'CC' | 'D';
  diameter: string;
  lengths: Record<string, number>;
  created_at: string;
}

export interface RetentionCheckEntry {
  id: string;
  lash_map_id: string;
  days_since_application: number;
  retention_pct: string;
  humidity_pct: string | null;
  glue_used: string | null;
  symptoms: string[];
  created_at: string;
  style: string;
  lash_set: string | null;
}

export interface NextFillEstimate {
  estimated_days_remaining: number;
  estimated_fill_day: number;
}

export interface ClientRetentionInsights {
  checks: RetentionCheckEntry[];
  next_fill_estimate: NextFillEstimate | null;
}

export interface RetentionAggregateRow {
  label: string;
  average_retention_pct: number;
  sample_size: number;
}

export interface RetentionInsightsSummary {
  by_lash_set: RetentionAggregateRow[];
  by_glue: RetentionAggregateRow[];
  total_checks: number;
}

export interface ClientNote {
  id: string;
  client_profile_id: string;
  text: string;
  source: 'manual' | 'voice';
  created_at: string;
}

export interface FeedbackReply {
  id: string;
  feedback_id: string;
  admin_id: string | null;
  message: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  user_id: string | null;
  message: string;
  context: unknown;
  is_priority: boolean;
  created_at: string;
  replies: FeedbackReply[];
}

export interface PhotoFeedback {
  id: string;
  client_profile_id: string;
  photo_url: string;
  isolation_score: number;
  direction_score: number;
  styling_score: number;
  overall_score: number;
  notes: string;
  mock: boolean;
  created_at: string;
}

export type InventoryCategory = 'lash_trays' | 'glue' | 'tools' | 'other';

export interface InventoryItem {
  id: string;
  owner_user_id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  notes: string | null;
  expiry_date: string | null;
  is_low_stock: boolean;
  is_expired: boolean;
  is_expiring_soon: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  order_index: number;
  title: string;
  summary: string;
  // null when the lesson is Pro-locked for the current user — the backend never
  // sends locked-lesson content, see backend/src/routes/lessons.routes.ts.
  content: string | null;
  completed: boolean;
  locked: boolean;
  created_at: string;
}

export interface ForumPost {
  id: string;
  user_id: string;
  author_display_name: string;
  title: string;
  body: string;
  comment_count: number;
  created_at: string;
}

export interface ForumComment {
  id: string;
  post_id: string;
  user_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
}

export interface ForumPostDetail extends ForumPost {
  comments: ForumComment[];
}

export interface AdminForumReport {
  id: string;
  reporter_user_id: string | null;
  target_type: 'post' | 'comment';
  target_id: string;
  reason: string;
  status: 'open' | 'resolved';
  created_at: string;
}

export interface AdminFeedbackItem {
  id: string;
  user_id: string | null;
  user_email: string | null;
  message: string;
  is_priority: boolean;
  reply_count: number;
  created_at: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export interface AdminSubscriptionGrant {
  id: string;
  user_id: string;
  plan: string;
  expires_at: string;
  revoked_at: string | null;
  grantee_email: string;
  granter_email: string | null;
  created_at: string;
}

export interface AdminOverview {
  totalUsers: number;
  recentUsers: AdminUserSummary[];
  totalClients: number;
  totalLashMaps: number;
  errorCountLast24h: number;
  subscriptionsByPlan: { plan: string; count: number }[];
  recentFeedback: AdminFeedbackItem[];
  openForumReports: AdminForumReport[];
  recentSubscriptionGrants: AdminSubscriptionGrant[];
}
