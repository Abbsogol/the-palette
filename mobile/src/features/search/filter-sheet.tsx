import { typography } from "../../theme/typography";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeIcon } from "../home/home-primitives";
import { homeFonts as f, homeColors as c } from "../home/tokens";
import { colorAssets, searchAssets } from "./assets";
import {
  FILTER_LABELS,
  FILTER_OPTIONS,
  emptyFilters,
  toggleFilter,
  type FilterGroup,
  type SearchFilters,
} from "./filters";
import { SearchBackground } from "./search-background";

const vibeWidths = [
  [117, 130, 91],
  [143, 98, 97],
  [135, 103, 100],
  [103.5, 131, 103.5],
  [122, 94, 122],
];
export type FilterSheetProps = {
  width: number;
  value: SearchFilters;
  onChange: (value: SearchFilters) => void;
  onClose: () => void;
  onApply: () => void;
  total?: number;
  loading?: boolean;
  error?: string;
  onRetry: () => void;
};
export function FilterSheet(p: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const columns = p.width < 360 || fontScale > 1.3 ? 2 : 3;
  const top = insets.top;
  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={p.onClose}
    >
      <View style={s.modal}>
        <View
          style={{
            flex: 1,
            width: p.width,
            overflow: "hidden",
            backgroundColor: c.burgundy,
          }}
        >
          <SearchBackground width={p.width} />
          <View
            testID="search-filter-sheet"
            accessibilityViewIsModal
            style={[s.sheet, { marginTop: top }]}
          >
            <ScrollView
              testID="search-filter-scroll"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                s.content,
                { paddingBottom: Math.max(32, insets.bottom + 24) },
              ]}
            >
              <View style={s.header}>
                <Text accessibilityRole="header" style={s.title}>
                  Filters
                </Text>
                <View style={s.actions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => p.onChange(emptyFilters())}
                    hitSlop={10}
                  >
                    <Text style={s.clear}>Clear All</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close filters"
                    onPress={p.onClose}
                    hitSlop={10}
                  >
                    <HomeIcon source={searchAssets.close} size={24} />
                  </Pressable>
                </View>
              </View>
              <View style={s.groups}>
                {(Object.keys(FILTER_OPTIONS) as FilterGroup[]).map((group) => {
                  const options = FILTER_OPTIONS[group];
                  const rows = Array.from(
                    { length: Math.ceil(options.length / columns) },
                    (_, i) => options.slice(i * columns, (i + 1) * columns),
                  );
                  return (
                    <View
                      key={group}
                      testID={`filter-group-${group}`}
                      style={s.group}
                    >
                      <Text accessibilityRole="header" style={s.label}>
                        {FILTER_LABELS[group]} ( {p.value[group].length} )
                      </Text>
                      <View style={{ gap: 6 }}>
                        {rows.map((row, rowIndex) => (
                          <View key={rowIndex} style={s.row}>
                            {row.map((option, index) => {
                              const selected = p.value[group].includes(option);
                              const isColor = group === "color";
                              const weight =
                                columns === 3 && group === "vibe"
                                  ? vibeWidths[rowIndex][index]
                                  : columns === 3 && isColor
                                    ? [112, 111, 114][index]
                                    : 1;
                              return (
                                <Pressable
                                  key={option}
                                  accessibilityRole="checkbox"
                                  accessibilityLabel={`${FILTER_LABELS[group]}: ${option}`}
                                  accessibilityState={{ checked: selected }}
                                  onPress={() =>
                                    p.onChange(
                                      toggleFilter(p.value, group, option),
                                    )
                                  }
                                  hitSlop={{ top: 3, bottom: 3 }}
                                  style={[
                                    s.chip,
                                    { flex: weight },
                                    group === "vibe" && {
                                      paddingHorizontal: 4,
                                    },
                                    isColor && s.colorChip,
                                    selected && s.selected,
                                  ]}
                                >
                                  {!selected && (
                                    <LinearGradient
                                      pointerEvents="none"
                                      colors={[
                                        "rgba(190,117,122,.2)",
                                        "rgba(190,117,122,0)",
                                      ]}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      style={[
                                        StyleSheet.absoluteFill,
                                        s.chipGradient,
                                      ]}
                                    />
                                  )}
                                  {isColor && (
                                    <HomeIcon
                                      source={
                                        colorAssets[
                                          option as keyof typeof colorAssets
                                        ]
                                      }
                                      size={22}
                                    />
                                  )}
                                  <Text
                                    style={[
                                      s.option,
                                      isColor && { flex: 1, textAlign: "left" },
                                      selected && s.selectedText,
                                    ]}
                                  >
                                    {option}
                                  </Text>
                                </Pressable>
                              );
                            })}
                            {group === "color" && row.length < columns && (
                              <View style={{ flex: 114 }} />
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
                {p.error && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry result count"
                    onPress={p.onRetry}
                    style={s.retry}
                  >
                    <Text accessibilityRole="alert" style={s.option}>
                      {p.error} Tap to retry.
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    p.loading
                      ? "Show results, counting"
                      : p.total === undefined || p.error
                        ? "Show Results"
                        : `Show ${p.total} Results`
                  }
                  onPress={p.onApply}
                  style={s.apply}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={["#660007", "#ff517f"]}
                    locations={[0.47832, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, s.chipGradient]}
                  />
                  {p.loading && (
                    <ActivityIndicator size="small" color="white" />
                  )}
                  <Text style={s.applyText}>
                    {p.total === undefined || p.loading || p.error
                      ? "Show Results"
                      : `Show ${p.total} Results`}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  modal: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Platform.OS === "web" ? "#21090f" : "transparent",
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    backgroundColor: c.burgundy,
  },
  content: { paddingTop: 44.49, paddingHorizontal: 24, gap: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    color: "white",
    ...typography.heading,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
  clear: {
    fontFamily: f.light,
    fontSize: 14,
    lineHeight: 16.8,
    color: "white",
    textDecorationLine: "underline",
  },
  groups: { gap: 32 },
  group: {
    paddingBottom: 24,
    borderBottomWidth: 0.1,
    borderBottomColor: "rgba(255,255,255,.2)",
    gap: 20,
  },
  label: {
    fontFamily: f.regular,
    fontSize: 18,
    lineHeight: 21.6,
    color: "white",
  },
  row: { flexDirection: "row", gap: 4, alignItems: "stretch" },
  chip: {
    minWidth: 0,
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    backgroundColor: "rgba(190,117,122,.2)",
  },
  chipGradient: { borderRadius: 100 },
  selected: { backgroundColor: "white" },
  colorChip: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 34,
  },
  option: {
    fontFamily: f.light,
    fontSize: 14,
    lineHeight: 18,
    color: "white",
    textAlign: "center",
  },
  selectedText: { fontFamily: f.regular, color: c.roseText },
  apply: {
    minHeight: 51.2,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  applyText: {
    ...typography.button,
    color: "white",
    textAlign: "center",
  },
  retry: { minHeight: 44, justifyContent: "center" },
});
