import { database, ok } from './supabase'

// Test-only SDK transport adapter. Queries and RPCs execute on real migrated
// PostgreSQL under service_role; this does not model HTTP/PostgREST or Storage.
const identifier = value => {
  if (!/^[a-z_][a-z_0-9]*$/i.test(value)) throw new Error(`Unsupported SQL identifier ${value}`)
  return `"${value}"`
}
export function sqlSupabase(db) {
  return database(async q => {
    try {
      const table=identifier(q.table),args=[]
      const bind=value=>{args.push(value);return `$${args.length}`}
      const conditions=q.filters.map(([op,key,value])=>{
        if(op==='eq')return `t.${identifier(key)}=${bind(value)}`
        if(op==='is' && value===null)return `t.${identifier(key)} is null`
        if(op==='in')return `t.${identifier(key)}=any(${bind(value)})`
        throw new Error(`Unsupported filter ${op}`)
      })
      const where=conditions.length?` where ${conditions.join(' and ')}`:''
      let sql
      if(q.operation==='select') {
        sql=q.table==='bookings' && q.columns?.includes('service:')
          ? `select t.*,to_jsonb(s) as service from public.${table} t left join public.services s on s.id=t.service_id${where}`
          : `select t.* from public.${table} t${where}`
      } else if(q.operation==='insert') {
        const fields=Object.keys(q.values).map(identifier)
        sql=`insert into public.${table}(${fields.join(',')}) select ${fields.join(',')} from jsonb_populate_record(null::public.${table},${bind(JSON.stringify(q.values))}) returning *`
      } else if(q.operation==='update') {
        const fields=Object.keys(q.values).map(identifier)
        const payload=bind(JSON.stringify(q.values))
        sql=`update public.${table} t set (${fields.join(',')})=(select ${fields.join(',')} from jsonb_populate_record(null::public.${table},${payload}))${where} returning *`
      } else if(q.operation==='delete')sql=`delete from public.${table} t${where} returning *`
      else throw new Error(`Unsupported operation ${q.operation}`)
      const result=await db.as('service_role',null,sql,args)
      return ok(q.single ? result.rows[0] || null : result.rows)
    } catch(error) {return {data:null,error}}
  },async(name,args={})=>{
    try {
      const keys=Object.keys(args)
      const result=await db.as('service_role',null,`select public.${identifier(name)}(${keys.map((key,i)=>`${identifier(key)} => $${i+1}`).join(',')}) as result`,keys.map(key=>args[key]))
      return ok(result.rows[0].result)
    } catch(error) {return {data:null,error}}
  })
}
