import http from 'node:http';
import crypto from 'node:crypto';
const PORT=Number(process.env.PORT||3000);
const API_KEY=process.env.OPENAI_API_KEY||'';
const TEST_TOKEN=process.env.APP_TEST_TOKEN||'';
const ENABLED=process.env.AI_ENABLED==='true';
const MODEL=process.env.IMAGE_MODEL||'gpt-image-2.5-sunburst';
const origins=new Set((process.env.ALLOWED_ORIGINS||'https://localhost,http://localhost').split(',').map(x=>x.trim()));
const LIMIT=Math.max(1,Number(process.env.MAX_REQUESTS_PER_HOUR||8));
const counts=new Map();
const prompts={
 'enhance':'Naturally improve clarity, lighting, white balance and color.',
 'old-photo':'Restore visible damage and fading, without inventing missing facial features.',
 'colorize':'Colorize this historical black-and-white photograph with plausible natural colors.',
 'remove-bg':'Isolate the foreground subject with a transparent background. Preserve hair and edges.',
 'replace-bg':'Replace only the background as requested. Keep the foreground subject unchanged.',
 'studio-light':'Improve professional lighting while preserving identity and original skin texture.',
 'product-cut':'Keep original product, its logos and labels. Use a pure white background.',
 'product-scene':'Put the exact original product in a realistic advertising studio. Preserve all labels.',
 'headshot':'Create a professional portrait with neutral background and lighting. Preserve exact face.',
 'poster':'Create a beautiful cinematic poster based on the supplied photo.',
 'sky':'Change only the sky, leaving structures and people unchanged.',
 'recolor':'Change only the requested clothing color, maintaining texture and shape.',
 'hair':'Change only the hairstyle as requested; keep the face unchanged.',
 'retouch':'Retouch only temporary blemishes, preserving natural skin texture and facial features.'
};
function cors(req){const origin=req.headers.origin;return origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}:{};}
function send(res,status,obj,headers){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(obj));}
function tokenMatches(req){let s=String(req.headers.authorization||'');s=s.startsWith('Bearer ')?s.slice(7):'';return !!TEST_TOKEN&&s.length===TEST_TOKEN.length&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(TEST_TOKEN));}
async function parseBody(req){let chunks=[],len=0;for await(const b of req){len+=b.length;if(len>11*1024*1024)throw Object.assign(new Error('IMAGE_TOO_LARGE'),{status:413});chunks.push(b);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('BAD_JSON'),{status:400});}}
function withinLimit(req){const hour=Math.floor(Date.now()/3600000),ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0];const prev=counts.get(ip);if(prev?.hour===hour&&prev.n>=LIMIT)return false;counts.set(ip,{hour,n:prev?.hour===hour?prev.n+1:1});if(counts.size>300)for(const [k,v]of counts)if(v.hour!==hour)counts.delete(k);return true;}
http.createServer(async(req,res)=>{
 const headers=cors(req);if(req.headers.origin&&!origins.has(req.headers.origin))return send(res,403,{error:'ORIGIN_NOT_ALLOWED'},headers);
 if(req.method==='OPTIONS'){res.writeHead(204,headers);return res.end();}
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{ok:true,version:'0.6.0',ai_available:!!(ENABLED&&API_KEY&&TEST_TOKEN)},headers);
 if(req.method!=='POST'||req.url!=='/v1/ai/edit')return send(res,404,{error:'NOT_FOUND'},headers);
 if(!ENABLED||!API_KEY||!TEST_TOKEN)return send(res,503,{error:'AI_NOT_CONFIGURED',message:'ИИ отключён. Нужны OPENAI_API_KEY, APP_TEST_TOKEN и AI_ENABLED=true.'},headers);
 if(!tokenMatches(req))return send(res,401,{error:'UNAUTHORIZED'},headers);
 if(!withinLimit(req))return send(res,429,{error:'RATE_LIMIT',message:'Достигнут лимит тестовых обработок.'},headers);
 try{
  const v=await parseBody(req);
  if(typeof v.tool!=='string'||!prompts[v.tool])return send(res,422,{error:'TOOL_NOT_AVAILABLE',message:'Этот инструмент требует отдельной модели или маски.'},headers);
  if(typeof v.image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(v.image)||v.image.length>10*1024*1024)return send(res,400,{error:'IMAGE_INVALID',message:'Используйте фото JPG, PNG или WebP до 7 МБ.'},headers);
  const userPrompt=typeof v.prompt==='string'?v.prompt.slice(0,850).trim():'';
  const level=v.strength==='strong'?'pronounced':v.strength==='minimal'?'very subtle':'balanced';
  const prompt=[prompts[v.tool],userPrompt,'Modification intensity: '+level+'.',
   'If a person is visible, preserve the SAME face, eye shape, eyebrows, nose, lips, skin tone, hairstyle (unless explicitly changing hair), age and original identity.',
   'Do not redraw any facial details. Keep all unaffected regions as close to the source as possible. Never add watermarks.'].filter(Boolean).join('\n');
  const payload={model:MODEL,images:[{image_url:v.image}],prompt,quality:v.quality==='high'?'high':'medium',n:1,output_format:'png'};
  if(v.tool==='remove-bg')payload.background='transparent';
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),180000);
  let result;try{result=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{'Authorization':'Bearer '+API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctl.signal});}finally{clearTimeout(timeout);}
  if(!result.ok){console.error('Image provider failed:',result.status,'request:',result.headers.get('x-request-id')||'none');return send(res,502,{error:'IMAGE_PROVIDER_ERROR',message:result.status===429?'Лимит ИИ-провайдера.':'Сервис ИИ отказал в обработке. Проверьте доступ к модели и баланс API.'},headers);}
  const data=await result.json(),base64=data.data?.[0]?.b64_json;
  if(!base64)return send(res,502,{error:'EMPTY_IMAGE_RESULT'},headers);
  return send(res,200,{ok:true,image:'data:image/png;base64,'+base64,mime:'image/png',model:MODEL,note:'Проверьте внешность и детали по сравнению с оригиналом.'},headers);
 }catch(e){if(e?.status)return send(res,e.status,{error:e.message},headers);console.error('Image processing failed:',e?.name||'Error');return send(res,502,{error:'PROCESSING_FAILED',message:'Не удалось обработать фотографию.'},headers);}
}).listen(PORT,'0.0.0.0',()=>console.log('PHOTO MAGIC test AI server on port',PORT));
