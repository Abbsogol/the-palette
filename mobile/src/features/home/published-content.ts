import { environment } from '../../lib/config';
import { supabase } from '../../lib/supabase';
import { checked } from '../../lib/api';
import type { Design } from '../../lib/types';
import { resolvePrivateImage } from '../../lib/designs';

export type PublishedHero = { id:string;imageUrl:string;alt:string;title:string;rotate:0|180 };
export type HomeContent = { revision:number;heroes:PublishedHero[];featuredDesignIds:string[];announcements:{id:string;title:string;body:string}[] };
export async function publishedHome(signal:AbortSignal):Promise<HomeContent> {
 const {data:{session}}=await supabase.auth.getSession();
 const r=await fetch(`${environment.apiUrl}/api/mobile/home-content`,{signal,headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});
 if(!r.ok)throw new Error('Published Home content could not load.');
 const content=await r.json();
 if(!Number.isInteger(content.revision)||!Array.isArray(content.heroes)||!Array.isArray(content.featuredDesignIds)||!Array.isArray(content.announcements))throw new Error('Published Home content is invalid.');
 return content;
}
export async function featuredDesigns(ids:string[],signal:AbortSignal):Promise<Design[]> {
 if(!ids.length)return [];
 const rows=await checked<Design[]>(supabase.from('designs').select('*').eq('is_published',true).in('id',ids).abortSignal(signal));
 return Promise.all(ids.flatMap(id=>{const row=rows.find(x=>x.id===id);return row?[row]:[]}).map(async row=>({...row,image_url:await resolvePrivateImage(row.image_url)})));
}
