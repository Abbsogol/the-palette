import { Redirect } from "expo-router";
import HomeDesignPreview from "../preview/home-main";

export default function DesignPreview() {
  return __DEV__ ? <HomeDesignPreview /> : <Redirect href="/" />;
}
