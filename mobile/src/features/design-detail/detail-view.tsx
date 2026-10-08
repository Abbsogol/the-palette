import { LabButton, LabSheet } from "../lab-ui/primitives";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeNavigation } from "../../components/home-tab-bar";
import { HomeGlass, HomeIcon, compactCount } from "../home/home-primitives";
import { homeAssets } from "../home/assets";
import { homeFonts } from "../home/tokens";
import { searchAssets } from "../search/assets";
import { detailAssets } from "./assets";
import type { DetailModel, DetailPhoto } from "./model";

export type DetailViewProps = {
  design?: DetailModel;
  width: number;
  saved?: boolean;
  saving?: boolean;
  loading?: boolean;
  error?: string;
  actionError?: string;
  selectedTab?: string;
  onRetry: () => void;
  onBack: () => void;
  onShare: () => void;
  onSave: () => void;
  onShowTech: () => void;
  onNavigate: (name: string) => void;
  actions?: { label: string; onPress: () => void }[];
};

function Photo({
  photo,
  thumbnail = false,
  contain = false,
}: {
  photo: DetailPhoto;
  thumbnail?: boolean;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  if (failed)
    return (
      <Pressable
        style={s.failedPhoto}
        accessibilityRole="button"
        accessibilityLabel="Retry image"
        onPress={(event) => {
          event.stopPropagation();
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      >
        <Text style={s.body}>Image unavailable</Text>
        <Text style={s.small}>Tap to retry</Text>
      </Pressable>
    );
  if (thumbnail && photo.thumbnailCrop === "cathedral-cross")
    return (
      <View style={s.crossBounds}>
        <View style={s.crossRotate}>
          <View style={s.crossClip}>
            <Image
              key={attempt}
              source={photo.source}
              contentFit="fill"
              cachePolicy="none"
              style={s.crossImage}
              onError={() => setFailed(true)}
              accessible={false}
            />
          </View>
        </View>
      </View>
    );
  return (
    <Image
      key={attempt}
      source={thumbnail ? photo.thumbnail || photo.source : photo.source}
      testID={`detail-photo-${photo.id}`}
      contentFit={contain ? "contain" : "cover"}
      cachePolicy="none"
      style={StyleSheet.absoluteFill}
      onError={() => setFailed(true)}
      accessible={false}
    />
  );
}

function Chips({ items, tags = false }: { items: string[]; tags?: boolean }) {
  const { fontScale } = useWindowDimensions();
  // Figma rows: four technique chips then three; tags use three / four / three.
  const sizes = tags ? [3, 4, 3] : [4, 3];
  const rows: string[][] = [];
  for (let i = 0; i < items.length; ) {
    const size = sizes[rows.length] || 3;
    rows.push(items.slice(i, i + size));
    i += size;
  }
  return (
    <View style={s.chips}>
      {rows.map((row, index) => (
        <View key={index} style={s.chipRow}>
          {row.map((item, i) => (
            <View
              key={`${item}-${i}`}
              style={[s.chip, fontScale > 1.3 && { minWidth: "40%" }]}
            >
              <Text style={s.small}>
                {tags ? `#${item.replace(/^#/, "")}` : item}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function DetailView(p: DetailViewProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const width = Math.max(1, p.width - 48),
    scale = p.width / 393;
  const d = p.design;
  const [shareMenu, setShareMenu] = useState(false);
  const [page, setPage] = useState(d?.initialPhoto || 0);
  const pageRef = useRef(page),
    gallery = useRef<ScrollView>(null);
  const [enlarged, setEnlarged] = useState<DetailPhoto | null>(null);
  // A failed refresh or a removed photo must also revoke the full-screen view.
  const visiblePhoto =
    !p.error && !p.loading && d
      ? [...d.photos, ...d.closeups].find((photo) => photo.id === enlarged?.id)
      : undefined;
  const [copyNotice, setCopyNotice] = useState(""),
    [copyError, setCopyError] = useState(false);
  useEffect(() => {
    gallery.current?.scrollTo({ x: pageRef.current * width, animated: false });
  }, [width]);
  const choosePhoto = (index: number) => {
    pageRef.current = index;
    setPage(index);
    gallery.current?.scrollTo({ x: index * width, animated: true });
  };
  const copy = async (code: string) => {
    try {
      if (!(await Clipboard.setStringAsync(code)))
        throw new Error("Clipboard unavailable");
      setCopyError(false);
      setCopyNotice(`Copied ${code}`);
    } catch {
      setCopyError(true);
      setCopyNotice(`Could not copy. Colour code: ${code}`);
    }
  };
  return (
    <View style={s.root}>
      <ScrollView
        testID="design-detail-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 17),
          paddingBottom: Math.max(insets.bottom, 34) + 110,
        }}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
        >
          <Image
            source={homeAssets.background}
            accessible={false}
            contentFit="fill"
            style={{
              position: "absolute",
              left: -21 * scale,
              top: -7 * scale,
              width: 629 * scale,
              height: 1353 * scale,
            }}
          />
        </View>
        <Text style={s.logo}>LaQue</Text>
        <View style={s.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={7}
            onPress={p.onBack}
            style={s.toolbarButton}
          >
            <HomeIcon source={detailAssets.back} size={16} />
            <Text style={s.small}>Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share design"
            hitSlop={7}
            disabled={!d || !!p.error}
            onPress={() => setShareMenu(true)}
            style={s.toolbarButton}
          >
            <HomeIcon source={detailAssets.share} size={16} />
            <Text style={s.small}>Share</Text>
          </Pressable>
        </View>
        {p.loading ? (
          <View style={s.state}>
            <ActivityIndicator
              accessibilityLabel="Loading design"
              color="white"
            />
          </View>
        ) : p.error || !d ? (
          <View style={s.state}>
            <Text accessibilityRole="alert" style={s.body}>
              {p.error || "This design is unavailable."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={p.onRetry}
              style={s.retry}
            >
              <Text style={s.body}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.galleryGroup}>
              <View style={[s.hero, { height: (383 * width) / 345 }]}>
                {d.photos.length ? (
                  <ScrollView
                    ref={gallery}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    testID="design-gallery"
                    contentOffset={{ x: (d.initialPhoto || 0) * width, y: 0 }}
                    onLayout={() =>
                      gallery.current?.scrollTo({
                        x: pageRef.current * width,
                        animated: false,
                      })
                    }
                    onScroll={(event) => {
                      const i = Math.max(
                        0,
                        Math.min(
                          d.photos.length - 1,
                          Math.round(event.nativeEvent.contentOffset.x / width),
                        ),
                      );
                      if (i !== pageRef.current) {
                        pageRef.current = i;
                        setPage(i);
                      }
                    }}
                    scrollEventThrottle={16}
                  >
                    {d.photos.map((photo, i) => (
                      <View
                        key={photo.id}
                        style={{ width, height: "100%" }}
                        accessibilityElementsHidden={i !== page}
                        importantForAccessibility={
                          i !== page ? "no-hide-descendants" : "auto"
                        }
                        aria-hidden={i !== page}
                      >
                        <Pressable
                          style={StyleSheet.absoluteFill}
                          accessibilityRole="button"
                          accessibilityLabel={`Enlarge ${d.title} image ${i + 1}`}
                          onPress={() => setEnlarged(photo)}
                        >
                          <Photo photo={photo} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={s.failedPhoto}>
                    <Text style={s.body}>No image available</Text>
                  </View>
                )}
                <Pressable
                  style={s.save}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.saved ? "Unsave" : "Save"} ${d.title}`}
                  accessibilityState={{
                    selected: !!p.saved,
                    busy: !!p.saving,
                    disabled: !!p.saving,
                  }}
                  disabled={p.saving}
                  hitSlop={4}
                  onPress={p.onSave}
                >
                  <LinearGradient
                    colors={["#be757a", "#bb4866"]}
                    style={StyleSheet.absoluteFill}
                  />
                  {p.saving ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <HomeIcon
                        source={
                          p.saved
                            ? homeAssets.heartFilled
                            : searchAssets.savedHeart
                        }
                        size={16}
                      />
                      <Text style={s.saveCount}>{compactCount(d.saves)}</Text>
                    </>
                  )}
                </Pressable>
              </View>
              {d.photos.length > 1 && (
                <View style={s.pagination}>
                  {d.photos.map((photo, i) => (
                    <Pressable
                      key={photo.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Show image ${i + 1} of ${d.photos.length}`}
                      accessibilityState={{ selected: i === page }}
                      onPress={() => choosePhoto(i)}
                      style={[s.pageTarget, { width: i === page ? 32 : 12 }]}
                    >
                      <Image
                        source={
                          i === page
                            ? detailAssets.pageActive
                            : detailAssets.pageInactive
                        }
                        accessible={false}
                        contentFit="fill"
                        style={{ width: i === page ? 32 : 12, height: 4 }}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <View style={s.content}>
              <View style={s.section}>
                <View style={s.titleRow}>
                  <Text accessibilityRole="header" style={s.title}>
                    {d.title}
                  </Text>
                  {d.reviewCount !== undefined && (
                    <Text style={s.reviews}>{d.reviewCount} Review</Text>
                  )}
                </View>
                {!!d.description && <Text style={s.body}>{d.description}</Text>}
              </View>
              {!!d.techniques.length && (
                <Section title="Technique">
                  <Chips items={d.techniques} />
                </Section>
              )}
              {!!d.closeups.length && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.closeupScroll}
                  contentContainerStyle={s.closeups}
                >
                  {d.closeups.map((photo, i) => (
                    <Pressable
                      key={photo.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Enlarge close-up ${i + 1}`}
                      onPress={() => setEnlarged(photo)}
                      style={s.closeup}
                    >
                      <Photo photo={photo} thumbnail />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {!!d.colours.length && (
                <Section title="Colour Specs">
                  {d.colours.map((colour) => (
                    <HomeGlass
                      key={colour.id}
                      style={[
                        s.colourCard,
                        fontScale > 1.3 && { flexWrap: "wrap" },
                      ]}
                      intensity={15}
                    >
                      {colour.image ? (
                        <Image
                          source={colour.image}
                          contentFit="contain"
                          accessible={false}
                          style={[
                            s.colourImage,
                            { width: Math.min(105, Math.max(64, width - 190)) },
                          ]}
                        />
                      ) : (
                        <View
                          accessibilityLabel={
                            colour.hex || "Colour swatch unavailable"
                          }
                          style={[
                            s.swatch,
                            {
                              backgroundColor:
                                colour.hex || "rgba(255,255,255,.15)",
                            },
                          ]}
                        />
                      )}
                      <View style={s.colourText}>
                        <Text style={s.colourName}>{colour.name}</Text>
                        {!!colour.code && (
                          <Text selectable style={s.small}>
                            <Text style={{ color: "rgba(255,255,255,.6)" }}>
                              Code:{" "}
                            </Text>
                            {colour.code}
                          </Text>
                        )}
                      </View>
                      {!!colour.code && (
                        <Pressable
                          style={s.copy}
                          accessibilityRole="button"
                          accessibilityLabel={`Copy colour code ${colour.code}`}
                          onPress={() => void copy(colour.code)}
                        >
                          <HomeIcon source={detailAssets.copy} size={16} />
                        </Pressable>
                      )}
                    </HomeGlass>
                  ))}
                  {!!copyNotice && (
                    <Text
                      accessibilityRole={copyError ? "alert" : undefined}
                      accessibilityLiveRegion="polite"
                      style={s.small}
                    >
                      {copyNotice}
                    </Text>
                  )}
                </Section>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share with my nail tech"
                accessibilityHint="Choose a conversation to share this design"
                onPress={p.onShowTech}
                style={s.cta}
              >
                <LinearGradient
                  colors={["#660007", "#ff517f"]}
                  locations={[0.47832, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={s.sectionTitle}>Share with my nail tech</Text>
              </Pressable>
              {!!d.tags.length && (
                <Section title="Tags">
                  <Chips items={d.tags} tags />
                </Section>
              )}
              {!!p.actions?.length && (
                <Section title="More options">
                  {p.actions.map((action) => (
                    <Pressable
                      key={action.label}
                      accessibilityRole="button"
                      onPress={action.onPress}
                      style={s.moreAction}
                    >
                      <Text style={s.body}>{action.label}</Text>
                    </Pressable>
                  ))}
                </Section>
              )}
            </View>
          </>
        )}
      </ScrollView>
      {!!p.actionError && (
        <Text
          accessibilityRole="alert"
          style={[s.notice, { top: Math.max(insets.top, 17) + 89 }]}
        >
          {p.actionError}
        </Text>
      )}
      <LabSheet
        visible={shareMenu && !!d && !p.error && !p.loading}
        title="Share design"
        onClose={() => setShareMenu(false)}
      >
        <LabButton
          title="Share to Chat"
          onPress={() => {
            setShareMenu(false);
            p.onShowTech();
          }}
        />
        <LabButton
          title="Share outside LaQue"
          secondary
          onPress={() => {
            setShareMenu(false);
            p.onShare();
          }}
        />
      </LabSheet>
      <HomeNavigation
        selected={p.selectedTab || "index"}
        onSelect={p.onNavigate}
      />
      <Modal
        visible={!!visiblePhoto}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setEnlarged(null)}
      >
        <View
          style={[
            s.viewer,
            {
              paddingTop: Math.max(insets.top, 20),
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close image"
            onPress={() => setEnlarged(null)}
            style={s.viewerClose}
          >
            <HomeIcon source={detailAssets.back} size={16} />
            <Text style={s.body}>Close</Text>
          </Pressable>
          {visiblePhoto && (
            <View
              style={{ flex: 1, width: "100%" }}
              accessibilityLabel={`${d?.title || "Design"} enlarged`}
            >
              <Photo key={visiblePhoto.id} photo={visiblePhoto} contain />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#241b20" },
  logo: {
    color: "white",
    fontFamily: homeFonts.display,
    fontSize: 24,
    lineHeight: 29,
    textAlign: "center",
  },
  toolbar: {
    marginTop: 10,
    marginHorizontal: 24,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,.2)",
  },
  small: {
    color: "white",
    fontFamily: homeFonts.light,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "300",
  },
  body: {
    color: "white",
    fontFamily: homeFonts.light,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "300",
  },
  galleryGroup: { marginHorizontal: 24, marginBottom: 29 },
  hero: {
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,.08)",
  },
  save: {
    position: "absolute",
    right: 16,
    bottom: 16,
    minWidth: 42,
    minHeight: 42,
    padding: 4,
    borderRadius: 50,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  saveCount: {
    color: "white",
    fontFamily: homeFonts.light,
    fontSize: 16,
    lineHeight: 18,
  },
  pagination: {
    height: 16,
    marginTop: 6,
    marginBottom: -6,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  pageTarget: { height: 16, alignItems: "center", justifyContent: "center" },
  content: { marginHorizontal: 24, gap: 32 },
  section: { gap: 12 },
  sectionTitle: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontSize: 18,
    lineHeight: 22,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    color: "white",
    fontFamily: homeFonts.display,
    fontSize: 28,
    lineHeight: 34,
  },
  reviews: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontSize: 14,
    lineHeight: 16,
    textDecorationLine: "underline",
  },
  chips: { gap: 4 },
  chipRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  chip: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 5.5,
    borderRadius: 100,
    backgroundColor: "rgba(190,117,122,.2)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,.22)",
  },
  closeupScroll: { marginRight: -24, flexGrow: 0 },
  closeups: { gap: 4, paddingRight: 24 },
  closeup: {
    width: 132,
    height: 112,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,.05)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,.35)",
  },
  crossBounds: {
    position: "absolute",
    left: -128,
    top: -166,
    width: 387.946,
    height: 427.36,
    alignItems: "center",
    justifyContent: "center",
  },
  crossRotate: { width: 237, height: 356, transform: [{ rotate: "31.46deg" }] },
  crossClip: { flex: 1, overflow: "hidden" },
  crossImage: {
    position: "absolute",
    width: "118.96%",
    height: "118.79%",
    left: "-7.42%",
    top: "7.38%",
  },
  colourCard: {
    borderRadius: 16,
    minHeight: 112,
    paddingLeft: 24,
    paddingRight: 10,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  colourImage: { width: 105, height: 110 },
  swatch: { width: 64, height: 80, borderRadius: 10, marginVertical: 16 },
  colourText: { flex: 1, minWidth: 80, gap: 4, paddingVertical: 12 },
  colourName: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
  },
  copy: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    minHeight: 54,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    overflow: "hidden",
  },
  moreAction: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomColor: "rgba(255,255,255,.15)",
    borderBottomWidth: 0.5,
  },
  failedPhoto: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
  },
  state: {
    padding: 24,
    minHeight: 350,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  retry: {
    minHeight: 44,
    paddingHorizontal: 24,
    justifyContent: "center",
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,.2)",
  },
  notice: {
    position: "absolute",
    left: 24,
    right: 24,
    color: "white",
    fontFamily: homeFonts.regular,
    padding: 12,
    backgroundColor: "#660007",
    borderRadius: 12,
  },
  viewer: { flex: 1, backgroundColor: "#21090f" },
  viewerClose: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 24,
  },
});
