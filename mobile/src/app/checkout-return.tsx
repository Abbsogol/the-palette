import { Redirect, useLocalSearchParams } from "expo-router";
import { Notice, Screen } from "../components/ui";
export default function CheckoutReturn() {
  const { booking } = useLocalSearchParams<{ booking?: string }>();
  if (!booking || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(booking))
    return (
      <Screen title="Payment status">
        <Notice>
          Invalid appointment link. Open your appointments to check payment
          status.
        </Notice>
      </Screen>
    );
  return (
    <Redirect href={{ pathname: "/booking/[id]", params: { id: booking } }} />
  );
}
