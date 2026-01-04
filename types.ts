export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT = "3:4",
  LANDSCAPE = "4:3",
  WIDE = "16:9",
  TALL = "9:16"
}

export type GenerationMode = 'auto' | 'manual';
export type ImageResolution = '1K' | '2K' | '4K';

export interface GenerationConfig {
  prompt: string;
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  base64Images: string[];
}

export interface GeneratedResult {
  imageUrl: string;
  originalIndex: number;
}