import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Button, Card, Chips, Empty, Notice, styles } from "./primitives";
import { money } from "../../lib/money";
import {
  appointmentFilters,
  appointmentCategory,
  appointmentTiming,
  appointmentActionLabel,
  depositBadge,
  needsTimeReview,
  type AppointmentRole,
  type AppointmentFilter,
  type AppointmentItem,
  type AppointmentPerson,
  type DepositState,
} from "../appointments/model";
export type HistoryFilter = AppointmentFilter;
export const historyFilters = appointmentFilters;
function Person({
  person,
  role,
}: {
  person?: AppointmentPerson;
  role: AppointmentRole;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.row, { flexWrap: "nowrap", alignItems: "center" }]}>
      {person?.avatar && !failed ? (
        <Image
          source={{ uri: person.avatar }}
          cachePolicy="none"
          style={{ width: 48, height: 48, borderRadius: 24 }}
          accessibilityLabel={`${person.name} profile photo`}
          onError={() => setFailed(true)}
        />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "#812740",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={styles.text}>
            {person?.name[0]?.toUpperCase() || "?"}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.subtitle}>
          {person?.name || "Account name unavailable"}
        </Text>
        <Text style={styles.small}>
          {role === "customer" ? "Your nail artist" : "Your client"}
          {person?.username ? ` · @${person.username}` : ""}
        </Text>
      </View>
    </View>
  );
}
export function HistoryCards({
  bookings,
  onOpen,
  role = "customer",
  filter = "Upcoming",
  now,
  payments,
  paymentsLoading = false,
}: {
  bookings: AppointmentItem[];
  onOpen: (id: string) => void;
  role?: AppointmentRole;
  filter?: HistoryFilter;
  now: number;
  payments?: Record<string, DepositState>;
  paymentsLoading?: boolean;
}) {
  if (!bookings.length)
    return (
      <Empty
        title={
          filter === "Requests"
            ? "No requests waiting"
            : filter === "Upcoming"
              ? "No upcoming appointments"
              : filter === "Past"
                ? "Your appointment history"
                : "No cancelled appointments"
        }
        detail={
          filter === "Requests"
            ? role === "creator"
              ? "New client requests will appear here for you to review."
              : "When you request an appointment, follow your artist’s decision here."
            : filter === "Past"
              ? "Completed times and unconfirmed requests that have ended appear here."
              : "Your appointment details keep decisions, payments and refunds together."
        }
      />
    );
  return (
    <>
      {bookings.map((b) => {
        const time = appointmentTiming(b),
          payment = depositBadge(b, payments?.[b.id], paymentsLoading),
          category = appointmentCategory(b, now),
          past = category === "Past",
          amount =
            b.deposit_snapshot == null ? NaN : Number(b.deposit_snapshot),
          price = b.price_snapshot == null ? NaN : Number(b.price_snapshot);
        return (
          <Card key={b.id}>
            <View style={[styles.wrap, { alignItems: "flex-start" }]}>
              <Text style={styles.tag}>
                {b.status === "pending"
                  ? past
                    ? "UNCONFIRMED · TIME PASSED"
                    : role === "creator"
                      ? "REQUEST TO REVIEW"
                      : "AWAITING ARTIST"
                  : b.status === "confirmed"
                    ? past
                      ? "PAST APPOINTMENT"
                      : "CONFIRMED"
                    : b.status.toUpperCase()}
              </Text>
            </View>
            <Person
              key={b.person?.avatar || b.id}
              person={b.person}
              role={role}
            />
            {b.identityUnavailable && (
              <Text style={styles.small}>
                Profile details are unavailable. You can still open this
                appointment.
              </Text>
            )}
            <Text accessibilityRole="header" style={styles.subtitle}>
              {b.services?.name || "Service unavailable"}
            </Text>
            <Text style={styles.text}>{time.date}</Text>
            <Text style={styles.subtitle}>{time.time}</Text>
            <Text style={styles.small}>{time.zone} · creator’s time zone</Text>
            {!!b.location_snapshot && (
              <Text style={styles.muted}>{b.location_snapshot}</Text>
            )}
            {Number.isFinite(price) && Number.isFinite(amount) && (
              <Text style={styles.small}>
                {money(price)} total · {money(amount)} deposit
              </Text>
            )}
            {(!Number.isFinite(price) || !Number.isFinite(amount)) && (
              <Text style={styles.small}>
                Recorded price/deposit terms need review · open details
              </Text>
            )}
            <View
              style={{
                borderRadius: 15,
                padding: 12,
                backgroundColor: payment.attention
                  ? "rgba(255,81,127,.16)"
                  : "rgba(255,255,255,.07)",
                borderColor: payment.attention
                  ? "#c77991"
                  : "rgba(255,255,255,.16)",
                borderWidth: 1,
              }}
            >
              <Text accessibilityLiveRegion="polite" style={styles.text}>
                {payment.label}
              </Text>
            </View>
            {(needsTimeReview(b) || time.review) && (
              <Notice>
                Recorded time needs review. Open details to check it; do not
                assume this is an available future slot.
              </Notice>
            )}
            {b.status === "pending" &&
              b.starts_at &&
              Date.parse(b.starts_at) <= now &&
              !past && (
                <Notice>
                  The requested start time has passed. Open details to review
                  this request.
                </Notice>
              )}
            <Button
              title={appointmentActionLabel(b, role, now)}
              secondary
              onPress={() => onOpen(b.id)}
            />
          </Card>
        );
      })}
    </>
  );
}
export function AppointmentList({
  items,
  role,
  canCreate = false,
  onRole,
  filter,
  onFilter,
  onOpen,
  now,
  loading = false,
  error,
  onRetry,
  refreshing = false,
  hasMore = false,
  onMore,
  payments,
  paymentsLoading = false,
  paymentError,
  onRetryPayments,
}: {
  items: AppointmentItem[];
  role: AppointmentRole;
  canCreate?: boolean;
  onRole: (role: AppointmentRole) => void;
  filter: AppointmentFilter;
  onFilter: (filter: AppointmentFilter) => void;
  onOpen: (id: string) => void;
  now: number;
  loading?: boolean;
  error?: unknown;
  onRetry: () => void;
  refreshing?: boolean;
  hasMore?: boolean;
  onMore: () => void;
  payments?: Record<string, DepositState>;
  paymentsLoading?: boolean;
  paymentError?: unknown;
  onRetryPayments: () => void;
}) {
  const unavailable =
    !!paymentError || Object.values(payments || {}).some((p) => p.unavailable);
  return (
    <>
      <View style={{ gap: 8 }}>
        <Text style={styles.subtitle}>
          {filter === "Requests"
            ? role === "creator"
              ? "Requests need your decision"
              : "Waiting for your artist"
            : filter === "Upcoming"
              ? "Your next appointments"
              : filter === "Past"
                ? "Your appointment history"
                : "Cancellations & declines"}
        </Text>
        <Text style={styles.small}>
          Times shown in each artist’s recorded time zone.
        </Text>
      </View>
      {canCreate && (
        <Chips
          values={["My bookings", "Client bookings"]}
          value={role === "customer" ? "My bookings" : "Client bookings"}
          onChange={(v) => onRole(v === "My bookings" ? "customer" : "creator")}
        />
      )}
      <Chips
        values={historyFilters}
        value={filter}
        onChange={(v) => onFilter(v as HistoryFilter)}
      />
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        {!loading && !error && (
          <Text style={styles.small}>
            {items.length}
            {hasMore ? "+" : ""} shown · {filter.toLowerCase()}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            refreshing ? "Refreshing appointments…" : "Refresh appointments"
          }
          accessibilityState={{ disabled: refreshing, busy: refreshing }}
          disabled={refreshing}
          onPress={onRetry}
          style={[styles.chip, refreshing && { opacity: 0.5 }]}
        >
          <Text style={styles.text}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </Text>
        </Pressable>
      </View>
      {loading && (
        <ActivityIndicator
          color="white"
          accessibilityLabel="Loading appointments"
        />
      )}
      {!!error && (
        <Notice error>
          Couldn’t load this appointment list. Refresh to check your access and
          current bookings.
        </Notice>
      )}
      {!loading && !error && (
        <>
          <HistoryCards
            bookings={items}
            onOpen={onOpen}
            role={role}
            filter={filter}
            now={now}
            payments={payments}
            paymentsLoading={paymentsLoading}
          />
        </>
      )}
      {!loading && !error && unavailable && (
        <>
          <Notice error>
            Some payment/refund statuses could not be verified. Open details or
            retry; a paid flag does not confirm a refund.
          </Notice>
          <Button
            title="Retry payment statuses"
            secondary
            disabled={paymentsLoading}
            onPress={onRetryPayments}
          />
        </>
      )}
      {!error && hasMore && (
        <Button
          title="Load more appointments"
          secondary
          disabled={loading || refreshing}
          onPress={onMore}
        />
      )}
    </>
  );
}
