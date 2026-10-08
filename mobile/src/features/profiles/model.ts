import type { ImageSource } from "expo-image";
export type ProfileIdentity = {
  id: string;
  name: string;
  username?:string|null;
  role: "user" | "creator" | "salon";
  avatar?: ImageSource | number | null;
  cover?: ImageSource | number;
  location?: string | null;
  bio?: string | null;
  specialties: string[];
  private?: boolean;
  replyTime?: string;
};
export type ProfileDesign = {
  id: string;
  title: string;
  category?: string | null;
  image?: ImageSource | number | null;
  published: boolean;
  saved?: boolean;
};
export type ProfileStats = {
  followers: number;
  designs: number;
  following?: number;
  rating?: number | null;
};
export type ProfileAppointment = {
  id: string;
  name: string;
  subtitle: string;
  avatar?: ImageSource | number | null;
  service: string;
  date: string;
  status: string;
};
export type ProfileAccount = {
  upcoming: number;
  saved: number;
  favorites: number;
  collections: number;
  credits: number | null;
  appointment?: ProfileAppointment | null;
};
export type ProfileCollection = { id: string; name: string };
export type ProfileService = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  deposit_amount: number;
  duration_minutes: number;
};
export type ProfileReview = {
  id: string;
  rating: number;
  text: string | null;
  created_at: string;
};
export const roleLabel = (role: ProfileIdentity["role"]) =>
  role === "user" ? "NAIL LOVER" : role === "salon" ? "SALON" : "NAIL ARTIST";
export const publicTabs = ["Designs", "Services", "Reviews", "About"];
export const ownerTabs = ["My Designs", "Saved", "Collections"];
