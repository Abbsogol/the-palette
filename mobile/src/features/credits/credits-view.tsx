import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LabButton, LabMessage, LabShell } from "../lab-ui/primitives";
import { StoryIconButton } from "../stories/story-ui";
import { typography } from "../../theme/typography";
import { creditStoreName, type CreditPack, type CreditHistory, type CreditOperation, type CreditBillingState } from "./model";
export type CreditsViewProps={width?:number;balance:number|null;packs:CreditPack[];subscription?:CreditBillingState["subscription"];canSubscribe?:boolean;loading?:boolean;busy?:boolean;workingOn?:CreditOperation|null;store?:string;history?:CreditHistory|null;historyLoading?:boolean;pending?:boolean;unavailable?:boolean;preview?:boolean;error?:string;notice?:string;onBack:()=>void;onBuy:(id:string)=>void;onRetry:()=>void;onCheck:()=>void;onRestore?:()=>void;onHistoryRetry?:()=>void;onManage?:()=>void;onPolicy?:(page:"privacy"|"terms")=>void};
export function CreditsView(p:CreditsViewProps){
 const insets=useSafeAreaInsets(),[selection,setSelection]=useState<string|null>(null);
 const active=!!p.subscription?.active;
 const monthly=p.packs.find(x=>x.kind==="subscription");
 const tokens=p.packs.filter(x=>x.kind!=="subscription");
 const selected=active?(tokens.find(x=>x.id===selection)||tokens[0]):monthly;
 const allowance=p.subscription?.monthlyRemaining??0;
 const allowed=active?allowance===0:p.canSubscribe!==false;
 const purchasable=!!selected&&allowed&&p.balance!==null&&!!selected.price&&!p.pending&&!p.unavailable&&!p.loading&&!p.busy&&!p.error;
 return <LabShell width={p.width} dark><View style={[s.header,{paddingTop:insets.top+14}]}><StoryIconButton label="Back from Lab subscription" glyph="‹" onPress={p.onBack}/><Text accessibilityRole="header" style={s.title}>Nail Lab membership</Text><Text style={s.star}>✦</Text></View>
 <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
 <View style={s.balanceCard}><Text style={s.eyebrow}>{active?"YOUR NAIL LAB MEMBERSHIP":"CREATE YOUR NEXT SET"}</Text><Text style={s.heading}>{active?"You’re subscribed":"15 designs. Every month."}</Text><Text style={s.packTitle}>{monthly?.price||"$5 USD"} / month</Text><Text style={s.muted}>An active subscription is required to generate designs.</Text><Text style={s.small}>Auto-renews monthly until cancelled. Local store pricing and tax are shown before payment.</Text>
 {active&&<><Text style={s.section}>{allowance} of 15 monthly designs remaining</Text><Text style={s.muted}>{p.subscription?.purchasedTokens??0} purchased design tokens</Text><Text style={s.small}>Current billing period ends {p.subscription?.renewsAt?new Date(p.subscription.renewsAt).toLocaleDateString():"after store verification"}. Monthly allowance resets each billing month; purchased tokens stay on your account and require an active subscription.</Text>{p.onManage&&<LabButton title="Manage subscription" secondary onPress={p.onManage}/>}</>}
 </View>
 {p.preview&&<LabMessage>Design preview · purchases do not take a payment.</LabMessage>}
 {p.busy&&<LabMessage>{p.workingOn==="restore"?"Checking your subscription and purchase history…":"Verifying your purchase. Please wait for confirmation…"}</LabMessage>}
 {p.pending&&<View style={s.status}><Text style={s.section}>Payment awaiting verification</Text><Text style={s.muted}>Do not purchase again. Access and tokens appear after the store confirms payment.</Text><LabButton title="Check purchase status" secondary disabled={p.busy} onPress={p.onCheck}/></View>}
 {!!p.error&&<><LabMessage error>{p.error}</LabMessage><LabButton title="Try again" secondary onPress={p.onRetry} disabled={p.busy}/></>}{!!p.notice&&<LabMessage>{p.notice}</LabMessage>}
 {p.loading?<ActivityIndicator color="#ff9dbb" accessibilityLabel="Loading subscription and token prices"/>:p.unavailable?<View style={s.status}><Text style={s.section}>Purchases aren’t available in this build</Text><Text style={s.muted}>Open a connected store build to subscribe or buy tokens. Existing verified access is shown above.</Text></View>:!p.packs.length?<View style={s.status}><Text style={s.section}>Store products are not available yet</Text><LabButton title="Reload store products" secondary onPress={p.onRetry}/></View>:null}
 <Text accessibilityRole="header" style={s.heading}>More designs, when you need them</Text><Text style={s.muted}>After using your 15 monthly designs, choose a one-time token pack.</Text>
 {(tokens.length?tokens:[{id:"30",credits:30,price:null},{id:"100",credits:100,price:null}]).map(pack=><Pressable key={pack.id} accessibilityRole="radio" accessibilityLabel={`${pack.credits} design tokens${pack.price?`, ${pack.price}`:""}`} accessibilityState={{checked:selected?.id===pack.id,disabled:!active||allowance>0||!!p.busy||!!p.pending}} disabled={!active||allowance>0||p.busy||p.pending} onPress={()=>setSelection(pack.id)} style={[s.pack,selected?.id===pack.id&&s.selected]}><View style={{flex:1,gap:5}}><Text style={s.packTitle}>{pack.credits} design tokens</Text><Text style={s.small}>{pack.credits===30?"$10 USD base price":"$25 USD base price"} · one-time purchase</Text></View><Text style={s.price}>{pack.price||"Store price pending"}</Text></Pressable>)}
 {!active&&<Text style={s.muted}>Subscribe first to use Nail Lab and purchase extra tokens.</Text>}{active&&allowance>0&&<Text style={s.muted}>Use your remaining monthly designs before buying extra tokens.</Text>}
 <View style={s.status}><Text style={s.section}>Every generation is a new design</Text><Text style={s.muted}>1 new generation uses 1 design token. Finished images cannot be edited. A new version is a new generation and uses another token.</Text><Text style={s.small}>Saving, adding publishing details and sharing do not use tokens. Failed attempts that produce no design release their reservation. Retrying the same request does not charge twice.</Text><Text style={s.small}>Lab purchases do not pay appointment deposits or nail services.</Text></View>
 {p.onPolicy&&<View style={s.row}><Pressable accessibilityRole="link" onPress={()=>p.onPolicy?.("terms")}><Text style={s.small}>Terms of use</Text></Pressable><Pressable accessibilityRole="link" onPress={()=>p.onPolicy?.("privacy")}><Text style={s.small}>Privacy policy</Text></Pressable></View>}
 {!p.preview&&<><LabButton title="Check purchases" secondary disabled={p.busy||p.unavailable} onPress={p.onCheck}/>{p.onRestore&&<LabButton title="Restore purchases" secondary disabled={p.busy||p.unavailable} onPress={p.onRestore}/>}<Text style={s.small}>Restoring does not refill used monthly designs or spent tokens. Refunds and cancellations are handled by your purchase provider.</Text></>}
 <Text accessibilityRole="header" style={s.section}>Recent token purchases</Text>{p.historyLoading?<Text style={s.muted}>Refreshing purchase history…</Text>:!p.history?<Text style={s.muted}>Purchase history is unavailable.</Text>:!p.history.items.length?<Text style={s.muted}>No token purchases recorded yet.</Text>:p.history.items.map((receipt,i)=><View key={i} style={s.receipt}><Text style={s.section}>{receipt.credits} design tokens</Text><Text style={s.muted}>{receipt.status==="refunded"?"Refunded / revoked":receipt.status==="credited"?"Tokens added":"Verifying"} · {creditStoreName(receipt.store)}</Text><Text style={s.small}>{receipt.purchasedAt?new Date(receipt.purchasedAt).toLocaleDateString():"Purchase date unavailable"}</Text></View>)}
 </ScrollView><View style={[s.footer,{paddingBottom:Math.max(insets.bottom,18)}]}><Text style={[s.small,{textAlign:"center"}]}>{p.preview?"Preview only · no charge":`Payment through ${creditStoreName(p.store)}`}</Text><LabButton title={p.pending?"Awaiting verification":active?selected?`Buy ${selected.credits} design tokens${selected.price?` · ${selected.price}`:""}`:"Choose a token pack":`Subscribe${monthly?.price?` · ${monthly.price}/month`:" · $5/month"}`} busy={p.busy} disabled={!purchasable} onPress={()=>{if(selected&&purchasable)p.onBuy(selected.id)}}/></View></LabShell>;
}
const s = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  title: {
    ...typography.heading,
    fontSize: 30,
    lineHeight: 36,
    color: "white",
    flex: 1,
  },
  star: { color: "#ffb9d0", fontSize: 27 },
  body: { padding: 24, paddingTop: 0, gap: 22, paddingBottom: 30 },
  balanceCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(247,166,194,.3)",
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eyebrow: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 2,
    color: "#f7cbda",
  },
  balanceStar: { fontSize: 28, color: "#ffd0e0" },
  balance: {
    ...typography.heading,
    fontSize: 60,
    lineHeight: 68,
    color: "white",
  },
  creditWord: { ...typography.body, color: "#ffdfeb" },
  heading: {
    ...typography.heading,
    color: "white",
    fontSize: 28,
    lineHeight: 34,
  },
  section: { ...typography.section, color: "white" },
  muted: { ...typography.caption, color: "#efc8d6" },
  small: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: "#deb5c4",
  },
  pack: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 18,
    minHeight: 94,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
  },
  receipt: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    backgroundColor: "rgba(255,255,255,.055)",
    padding: 18,
    gap: 8,
  },
  receiptHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    borderRadius: 14,
    backgroundColor: "rgba(155,216,185,.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refunded: { backgroundColor: "rgba(255,143,171,.16)" },
  badgeText: { ...typography.caption, fontSize: 11, color: "#ffe5ee" },
  selected: { borderColor: "#f99ab9", backgroundColor: "rgba(208,89,135,.19)" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c299a8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#ffb5cf" },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ffb5cf",
  },
  packTitle: { ...typography.section, color: "white", fontSize: 20 },
  priceColumn: {
    alignItems: "flex-end",
    gap: 4,
    maxWidth: "40%",
    flexShrink: 1,
  },
  price: { ...typography.section, color: "#ffe5ee" },
  status: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    backgroundColor: "rgba(255,255,255,.055)",
    padding: 20,
    gap: 14,
  },
  restore: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.1)",
    backgroundColor: "rgba(35,6,19,.9)",
  },
});
