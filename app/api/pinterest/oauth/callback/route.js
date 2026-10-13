import { serviceClient } from '@/lib/auth'
import { completeOAuth } from '@/lib/pinterest/connection'
export async function GET(request) {
 let ok=false;let text='Pinterest connection could not be completed. Return to the dashboard and start again.'
 try{await completeOAuth(serviceClient,request);ok=true;text='LaQue’s Pinterest account is connected. Verify the public boards in the dashboard before enabling display.'}catch{}
 // Deliberately no secondary redirect. This URL owns its completion screen.
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LaQue — Pinterest connection</title><style>body{background:#3c000e;color:#ffebeb;font:18px Arial;margin:0;display:grid;place-items:center;min-height:100vh}main{max-width:520px;padding:32px}a{display:inline-block;margin-top:24px;background:#ff477e;color:white;padding:16px 24px;border-radius:40px}</style><main><h1>${ok?'Pinterest connected':'Connection not completed'}</h1><p>${text}</p><a href="/admin?section=pinterest">Return to dashboard</a></main></html>`,{status:ok?200:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",'Set-Cookie':'laque_pinterest_oauth=; Path=/api/pinterest/oauth/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}})
}
