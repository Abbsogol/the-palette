import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { Booking } from "../../lib/types";
import { appointmentICS } from "./calendar-event";
export async function exportAppointment(b: Booking) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Calendar sharing is unavailable on this device.");
  const file = new File(Paths.cache, `laque-appointment-${b.id}.ics`);
  try {
    file.create({ overwrite: true });
    file.write(appointmentICS(b));
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/calendar",
      UTI: "public.calendar-event",
      dialogTitle: "Add appointment to calendar",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
