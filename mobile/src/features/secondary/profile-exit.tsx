import { useCallback, useEffect, useState } from "react";
import { Platform, Text } from "react-native";
import { LabSheet } from "../lab-ui/primitives";
import { Button, styles } from "./primitives";
import { accountScope } from "../../lib/account-scope";
export function useProfileExit() {
  return useDraftExit("Unsaved profile changes");
}
export type DraftStatus = { dirty: boolean; busy: boolean };
export function useDraftExit(title: string) {
  const [status, setStatus] = useState<DraftStatus>({
    dirty: false,
    busy: false,
  });
  const [leave, setLeave] = useState<null | (() => void)>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || (!status.dirty && !status.busy)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status.dirty, status.busy]);
  const requestExit = useCallback(
    (action: () => void) => {
      if (status.busy) return;
      if (!status.dirty) {
        action();
        return;
      }
      const ticket = accountScope.capture();
      setLeave(() => () => {
        if (accountScope.isCurrent(ticket)) action();
      });
    },
    [status],
  );
  const close = () => setLeave(null);
  return {
    status,
    onStatusChange: setStatus,
    requestExit,
    dialog: (
      <LabSheet title={title} visible={!!leave} onClose={close}>
        <Text style={styles.text}>
          Your edits haven’t been saved. Keep editing or discard them and leave
          this page.
        </Text>
        <Button title="Keep editing" onPress={close} />
        <Button
          title="Discard changes"
          secondary
          onPress={() => {
            const action = leave;
            close();
            action?.();
          }}
        />
      </LabSheet>
    ),
  };
}
