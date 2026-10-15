import { useLocalSearchParams } from "expo-router";
import FavoritesScreen from "../features/favorites/favorites-screen";
export default function CollectionsScreen() {
  const { designId } = useLocalSearchParams<{ designId?: string }>();
  return <FavoritesScreen back initialDesignId={designId} />;
}
