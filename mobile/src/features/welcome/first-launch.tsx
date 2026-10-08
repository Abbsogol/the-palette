import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
const INTRO_KEY = "laque.introduction.v1";
const Context = createContext({
  ready: false,
  seen: false,
  complete: async () => {},
});
export function FirstLaunchProvider({
  children,
  preview = false,
}: PropsWithChildren<{ preview?: boolean }>) {
  const key = preview ? `${INTRO_KEY}.preview` : INTRO_KEY;
  const [ready, setReady] = useState(false),
    [seen, setSeen] = useState(false);
  useEffect(() => {
    let active = true;
    // This stores only an introduction preference, never credentials or account data.
    void AsyncStorage.getItem(key)
      .then((value) => {
        if (active) setSeen(value === "complete");
      })
      .catch(() => {
        if (active) setSeen(false);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  const complete = async () => {
    await AsyncStorage.setItem(key, "complete");
    setSeen(true);
  };
  return (
    <Context.Provider value={{ ready, seen, complete }}>
      {children}
    </Context.Provider>
  );
}
export const useFirstLaunch = () => useContext(Context);
