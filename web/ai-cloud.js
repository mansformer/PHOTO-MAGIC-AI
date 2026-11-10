(function(){
 'use strict';
 const bridge=window.PHOTO_MAGIC_CLOUD_BRIDGE;
 const $=id=>document.getElementById(id);
 const supported=new Set(['enhance','old-photo','colorize','remove-bg','replace-bg','studio-light','product-cut','product-scene','headshot','poster','sky','recolor','hair','retouch']);
 const modal=$('aiDialog'),run=$('aiPrepare');
 if(!bridge||!modal||!run)return;
 let testToken='',resultURL='',busy=false,controller=null;
 const section=document.createElement('section');
 section.className='cloud-options';
 section.innerHTML='<div class="cloud-title"><strong>Настройки настоящего ИИ</strong><span>ТЕСТ</span></div><p>ИИ запустится только после подключения сервера. Фотография отправится в облако лишь с твоего согласия.</p><label class="cloud-label">Адрес своего ИИ-сервера <input id="cloudEndpoint" type="url" placeholder="https://photo-magic-api-production.up.railway.app" autocomplete="url" spellcheck="false"></label><label class="cloud-label">Тестовый пароль сервера <input id="cloudToken" type="password" placeholder="Тестовый пароль" autocomplete="off"></label><div class="cloud-info" id="cloudInfo" role="status">Нет соединения с ИИ-сервером. Офлайн-эффекты доступны без него.</div><label class="cloud-agree"><input id="cloudConsent" type="checkbox"> Я согласен отправить выбранную фотографию на внешний ИИ-сервер для обработки. Результат может отличаться от оригинала.</label><div class="cloud-preview hidden" id="cloudPreviewBox"><p>Готово — проверь лицо и детали. Принять результат?</p><img id="cloudResultImage" alt="Результат ИИ-обработки"><div class="cloud-actions"><button id="cloudAccept" class="cloud-accept" type="button">Использовать в редакторе</button><button id="cloudReject" type="button">Отклонить</button></div></div>';
 run.parentNode.insertBefore(section,run);
 const endpoint=$('cloudEndpoint'),tokenField=$('cloudToken'),consent=$('cloudConsent'),info=$('cloudInfo'),preview=$('cloudPreviewBox');
 const serverCheck=document.createElement('button');
 serverCheck.type='button';serverCheck.className='cloud-server-check';serverCheck.textContent='Проверить сервер';
 section.insertBefore(serverCheck,document.getElementById('cloudInfo'));
 serverCheck.addEventListener('click',async()=>{
   const base=endpoint.value.trim().replace(/\/+$/,'');
   if(!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(base)){saveInfo('Неверный адрес сервера.','error');return;}
   serverCheck.disabled=true;saveInfo('Проверяю подключение к серверу…','neutral');
   const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);
   try{
     const result=await fetch(base+'/health',{signal:c.signal,cache:'no-store'});
     if(!result.ok)throw new Error('HTTP '+result.status);
     const data=await result.json();
     saveInfo(data.ai_available?'Сервер работает. Облачный ИИ включён.':'Сервер доступен, но платный ИИ выключен. Бесплатное удаление фона работает отдельно в телефоне.','success');
   }catch(err){saveInfo('Сервер сейчас не отвечает: '+(err?.message||'ошибка сети')+'. Бесплатный ИИ от этого не зависит.','error');}
   finally{clearTimeout(t);serverCheck.disabled=false;}
 });
 const saveInfo=(message,kind)=>{info.textContent=message;info.dataset.kind=kind||'neutral';};
 try{endpoint.value=localStorage.getItem('photo-magic-ai-server')||'https://photo-magic-api-production.up.railway.app';}catch{endpoint.value='https://photo-magic-api-production.up.railway.app';}
 endpoint.addEventListener('change',()=>{try{localStorage.setItem('photo-magic-ai-server',endpoint.value.trim());}catch{}});
 tokenField.addEventListener('input',()=>{testToken=tokenField.value;});
 $('cloudReject').addEventListener('click',()=>{resultURL='';preview.classList.add('hidden');$('cloudResultImage').removeAttribute('src');saveInfo('Результат отклонён. Исходное фото не изменено.','neutral');});
 $('cloudAccept').addEventListener('click',()=>{
   if(!resultURL)return;bridge.accept(resultURL);resultURL='';
   $('cloudResultImage').removeAttribute('src');preview.classList.add('hidden');consent.checked=false;
 });
 async function cloudRun(){
   if(busy)return;
   const tool=bridge.getTool();if(!tool)return;
   preview.classList.add('hidden');resultURL='';
   if(!supported.has(tool.id)){saveInfo('Эта функция требует отдельной модели или точной маски. Сейчас доступны 14 тестовых ИИ-инструментов.','error');return;}
   if(bridge.isDemo()){saveInfo('Сначала выбери своё фото из галереи. Демонстрационную картинку в ИИ не отправляем.','error');return;}
   const base=endpoint.value.trim().replace(/\/+$/,'');
   if(!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(base)){saveInfo('Укажи защищённый HTTPS-адрес своего сервера без пути.','error');return;}
   if(!testToken){saveInfo('Введи тестовый пароль сервера. API-ключ провайдера сюда вводить нельзя.','error');return;}
   if(!consent.checked){saveInfo('Необходимо согласие на передачу фотографии серверу.','error');return;}
   busy=true;controller=new AbortController();
   run.disabled=true;run.textContent='ИИ обрабатывает фото…';
   saveInfo('Отправляем фото на ИИ-сервер. Это может занять несколько минут.','neutral');
   const timeout=setTimeout(()=>controller?.abort(),185000);
   try{
     const response=await fetch(base+'/v1/ai/edit',{
       method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+testToken},
       body:JSON.stringify({tool:tool.id,image:bridge.currentImage(),prompt:$('aiPrompt').value.trim(),strength:$('aiStrength').value,quality:$('aiQuality').value}),
       signal:controller.signal
     });
     const data=await response.json();
     if(!response.ok)throw new Error(data.message||data.error||'Ошибка '+response.status);
     if(!data.ok||typeof data.image!=='string'||!data.image.startsWith('data:image/'))throw new Error('ИИ не вернул изображение.');
     resultURL=data.image;$('cloudResultImage').src=data.image;preview.classList.remove('hidden');
     saveInfo('Результат готов. Сравни с исходником и прими или отклони.','success');
   }catch(e){saveInfo(e.name==='AbortError'?'Время ожидания истекло. Попробуй ещё раз.':'Ошибка: '+(e?.message||'сервер недоступен'),'error');}
   finally{clearTimeout(timeout);controller=null;busy=false;run.disabled=false;run.textContent='Запустить ИИ-обработку';}
 }
 window.PHOTO_MAGIC_AI_CLOUD=cloudRun;
 const obs=new MutationObserver(()=>{
  if(!modal.classList.contains('hidden')){
    const tool=bridge.getTool();consent.checked=false;preview.classList.add('hidden');resultURL='';
    if(tool&&!supported.has(tool.id))saveInfo('Этот модуль пока не подключён к настоящей модели. Доступны 14 тестовых инструментов.','neutral');
    else saveInfo('Для теста укажи сервер и пароль. Платные вызовы без настроек не запускаются.','neutral');
    const status=modal.querySelector('.ai-cloud');if(status)status.textContent='● ИИ через свой сервер — настройка ниже';
  }
 });
 obs.observe(modal,{attributes:true,attributeFilter:['class']});
})();
