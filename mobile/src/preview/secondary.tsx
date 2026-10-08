import { creatorSetup } from "../features/creator-setup/model";
import {
  useDraftExit,
  useProfileExit,
} from "../features/secondary/profile-exit";
import { CompleteProfile } from "../features/onboarding/complete-profile";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Linking, Text } from "react-native";
import { Screen, styles } from "../features/secondary/primitives";
import { ProfileForm } from "../features/secondary/profile-form";
import { BusinessView } from "../features/secondary/business-view";
import {
  PrivacyView,
  type PrivacySettings,
} from "../features/secondary/privacy-view";
import { DeleteView } from "../features/secondary/delete-view";
import {
  AppointmentPreviewList,
  type PreviewAppointment,
} from "./appointments";
import { ServiceManager } from "../features/secondary/service-manager";
import { Schedule, type Day } from "../features/secondary/hours-form";
import type { ProfileIdentity } from "../features/profiles/model";
import type { Service } from "../lib/types";
export type SecondaryRoute =
  | "edit"
  | "onboarding"
  | "business"
  | "services"
  | "availability"
  | "privacy"
  | "appointments"
  | "delete";
export function SecondaryPreview({
  initial,
  profile,
  onSaveProfile,
  onBack,
  onCalendar,
  onAppointment,
  onExit,
  onPortfolio,
  onCredits,
}: {
  initial: SecondaryRoute;
  profile: ProfileIdentity;
  onSaveProfile: (p: Partial<ProfileIdentity>) => void;
  onBack: () => void;
  onCalendar: () => void;
  onAppointment: (selection: PreviewAppointment) => void;
  onExit: () => void;
  onPortfolio: () => void;
  onCredits?: () => void;
}) {
  const [serviceEditing, setServiceEditing] = useState(false);
  const exit = useProfileExit();
  const serviceExit = useDraftExit("Unsaved service changes");
  const hoursExit = useDraftExit("Unsaved working hours");
  const [route, setRoute] = useState(initial),
    [privacy, setPrivacy] = useState<PrivacySettings>({
      is_private: false,
      message_permission: "everyone",
      show_saves: true,
    }),
    [blocks, setBlocks] = useState([
      {
        id: "sample-block",
        name: "Elena R.",
        username: "elena.nails",
        avatar: null,
      },
    ]),
    [creator, setCreator] = useState(profile.role !== "user"),
    [hours, setHours] = useState<Day[]>([]),
    [zone, setZone] = useState("Asia/Dubai"),
    [services, setServices] = useState<Service[]>([
      {
        id: "demo-service",
        creator_id: "demo-owner",
        name: "Chrome Marble Dream",
        description: "Gel manicure with a chrome finish.",
        price: 125,
        deposit_amount: 25,
        duration_minutes: 60,
        is_active: true,
      },
    ]);
  const [businessLocation, setBusinessLocation] = useState(
    profile.role !== "user" ? profile.location || "" : "",
  );
  const titles = {
    edit: "Edit profile",
    onboarding: "Complete your profile",
    business: "Creator studio",
    services: "My services",
    availability: "Working hours",
    privacy: "Privacy & safety",
    appointments: "Appointments",
    delete: "Delete account",
  };
  const back = () => {
    if (route === initial) onBack();
    else setRoute(initial);
  };
  const saveProfile: React.ComponentProps<
    typeof ProfileForm
  >["onSave"] = async (v, media) => {
    setCreator(v.role === "Creator");
    setBusinessLocation(v.booking_area);
    onSaveProfile({
      name: v.display_name,
      ...(media
        ? {
            avatar:
              typeof media.avatar === "string"
                ? { uri: media.avatar }
                : media.avatar,
            cover:
              typeof media.banner === "string"
                ? { uri: media.banner }
                : media.banner || undefined,
          }
        : {}),
      username: v.username,
      bio: v.bio,
      specialties: v.specialties || [],
      location: v.location,
      role: v.role === "Creator" ? "creator" : "user",
    });
  };
  const ProfileEditor = route === "onboarding" ? CompleteProfile : ProfileForm;
  return (
    <Screen
      resetScrollKey={`${route}:${serviceEditing}`}
      title={titles[route]}
      onBack={() =>
        route === "edit"
          ? exit.requestExit(back)
          : route === "services"
            ? serviceExit.requestExit(back)
            : route === "availability"
              ? hoursExit.requestExit(back)
              : back()
      }
    >
      {route !== "delete" && (
        <Text style={styles.tag}>
          DEMO ACCOUNT · CHANGES STAY IN THIS PREVIEW
        </Text>
      )}
      {(route === "edit" || route === "onboarding") && (
        <ProfileEditor
          key={route}
          onStatusChange={exit.onStatusChange}
          onContinue={async (role) => {
            if (role === "Creator") setRoute("business");
            else onBack();
          }}
          avatar={profile.avatar}
          banner={profile.cover}
          onPick={async () => {
            const selected = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.85,
              allowsMultipleSelection: false,
            });
            if (selected.canceled) return null;
            const image = selected.assets[0];
            if (image.fileSize && image.fileSize > 8 * 1024 * 1024)
              throw new Error("Choose an image smaller than 8 MB.");
            return { url: image.uri, preview: { uri: image.uri } };
          }}
          initial={{
            display_name: profile.name,
            username: profile.username || "sarah.nails",
            location: profile.location || "",
            bio: profile.bio || "",
            booking_area: businessLocation,
            specialties: profile.specialties,
            role: creator ? "Creator" : "Customer",
          }}
          onSave={saveProfile}
        />
      )}
      {exit.dialog}
      {route === "business" && (
        <BusinessView
          creator={creator}
          setup={creatorSetup(
            {
              display_name: profile.name,
              username: profile.username || "sarah.nails",
              location: profile.location || "",
              booking_area: businessLocation,
              onboarding_complete: true,
              account_type: creator ? "creator" : "user",
            },
            { services, days: hours, timeZone: zone, publishedDesigns: 1 },
          )}
          onStart={() => {
            setCreator(true);
            onSaveProfile({ role: "creator" });
          }}
          onOpen={(r) => {
            if (r === "calendar-connect") onCalendar();
            else if (r === "portfolio") onPortfolio();
            else setRoute(r === "profile-edit" ? "edit" : r);
          }}
        />
      )}
      {route === "privacy" && (
        <PrivacyView
          settings={privacy}
          blocks={blocks}
          onUpdate={(v) => setPrivacy((p) => ({ ...p, ...v }))}
          onUnblock={async (id) => {
            setBlocks((b) => b.filter((v) => v.id !== id));
            return true;
          }}
          onPolicy={() =>
            void Linking.openURL("https://www.laque.app/privacy#retention")
          }
          onDelete={() => setRoute("delete")}
        />
      )}
      {route === "delete" && (
        <DeleteView
          demo
          onAppointments={() => setRoute("appointments")}
          onCredits={onCredits}
          onSupport={() => Linking.openURL("mailto:contact@laque.app?subject=LaQue%20account%20closure")}
          onDelete={async () => undefined}
          onPolicy={() =>
            Linking.openURL("https://www.laque.app/privacy#retention")
          }
          onDone={onExit}
          onCancel={back}
        />
      )}
      {route === "availability" && (
        <Schedule
          initial={hours}
          zone={zone}
          onStatusChange={hoursExit.onStatusChange}
          onCalendar={() => hoursExit.requestExit(onCalendar)}
          onSave={async (z, d) => {
            setZone(z);
            setHours(d);
          }}
        />
      )}
      {route === "services" && (
        <ServiceManager
          onEditorChange={setServiceEditing}
          services={services}
          onStatusChange={serviceExit.onStatusChange}
          requestExit={serviceExit.requestExit}
          onHours={() => setRoute("availability")}
          onLocation={() => setRoute("edit")}
          onSave={async (draft, service, draftId) => {
            setServices((rows) =>
              service
                ? rows.map((row) =>
                    row.id === service.id ? { ...row, ...draft } : row,
                  )
                : [
                    ...rows,
                    {
                      ...draft,
                      id: draftId,
                      creator_id: "demo-owner",
                      is_active: true,
                    },
                  ],
            );
          }}
          onVisibility={async (service, active) => {
            setServices((rows) =>
              rows.map((row) =>
                row.id === service.id ? { ...row, is_active: active } : row,
              ),
            );
          }}
        />
      )}
      {serviceExit.dialog}
      {hoursExit.dialog}
      {route === "appointments" && (
        <AppointmentPreviewList onOpen={onAppointment} />
      )}
    </Screen>
  );
}
