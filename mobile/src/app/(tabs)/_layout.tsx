import { Tabs, router } from "expo-router";
import { HomeTabBar, homeTabs } from "../../components/home-tab-bar";
import { RouteAccess } from "../../features/welcome/access";
import { useAuth } from "../../lib/auth";

export default function TabLayout() {
  const { session } = useAuth();
  return (
    <Tabs
      tabBar={(props) => (
        <HomeTabBar
          {...props}
          onBeforeSelect={(name) => {
            if (session) return true;
            router.push({
              pathname: "/auth",
              params: { returnTo: `/${name}` },
            });
            return false;
          }}
        />
      )}
      screenLayout={({ children, route }) => (
        <RouteAccess name={route.name} params={route.params}>
          {children}
        </RouteAccess>
      )}
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
    >
      {homeTabs.map(({ name, title }) => (
        <Tabs.Screen key={name} name={name} options={{ title }} />
      ))}
    </Tabs>
  );
}
