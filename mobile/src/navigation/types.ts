import { EyeAnalysis, LashMap, Lesson } from '../types/api';

export type RootStackParamList = {
  Auth: undefined;
  Dashboard: undefined;
  ClientList: { pickerMode?: 'photoEdit' } | undefined;
  NewClient: undefined;
  ClientProfile: { clientId: string };
  CameraUpload: { clientId: string };
  EyeAnalysisResult: {
    clientId: string;
    eyeAnalysis?: EyeAnalysis;
    photoUrl?: string;
  };
  LashMap: { clientId: string; lashMap: LashMap };
  ChairsideMode: { clientId: string; lashMap: LashMap };
  ARLashPreview: undefined;
  Coach: { clientId?: string; clientName?: string } | undefined;
  Feedback: undefined;
  Paywall: undefined;
  PhotoFeedback: { clientId: string };
  Inventory: undefined;
  RetentionAnalytics: undefined;
  MarketingTools: undefined;
  LessonList: undefined;
  LessonDetail: { lesson: Lesson };
  ForumList: undefined;
  ForumPostDetail: { postId: string };
  BeforeAfter: { clientId: string };
  PhotoEditor: { clientId: string; photoUri: string };
  ReferenceGuide: undefined;
  Admin: undefined;
  AccountSettings: undefined;
};
