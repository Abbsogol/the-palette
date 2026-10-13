import { useState } from "react";
import { Modal, Text } from "react-native";
import { CreditsView } from "../features/credits/credits-view";
import { LabButton, LabSheet, s } from "../features/lab-ui/primitives";

export function CreditsPreview({
  width,
  onBack,
}: {
  width: number;
  onBack: () => void;
}) {
  const [pack, setPack] = useState<string | null>(null);
  return (
    <Modal visible animationType="slide" onRequestClose={onBack}>
      <CreditsView
        width={width}
        balance={0}
        preview
        subscription={{active:false,monthlyRemaining:0,purchasedTokens:0,renewsAt:null,store:null}}
        packs={[15, 30, 100].map((credits) => ({
          id: `${credits}`,
          credits,
          kind: credits===15 ? "subscription" : "credits",
          price: credits===15 ? "$5" : credits===30 ? "$10" : "$25",
        }))}
        onBack={onBack}
        onBuy={setPack}
        onRetry={() => undefined}
        onCheck={() => undefined}
      />
      <LabSheet
        visible={!!pack}
        title="Nail Lab membership"
        onClose={() => setPack(null)}
      >
        <Text style={s.sectionTitle}>{pack === "15" ? "$5 / month · 15 designs" : `${pack} design tokens`}</Text>
        <Text style={s.text}>
          In the connected app, you’ll see your local price and confirm this
          purchase with Apple App Store or Google Play Billing. The monthly plan auto-renews until cancelled.
        </Text>
        <Text style={s.muted}>
          This is a design preview. No payment was taken and no credits were
          added.
        </Text>
        <LabButton title="Keep exploring" onPress={() => setPack(null)} />
      </LabSheet>
    </Modal>
  );
}
