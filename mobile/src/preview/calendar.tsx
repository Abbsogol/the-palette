import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { Modal } from "react-native";
import { CalendarView } from "../features/calendar/calendar-view";
import type { CalendarStatus } from "../features/calendar/model";
const sampleCalendars = [
  { id: "sample-personal", name: "Personal", primary: true },
  { id: "sample-work", name: "Work" },
];
const initial: CalendarStatus = {
  configured: true,
  status: "disconnected",
  sources: [sampleCalendars[0]],
  calendars: sampleCalendars,
  pending: 0,
};
const Context = createContext<{
  state: CalendarStatus;
  setState: (s: CalendarStatus) => void;
} | null>(null);
export function PreviewCalendarProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initial);
  return (
    <Context.Provider value={{ state, setState }}>{children}</Context.Provider>
  );
}
export const usePreviewCalendar = () => useContext(Context);
export function CalendarPreview({
  width,
  onBack,
}: {
  width: number;
  onBack: () => void;
}) {
  const shared = usePreviewCalendar(),
    [local, setLocal] = useState(initial),
    [notice, setNotice] = useState("");
  const state = shared?.state || local,
    setState = shared?.setState || setLocal;
  return (
    <Modal visible animationType="slide" onRequestClose={onBack}>
      <CalendarView
        width={width}
        state={state}
        preview
        notice={notice}
        onBack={onBack}
        onConnect={() => {
          setState({
            ...state,
            status: "connected",
            accountLabel: "LaQue demo calendar",
          });
          setNotice(
            "Example connection enabled. Booking previews now show a sample overlapping event. No Google account was connected.",
          );
        }}
        onDisconnect={() => setState({ ...state, status: "disconnected" })}
        onSave={(ids) => {
          setState({
            ...state,
            sources: sampleCalendars.filter((c) => ids.includes(c.id)),
          });
          setNotice("Preview calendars saved.");
        }}
        onSync={() =>
          setNotice("Preview sync complete. No real calendar was changed.")
        }
        onRetry={() => undefined}
      />
    </Modal>
  );
}
