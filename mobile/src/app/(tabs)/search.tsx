import SearchScreen from "../../features/search";
import { useLocalSearchParams } from "expo-router";
export default function Search() {
  const { query, mode } = useLocalSearchParams<{
    query?: string;
    mode?: string;
  }>();
  return (
    <SearchScreen
      key={`${query || ""}:${mode || ""}`}
      initialQuery={query}
      initialMode={mode}
    />
  );
}
