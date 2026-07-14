import { api } from './api';

export interface CaptionResult {
  caption: string;
  hashtags: string[];
  mock: boolean;
}

// Shared by MarketingToolsScreen and PhotoEditorScreen so caption generation isn't
// duplicated between the standalone marketing tool and the photo-editor's inline
// "Generate Caption" action.
export function generateCaption(postDescription: string): Promise<CaptionResult> {
  return api.post<CaptionResult>('/marketing/caption', { post_description: postDescription });
}
