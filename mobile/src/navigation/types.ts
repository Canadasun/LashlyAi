import { EyeAnalysis, LashMap } from '../types/api';

export type RootStackParamList = {
  Auth: undefined;
  ClientList: undefined;
  NewClient: undefined;
  ClientProfile: { clientId: string };
  CameraUpload: { clientId: string };
  EyeAnalysisResult: { clientId: string; eyeAnalysis: EyeAnalysis; photoUrl: string };
  LashMap: { clientId: string; lashMap: LashMap };
  Coach: undefined;
  Feedback: undefined;
  Paywall: undefined;
  PhotoFeedback: { clientId: string };
};
