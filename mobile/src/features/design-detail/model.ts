import type { ImageSource } from "expo-image";

export type DetailPhoto = {
  id: string;
  source: ImageSource | string | number;
  thumbnail?: ImageSource | string | number;
  // Figma's third close-up extends beyond the frame; preserve its full crop.
  thumbnailCrop?: "cathedral-cross";
};
export type DetailColour = {
  id: string;
  name: string;
  code: string;
  hex?: string;
  image?: number;
};
export type DetailModel = {
  id: string;
  title: string;
  description: string;
  photos: DetailPhoto[];
  initialPhoto?: number;
  closeups: DetailPhoto[];
  techniques: string[];
  colours: DetailColour[];
  tags: string[];
  saves: number;
  reviewCount?: number;
};
