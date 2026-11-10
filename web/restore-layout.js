(function(){
  'use strict';
  const root=document.getElementById('page-editor');
  const stack=root?.querySelector('.editor-layout > .right-stack');
  const data=window.PHOTO_MAGIC_RESTORE_DATA;
  if(!root||!stack||!data||!Array.isArray(data.effects))return;
  root.classList.add('restore-first-layout');
  root.classList.remove('studio-v07');
  const $=id=>document.getElementById(id);
  const panel=document.createElement('section');
  panel.className='restore-effects';panel.id='restoreEffects';
  panel.innerHTML='<h3>✦ Библиотека эффектов</h3><p>Выбирай стиль и листай разделы вправо. Все настройки ниже, фотография остаётся на экране.</p><div id="restoreCategories" class="restore-chips" role="group" aria-label="Категории эффектов"></div><div id="restoreEffectList" class="restore-effects-grid"></div><div class="restore-effect-row"><label>Сила эффекта <input id="restoreEffectPower" type="range" min="0" max="100" value="85"><output id="restorePowerLabel">85%</output></label><button id="restoreReset" class="restore-pill" type="button">Сбросить</button></div>';
  stack.prepend(panel);
  const families=[{id:'popular',name:'🔥 Лучшие'},{id:'all',name:'Все 430'},{id:'magic',name:'✨ Магия'},...data.families.map(x=>({id:x.id,name:x.icon+' '+x.name}))];
  let category='popular',rendered=0,current=[],observer=null;
  const picked=new Set(['cinema-12','film-9','mono-14','portrait-6','vintage-18','neon-17','cyber-10','pastel-5','dramatic-21','sun-15','winter-9','nature-19','matte-13','duotone-22','pop-16','glitch-27','magic:aurora','magic:neon','magic:galaxy','magic:glitter']);
  function entries(){if(category==='all')return data.effects;if(category==='popular')return data.effects.filter(e=>picked.has(e.id)).slice(0,20);if(category==='magic')return data.magic.map(e=>({id:e.id,name:e.name}));return data.effects.filter(e=>e.id.startsWith(category+'-'));}
  function paint(c,id){try{const ctx=c.getContext('2d',{willReadFrequently:true});const src=data.getSource();c.width=104;c.height=80;if(src){ctx.drawImage(src,0,0,104,80);window.PHOTO_MAGIC_OFFLINE.applyOfflineEffect(ctx,104,80,id,92);}else{ctx.fillStyle='#37354c';ctx.fillRect(0,0,104,80);}}catch(e){console.warn('thumbnail',e);}}
  observer='IntersectionObserver' in window?new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){observer.unobserve(item.target);paint(item.target,item.target.dataset.effectId);}}, {root:stack,rootMargin:'200px'}):null;
  function addBatch(){const grid=$('restoreEffectList');const chunk=current.slice(rendered,rendered+36);const fragment=document.createDocumentFragment();for(const item of chunk){const b=document.createElement('button');b.type='button';b.className='restore-effect';b.setAttribute('aria-pressed',String(data.getEffect()===item.id));b.title=item.name;b.dataset.effect=item.id;const c=document.createElement('canvas');c.dataset.effectId=item.id;c.width=104;c.height=80;const label=document.createElement('small');label.textContent=item.name;b.append(c,label);b.addEventListener('click',()=>{data.selectEffect(item.id);$('restoreEffectPower').value='85';$('restorePowerLabel').textContent='85%';panel.querySelectorAll('.restore-effect').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});fragment.append(b);if(observer)observer.observe(c);else paint(c,item.id);}rendered+=chunk.length;grid.append(fragment);if(rendered<current.length){const more=document.createElement('button');more.className='restore-pill restore-load-more';more.type='button';more.textContent='Показать ещё эффекты ('+(current.length-rendered)+')';more.addEventListener('click',()=>{more.remove();addBatch()});grid.append(more);}}
  function choose(id){category=id;current=entries();rendered=0;observer?.disconnect();$('restoreEffectList').replaceChildren();addBatch();$('restoreCategories').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cat===id)));}
  const tabs=$('restoreCategories');for(const f of families){const b=document.createElement('button');b.type='button';b.className='restore-chip';b.textContent=f.name;b.dataset.cat=f.id;b.addEventListener('click',()=>choose(f.id));tabs.append(b);}choose('popular');
  const power=$('restoreEffectPower');power.addEventListener('input',()=>{data.setIntensity(Number(power.value));$('restorePowerLabel').textContent=power.value+'%'});
  $('restoreReset').addEventListener('click',()=>{data.clearEffect();power.value='85';$('restorePowerLabel').textContent='85%';panel.querySelectorAll('.restore-effect').forEach(b=>b.setAttribute('aria-pressed','false'));});
  // The free local model was initialized before this script; move its button into a visible original-style card.
  const ai=document.createElement('section');ai.className='restore-effects';ai.id='restoreAI';ai.innerHTML='<div class="restore-card-title">✨ Бесплатный ИИ на телефоне</div><p>Удаление фона вокруг человека, прозрачный PNG, размытие и замена заднего плана. Без API-ключа и платы за запросы.</p><div class="restore-ai-card"><span>✂️</span><div><b>Убрать фон</b><small>Локальная модель · твоя фотография остаётся на телефоне</small></div><button id="restoreRunAI" type="button">Открыть ИИ</button></div><p class="restore-inline-note">Другие облачные ИИ-функции доступны только после подключения API.</p>';
  stack.insertBefore(ai,stack.children[1]||null);
  $('restoreRunAI').addEventListener('click',()=>window.PHOTO_MAGIC_FREE_AI?.run());
  const cloud=document.createElement('section');cloud.className='restore-effects';cloud.innerHTML='<div class="restore-card-title">✦ Другие ИИ-инструменты</div><p>Облачные инструменты сохранены, но требуют своего сервера и API-ключа.</p><button id="restoreCloud" class="restore-pill" type="button">Открыть каталог ИИ</button>';
  stack.append(cloud);$('restoreCloud').addEventListener('click',()=>{document.querySelector('[data-goto="ai"]')?.click()});
  // Existing old modal launchers should jump to the inline effects instead of hiding controls.
  for(const id of ['openFx','openFxTop'])$(id)?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();stack.scrollTo({top:0,behavior:'smooth'});},{capture:true});
  window.PHOTO_MAGIC_RESTORED={version:'0.8.2',effects:data.effects.length,openCategory:choose,scrollRegion:stack};
})();