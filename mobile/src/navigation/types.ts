export type RootStackParamList = {
  Auth: undefined;
  ClientList: undefined;
  NewClient: undefined;
  ClientProfile: { clientId: string };
  CameraUpload: { clientId: string };
  EyeAnalysisResult: { clientId: string };
  LashMap: { clientId: string; lashMapId?: string };
  Coach: undefined;
};
