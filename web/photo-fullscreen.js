(function(){
'use strict';
const root=document.getElementById('page-editor');
const stage=root?.querySelector('.stage-area');
const bridge=window.PHOTO_MAGIC_RESTORE_DATA;
if(!root||!stage||!bridge?.renderPreview)return;
const trigger=document.createElement('button');
trigger.id='photoFullButton';trigger.className='photo-full-trigger';
trigger.type='button';trigger.setAttribute('aria-label','Открыть фотографию во весь экран');
trigger.innerHTML='<span aria-hidden="true">⛶</span> <span>Во весь экран</span>';
stage.append(trigger);
const overlay=document.createElement('div');overlay.className='photo-full-overlay hidden';
overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
overlay.setAttribute('aria-label','Фотография во весь экран');
overlay.innerHTML='<div class="photo-full-top"><strong>Фото · полный размер</strong><button id="photoFullClose" type="button" aria-label="Закрыть">✕</button></div><div class="photo-full-view"><canvas id="photoFullCanvas"></canvas></div><div class="photo-full-bottom"><button id="photoFullBefore" type="button">Показать оригинал</button><button id="photoFullMinus" type="button">−</button><output id="photoFullZoom">100%</output><button id="photoFullPlus" type="button">+</button><button id="photoFullFit" type="button">Вписать</button></div>';
document.body.append(overlay);
const area=overlay.querySelector('.photo-full-view');
const canvas=overlay.querySelector('canvas');
const zoomLabel=overlay.querySelector('#photoFullZoom');
const before=overlay.querySelector('#photoFullBefore');
let scale=1,showOriginal=false;
function zoom(next){
 scale=Math.max(1,Math.min(4,Math.round(next*10)/10));
 canvas.style.width=(100*scale)+'%';
 canvas.style.maxWidth='none';
 canvas.style.maxHeight=scale===1?'100%':'none';
 canvas.style.height='auto';
 zoomLabel.textContent=Math.round(scale*100)+'%';
 if(scale===1){area.scrollTop=0;area.scrollLeft=0;}
}
function redraw(){
 bridge.renderPreview(canvas,4096,showOriginal);
 before.textContent=showOriginal?'Показать результат':'Показать оригинал';
}
function open(){
 if(!bridge.getSource())return;
 showOriginal=false;redraw();zoom(1);
 overlay.classList.remove('hidden');document.body.classList.add('photo-full-open');
}
function close(){overlay.classList.add('hidden');document.body.classList.remove('photo-full-open');}
trigger.addEventListener('click',open);
overlay.querySelector('#photoFullClose').addEventListener('click',close);
before.addEventListener('click',()=>{showOriginal=!showOriginal;redraw();zoom(1);});
overlay.querySelector('#photoFullMinus').addEventListener('click',()=>zoom(scale-.5));
overlay.querySelector('#photoFullPlus').addEventListener('click',()=>zoom(scale+.5));
overlay.querySelector('#photoFullFit').addEventListener('click',()=>zoom(1));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.classList.contains('hidden'))close();});
window.PHOTO_MAGIC_FULLSCREEN={open,close};
})();
