import { PortfolioPreview } from "./portfolio";
import { SecondaryPreview, type SecondaryRoute } from "./secondary";
import { CalendarPreview } from "./calendar";
import { CreditsPreview } from "./credits";
import type { Booking } from "../lib/types";
// Figma sample identities and interactions. Never imported by connected routes.
import { useState } from "react";
import { usePreviewFavorites } from "./favorites-store";
import { BookingPreview, demoAppointment } from "./booking";
import type { PreviewAppointment } from "./appointments";
import { Text, View } from "react-native";
import {
  ProfileView,
  ProfileSettingsView,
  ProfileButton,
  type ProfileAction,
} from "../features/profiles/profile-view";
import { profileAssets as a } from "../features/profiles/assets";
import type {
  ProfileIdentity,
  ProfileDesign,
} from "../features/profiles/model";
import { LabSheet } from "../features/lab-ui/primitives";
import { homeFonts } from "../features/home/tokens";
import { DesignDetailPreview } from "./design-detail";
const tags = ["Minimal", "Glam", "Nail Art", "Gel", "Extensions"];
const artist: ProfileIdentity = {
  id: "demo-artist",
  name: "Kimia Kimia",
  username: "kimia.nails",
  role: "creator",
  location: "Dubai",
  bio: "Specializing in high-end luxury chrome, encapsulated florals, & exquisite hand-painted marble finishes.",
  specialties: tags,
  avatar: require("../../assets/figma/profiles/f31fd.png"),
  cover: a.publicCover,
  replyTime: "Usually replies in 1hr",
};
const customer: ProfileIdentity = {
  id: "demo-owner",
  name: "Sarah",
  username: "sarah.nails",
  role: "user",
  location: "Dubai, UAE",
  bio: "Nail art enthusiast & collector.\nAlways looking for the next stunning set ✨",
  specialties: tags,
  avatar: require("../../assets/figma/profiles/65da1.png"),
  cover: a.ownerCover,
};
const samples: ProfileDesign[] = Array.from({ length: 6 }, (_, i) => ({
  id: `profile-sample-${i}`,
  title: "Cathedral",
  category: "Glamour",
  image: require("../../assets/figma/profiles/6cdce.png"),
  published: i % 2 === 0,
}));
export default function ProfilePreview({
  width,
  publicProfile = false,
  onBack,
  onExitDemo,
  publicIdentity,
  onNavigate,
  initialTab,
  onBookingChat,
}: {
  width: number;
  publicProfile?: boolean;
  onBack?: () => void;
  onExitDemo?: () => void;
  publicIdentity?: Pick<
    ProfileIdentity,
    "id" | "name" | "avatar" | "location" | "role"
  >;
  onNavigate?: (name: string) => void;
  initialTab?: "Designs" | "Services";
  onBookingChat?: (draft?: string, booking?: Booking) => void;
}) {
  const [designEditor, setDesignEditor] = useState<"manager" | "new" | null>(
    null,
  );
  const [secondary, setSecondary] = useState<SecondaryRoute | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [owner, setOwner] = useState(!publicProfile),
    [tab, setTab] = useState(
      publicProfile ? initialTab || "Designs" : "My Designs",
    ),
    [settings, setSettings] = useState(false),
    [profile, setProfile] = useState(customer),
    [localFavorite, setFavorite] = useState(false),
    [following, setFollowing] = useState(false),
    [localSaved, setSaved] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [detail, setDetail] = useState<ProfileDesign | null>(null);
  const [bookingOpen, setBookingOpen] = useState<"new" | "existing" | null>(
    null,
  );
  const [selectedAppointment, setSelectedAppointment] =
    useState<PreviewAppointment | null>(null);
  const identity = publicProfile
    ? publicIdentity?.role === "user"
      ? {
          ...customer,
          ...publicIdentity,
          location: undefined,
          replyTime: undefined,
        }
      : { ...artist, ...publicIdentity }
    : { ...profile, location: owner ? profile.location : undefined };
  const favorites = usePreviewFavorites();
  const saved = favorites ? favorites.library.savedIds : localSaved;
  const favorite = favorites
    ? favorites.library.profiles.some((p) => p.id === identity.id)
    : localFavorite;
  const explain = (label: string) =>
    setNotice(
      `${label} uses the connected app. This demo shows sample profiles and never sends messages, creates bookings or changes a real account.`,
    );
  const back = () => {
    if (settings) {
      setSettings(false);
      return;
    }
    if (!owner && !publicProfile) {
      setOwner(true);
      setTab("My Designs");
      return;
    }
    onBack?.();
  };
  const action = (kind: ProfileAction, id?: string) => {
    if (kind === "book") return setBookingOpen("new");
    if (kind === "appointment" || kind === "upcoming")
      return setBookingOpen("existing");
    if (kind === "back") return back();
    if (kind === "settings") return setSettings(true);
    if (kind === "public") {
      setOwner(false);
      setTab("Designs");
      return;
    }
    if (kind === "edit") return setSecondary("edit");
    if (kind === "favorite") {
      if (favorites)
        favorites.toggleProfile({
          id: identity.id,
          name: identity.name,
          image: identity.avatar || null,
          kind:
            identity.role === "salon"
              ? "SALON"
              : identity.role === "user"
                ? "MEMBER"
                : "NAIL ARTIST",
          location: identity.location,
        });
      else setFavorite(!favorite);
      return;
    }
    if (
      ["saved", "collections", "favorites", "collection"].includes(kind) &&
      onNavigate
    ) {
      onNavigate("saved");
      return;
    }
    if (kind === "follow") return setFollowing(!following);
    if (kind === "save-design" && id) {
      const design = samples.find((d) => d.id === id);
      if (favorites && design) {
        favorites.toggleDesign({
          id: design.id,
          title: design.title,
          image: design.image || null,
          attributes: [design.category || ""].filter(Boolean),
        });
        return;
      }

      setSaved((current) =>
        current.includes(id)
          ? current.filter((v) => v !== id)
          : [...current, id],
      );
      return;
    }
    if (kind === "design") {
      setDetail(samples.find((d) => d.id === id) || null);
      return;
    }
    if (kind === "saved") {
      setTab("Saved");
      return;
    }
    if (kind === "collections") {
      setTab("Collections");
      return;
    }
    if (kind === "credits") {
      setCreditsOpen(true);
      return;
    }
    if (kind === "portfolio" || kind === "upload-design") {
      setDesignEditor(kind === "upload-design" ? "new" : "manager");
      return;
    }
    explain(
      (
        {
          book: "Appointment booking",
          message: "Messaging",
          appointment: "Appointment details",
          credits: "Lab Credits",
          upcoming: "Booking history",
          favorites: "Favorite artists",
          collection: "Collection management",
          share: "Sharing this sample profile",
          block: "Blocking a profile",
          report: "Reporting a profile",
        } as Partial<Record<ProfileAction, string>>
      )[kind] || "This action",
    );
  };
  const designs = (
    tab === "Saved"
      ? samples.filter((d) => saved.includes(d.id))
      : owner
        ? samples.slice(0, 4)
        : publicProfile
          ? identity.role === "user"
            ? samples.filter((d) => d.published)
            : samples.map((d) => ({ ...d, published: true }))
          : samples.slice(0, 4).filter((d) => d.published)
  ).map((d) => ({ ...d, saved: saved.includes(d.id) }));
  const settingItems = [
    { title: "Edit Profile", icon: a.account },
    { title: "Creator Studio", icon: a.folder },
    { title: "Booking History", icon: a.calendar },
    { title: "Google Calendar", icon: a.calendar },
    { title: "Nail Lab History", icon: a.credits },
    { title: "Notifications", icon: a.notifications },
    { title: "Privacy & Safety", icon: a.safety },
    { title: "Lab Credits", icon: a.credits },
    { title: "Help & Support", icon: a.help },
    { title: "Delete Account", icon: a.safety },
  ].map((v) => ({
    ...v,
    onPress: () =>
      v.title === "Google Calendar"
        ? setCalendarOpen(true)
        : v.title === "Lab Credits"
          ? setCreditsOpen(true)
          : v.title === "Nail Lab History"
            ? onNavigate?.("lab")
            : v.title === "Edit Profile"
              ? setSecondary("edit")
              : v.title === "Creator Studio"
                ? setSecondary("business")
                : v.title === "Booking History"
                  ? setSecondary("appointments")
                  : v.title === "Privacy & Safety"
                    ? setSecondary("privacy")
                    : v.title === "Delete Account"
                      ? setSecondary("delete")
                      : explain(v.title),
  }));
  if (designEditor)
    return (
      <PortfolioPreview
        width={width}
        startNew={designEditor === "new"}
        onClose={() => setDesignEditor(null)}
      />
    );
  if (secondary && !calendarOpen && !bookingOpen)
    return (
      <SecondaryPreview
        initial={secondary}
        profile={profile}
        onSaveProfile={(p) => setProfile((v) => ({ ...v, ...p }))}
        onBack={() => setSecondary(null)}
        onCalendar={() => setCalendarOpen(true)}
        onAppointment={(selection) => {
          setSelectedAppointment(selection);
          setBookingOpen("existing");
        }}
        onExit={() => {
          setSecondary(null);
          onExitDemo?.();
        }}
        onPortfolio={() => setDesignEditor("manager")}
        onCredits={() => { setSecondary(null); setCreditsOpen(true); }}
      />
    );
  if (creditsOpen)
    return (
      <CreditsPreview width={width} onBack={() => setCreditsOpen(false)} />
    );
  return (
    <View style={{ flex: 1 }}>
      {calendarOpen && (
        <CalendarPreview width={width} onBack={() => setCalendarOpen(false)} />
      )}
      {bookingOpen && (
        <BookingPreview
          width={width}
          artist={
            selectedAppointment?.artist ||
            (publicProfile ? identity.name : "Kim")
          }
          client={selectedAppointment?.client}
          initialRole={
            selectedAppointment?.role === "creator" ? "creator" : "client"
          }
          initialPaymentStatus={selectedAppointment?.paymentStatus}
          initialAppointment={
            bookingOpen === "existing"
              ? selectedAppointment?.booking || demoAppointment()
              : undefined
          }
          onClose={() => {
            setBookingOpen(null);
            setSelectedAppointment(null);
          }}
          onChat={(draft, booking) =>
            onBookingChat
              ? onBookingChat(draft, booking)
              : onNavigate?.("messages")
          }
        />
      )}
      {settings ? (
        <ProfileSettingsView
          width={width}
          onBack={back}
          items={settingItems}
          moreItems={[
            {
              title: "Edit Profile",
              icon: a.account,
              onPress: () => action("edit"),
            },
            {
              title: "Preview account onboarding",
              onPress: () => setSecondary("onboarding"),
            },
            ...(onExitDemo
              ? [{ title: "Exit demo account", onPress: onExitDemo }]
              : []),
          ]}
        />
      ) : (
        <ProfileView
          width={width}
          owner={owner}
          profile={identity}
          tab={tab}
          onTab={setTab}
          onAction={action}
          self={!publicProfile && !owner}
          favorite={favorite}
          following={following}
          stats={
            owner
              ? { followers: 847, designs: 12, following: 234 }
              : publicProfile
                ? identity.role === "user"
                  ? {
                      followers: 847 + Number(following),
                      designs: designs.length,
                      following: 234,
                    }
                  : {
                      followers: 1200 + Number(following),
                      designs: 24,
                      rating: 4.9,
                    }
                : { followers: 847, designs: 2, following: 234 }
          }
          account={
            owner
              ? {
                  upcoming: 2,
                  saved: 48,
                  favorites: 8,
                  collections: 5,
                  credits: 0,
                  appointment: {
                    id: "sample-appointment",
                    name: "Kim",
                    subtitle: "Nail Artist • Dubai",
                    avatar: require("../../assets/figma/profiles/185b1.png"),
                    service: "Chrome Marble Dream",
                    date: "Aug 18, 2026 • 2:00 PM",
                    status: "confirmed",
                  },
                }
              : undefined
          }
          designs={designs}
          collections={[
            { id: "minimal", name: "Minimal favourites" },
            { id: "bridal", name: "Bridal inspiration" },
          ]}
          services={[
            {
              id: "demo-service",
              name: "Chrome Marble Dream",
              description: "Sample service",
              price: 125,
              deposit_amount: 25,
              duration_minutes: 60,
            },
          ]}
          reviews={[]}
        />
      )}
      <LabSheet
        visible={!!notice}
        title="Demo profile"
        onClose={() => setNotice("")}
      >
        <Text
          style={{
            fontFamily: homeFonts.regular,
            color: "white",
            fontSize: 16,
            lineHeight: 24,
          }}
        >
          {notice}
        </Text>
        <ProfileButton title="Got it" onPress={() => setNotice("")} />
      </LabSheet>
      {detail && (
        <DesignDetailPreview
          width={width}
          design={{
            id: detail.id,
            title: detail.title,
            description: "A sample design from the profile.",
            photos: [{ id: "main", source: detail.image! }],
            closeups: [],
            techniques: ["Glamour", "Stiletto"],
            colours: [],
            tags: [],
            saves: 1800,
          }}
          from="search"
          saved={saved.includes(detail.id)}
          onSave={() => action("save-design", detail.id)}
          onClose={() => setDetail(null)}
          onNavigate={onNavigate}
        />
      )}
    </View>
  );
}
