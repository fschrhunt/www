
// Real daily model values arrive from the independently published snapshot.
let days=[];
const chart=document.querySelector('#chart'),bars=document.querySelector('#bars'),timeline=document.querySelector('#timeline'),cursor=document.querySelector('#cursor'),details=document.querySelector('#details'),dateText=document.querySelector('#date');
let active=-1,visible=false,muted=false,unlocked=false,audio=null,offset=0,pitch=11,first=0,lastTick=0,last=179,guideX=0,guideTarget=0,guideVelocity=0,frame=0,previousTime=0,drag=null,anchorX=innerWidth/2,initialized=false,introPlayed=false;
const cost=n=>'$'+n.toFixed(2);
document.querySelector('#total').textContent='';
// Create short noise transients for movement and clicks; audio is unlocked by the first click, tap, or key press.
function unlock(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});unlocked=true}catch{}}
function sound(kind){if(!unlocked||muted||!audio)return;const now=performance.now();if(kind==='tick'&&now-lastTick<22)return;lastTick=now;const time=audio.currentTime;const source=audio.createBufferSource();const duration=kind==='tick'?.003:kind==='click'?.006:.012;const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);const channel=buffer.getChannelData(0);const decay=kind==='tick'?16:kind==='click'?42:65;for(let i=0;i<channel.length;i++)channel[i]=(Math.random()*2-1)*Math.exp(-i/decay);source.buffer=buffer;const filter=audio.createBiquadFilter();filter.type=kind==='tick'?'highpass':'bandpass';filter.frequency.value=kind==='tick'?3500:kind==='click'?4200:1600;filter.Q.value=kind==='click'?2.5:.7;const gain=audio.createGain();gain.gain.value=kind==='tick'?.19:kind==='click'?.28:.16;source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(time);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()}}
// A native horizontal scroller keeps every date reachable with trackpads and touch momentum.
function render(){if(!days.length)return;const width=chart.clientWidth,oldMax=timeline.scrollWidth-width,position=initialized&&oldMax>0?timeline.scrollLeft/oldMax:1;const trackWidth=Math.max(width,(days.length-1)*pitch+49),padding=(trackWidth-((days.length-1)*pitch+1))/2;const max=Math.max(...days.map(d=>d.total),1),scale=Math.min(300,Math.max(40,innerHeight-230));const heights=days.map(d=>{const values=d.models.map(m=>m.value??0).filter(v=>v>0).sort((a,b)=>b-a).map(v=>Math.max(1,Math.min(300,v/max*scale)));return values.length?values:[1]});const height=Math.max(...heights.map(h=>h.reduce((a,b)=>a+b,0)+Math.max(0,h.length-1)*2));chart.style.setProperty('--half-chart',height/2+'px');bars.style.width=trackWidth+'px';bars.dataset.padding=padding;bars.innerHTML=days.map((d,i)=>'<div class="day '+(i===0||d.date.getUTCDate()===1?'month':'')+'" style="left:'+(padding+i*pitch)+'px">'+heights[i].map(h=>'<i class="segment" style="height:'+h+'px"></i>').join('')+'</div>').join('');first=0;last=days.length-1;chart.setAttribute('aria-valuemin',first);chart.setAttribute('aria-valuemax',last);timeline.scrollLeft=position*(trackWidth-width);offset=padding-timeline.scrollLeft;initialized=true;introRise(padding,width);if(visible)select(active,false)}
// On first paint the on-screen columns grow 0 -> full height in a left-to-right wave. Only visible
// columns animate (the rest are scrolled off-screen). A shared base delay lets the initial layout
// and paint settle before any motion starts, so the wave's leading edge is as smooth as its tail;
// `backwards` fill holds each column collapsed until its turn, so there is no flash. Each animating
// column is promoted to its own compositor layer and released when it lands. Reduced motion is left
// in place.
function introRise(padding,width){if(introPlayed||matchMedia('(prefers-reduced-motion: reduce)').matches)return;introPlayed=true;const left=timeline.scrollLeft;bars.querySelectorAll('.day').forEach((el,i)=>{const x=padding+i*pitch-left;if(x<-pitch||x>width)return;el.style.willChange='transform';el.style.animation='bar-rise 460ms cubic-bezier(.2,.85,.3,1) '+Math.round(120+Math.max(0,x)/width*520)+'ms backwards';el.addEventListener('animationend',()=>{el.style.willChange='';el.style.animation=''},{once:true})});}
// Follow date changes with the reference's damped spring, retaining immediate placement for reduced motion.
function moveGuide(x){guideTarget=x;if(!visible||matchMedia('(prefers-reduced-motion: reduce)').matches){cancelAnimationFrame(frame);frame=0;guideVelocity=0;guideX=x;cursor.style.left=x+'px';return}if(!frame){previousTime=performance.now();frame=requestAnimationFrame(stepGuide)}}
function stepGuide(time){const dt=Math.min((time-previousTime)/1000,1/60);previousTime=time;guideVelocity+=(500*(guideTarget-guideX)-40*guideVelocity)*dt;guideX+=guideVelocity*dt;cursor.style.left=guideX+'px';if(Math.abs(guideTarget-guideX)<.02&&Math.abs(guideVelocity)<.02){guideX=guideTarget;cursor.style.left=guideX+'px';frame=0;return}frame=requestAnimationFrame(stepGuide)}
function label(date){const day=date.getUTCDate();const suffix=day%10===1&&day!==11?'st':day%10===2&&day!==12?'nd':day%10===3&&day!==13?'rd':'th';return date.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})+' '+day+suffix}
// Render model labels as text and resolve each creator's mark separately from the usage source.
// Mark elements are cached by icon and reused across bars: an unchanged icon is moved into the new
// row, not recreated. Recreating a CSS-mask element reloads its SVG and flickers on mobile. A rare
// icon repeated within one day gets a fresh element so both rows keep a mark.
const markCache=new Map();
function renderUsageRows(rows){const used=new Set();details.replaceChildren(...rows.map(item=>{const row=document.createElement('div');row.className='row';const name=document.createElement('span');name.textContent=item.name;const price=document.createElement('span');price.className='price';price.textContent=item.value===null?'—':cost(item.value);const icon=ProviderIcons.resolve(item.modelId,item.creator);let m;if(used.has(icon)){m=ProviderIcons.create(item.modelId,item.creator)}else{m=markCache.get(icon);if(!m){m=ProviderIcons.create(item.modelId,item.creator);markCache.set(icon,m)}used.add(icon)}row.append(m,name,price);return row}))}
// The only revealed text is the selected date and its per-model cost, placed beside the moving guide.
function select(index,feedback=true){if(!days.length)return;index=Math.min(last,Math.max(first,index));const changed=index!==active||!visible;active=index;const d=days[index],x=offset+index*pitch;moveGuide(x);renderUsageRows(d.models);const half=details.offsetWidth/2+24;const detailX=Math.max(half,Math.min(innerWidth-half,x));details.style.left=(detailX-x)+'px';const baseline=innerHeight/2+parseFloat(chart.style.getPropertyValue('--half-chart'));cursor.style.height=Math.max(32,Math.min(380,baseline-140,baseline-details.offsetHeight-96))+'px';const dateX=Math.max(42,Math.min(innerWidth-42,x));dateText.style.left=(dateX-x)+'px';dateText.textContent=label(d.date);chart.setAttribute('aria-valuenow',index);chart.setAttribute('aria-valuetext',label(d.date)+', '+cost(d.total));if(feedback&&changed)sound(visible?'tick':'enter');visible=true;cursor.classList.add('visible')}
function hide(){if(!visible)return;visible=false;cursor.classList.remove('visible');sound('leave')}
// Mouse dragging pans; touch drags inspect the bars or scroll through empty space.
function explore(event){anchorX=event.clientX;const bounds=document.querySelector('#scrub').getBoundingClientRect();if(event.clientY<bounds.top||event.clientY>bounds.bottom){hide();return}select(Math.round((event.clientX-offset)/pitch))}
chart.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;unlock();anchorX=e.clientX;drag={id:e.pointerId,x:e.clientX,scroll:timeline.scrollLeft,moved:false,type:e.pointerType,scrub:e.target.id==='scrub'};if(e.pointerType==='mouse'){e.preventDefault();chart.focus({preventScroll:true});chart.setPointerCapture(e.pointerId)}else if(drag.scrub){chart.setPointerCapture(e.pointerId)}explore(e);sound('click')});
chart.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId){const dx=e.clientX-drag.x;if(Math.abs(dx)>4)drag.moved=true;if(drag.type==='mouse'&&drag.moved){chart.classList.add('dragging');timeline.scrollLeft=drag.scroll-dx;return}if(drag.type==='touch'){if(drag.scrub)explore(e);return}}explore(e)});
function endDrag(e){if(!drag||drag.id!==e.pointerId)return;const tap=!drag.moved;if(chart.hasPointerCapture(e.pointerId))chart.releasePointerCapture(e.pointerId);drag=null;chart.classList.remove('dragging');if(e.type==='pointerup'&&tap)explore(e)}
chart.addEventListener('pointerup',endDrag);chart.addEventListener('pointercancel',endDrag);chart.addEventListener('lostpointercapture',()=>{drag=null;chart.classList.remove('dragging')});chart.addEventListener('pointerleave',()=>{if(!drag)hide()});
timeline.addEventListener('scroll',()=>{offset=Number(bars.dataset.padding)-timeline.scrollLeft;if(visible)select(Math.round((anchorX-offset)/pitch))},{passive:true});
// Route horizontal wheel deltas through the scroller even when the bar inspection layer is under the pointer.
chart.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();const delta=e.deltaX||(e.shiftKey?e.deltaY:0);if(!delta)return;anchorX=e.clientX;const unit=e.deltaMode===1?16:e.deltaMode===2?timeline.clientWidth:1;timeline.scrollLeft+=delta*unit;offset=Number(bars.dataset.padding)-timeline.scrollLeft;explore(e)},{passive:false});
// Keyboard navigation spans the complete history and scrolls selected dates into view.
chart.addEventListener('keydown',e=>{unlock();if(e.key.toLowerCase()==='m'){muted=!muted;return}if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();return}if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape'){hide();chart.blur();return}const index=Math.max(first,Math.min(last,e.key==='Home'?first:e.key==='End'?last:active<0?Math.round((innerWidth/2-offset)/pitch):active+(e.key==='ArrowRight'?1:-1)));const x=offset+index*pitch;if(x<40)timeline.scrollLeft-=40-x;else if(x>innerWidth-40)timeline.scrollLeft+=x-(innerWidth-40);offset=Number(bars.dataset.padding)-timeline.scrollLeft;anchorX=offset+index*pitch;select(index)});
chart.addEventListener('blur',hide);document.addEventListener('pointerdown',unlock,{capture:true});document.addEventListener('pointerup',unlock,{capture:true});document.addEventListener('click',unlock,{capture:true});document.addEventListener('keydown',unlock,{capture:true});window.addEventListener('resize',render);


// Format raw model IDs without exposing the reporting tool as the model's identity.
function modelName(id){
 const names={'gpt-5.3-codex':'GPT 5.3','claude-opus-4-6':'Opus 4.6','claude-opus-4-7':'Opus 4.7','gpt-unattributed':'GPT','claude-opus-4-8':'Opus 4.8','claude-opus-5':'Opus 5','claude-fable-5':'Fable 5','claude-fable-5-1':'Fable 5.1','claude-haiku-4-5':'Haiku 4.5','hy3':'Hy3','muse-spark-1.2-contributor':'Muse Spark 1.2 Contributor'};
 if(names[id])return names[id];
 return id.replace(/^claude-/,'').replace(/^gpt-/,'GPT ').replace(/^glm-/,'GLM ').replace(/^qwen/,'Qwen ').replace(/^mimo-/,'MiMo ').replace(/^minimax-/,'MiniMax ').replace(/^deepseek-/,'DeepSeek ').replace(/-/g,' ').replace(/\b([mv])(\d)/gi,(_,letter,digit)=>letter.toUpperCase()+digit).replace(/\b(flash|mini|pro|astra|sol|terra|luna|opus|sonnet|haiku)\b/g,w=>w[0].toUpperCase()+w.slice(1));
}

// Validate complete snapshots before replacing the last usable chart data.
function applyUsage(snapshot){
 if(snapshot.version!==1||snapshot.unit!=='USD'||!Array.isArray(snapshot.days)||snapshot.days.length>2000||!Number.isFinite(Date.parse(snapshot.publishedAt)))throw Error('Invalid usage snapshot');
 const seen=new Set();
 const next=snapshot.days.map(day=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day.date)||seen.has(day.date)||!Array.isArray(day.models)||day.models.length>100)throw Error('Invalid usage day');
  seen.add(day.date);
  const models=day.models.map(m=>{
   if(typeof m.modelId!=='string'||!/^[-A-Za-z0-9._:/]{1,150}$/.test(m.modelId))throw Error('Invalid model');
   const value=m.usd===null?null:Number(m.usd);
   if(value!==null&&(!Number.isFinite(value)||value<0))throw Error('Invalid usage value');
   return{modelId:m.modelId,name:modelName(m.modelId),value};
  }).filter(model=>model.value>0).sort((a,b)=>b.value-a.value);
  const date=new Date(day.date+'T00:00:00Z');
  if(!Number.isFinite(+date))throw Error('Invalid date');
  return{date,models,total:models.reduce((sum,m)=>sum+(m.value??0),0)};
 }).sort((a,b)=>a.date-b.date);
 if(!next.length)throw Error('Empty snapshot');
 days=next;
 if(active>=days.length)active=days.length-1;
 const total=document.querySelector('#total');
 total.textContent=cost(days.reduce((sum,day)=>sum+day.total,0));
 const age=Date.now()-Date.parse(snapshot.publishedAt);
 const delayed=Object.entries(snapshot.sources??{}).some(([key,value])=>key!=='claudeDevicesDelayed'&&typeof value==='string'&&Date.now()-Date.parse(value)>3600000)||snapshot.sources?.claudeDevicesDelayed>0;
 total.title='Updated '+new Date(snapshot.publishedAt).toLocaleString()+(age>3600000||delayed?'. Some usage is awaiting an update.':'')+(snapshot.incompleteSources?.includes('codex')?'. Partial total: some historical model records are unavailable.':snapshot.unpricedModels?.length?'. Some models do not have a dollar value yet.':'');
 chart.setAttribute('aria-description',total.title);
 render();
}

// Refresh only while visible; failures retain the last successful snapshot and its timestamps.
let loading=false;
async function loadUsage(){
 if(loading)return;loading=true;
 try{
  const response=await fetch('/token-usage/data.json',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Usage unavailable');
  const snapshot=await response.json();applyUsage(snapshot);
 }catch{const total=document.querySelector('#total');total.title=days.length?'Update unavailable. Showing the last loaded usage.':'Usage is temporarily unavailable.';chart.setAttribute('aria-description',total.title)}
 finally{loading=false}
}

loadUsage();setInterval(()=>{if(!document.hidden)loadUsage()},60000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)loadUsage()});
