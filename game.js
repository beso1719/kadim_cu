// ===== Uçan Baz — düşen kafaları yakala =====
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const bestEl  = document.getElementById("best");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovText  = document.getElementById("ov-text");
const startBtn = document.getElementById("startBtn");

const IMG_SRCS = ["img/baz1.jpeg","img/baz2.jpeg","img/baz3.jpeg","img/baz4.jpeg","img/baz5.jpeg"];
const POS = [0.50, 0.55, 0.52, 0.58, 0.55]; // her foto için dikey yüz odağı
const images = IMG_SRCS.map(s => { const i = new Image(); i.src = s; return i; });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  W = r.width; H = r.height;
  cv.width = W * DPR; cv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);

// ---- ses ----
let audioCtx = null;
const ac = () => audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
function tone(freq, dur, type="square", vol=0.25, slideTo=null) {
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
}
function laugh(){ [380,300,420,320,460].forEach((f,i)=>setTimeout(()=>tone(f,0.08,"sawtooth",0.18),i*60)); }
const catchSound = () => { tone(600,0.1,"square",0.25,1000); laugh(); };
const bombSound  = () => tone(120,0.4,"sawtooth",0.35,40);
const missSound  = () => tone(200,0.25,"triangle",0.3,90);
const endSound   = () => [523,415,330,262].forEach((f,i)=>setTimeout(()=>tone(f,0.25,"triangle",0.25),i*140));

// ---- durum ----
let basket = { x: 0, w: 90, h: 26 };
let items = [];      // {x,y,r,vy,bomb,img,pos}
let score = 0, lives = 3, running = false;
let best = +(localStorage.getItem("ucanbaz_best") || 0);
let spawnTimer = 0, spawnEvery = 80, fallBase = 2.4, lastT = 0;
bestEl.textContent = best;

function setLives(n){ lives = n; livesEl.textContent = "❤️".repeat(Math.max(0,n)) || "💀"; }

// ---- kontrol ----
function moveTo(clientX){
  const r = cv.getBoundingClientRect();
  basket.x = Math.max(basket.w/2, Math.min(W - basket.w/2, clientX - r.left));
}
cv.addEventListener("pointerdown", e => moveTo(e.clientX));
cv.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "touch") moveTo(e.clientX); });
let keyDir = 0;
window.addEventListener("keydown", e => { if(e.key==="ArrowLeft")keyDir=-1; if(e.key==="ArrowRight")keyDir=1; });
window.addEventListener("keyup",   e => { if((e.key==="ArrowLeft"&&keyDir<0)||(e.key==="ArrowRight"&&keyDir>0))keyDir=0; });

// ---- oyun ----
function start(){
  resize();
  score = 0; setLives(3); items = []; spawnTimer = 0;
  spawnEvery = 80; fallBase = 2.4; running = true;
  scoreEl.textContent = 0;
  overlay.classList.remove("show");
  ac().resume();
  basket.x = W/2; basket.w = Math.max(70, W*0.22);
  lastT = performance.now();
  requestAnimationFrame(loop);
}

function spawn(){
  const r = Math.max(26, W*0.085);
  const bomb = Math.random() < 0.2;
  const idx = Math.floor(Math.random()*images.length);
  items.push({
    x: r + Math.random()*(W - 2*r),
    y: -r, r,
    vy: fallBase + Math.random()*1.2 + score*0.02,
    bomb, img: images[idx], pos: POS[idx],
  });
}

function loop(t){
  if (!running) return;
  const dt = Math.min(2, (t - lastT)/16.67); lastT = t;

  // klavye
  if (keyDir) basket.x = Math.max(basket.w/2, Math.min(W - basket.w/2, basket.x + keyDir*7*dt));

  // spawn
  spawnTimer += dt;
  const interval = Math.max(34, spawnEvery - score*0.5);
  if (spawnTimer >= interval){ spawnTimer = 0; spawn(); }

  // arka plan
  ctx.clearRect(0,0,W,H);

  const basketY = H - basket.h - 8;

  // item güncelle + çiz
  for (let i = items.length - 1; i >= 0; i--){
    const it = items[i];
    it.y += it.vy * dt;

    // yakalama kontrolü
    if (it.y + it.r >= basketY && it.y - it.r < basketY + basket.h){
      if (Math.abs(it.x - basket.x) < basket.w/2 + it.r*0.5){
        if (it.bomb){ setLives(lives-1); bombSound(); flash("#ff5252"); }
        else { score++; scoreEl.textContent = score; catchSound(); }
        items.splice(i,1);
        if (lives <= 0) return end();
        continue;
      }
    }
    // yere düştü
    if (it.y - it.r > H){
      if (!it.bomb){ setLives(lives-1); missSound(); flash("#ffb300"); }
      items.splice(i,1);
      if (lives <= 0) return end();
      continue;
    }
    drawItem(it);
  }

  drawBasket(basketY);
  requestAnimationFrame(loop);
}

function drawItem(it){
  ctx.save();
  ctx.beginPath();
  ctx.arc(it.x, it.y, it.r, 0, Math.PI*2);
  if (it.bomb){
    ctx.fillStyle = "#1a1a1a"; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#ffd23f"; ctx.stroke();
    ctx.restore();
    ctx.font = `${it.r*1.2}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("💣", it.x, it.y);
    return;
  }
  ctx.closePath(); ctx.clip();
  if (it.img.complete && it.img.naturalWidth){
    const iw = it.img.naturalWidth, ih = it.img.naturalHeight;
    const s = (it.r*2) / Math.min(iw, ih);
    const dw = iw*s, dh = ih*s;
    ctx.drawImage(it.img, it.x - dw/2, it.y - it.r - (dh - it.r*2)*it.pos, dw, dh);
  } else {
    ctx.fillStyle = "#4fc3f7"; ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(it.x, it.y, it.r, 0, Math.PI*2);
  ctx.lineWidth = 3; ctx.strokeStyle = "#4fc3f7"; ctx.stroke();
}

function drawBasket(y){
  const x = basket.x - basket.w/2;
  ctx.fillStyle = "#8d5524";
  roundRect(x, y, basket.w, basket.h, 6); ctx.fill();
  ctx.fillStyle = "#a86b32";
  roundRect(x, y, basket.w, 7, 4); ctx.fill();
  // örgü çizgileri
  ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++){
    const px = x + (basket.w/5)*i;
    ctx.beginPath(); ctx.moveTo(px, y+4); ctx.lineTo(px, y+basket.h-2); ctx.stroke();
  }
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

let flashColor = null, flashT = 0;
function flash(c){ flashColor = c; flashT = 1; }
// flaş efekti loop içinde basit tutuldu (atlandı)

function end(){
  running = false;
  endSound();
  if (score > best){ best = score; localStorage.setItem("ucanbaz_best", best); bestEl.textContent = best; ovTitle.textContent = "🏆 YENİ REKOR!"; }
  else ovTitle.textContent = "Oyun Bitti!";
  ovText.innerHTML = `Puanın: <b>${score}</b> · Rekor: <b>${best}</b>`;
  startBtn.textContent = "TEKRAR OYNA";
  overlay.classList.add("show");
}

startBtn.addEventListener("click", start);
resize();
