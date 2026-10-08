import { useLocalSearchParams } from "expo-router";
import FavoritesScreen from "../../features/favorites/favorites-screen";
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FavoritesScreen key={id} back initialFolderId={id} />;
}
