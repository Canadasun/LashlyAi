export interface EyeAnalysis {
  eye_shape: string;
  lash_density: string;
  lash_length_natural: string;
  notes: string;
  mock: boolean;
}

export interface ClientProfile {
  id: string;
  owner_user_id: string;
  name: string;
  photos: string[];
  eye_analysis: EyeAnalysis | null;
  lash_history: { lash_map_id: string; style: string; created_at: string }[];
  notes: string | null;
  created_at: string;
}

export interface VisualMapZone {
  zone: 'inner' | 'inner_mid' | 'center' | 'outer_mid' | 'outer';
  length_mm: number;
  direction: 'outward' | 'vertical';
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
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  order_index: number;
  title: string;
  summary: string;
  content: string;
  completed: boolean;
  created_at: string;
}
