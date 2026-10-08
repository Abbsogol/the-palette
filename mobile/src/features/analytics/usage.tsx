import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Switch, Text, View } from "react-native";
import { usePathname } from "expo-router";
import { randomUUID } from "expo-crypto";
import { accountScope } from "../../lib/account-scope";
import { api } from "../../lib/api";
import { useAuth, useAccountQuery, queryClient } from "../../lib/auth";
import { useSubmission } from "../secondary/use-submission";
import { Card, Section, Notice, Button, styles } from "../secondary/primitives";

export function usageScreen(path: string): string | null {
  // Never transmit route parameters, user IDs, query text or private content.
  const first=path.split("/").filter(Boolean)[0] || "home";
  return ({home:"home",index:"home",lab:"lab",saved:"favorites",conversation:"messages",appointments:"booking",search:"search","nail-lab":"lab",messages:"messages",collections:"favorites",profile:"profile",design:"design",creator:"profile",book:"booking",booking:"booking",story:"stories",update:"updates"} as Record<string,string>)[first] || null;
}
const loadPreference=()=>api<{enabled:boolean}>("/mobile/analytics");
export function UsageAnalytics() {
  const {session}=useAuth();const path=usePathname();
  const preference=useAccountQuery(["usage-preference"],loadPreference,!!session);
  const [state,setState]=useState(AppState.currentState);
  const current=useRef<{owner:string;session:string;screen:string|null;last:number}|null>(null);
  useEffect(()=>{const listener=AppState.addEventListener("change",setState);return ()=>listener.remove()},[]);
  useEffect(()=>{
    const owner=session?.user.id,screen=usageScreen(path);
    if(!owner||!preference.data?.enabled){current.current=null;return;}
    if(state!=="active"||!screen)return;
    const time=Date.now();
    if(!current.current||current.current.owner!==owner||time-current.current.last>=30*60*1000)current.current={owner,session:randomUUID(),screen:null,last:time};
    const visit=current.current,ticket=accountScope.capture();
    if(visit.screen===screen&&time-visit.last<5*60*1000)return;
    const timer=setTimeout(()=>{
      if(!accountScope.isCurrent(ticket)||ticket.id!==owner)return;
      visit.screen=screen;visit.last=Date.now();
      // Best effort, no offline queue or automatic retries. Analytics must not
      // delay navigation, keep credentials, or interfere with app features.
      void api("/mobile/analytics",{id:randomUUID(),sessionId:visit.session,screen,platform:Platform.OS}).catch(()=>undefined);
    },800);
    return ()=>clearTimeout(timer);
  },[session?.user.id,preference.data?.enabled,path,state]);
  return null;
}
export function UsagePreference() {
  const {session,epoch}=useAuth(),submit=useSubmission();
  const query=useAccountQuery(["usage-preference"],loadPreference,!!session);
  return <Section title="Help improve LaQue" subtitle="Optional app usage statistics. Off until you choose to share.">
    <Card><View style={styles.row}><View style={{flex:1,gap:6}}><Text style={styles.text}>Share app usage statistics</Text><Text style={styles.small}>Share screen categories and a temporary app-session ID. No search text, messages, photos or location. Turning this off removes your recorded screen history.</Text></View>
    <Switch accessibilityLabel="Share app usage statistics" value={query.data?.enabled===true} disabled={query.isPending||!!query.error||submit.busy} trackColor={{true:"#bc315b",false:"#71505c"}} thumbColor="#fff1f5" onValueChange={enabled=>void submit.run(async()=>{
      const saved=await api<{enabled:boolean}>("/mobile/analytics",{action:"preference",enabled});
      queryClient.setQueryData([session!.user.id,epoch,"usage-preference"],saved);
    })}/></View>
    <Text style={styles.small}>Screen statistics use a 30-day reporting window. Expired history is removed by daily cleanup. Signed-out browsing is not recorded. Saved designs and booking activity still support normal app operations.</Text>
    {query.error&&<><Notice error>Usage preference could not load.</Notice><Button title="Retry usage preference" secondary onPress={()=>void query.refetch()}/></>}
    {submit.error&&<Notice error>{submit.error}</Notice>}</Card>
  </Section>;
}
