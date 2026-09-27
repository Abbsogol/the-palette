import { Tabs } from "expo-router";
import { Image } from "expo-image";
import { palette } from "../../components/ui";
const tabs = [
  {
    name: "index",
    title: "Home",
    icon: require("../../../assets/figma/home.svg"),
  },
  {
    name: "search",
    title: "Search",
    icon: require("../../../assets/figma/search.svg"),
  },
  { name: "lab", title: "Lab", icon: require("../../../assets/figma/lab.svg") },
  {
    name: "messages",
    title: "Messages",
    icon: require("../../../assets/figma/messages.svg"),
  },
  {
    name: "profile",
    title: "Profile",
    icon: require("../../../assets/figma/profile.svg"),
  },
];
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: palette.muted,
        tabBarActiveBackgroundColor: palette.burgundy,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
        tabBarItemStyle: { borderRadius: 24, margin: 4 },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      {tabs.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: () => (
              <Image
                source={icon}
                style={{ width: 20, height: 20 }}
                accessible={false}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
