(function(){
'use strict';
const bridge=window.PHOTO_MAGIC_FREE_BRIDGE;
const $=id=>document.getElementById(id);
const aiTools=$('v4AITools');
if(!bridge||!aiTools)return;
const VERSION='0.1.1675465747';
const localFolder=new URL('./vendor/selfie_segmentation/',document.baseURI).href;
const cdnFolder='https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@'+VERSION+'/';
let loading=null,segmenter=null,pending=null,lastCutout=null,lastCanvas=null,working=false;
const freeCard=document.createElement('button');
freeCard.type='button';
freeCard.className='v4-ai-card free-ai-card';
freeCard.id='freeAiButton';
freeCard.innerHTML='<span>✂️</span><small>Убрать фон · БЕСПЛАТНО</small>';
aiTools.prepend(freeCard);
const modal=document.createElement('div');
modal.id='freeAiModal';
modal.className='free-ai-modal hidden';
modal.setAttribute('aria-hidden','true');
modal.innerHTML=[
 '<section class="free-ai-panel" role="dialog" aria-modal="true" aria-labelledby="freeAiTitle">',
 '<header class="free-ai-header"><div><small>PHOTO MAGIC · LOCAL AI</small><h2 id="freeAiTitle">✂️ Удалить фон бесплатно</h2></div><button id="freeAiClose" aria-label="Закрыть">✕</button></header>',
 '<p class="free-ai-note">Нейросеть выделяет человека на фотографии. Обработка выполняется на телефоне, без API и подписки. Лицо не перерисовывается. Для автомобилей и предметов этот режим не предназначен.</p>',
 '<div class="free-ai-toolbar"><label>Фон <select id="freeAiMode"><option value="transparent">Прозрачный PNG</option><option value="blur">Размытие фона</option><option value="white">Белый</option><option value="dark">Тёмный</option><option value="violet">Фиолетовый градиент</option></select></label></div>',
 '<div class="free-ai-preview"><canvas id="freeAiCanvas"></canvas><span id="freeAiPlaceholder">Загрузи фотографию человека и нажми «Обработать»</span></div>',
 '<p id="freeAiStatus" class="free-ai-status" role="status">Модель встроена в APK и работает без интернета.</p>',
 '<div class="free-ai-actions"><button id="freeAiStart" class="free-ai-primary">✨ Обработать бесплатно</button><button id="freeAiApply" disabled>Применить</button><button id="freeAiExport" disabled>Сохранить PNG</button></div>',
 '</section>'
].join('');
document.body.append(modal);
const canvas=$('freeAiCanvas'),ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:false}),status=$('freeAiStatus');
const start=$('freeAiStart'),apply=$('freeAiApply'),save=$('freeAiExport'),mode=$('freeAiMode');
function message(text,error){status.textContent=text;status.classList.toggle('error',!!error);}
function open(){
 modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
 document.body.classList.add('free-ai-open');lastCutout=null;lastCanvas=null;
 apply.disabled=true;save.disabled=true;canvas.width=0;canvas.height=0;
 $('freeAiPlaceholder').classList.remove('hidden');
 message('Модель встроена в APK. Обработка не тратит деньги и не отправляет фотографию на сервер.');
}
function close(){if(working)return;modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');document.body.classList.remove('free-ai-open');}
freeCard.addEventListener('click',open);$('freeAiClose').addEventListener('click',close);
modal.addEventListener('click',event=>{if(event.target===modal)close();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.classList.contains('hidden'))close();});
function loadLibrary(url){
 return new Promise((resolve,reject)=>{
   const node=document.createElement('script');node.src=url;node.async=true;
   node.onload=()=>window.SelfieSegmentation?resolve():reject(new Error('Модель не загрузилась'));
   node.onerror=()=>reject(new Error('Не удалось загрузить файл модели'));
   document.head.append(node);
 });
}
async function init(){
 if(segmenter)return segmenter;
 if(loading)return loading;
 if(!document.createElement('canvas').getContext('webgl2')&&!document.createElement('canvas').getContext('webgl'))throw new Error('На этом устройстве отключён WebGL. Для бесплатного ИИ включи аппаратное ускорение или попробуй другой телефон.');
 loading=(async()=>{
  // Models and WASM are included in the Android APK. In standalone browser previews,
  // pinned CDN is used only when the local model files do not exist.
  let dir=localFolder;
  try{await loadLibrary(dir+'selfie_segmentation.js');}
  catch{dir=cdnFolder;await loadLibrary(dir+'selfie_segmentation.js');}
  const s=new window.SelfieSegmentation({locateFile:file=>dir+file});
  s.setOptions({modelSelection:0,selfieMode:false});
  s.onResults(results=>{
   if(!pending)return;
   const current=pending;pending=null;
   if(!results?.segmentationMask){current.reject(new Error('Модель не вернула маску'));return;}
   const m=document.createElement('canvas');
   m.width=current.width;m.height=current.height;
   m.getContext('2d',{alpha:true}).drawImage(results.segmentationMask,0,0,m.width,m.height);
   current.resolve(m);
  });
  segmenter=s;
  return s;
 })();
 try{return await loading;}catch(e){loading=null;segmenter=null;throw e;}
}
function previewImage(src,maxSide){
 const naturalWidth=src.naturalWidth||src.width, naturalHeight=src.naturalHeight||src.height;
 const ratio=Math.min(1,maxSide/Math.max(naturalWidth,naturalHeight));
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(naturalWidth*ratio));c.height=Math.max(1,Math.round(naturalHeight*ratio));
 c.getContext('2d').drawImage(src,0,0,c.width,c.height);return c;
}
async function generateMask(src){
 const input=previewImage(src,960);
 const s=await init();
 return new Promise((resolve,reject)=>{
  pending={resolve,reject,width:input.width,height:input.height};
  s.send({image:input}).catch(error=>{if(pending){pending=null;reject(error);}});
 });
}
function compose(modeValue){
 if(!lastCutout)return;
 const w=lastCutout.width,h=lastCutout.height;
 canvas.width=w;canvas.height=h;
 ctx.clearRect(0,0,w,h);
 if(modeValue==='blur'){
  const src=bridge.getSource();if(src){
    ctx.save();ctx.filter='blur('+Math.max(8,Math.round(w/80))+'px)';
    ctx.drawImage(src,-w*.02,-h*.02,w*1.04,h*1.04);ctx.restore();
  }
 }else if(modeValue==='white'||modeValue==='dark'||modeValue==='violet'){
   if(modeValue==='violet'){
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#321557');g.addColorStop(.55,'#8355d4');g.addColorStop(1,'#101a36');ctx.fillStyle=g;
   }else ctx.fillStyle=modeValue==='white'?'#ffffff':'#12131b';
   ctx.fillRect(0,0,w,h);
 }
 ctx.drawImage(lastCutout,0,0);
 $('freeAiPlaceholder').classList.add('hidden');
 lastCanvas=canvas;
}
mode.addEventListener('change',()=>{if(lastCutout)compose(mode.value);});
start.addEventListener('click',async()=>{
 if(working)return;
 const src=bridge.getSource();
 if(!src||bridge.isDemo()){message('Сначала выбери свою фотографию человека: нажми «Фото» наверху. Демонстрационную картинку не обрабатываем.',true);return;}
 const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;
 if(!w||!h){message('Не удалось прочитать фотографию.',true);return;}
 working=true;start.disabled=true;apply.disabled=true;save.disabled=true;
 message('Запускаю бесплатную модель на устройстве… Первое открытие может занять немного времени.');
 try{
  const mask=await generateMask(src);
  const ratio=Math.min(1,4096/Math.max(w,h)),cw=Math.max(1,Math.round(w*ratio)),ch=Math.max(1,Math.round(h*ratio));
  const result=document.createElement('canvas');result.width=cw;result.height=ch;
  const c=result.getContext('2d',{alpha:true});
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.drawImage(src,0,0,cw,ch);
  c.globalCompositeOperation='destination-in';
  c.drawImage(mask,0,0,cw,ch);
  c.globalCompositeOperation='source-over';
  lastCutout=result;
  compose(mode.value);
  apply.disabled=false;save.disabled=false;
  message('Готово! Проверь края волос и одежды. Можно применить результат или сохранить PNG.');
 }catch(err){console.error('[FREE AI]',err);message('Не удалось выполнить локальную обработку. '+(err?.message||'Попробуй другое фото.'),true);}
 finally{working=false;start.disabled=false;}
});
apply.addEventListener('click',()=>{
 if(!lastCanvas)return;
 // transparent PNG stays transparent in the normal editor/export pipeline
 const transparent=mode.value==='transparent';
 bridge.accept(canvas.toDataURL('image/png'),transparent);
 close();
});
save.addEventListener('click',async()=>{
 if(!lastCanvas)return;
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('PNG не создан')),'image/png'));
 const name='PHOTO_MAGIC_FREE_AI_'+Date.now()+'.png';
 const native=bridge.nativeSaver();
 try{
  if(bridge.isAndroid()&&native){
   const base64=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(new Error('Ошибка чтения PNG'));
    reader.readAsDataURL(blob);
   });
   await native.savePhoto({name,mime:'image/png',data:base64});
   message('Сохранено в галерею: Pictures/PhotoMagicAI. Бесплатно!');
  }else{
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),15000);
   message('PNG сохранён. Бесплатно!');
  }
 }catch(err){message('Не удалось сохранить PNG: '+(err?.message||'Ошибка'),true);}
});
window.PHOTO_MAGIC_FREE_AI={version:'0.8.0',engine:'MediaPipe Selfie Segmentation',run:open,isModelBundled:true};
})();
