import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { HomeIcon } from "../home/home-primitives";
import { homeFonts } from "../home/tokens";
import { labAssets, labSwatches } from "./assets";
import {
  labOptions,
  normalizedHex,
  toggleChoice,
  type LabSettings,
} from "./model";
import {
  LabButton,
  LabHeader,
  LabMessage,
  LabPageBody,
  LabSheet,
  LabShell,
  s,
} from "./primitives";

export type LabViewProps = {
  width?: number;
  settings: LabSettings;
  onSettings: (settings: LabSettings) => void;
  credits: number | null;
  subscribed?: boolean;
  subscriptionLoading?: boolean;
  busy?: boolean;
  recovering?: boolean;
  pending?: boolean;
  notice?: string;
  error?: string;
  onGenerate: () => void;
  onRetry?: () => void;
  onHistory: () => void;
  onCredits: () => void;
  children?: ReactNode;
};
function Choices({
  label,
  values,
  selected,
  onSelect,
  multiple = false,
}: {
  label: string;
  values: string[];
  selected: string[];
  onSelect: (value: string) => void;
  multiple?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.muted}>{label}</Text>
      <View style={styles.choices}>
        {values.map((value) => (
          <Pressable
            key={value}
            accessibilityRole={multiple ? "checkbox" : "radio"}
            accessibilityLabel={`${label}: ${value}`}
            accessibilityState={{ checked: selected.includes(value) }}
            hitSlop={4}
            onPress={() => onSelect(value)}
            style={[styles.chip, selected.includes(value) && styles.selected]}
          >
            <Text style={styles.chipText}>{value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function Section({
  title,
  required,
  collapsible = false,
  initiallyExpanded = true,
  children,
}: {
  title: string;
  required?: boolean;
  collapsible?: boolean;
  initiallyExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const heading = (
    <>
      <Text
        accessibilityRole={collapsible ? undefined : "header"}
        style={[s.sectionTitle, { flex: 1 }]}
      >
        {title}
      </Text>
      <Text style={[styles.sectionLabel, required && { color: "#d98cab" }]}>
        {required ? "REQUIRED" : "OPTIONAL"}
      </Text>
      {collapsible && (
        <View
          style={{ transform: [{ rotate: expanded ? "90deg" : "-90deg" }] }}
        >
          <HomeIcon source={labAssets.back} size={16} />
        </View>
      )}
    </>
  );
  return (
    <View style={s.card}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={[s.spread, styles.sectionToggle]}
        >
          {heading}
        </Pressable>
      ) : (
        <View style={s.spread}>{heading}</View>
      )}
      {(!collapsible || expanded) && children}
    </View>
  );
}
export function LabView(p: LabViewProps) {
  const [picker, setPicker] = useState(false);
  const [hex, setHex] = useState("");
  const [colorError, setColorError] = useState("");
  const settings = p.settings;
  const ready =
    settings.vibe.length > 0 && !!settings.shape && !!settings.length;
  const toggleColor = (value: string) => {
    if (settings.colors.length >= 4 && !settings.colors.includes(value)) {
      setColorError(
        "Choose up to 4 colours. Remove one before adding another.",
      );
      return;
    }
    setColorError("");
    p.onSettings({
      ...settings,
      colors: toggleChoice(settings.colors, value, 4),
    });
  };
  const custom = settings.colors.filter(
    (value) => !labSwatches.some((swatch) => swatch.hex === value),
  );
  const actionTitle = p.recovering
    ? "Checking your generation…"
    : p.pending
      ? "Retry / recover this generation"
      : p.subscriptionLoading
        ? "Checking subscription…"
        : p.subscribed === false
          ? "Subscribe to Nail Lab"
          : p.credits === null
        ? "Checking design tokens…"
        : p.credits < 1
          ? "Buy design tokens"
          : "Generate · 1 design token";
  const action = (
    <>
      <Text style={[s.small, { textAlign: "center", fontSize: 13 }]}>
        {p.pending
          ? "Your request is saved. Retrying will not charge twice."
          : p.credits === 0
            ? "Top up with 30 or 100 design tokens"
            : "Select vibe, shape & length to generate"}
      </Text>
      <LabButton
        title={actionTitle}
        busy={p.busy}
        disabled={
          p.recovering || p.subscriptionLoading ||
          (!p.pending && p.subscribed !== false && (p.credits === null || (p.credits > 0 && !ready)))
        }
        secondary={!p.pending && p.credits === 0}
        onPress={!p.pending && (p.subscribed === false || p.credits === 0) ? p.onCredits : p.onGenerate}
      />
    </>
  );
  return (
    <LabShell width={p.width} dark>
      <LabHeader
        credits={p.credits}
        onHistory={p.onHistory}
        onCredits={p.onCredits}
      />
      <LabPageBody action={action}>
        <Text style={s.subtitle}>Generate a custom nail design with AI</Text>
        {p.subscribed === false && !p.pending && <LabMessage>Subscribe for $5/month and get 15 designs each billing month. An active subscription is required, including when using purchased tokens.</LabMessage>}
        <Text style={s.small}>Each new generation uses 1 design token. Finished images cannot be edited. Saving and sharing do not use tokens.</Text>
        {p.credits === 0 && !p.pending && (
          <LabMessage>
            Each new design uses 1 token. Subscribe to Nail Lab, or top up after using your monthly allowance.
          </LabMessage>
        )}
        {!!p.error && (
          <>
            <LabMessage error>{p.error}</LabMessage>
            {p.onRetry && (
              <LabButton
                title="Try again"
                secondary
                disabled={p.busy}
                onPress={p.onRetry}
              />
            )}
          </>
        )}
        {(p.recovering || p.pending || p.notice) && (
          <View style={s.card} accessibilityLiveRegion="polite">
            <View style={s.row}>
              {(p.recovering || (p.pending && p.busy)) && (
                <ActivityIndicator
                  color="#f6aec9"
                  accessibilityLabel="Checking generation progress"
                />
              )}
              <Text style={[s.sectionTitle, { flex: 1 }]}>
                {p.recovering
                  ? "Finding your last design"
                  : p.pending
                    ? p.busy
                      ? "Creating your design"
                      : "Your design is in progress"
                    : "Nail Lab update"}
              </Text>
            </View>
            <Text style={s.text}>
              {p.notice ||
                (p.recovering
                  ? "Checking for an unfinished generation before you start another."
                  : "Your request is saved. Recover this design below; retrying the same request won’t spend another token.")}
            </Text>
            {p.pending && (
              <Text style={s.small}>
                You can leave this screen and return to recover your design.
              </Text>
            )}
          </View>
        )}
        {p.children}
        <Section title="1. Essentials" required collapsible>
          <Choices
            label="Vibe / Style"
            values={labOptions.vibe}
            selected={settings.vibe}
            multiple
            onSelect={(value) =>
              p.onSettings({
                ...settings,
                vibe: toggleChoice(settings.vibe, value, 10),
              })
            }
          />
          <Choices
            label="Shape"
            values={labOptions.shape}
            selected={[settings.shape]}
            onSelect={(shape) => p.onSettings({ ...settings, shape })}
          />
          <Choices
            label="Length"
            values={labOptions.length}
            selected={[settings.length]}
            onSelect={(length) => p.onSettings({ ...settings, length })}
          />
        </Section>
        <Section title="2. Personalize" collapsible initiallyExpanded={false}>
          <View style={{ gap: 12 }}>
            <View style={s.spread}>
              <Text style={s.muted}>Colours</Text>
              <Text style={s.small}>Select up to 4</Text>
            </View>
            <View style={{ gap: 10 }}>
              {["Nudes", "Pinks"].map((group) => (
                <View key={group} style={{ gap: 6 }}>
                  <Text style={[s.small, { fontSize: 11 }]}>
                    {group.toUpperCase()}
                  </Text>
                  <View style={styles.swatches}>
                    {labSwatches
                      .filter((swatch) => swatch.group === group)
                      .map((swatch) => (
                        <Pressable
                          key={swatch.hex}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Colour: ${swatch.name}`}
                          accessibilityState={{
                            checked: settings.colors.includes(swatch.hex),
                          }}
                          hitSlop={4}
                          onPress={() => toggleColor(swatch.hex)}
                          style={[
                            styles.swatch,
                            settings.colors.includes(swatch.hex) &&
                              styles.swatchSelected,
                          ]}
                        >
                          <HomeIcon source={swatch.image} size={36} />
                          {settings.colors.includes(swatch.hex) && (
                            <View style={styles.check}>
                              <Text style={{ color: "#3c000e", fontSize: 12 }}>
                                ✓
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      ))}
                    {group === "Nudes" && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add custom colour"
                        onPress={() => setPicker(true)}
                        style={[styles.swatch, styles.plus]}
                      >
                        <Text style={s.text}>+</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
            {!!custom.length && (
              <View style={styles.swatches}>
                {custom.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Colour: ${value}`}
                    accessibilityState={{ checked: true }}
                    onPress={() => toggleColor(value)}
                    style={[
                      styles.swatch,
                      styles.swatchSelected,
                      { backgroundColor: value },
                    ]}
                  >
                    <View style={styles.check}>
                      <Text style={{ color: "#3c000e", fontSize: 12 }}>✓</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            {!!colorError && !picker && (
              <Text accessibilityRole="alert" style={s.small}>
                {colorError}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Custom colour picker"
              onPress={() => setPicker(true)}
              style={[s.spread, styles.pickerRow]}
            >
              <View style={s.row}>
                <HomeIcon source={labAssets.palette} size={16} />
                <Text style={s.text}>Custom colour picker</Text>
              </View>
              <Text style={s.muted}>›</Text>
            </Pressable>
          </View>
          <Choices
            label="Occasion"
            values={labOptions.occasion}
            selected={settings.occasion}
            multiple
            onSelect={(value) =>
              p.onSettings({
                ...settings,
                occasion: toggleChoice(settings.occasion, value, 8),
              })
            }
          />
        </Section>
        <Section title="3. Inspiration">
          <Text style={s.small}>
            Describe your inspiration in words: colours, textures and finishing touches. Image references aren’t available in this beta.
          </Text>
          <View style={{ gap: 8 }}>
            <Text style={s.muted}>Additional details</Text>
            <TextInput
              accessibilityLabel="Additional details"
              value={settings.customText}
              onChangeText={(customText) =>
                p.onSettings({ ...settings, customText })
              }
              multiline
              maxLength={500}
              placeholder="e.g. chrome finish, marble texture, with tiny stars…"
              placeholderTextColor="rgba(255,255,255,.5)"
              style={[s.field, { minHeight: 80, textAlignVertical: "top" }]}
            />
          </View>
        </Section>
      </LabPageBody>
      <LabSheet
        visible={picker}
        onClose={() => setPicker(false)}
        title="Custom colour picker"
      >
        <Text style={s.text}>
          Enter a hex colour to add it to your palette.
        </Text>
        <View style={s.row}>
          <View
            style={[
              styles.swatch,
              { backgroundColor: normalizedHex(hex) ?? "#d98cab" },
            ]}
          />
          <TextInput
            accessibilityLabel="Hex colour"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            placeholder="#D98CAB"
            placeholderTextColor="#bb929d"
            value={hex}
            onChangeText={(value) => {
              setHex(value);
              setColorError("");
            }}
            style={[s.field, { flex: 1 }]}
          />
        </View>
        {!!colorError && <LabMessage error>{colorError}</LabMessage>}
        <LabButton
          title="Add colour"
          onPress={() => {
            const value = normalizedHex(hex);
            if (!value) {
              setColorError("Enter a valid hex colour, such as #D98CAB.");
              return;
            }
            if (!settings.colors.includes(value)) {
              if (settings.colors.length >= 4) {
                setColorError(
                  "Choose up to 4 colours. Remove one before adding another.",
                );
                return;
              }
              toggleColor(value);
            }
            setColorError("");
            setPicker(false);
            setHex("");
          }}
        />
      </LabSheet>
    </LabShell>
  );
}
export function GeneratedResult({
  imageUrl,
  busy,
  onSave,
  onPublish,
}: {
  imageUrl: string;
  busy: boolean;
  freeAvailable: boolean;
  onSave: () => void;
  onPublish: () => void;
  onVariation: () => void;
}) {
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.sectionTitle}>
        Your design
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Open generated design" disabled={busy} onPress={onSave}><Image
        source={imageUrl}
        style={{ width: "100%", aspectRatio: 1.5, borderRadius: 12 }}
        contentFit="contain"
        cachePolicy="none"
        accessibilityLabel="Generated nail design"
      /></Pressable>
      <LabButton title="Save privately" disabled={busy} onPress={onSave} />
      <LabButton
        title="Add details & publish design"
        secondary
        disabled={busy}
        onPress={onPublish}
      />

    </View>
  );
}
const styles = StyleSheet.create({
  sectionToggle: {
    minHeight: 44,
    marginHorizontal: -20,
    marginVertical: -10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionLabel: {
    color: "rgba(255,255,255,.5)",
    fontFamily: homeFonts.regular,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
  },
  selected: { backgroundColor: "#d98cab", borderColor: "#d98cab" },
  chipText: {
    color: "white",
    fontFamily: homeFonts.light,
    fontSize: 14,
    lineHeight: 16,
  },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: { outlineWidth: 2, outlineColor: "white", outlineOffset: 2 },
  check: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: {
    backgroundColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
  },
  pickerRow: {
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 44,
  },
});
