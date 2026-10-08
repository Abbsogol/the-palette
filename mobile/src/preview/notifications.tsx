import { useState } from "react";
import { NotificationsView } from "../features/notifications/notifications-view";
import type { Activity, PushState } from "../features/notifications/model";
const owner = "00000000-0000-4000-8000-000000000001",
  actor = "00000000-0000-4000-8000-000000000002";
const types = ["new_message", "booking_confirmed", "like", "follow"];
export function NotificationsPreview({
  onBack,
  width,
}: {
  onBack: () => void;
  width?: number;
}) {
  const [now] = useState(() => Date.now());
  const [items, setItems] = useState<Activity[]>(() =>
    types.map((type, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index + 3}`,
      user_id: owner,
      actor_id: actor,
      type,
      read: index >= 2,
      design_id: "00000000-0000-4000-8000-000000000010",
      comment_preview: null,
      created_at: new Date(
        now - (index === 3 ? 90000000 : (index + 1) * 900000),
      ).toISOString(),
      actor: {
        id: actor,
        display_name:
          index === 0 ? "Sarah M." : index === 1 ? "Anelia Cafe" : "Elena R.",
        avatar_url: null,
      },
    })),
  );
  const [device, setDevice] = useState<PushState>({
      state: "off",
      registered: false,
    }),
    [notice, setNotice] = useState("");
  return (
    <NotificationsView
      preview
      width={width}
      items={items}
      device={device}
      now={now}
      notice={notice}
      onBack={onBack}
      onRefresh={() =>
        setNotice("Sample activity refreshed. No server was contacted.")
      }
      onOlder={() => undefined}
      onRead={(ids, read) =>
        setItems((old) =>
          old.map((n) => (ids.includes(n.id) ? { ...n, read } : n)),
        )
      }
      onOpen={(n) => {
        setItems((old) =>
          old.map((item) =>
            item.id === n.id ? { ...item, read: true } : item,
          ),
        );
        setNotice(
          "Design preview · open messages, bookings and designs from their tabs to explore sample content.",
        );
      }}
      onEnable={() => setDevice({ state: "enabled", registered: true })}
      onDisable={() => setDevice({ state: "off", registered: false })}
      onCheck={() =>
        setNotice("Sample device state checked. No permission was requested.")
      }
      onSettings={() => {
        setDevice({ state: "denied", registered: true });
        setNotice(
          "Preview of denied permission. Real device settings open in the connected app.",
        );
      }}
    />
  );
}
