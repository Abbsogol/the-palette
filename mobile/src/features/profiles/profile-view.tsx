import { typography } from "../../theme/typography";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeGlass, HomeIcon, compactCount } from "../home/home-primitives";
import { homeColors, homeFonts } from "../home/tokens";
import { LabSheet } from "../lab-ui/primitives";
import { profileAssets as a } from "./assets";
import {
  roleLabel,
  ownerTabs,
  publicTabs,
  type ProfileIdentity,
  type ProfileDesign,
  type ProfileStats,
  type ProfileAccount,
  type ProfileCollection,
  type ProfileReview,
  type ProfileService,
} from "./model";

export type ProfileAction =
  | "back"
  | "share"
  | "settings"
  | "edit"
  | "public"
  | "book"
  | "message"
  | "favorite"
  | "follow"
  | "report"
  | "block"
  | "upcoming"
  | "saved"
  | "favorites"
  | "collections"
  | "credits"
  | "appointment"
  | "design"
  | "save-design"
  | "collection"
  | "portfolio"
  | "upload-design"
  | "onboarding";
export type ProfileViewProps = {
  owner?: boolean;
  width?: number;
  profile?: ProfileIdentity;
  stats?: ProfileStats;
  account?: ProfileAccount;
  tab: string;
  onTab: (tab: string) => void;
  onAction: (action: ProfileAction, id?: string) => void;
  designs?: ProfileDesign[];
  collections?: ProfileCollection[];
  services?: ProfileService[];
  reviews?: ProfileReview[];
  loading?: boolean;
  error?: string;
  contentLoading?: boolean;
  contentError?: string;
  statsError?: string;
  onRetry?: () => void;
  onRetryContent?: () => void;
  onRetryStats?: () => void;
  onMore?: () => void;
  hasMore?: boolean;
  busy?: boolean;
  favorite?: boolean;
  following?: boolean;
  self?: boolean;
  actionError?: string;
  onRefresh?: () => void;
  needsOnboarding?: boolean;
};
export function ProfileShell({
  children,
  width: supplied,
}: {
  children: ReactNode;
  width?: number;
}) {
  const { width } = useWindowDimensions();
  return (
    <View style={s.outer}>
      <View
        style={[
          s.shell,
          {
            width:
              supplied ??
              (Platform.OS === "web" ? Math.min(width, 393) : width),
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}
export function ProfileIconButton({
  label,
  icon,
  size = 16,
  onPress,
  selected = false,
  disabled = false,
}: {
  label: string;
  icon: number;
  size?: number;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={s.iconTouch}
    >
      <HomeGlass
        style={[s.iconCircle, selected && { backgroundColor: "#ba3055" }]}
        intensity={12}
      >
        <HomeIcon source={icon} size={size} />
      </HomeGlass>
    </Pressable>
  );
}
export function ProfileButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={
          // The Figma gradient starts before the visible button; use its sampled left edge across platforms.
          secondary ? ["transparent", "transparent"] : ["#981a2e", "#ff517f"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.button, secondary && s.outline]}
      >
        <Text style={s.buttonText}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}
export function ProfileNotice({
  text,
  retry,
}: {
  text: string;
  retry?: () => void;
}) {
  return (
    <View style={s.notice}>
      <Text style={s.body}>{text}</Text>
      {retry && <ProfileButton title="Try again" secondary onPress={retry} />}
    </View>
  );
}
function GlassCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={[s.glass, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(255,205,219,.1)",
          "transparent",
          "transparent",
          "rgba(255,205,219,.15)",
        ]}
        locations={[0, 0.24, 0.64, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
function Stats({
  stats,
  owner,
  customer,
}: {
  stats?: ProfileStats;
  owner: boolean;
  customer: boolean;
}) {
  const rows = [
    ["Followers", stats?.followers],
    ["Designs", stats?.designs],
    [
      owner || customer ? "Following" : "Rating",
      owner || customer ? stats?.following : stats?.rating,
    ],
  ] as const;
  return (
    <View style={s.statRow}>
      {rows
        .filter(([label]) => label !== "Rating" || !customer)
        .map(([label, value]) => (
          <GlassCard key={label} style={s.stat}>
            <Text style={s.statValue}>
              {value == null
                ? "—"
                : label === "Rating"
                  ? value.toFixed(1)
                  : compactCount(value)}
            </Text>
            <Text style={[s.small, { lineHeight: 12 }]}>{label}</Text>
          </GlassCard>
        ))}
    </View>
  );
}
export function ProfileView(p: ProfileViewProps) {
  const { owner = false, profile, stats, account, onAction, tab, onTab } = p;
  const insets = useSafeAreaInsets(),
    win = useWindowDimensions();
  const width =
    p.width ?? (Platform.OS === "web" ? Math.min(win.width, 393) : win.width);
  const [menu, setMenu] = useState(false);
  const scale = width / 393,
    top = Math.max(insets.top, 44),
    coverHeight = 266 * scale + Math.max(0, top - 44);
  const tabs = owner
    ? ownerTabs
    : profile?.role === "user"
      ? ["Designs", "About"]
      : publicTabs;
  const privatePublic = !owner && profile?.private;
  const cover =
    profile?.cover ?? (profile?.role === "user" ? a.ownerCover : a.publicCover);
  const action = (name: ProfileAction, id?: string) => onAction(name, id);
  const shortcut = (
    key: "upcoming" | "saved" | "favorites" | "collections" | "credits",
    label: string,
    icon: number,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${account?.[key] ?? "unavailable"}`}
      onPress={() => action(key)}
      style={{ flex: 1 }}
    >
      <GlassCard style={s.shortcut}>
        <View style={s.spread}>
          <HomeIcon source={icon} size={16} />
          <Text style={s.shortcutNumber}>{account?.[key] ?? "—"}</Text>
        </View>
        <Text style={s.small}>{label}</Text>
      </GlassCard>
    </Pressable>
  );
  return (
    <ProfileShell width={width}>
      <ScrollView
        testID={owner ? "owner-profile" : "public-profile"}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 34) + 130,
        }}
      >
        <View style={{ height: coverHeight }}>
          <Image
            source={cover}
            contentFit="cover"
            contentPosition={
              cover === a.ownerCover
                ? { top: "30.485%", left: "50%" }
                : "center"
            }
            style={StyleSheet.absoluteFill}
            accessible={false}
          />
          <LinearGradient
            colors={["rgba(0,0,0,.25)", "transparent"]}
            style={[StyleSheet.absoluteFill, { height: 130 }]}
          />
          <View style={[s.topNav, { top }]}>
            <ProfileIconButton
              label="Back"
              icon={a.back}
              onPress={() => action("back")}
            />
            <View style={s.row}>
              {!owner && (
                <ProfileIconButton
                  label="Share profile"
                  icon={a.share}
                  size={16}
                  onPress={() => action("share")}
                />
              )}
              <ProfileIconButton
                label={owner ? "Settings" : "Profile options"}
                icon={a.more}
                onPress={() => (owner ? action("settings") : setMenu(true))}
              />
            </View>
          </View>
        </View>
        {p.loading ? (
          <View style={s.padded}>
            <ActivityIndicator
              color="white"
              accessibilityLabel="Loading profile"
            />
          </View>
        ) : p.error || !profile ? (
          <View style={s.padded}>
            <ProfileNotice
              text={p.error || "This profile is unavailable."}
              retry={p.onRetry}
            />
          </View>
        ) : (
          <>
            <View style={[s.identity, { marginTop: -66 * scale }]}>
              <View style={{ alignItems: "center" }}>
                <View style={s.avatarRing}>
                  <View pointerEvents="none" style={s.avatarStroke} />
                  {profile.avatar ? (
                    <Image
                      source={profile.avatar}
                      cachePolicy="none"
                      recyclingKey={profile.id}
                      style={s.avatar}
                      contentFit="cover"
                      accessibilityLabel={`${profile.name} profile photo`}
                    />
                  ) : (
                    <View style={[s.avatar, s.avatarFallback]}>
                      <Text style={s.initial}>
                        {profile.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <LinearGradient
                  colors={["#ff517f", "#99314c"]}
                  locations={[0.39548, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.badge}
                >
                  <Text style={s.badgeText}>{roleLabel(profile.role)}</Text>
                </LinearGradient>
              </View>
              {(owner || (!p.self && profile.role !== "user")) && (
                <View style={s.identityAction}>
                  <ProfileIconButton
                    label={
                      owner
                        ? "Edit profile"
                        : p.favorite
                          ? "Remove favorite artist"
                          : "Favorite artist"
                    }
                    icon={owner ? a.edit : a.heart}
                    size={14}
                    selected={!owner && p.favorite}
                    disabled={p.busy}
                    onPress={() => action(owner ? "edit" : "favorite")}
                  />
                </View>
              )}
            </View>
            <View style={s.info}>
              <View style={{ gap: 16 }}>
                <View style={{ gap: 2, alignItems: "center" }}>
                  <Text accessibilityRole="header" style={s.name}>
                    {profile.name}
                  </Text>
                  {!!profile.username && (
                    <Text style={s.small}>@{profile.username}</Text>
                  )}
                  {profile.location && (
                    <View style={s.location}>
                      <Image
                        source={a.location}
                        style={{ width: 12, height: 12.2058 }}
                      />
                      <Text style={[s.small, { lineHeight: 12 }]}>
                        {profile.location}
                      </Text>
                    </View>
                  )}
                </View>
                {(profile.bio || profile.specialties.length > 0) && (
                  <View style={{ gap: 12 }}>
                    {profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
                    <View style={s.chips}>
                      {profile.specialties.map((tag) => (
                        <HomeGlass key={tag} style={s.chip} intensity={6}>
                          <Text style={[s.small, { lineHeight: 13.2 }]}>
                            {tag}
                          </Text>
                        </HomeGlass>
                      ))}
                    </View>
                  </View>
                )}
              </View>
              <View style={{ gap: 12 }}>
                {owner ? (
                  <ProfileButton
                    title="Public Profile"
                    onPress={() => action("public")}
                  />
                ) : (
                  <>
                    {profile.role !== "user" && !p.self && (
                      <ProfileButton
                        title="Book Appointment"
                        disabled={p.busy}
                        onPress={() => action("book")}
                      />
                    )}
                    {profile.role !== "user" && !p.self && (
                      <ProfileButton
                        title="Message"
                        secondary
                        disabled={p.busy}
                        onPress={() => action("message")}
                      />
                    )}
                    {profile.role === "user" && !p.self && (
                      <ProfileButton
                        title={p.following ? "Following" : "Follow"}
                        secondary={p.following}
                        disabled={p.busy}
                        onPress={() => action("follow")}
                      />
                    )}
                    {profile.role !== "user" && profile.replyTime && (
                      <View style={[s.row, { justifyContent: "center" }]}>
                        <HomeIcon source={a.clock} size={12} />
                        <Text style={s.small}>{profile.replyTime}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
              {p.actionError && <ProfileNotice text={p.actionError} />}
              {p.needsOnboarding && owner && (
                <ProfileButton
                  title="Finish onboarding"
                  secondary
                  onPress={() => action("onboarding")}
                />
              )}
            </View>
            <View style={s.dashboard}>
              {owner && (
                <View style={s.row}>
                  <HomeIcon source={a.lock} size={16} />
                  <Text style={s.sectionTitle}>My Account</Text>
                </View>
              )}
              <Stats
                stats={stats}
                owner={owner}
                customer={profile.role === "user"}
              />
              {owner && (
                <View style={{ gap: 4 }}>
                  <View style={s.statRow}>
                    {shortcut("upcoming", "Upcoming", a.calendar)}
                    {shortcut("saved", "Saved", a.saved)}
                    {shortcut("favorites", "Favorites", a.favorites)}
                  </View>
                  <View style={s.statRow}>
                    {shortcut("collections", "Collections", a.folder)}
                    {shortcut("credits", "Credits", a.credits)}
                  </View>
                </View>
              )}
              {p.statsError && (
                <ProfileNotice text={p.statsError} retry={p.onRetryStats} />
              )}
            </View>
            {owner && (
              <View style={s.appointmentWrap}>
                {account?.appointment ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View Appointment"
                    onPress={() =>
                      action("appointment", account.appointment!.id)
                    }
                  >
                    <GlassCard style={s.appointment}>
                      <View style={s.spread}>
                        <Text style={s.appointmentTitle}>
                          Upcoming Appointment
                        </Text>
                        <View style={s.status}>
                          <Text
                            style={[
                              s.statusText,
                              {
                                color:
                                  account.appointment.status === "confirmed"
                                    ? "#07885e"
                                    : "#704400",
                              },
                            ]}
                          >
                            {account.appointment.status === "confirmed"
                              ? "Confirmed"
                              : "Pending"}
                          </Text>
                        </View>
                      </View>
                      <View style={s.rule} />
                      <View style={[s.row, { gap: 12 }]}>
                        {account.appointment.avatar && (
                          <Image
                            source={account.appointment.avatar}
                            cachePolicy="none"
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                          />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={s.body}>{account.appointment.name}</Text>
                          <Text style={s.dim}>
                            {account.appointment.subtitle}
                          </Text>
                        </View>
                      </View>
                      <View style={{ gap: 4 }}>
                        <Text style={s.body}>
                          Service: {account.appointment.service}
                        </Text>
                        <Text style={s.dim}>{account.appointment.date}</Text>
                      </View>
                      <Text style={s.link}>View Appointment →</Text>
                    </GlassCard>
                  </Pressable>
                ) : (
                  account && <ProfileNotice text="No upcoming appointments." />
                )}
              </View>
            )}
            <View style={s.tabs} accessibilityRole="tablist">
              {tabs.map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityLabel={t}
                  accessibilityState={{ selected: tab === t }}
                  onPress={() => onTab(t)}
                  style={[s.tab, tab === t && s.activeTab]}
                >
                  <Text style={[s.tabText, tab === t && { color: "white" }]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={s.gridSection}>
              {p.contentLoading ? (
                <ActivityIndicator
                  color="white"
                  accessibilityLabel="Loading profile content"
                />
              ) : p.contentError ? (
                <ProfileNotice text={p.contentError} retry={p.onRetryContent} />
              ) : privatePublic && tab !== "About" ? (
                <ProfileNotice text="This profile is private. Its portfolio is not shared publicly." />
              ) : tab === "About" ? (
                <>
                  <Text style={s.sectionTitle}>About {profile.name}</Text>
                  <Text style={s.body}>
                    {profile.bio || "No biography yet."}
                  </Text>
                  {profile.location && (
                    <Text style={s.dim}>{profile.location}</Text>
                  )}
                  {profile.specialties.length > 0 && (
                    <Text style={s.body}>
                      {profile.specialties.join(" · ")}
                    </Text>
                  )}
                </>
              ) : tab === "Services" ? (
                <>
                  {!p.services?.length && (
                    <ProfileNotice text="No services available yet." />
                  )}
                  {p.services?.map((v) => (
                    <GlassCard key={v.id} style={s.detailCard}>
                      <Text style={s.sectionTitle}>{v.name}</Text>
                      {v.description && (
                        <Text style={s.body}>{v.description}</Text>
                      )}
                      <Text style={s.body}>
                        AED {v.price.toFixed(2)} · {v.duration_minutes} min
                      </Text>
                      <Text style={s.dim}>
                        Deposit AED {v.deposit_amount.toFixed(2)}
                      </Text>
                      {!p.self && (
                        <ProfileButton
                          title={`Book ${v.name}`}
                          onPress={() => action("book", v.id)}
                          disabled={p.busy}
                        />
                      )}
                    </GlassCard>
                  ))}
                </>
              ) : tab === "Reviews" ? (
                <>
                  {!p.reviews?.length && (
                    <ProfileNotice text="No reviews yet." />
                  )}
                  {p.reviews?.map((r) => (
                    <GlassCard key={r.id} style={s.detailCard}>
                      <Text style={s.sectionTitle}>{r.rating} / 5</Text>
                      <Text style={s.body}>
                        {r.text || "No written review."}
                      </Text>
                      <Text style={s.dim}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </Text>
                    </GlassCard>
                  ))}
                </>
              ) : tab === "Collections" ? (
                <>
                  {!p.collections?.length && (
                    <ProfileNotice text="No collections yet. Create one to organise your saved designs." />
                  )}
                  {p.collections?.map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open collection ${c.name}`}
                      onPress={() => action("collection", c.id)}
                    >
                      <GlassCard style={s.detailCard}>
                        <View style={s.spread}>
                          <HomeIcon source={a.folder} size={16} />
                          <Text style={[s.body, { flex: 1 }]}>{c.name}</Text>
                          <Text style={s.body}>›</Text>
                        </View>
                      </GlassCard>
                    </Pressable>
                  ))}
                  <ProfileButton
                    title="Manage collections"
                    secondary
                    onPress={() => action("collections")}
                  />
                </>
              ) : (
                <>
                  {owner && tab === "My Designs" && (
                    <ProfileButton
                      title="Upload a design"
                      onPress={() => action("upload-design")}
                      disabled={p.busy}
                    />
                  )}
                  {!p.designs?.length && (
                    <ProfileNotice
                      text={
                        tab === "Saved"
                          ? "No saved designs yet."
                          : "No designs to show yet."
                      }
                    />
                  )}
                  <View style={s.grid}>
                    {p.designs?.map((d) => (
                      <View
                        key={d.id}
                        style={{
                          width:
                            win.fontScale > 1.5 || width < 340
                              ? "100%"
                              : (width - 56) / 2,
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`View ${d.title}${owner && tab === "My Designs" ? (d.published ? ", Public" : ", Private") : ""}`}
                          onPress={() => action("design", d.id)}
                        >
                          <View style={s.designPhoto}>
                            {d.image ? (
                              <Image
                                source={d.image}
                                cachePolicy="none"
                                recyclingKey={d.id}
                                contentFit="cover"
                                style={StyleSheet.absoluteFill}
                              />
                            ) : (
                              <View style={s.photoFallback}>
                                <Text style={s.small}>Image unavailable</Text>
                              </View>
                            )}
                          </View>
                          <Text numberOfLines={2} style={s.designTitle}>
                            {d.title}
                          </Text>
                          {d.category && (
                            <Text style={s.category}>{d.category}</Text>
                          )}
                        </Pressable>
                        {owner && tab === "My Designs" ? (
                          <View
                            style={[
                              s.visibility,
                              {
                                top:
                                  ((win.fontScale > 1.5 || width < 340
                                    ? width - 48
                                    : (width - 56) / 2) *
                                    222) /
                                    169 -
                                  34,
                                backgroundColor: d.published
                                  ? "#ff517f"
                                  : "#ac2649",
                              },
                            ]}
                          >
                            {!d.published && (
                              <HomeIcon source={a.private} size={12} />
                            )}
                            <Text style={s.small}>
                              {d.published ? "Public" : "Private"}
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              s.saveDesign,
                              {
                                top:
                                  ((win.fontScale > 1.5 || width < 340
                                    ? width - 48
                                    : (width - 56) / 2) *
                                    222) /
                                    169 -
                                  48,
                              },
                            ]}
                          >
                            <ProfileIconButton
                              label={`${d.saved ? "Unsave" : "Save"} ${d.title}`}
                              icon={a.heart}
                              size={14}
                              selected={d.saved}
                              disabled={p.busy}
                              onPress={() => action("save-design", d.id)}
                            />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                  {owner && tab === "My Designs" && (
                    <ProfileButton
                      title={
                        profile.role === "user"
                          ? "Manage my designs"
                          : "Manage portfolio"
                      }
                      secondary
                      onPress={() => action("portfolio")}
                    />
                  )}
                </>
              )}
              {p.hasMore && (
                <ProfileButton
                  title="Load more"
                  secondary
                  onPress={() => p.onMore?.()}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
      <LabSheet
        visible={menu}
        title="Profile options"
        onClose={() => setMenu(false)}
      >
        {!p.self && (
          <>
            <ProfileButton
              title={p.following ? "Unfollow" : "Follow"}
              onPress={() => {
                setMenu(false);
                action("follow");
              }}
              disabled={p.busy}
            />
            <ProfileButton
              title="Report profile"
              secondary
              onPress={() => {
                setMenu(false);
                action("report");
              }}
            />
            <ProfileButton
              title="Block profile"
              secondary
              onPress={() => {
                setMenu(false);
                action("block");
              }}
            />
          </>
        )}
        <ProfileButton
          title="Share profile"
          secondary
          onPress={() => {
            setMenu(false);
            action("share");
          }}
        />
        {p.onRefresh && (
          <ProfileButton
            title="Refresh profile"
            secondary
            onPress={() => {
              setMenu(false);
              p.onRefresh?.();
            }}
          />
        )}
      </LabSheet>
    </ProfileShell>
  );
}
export type SettingsItem = {
  title: string;
  icon?: number;
  onPress: () => void;
  disabled?: boolean;
};
export function ProfileSettingsView({
  onBack,
  items,
  moreItems,
  width,
}: {
  onBack: () => void;
  items: SettingsItem[];
  moreItems: SettingsItem[];
  width?: number;
}) {
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  // Keep the Settings title below the real native status area.
  const statusInset = Platform.OS === "web" ? 0 : insets.top;
  const row = (item: SettingsItem, closeMenu = false) => (
    <Pressable
      key={item.title}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityState={{ disabled: !!item.disabled }}
      disabled={item.disabled}
      onPress={() => {
        if (closeMenu) setMenu(false);
        item.onPress();
      }}
      style={[s.settingsRow, item.disabled && { opacity: 0.5 }]}
    >
      <View pointerEvents="none" style={s.settingsRowBorder} />
      {item.icon && <HomeIcon source={item.icon} size={16} />}
      <Text style={s.settingsLabel}>{item.title}</Text>
      <Text accessible={false} style={s.settingsChevron}>
        ›
      </Text>
    </Pressable>
  );
  return (
    <ProfileShell width={width}>
      {a.settingLines.map((source, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            s.settingsDecoration,
            {
              left: index === 0 ? "33.3333%" : "66.6667%",
              bottom: Math.max(insets.bottom, 34) + 83.5,
            },
          ]}
        >
          <Image
            source={source}
            style={{ width: 20, height: 1 }}
            accessible={false}
          />
        </View>
      ))}
      <View style={[s.settingsHeading, { marginTop: statusInset + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
          onPress={onBack}
          hitSlop={6}
          style={s.settingsBack}
        >
          <HomeIcon source={a.back} size={16} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[typography.heading, { color: "white", flex: 1 }]}
        >
          Settings
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More settings"
          accessibilityState={{ expanded: menu }}
          onPress={() => setMenu(true)}
          hitSlop={5}
          style={[s.settingsBack, { width: 34, height: 34 }]}
        >
          <HomeIcon source={a.more} size={16} />
        </Pressable>
      </View>
      <ScrollView
        testID="profile-settings-list"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.settingsContent,
          { paddingBottom: Math.max(insets.bottom, 34) + 126 },
        ]}
      >
        {items.map((item) => row(item))}
      </ScrollView>
      <LabSheet
        visible={menu}
        title="Account settings"
        onClose={() => setMenu(false)}
      >
        {moreItems.map((item) => row(item, true))}
      </LabSheet>
    </ProfileShell>
  );
}
const s = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: "center",
    backgroundColor: homeColors.burgundy,
  },
  shell: { flex: 1, backgroundColor: homeColors.burgundy },
  topNav: {
    position: "absolute",
    left: 18,
    right: 18,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  iconTouch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { alignItems: "center", position: "relative", minHeight: 130 },
  avatarRing: {
    width: 124,
    height: 124,
    borderRadius: 100,
    padding: 2,
  },
  // Figma's centered stroke does not reduce the 120-point image bounds.
  avatarStroke: {
    position: "absolute",
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderWidth: 12,
    borderColor: homeColors.burgundy,
    borderRadius: 100,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 100 },
  avatarFallback: {
    backgroundColor: "#6b283c",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontFamily: homeFonts.display, fontSize: 36, color: "white" },
  badge: {
    marginTop: -16,
    minHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 100,
  },
  badgeText: {
    fontFamily: homeFonts.light,
    fontSize: 12,
    lineHeight: 16,
    color: "white",
  },
  identityAction: { position: "absolute", right: 18, top: 70 },
  info: { paddingHorizontal: 24, marginTop: 32, gap: 24 },
  name: {
    ...typography.heading,
    textAlign: "center",
    textTransform: "uppercase",
    color: "white",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  bio: {
    fontFamily: homeFonts.light,
    fontSize: 14,
    lineHeight: 15.4,
    textAlign: "center",
    color: "white",
  },
  small: {
    fontFamily: homeFonts.light,
    fontSize: 12,
    lineHeight: 14,
    color: "white",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "rgba(190,117,122,.2)",
  },
  button: {
    minHeight: 47,
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  outline: { borderWidth: 0.7, borderColor: "rgba(255,255,255,.28)" },
  buttonText: {
    ...typography.button,
    color: "white",
    textAlign: "center",
  },
  dashboard: { paddingHorizontal: 24, marginTop: 32, gap: 12 },
  sectionTitle: {
    ...typography.section,
    color: "white",
  },
  statRow: { flexDirection: "row", gap: 4 },
  glass: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,.22)",
  },
  stat: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  statValue: {
    fontFamily: homeFonts.regular,
    fontSize: 18,
    lineHeight: 18,
    color: "white",
  },
  shortcut: { padding: 12, gap: 6, minHeight: 60 },
  shortcutNumber: {
    fontFamily: homeFonts.regular,
    fontSize: 14,
    color: "white",
    fontWeight: "600",
  },
  appointmentWrap: { paddingHorizontal: 24, marginTop: 32 },
  appointment: { borderRadius: 24, padding: 16, gap: 16 },
  appointmentTitle: {
    fontFamily: homeFonts.regular,
    fontWeight: "600",
    fontSize: 15,
    color: "white",
    flex: 1,
  },
  status: {
    backgroundColor: "white",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: homeFonts.regular,
    fontSize: 10,
    fontWeight: "600",
  },
  rule: { height: 1, backgroundColor: "rgba(255,255,255,.07)" },
  body: {
    fontFamily: homeFonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: "white",
  },
  dim: {
    fontFamily: homeFonts.light,
    fontSize: 12,
    lineHeight: 17,
    color: "#c9aeb9",
  },
  link: {
    fontFamily: homeFonts.regular,
    fontSize: 13,
    color: "#ff6e94",
    fontWeight: "600",
  },
  tabs: { flexDirection: "row", marginTop: 32, marginHorizontal: 24 },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: "flex-start",
    paddingBottom: 10,
    paddingTop: 7,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  activeTab: { borderColor: "#d98cab" },
  tabText: {
    fontFamily: homeFonts.regular,
    fontSize: 16,
    lineHeight: 20,
    color: "rgba(255,255,255,.55)",
    textAlign: "center",
  },
  gridSection: { paddingHorizontal: 24, paddingTop: 16, gap: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, rowGap: 16 },
  designPhoto: {
    aspectRatio: 169 / 222,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#612333",
  },
  photoFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  designTitle: {
    fontFamily: homeFonts.regular,
    fontSize: 18,
    lineHeight: 22,
    color: "white",
    marginTop: 8,
  },
  category: {
    fontFamily: homeFonts.light,
    fontSize: 11,
    lineHeight: 14,
    color: "rgba(255,255,255,.8)",
    marginTop: 2,
  },
  visibility: {
    position: "absolute",
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveDesign: { position: "absolute", right: 4, top: 170 },
  detailCard: { padding: 16, gap: 12 },
  notice: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,.06)",
    gap: 12,
  },
  padded: { padding: 24 },
  settingsDecoration: {
    position: "absolute",
    width: 20,
    height: 1,
    marginLeft: -10,
    transform: [{ rotate: "90deg" }],
  },
  settingsHeading: {
    minHeight: 56,
    paddingHorizontal: 24,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  settingsBack: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsContent: { paddingHorizontal: 24, paddingTop: 26, gap: 10 },
  settingsRow: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,.06)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingsRowBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
  },
  settingsLabel: {
    fontFamily: homeFonts.regular,
    fontSize: 15,
    lineHeight: 18,
    color: "white",
    flex: 1,
  },
  settingsChevron: {
    fontFamily: homeFonts.regular,
    fontSize: 18,
    lineHeight: 18,
    color: "#a38b95",
  },
});
