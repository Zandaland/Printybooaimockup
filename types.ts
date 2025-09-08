export interface Project {
  id: string;
  name: string;
  generatedImage: string; // base64 string
  generatedImageMimeType: string;
  thumbnailImage: string; // base64 jpeg data URL for preview
  sourceImage: string; // base64 string of original design or product photo
  sourceImageMimeType: string;
  prompt: string;
  createdAt: string;
  variations?: { data: string; mimeType: string; }[];
}

export type MockupType = 'person' | 'flatlay';

export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export interface PromptTemplate {
    name: string;
    scene: string;
    details: string;
    mood: string;
}
