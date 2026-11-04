/* 《海市》共用資料
   改文字、換照片、填秤冰紀錄，都改這一個檔案就好。
   照片放在 images/<場域代號>/ 裡，檔名寫進 photos 陣列。
   照片還沒放進來時，網頁會自動畫單色剪影當佔位。 */

window.HAISHI = {
  title: '海市',
  myth: {
    source: '史記・天官書',
    quote: '海旁蜃氣象樓臺',
    plain: '古人說，海邊浮現的樓臺城郭，是蜃吐出來的氣。蜃的樣子說法不一，有人說是大蛤，有人說是蛟龍一類。龍口市場的「龍口」，恰好是一張龍的嘴。'
  },

  /* 展期設定：線上冰的融化跟著這裡走 */
  show: {
    start: '2026-12-05T09:00:00+08:00',   // 成果展開始〔待確認〕
    end:   '2026-12-06T18:00:00+08:00',   // 成果展結束〔待確認〕
    afterDays: 30,                         // 收攤後線上冰再慢慢化幾天
    fullWeight: 25,                        // 一塊冰幾斤
    // 現場每小時秤冰的紀錄，填了就照這個化。格式 [距開展幾小時, 斤]
    measured: []
  },

  sites: [
    {
      id: 'longkou', name: '龍口', en: 'Longkou', role: '主要場域',
      where: '臺北中正區，汀州路一段149巷進去的龍口市場',
      look: '巷口在汀州路一段149巷，一層樓高的鐵皮雨遮上掛著黃底紅字的「龍口市場」，旁邊是水果攤、綠色帆布雨遮，和一棟三四層的紅磚老樓。走進去，巷子又低又暗，鐵皮屋頂中間夾著幾片透光浪板，白天也要開日光燈。兩旁大多是拉下的藍灰色鐵捲門，掛著白底手寫的招牌，水餃餡餅、化粧品香水。巷子彎來彎去，走一走就分岔，綠色塑膠籃和腳踏車停在門口，巷子盡頭有一點光。',
      situation: '部分攤位已經拉下鐵門，招牌褪了色也沒有人換。留下來的老攤商，每天清晨仍照常開市。',
      echo: '其他三個地方的問題，最後都帶回這裡。',
      call: '來喔，剛到的龍口，一斤算你便宜啦',
      photos: ['images/longkou/1.jpg', 'images/longkou/2.jpg', 'images/longkou/3.jpg', 'images/longkou/4.jpg'],   // Koza 拍的
      map: { x: 52, y: 54 },
      hue: 24
    },
    {
      id: 'shuangxi', name: '雙溪', en: 'Shuangxi', role: '帶入的經驗',
      where: '新北，雙溪老街與雙溪河',
      look: '被淺山圍著的小鎮，平林溪和牡丹溪在老街旁匯流成雙溪。老街只容得下一輛車，兩旁是石砌和紅磚的矮厝，街頭是三忠廟。過了水泥欄杆的橋，溪邊的老公寓一層一層往後退，陽台對著溪。宜蘭線的火車沿著山腳經過，細雨裡，搬家的卡車往外開。',
      situation: '雙溪沒有明確的界線。老街隨著年輕人離開，一點一點安靜下來。',
      echo: '和龍口一樣，沒有人宣布結束，只是開著的店越來越少。',
      call: '雙溪的河水，秤給你看，比你想的重',
      photos: ['images/shuangxi/1.jpg', 'images/shuangxi/2.jpg'],   // Koza 拍的
      map: { x: 88, y: 44 },
      hue: 160
    },
    {
      id: 'hangkong', name: '航空城', en: 'Aerotropolis', role: '帶入的經驗',
      where: '桃園大園，航空城計畫徵收範圍',
      look: '竹圍街兩排騎樓透天，門窗封上木板，噴著拆遷的編號，只剩一家超商還亮著。福海宮關上大門，廟埕堆滿搬家留下的家具，神明暫住在鐵皮搭的紅壇；巷口還立著石敢當。海口的福元宮已經搬空，田邊的土地公廟一間間封起來。沙崙有油庫，埤塘多半被填平，九十多年的盟德居還在。台十五線改道之後，就是機場的新邊界。',
      situation: '徵收線劃下之後，線內的人家陸續搬離。飛機照常從頭頂飛過去。',
      echo: '效果圖上的航空城乾淨、明亮、沒什麼人，和市場改建的想像很像。',
      call: '航空城的厝，拆了就沒了，最後一批喔',
      photos: ['images/hangkong/1.jpg', 'images/hangkong/2.jpg', 'images/hangkong/3.jpg', 'images/hangkong/4.jpg'],   // Koza 拍的
      map: { x: 12, y: 48 },
      hue: 215
    },
    {
      id: 'shezi', name: '社子島', en: 'Shezi Island', role: '帶入的經驗',
      where: '臺北士林，基隆河與淡水河交會處',
      look: '兩條河交會處的沙洲，一道堤防把島圍起來。從空中看，堤內幾乎被灰藍色的鐵皮屋頂填滿，工廠、小工坊、生鏽的儲油槽、五顏六色的油桶，夾著墊高地基的透天厝和菜園。延平北路從島中間穿過，社子大橋往北投去，堤防上掛著自救會的布條，島上還有坤天亭。',
      situation: '五十多年的限建，讓許多房子只能修補，無法翻新。堤防外的潮水照常漲退。',
      echo: '在規劃和等待之間照常過日子，這點和龍口的老攤商一樣。',
      call: '社子島的潮水，漲起來又退下去，算你一斤就好',
      photos: ['images/found/shezi-overlook.jpg', 'images/found/dsc-5044.jpg', 'images/found/night-in-shezi-bridge-20140830.jpg'],   // 暫用 Wikimedia Commons 的照片，Koza 的照片放進來後換掉
      map: { x: 40, y: 20 },
      hue: 195
    }
  ],

  echo: '四個地方的共鳴，在於被描繪的未來和眼前的日常之間的落差。規劃圖和效果圖裡，這些地方總是乾淨、明亮、人很少，像一座蜃樓。生活在裡面的人，卻在不確定裡一天一天地等。',

  /* 走讀撿到的：去雙溪和航空城走讀時，路上聽到、看到的東西。
     3D 海市裡也立了同名的地標牌。不想放的刪掉那一行就好。 */
  walk: [
    { site: 'shuangxi', thing: '東和戲院的一面牆', note: '雙溪最老的戲院，民國六十五年前後關了，現在只剩一面牆和放映的洞。' },
    { site: 'shuangxi', thing: '老街的打鐵舖', note: '碳爐還在，牆上掛的刀已經是從三峽批來的。' },
    { site: 'shuangxi', thing: '林益和堂的八仙果', note: '一百多年的中藥行，洋樓還在，老闆照古法做八仙果和橄欖。' },
    { site: 'shuangxi', thing: '一百八十天的雨', note: '雙溪曾經一年有一百八十天在下雨，從十一月一路下到媽祖生。' },
    { site: 'shuangxi', thing: '地是別人的', note: '老街很多房子蓋在連家的地上，住了好幾代，每年還繳一點地租。' },
    { site: 'shuangxi', thing: '礦坑口', note: '雙溪產過全台最好的焦煤，最多時有三萬人。礦收了以後，剩下三千人。' },
    { site: 'hangkong', thing: '四個聖桮', note: '問石敢當要留下、進博物館，還是跟居民走，連續四個聖桮，祂選擇跟人走。' },
    { site: 'hangkong', thing: '海口埤的龍船', note: '照古法重新造的船。端午那天搬出去的人都回來了，小孩也跑來划。' },
    { site: 'hangkong', thing: '二十幾種鳥叫', note: '人搬走、路封起來以後，沙崙魚池邊最大的聲音。魚池十二月要填平。' },
    { site: 'hangkong', thing: '冬天的蟬叫', note: '海口人聽飛機分辨季節和風向，搬到跑道另一頭，冬天和夏天的聲音會互換。' },
    { site: 'hangkong', thing: '合爐', note: '土地公搬進別人的轄區，一個地方不能有兩尊，原本拜的那尊就不見了。' },
    { site: 'hangkong', thing: '堤岸上的石敢當', note: '好幾顆都立在埤塘堤岸、容易潰堤的角落，像信仰上的堤防。' }
  ],


  /* 照片說明與出處。暫用的照片來自 Wikimedia Commons（可商用、需署名），換成自己的照片後把那一行刪掉即可。 */
  photoInfo: {
    'images/longkou/1.jpg': { cap: '龍口市場，汀州路一段149巷的巷口', by: 'Koza' },
    'images/longkou/2.jpg': { cap: '龍口市場的巷子裡', by: 'Koza' },
    'images/longkou/3.jpg': { cap: '龍口市場的巷子，門口堆著收納箱，吊著紅燈籠', by: 'Koza' },
    'images/longkou/4.jpg': { cap: '市場的鐵皮屋頂，中間夾著透光浪板', by: 'Koza' },
    'images/shuangxi/1.jpg': { cap: '雙溪，沿著溪一層一層往後退的老公寓', by: 'Koza' },
    'images/shuangxi/2.jpg': { cap: '雙溪老街上林益和堂的洋樓', by: 'Koza' },
    'images/hangkong/1.jpg': { cap: '航空城徵收範圍裡的廟，旁邊的門已經封起來', by: 'Koza' },
    'images/hangkong/2.jpg': { cap: '埤塘上的白鷺鷥，後面是機場的雷達', by: 'Koza' },
    'images/hangkong/3.jpg': { cap: '還有人住的老屋，門口撐著陽傘', by: 'Koza' },
    'images/hangkong/4.jpg': { cap: '搬空的房子，門窗釘上夾板', by: 'Koza' },
    'images/found/shezi-overlook.jpg': { cap: '從山上看社子島，兩條河夾著的沙洲', by: 'vixyao，CC BY-SA 2.0', url: 'https://commons.wikimedia.org/wiki/File:Shezi_overlook.jpg' },
    'images/found/dsc-5044.jpg': { cap: '社子島與社子大橋', by: 'Taiwankengo，CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:%E7%A4%BE%E5%AD%90%E5%A4%A7%E6%A9%8BDSC_5044.jpg' },
    'images/found/night-in-shezi-bridge-20140830.jpg': { cap: '夜裡的社子大橋', by: 'David Jackson，CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Night_in_Shezi_Bridge_20140830.jpg' },
    'images/found/ice-blocks-melting-in-an-old-oven.jpg': { cap: '正在化的冰', by: 'W.carter，CC BY-SA 4.0', url: 'https://commons.wikimedia.org/w/index.php?curid=138564078' }
  },

  // Koza 走讀心得裡的一句，放在網頁最後
  closing: '冰還是會化，只是化的時候，旁邊會有人站著看。',

  samples: [
    { place: '新莊老家的頂樓', words: '曬衣服的鐵架，颱風前要先拆下來', w: 3.2, sample: true },
    { place: '金瓜石的雨', words: '六年都沒乾過的鞋子', w: 2.1, sample: true },
    { place: '奶奶的菜市場', words: '她跟賣魚的阿姨講話，從來不用講價', w: 3.8, sample: true }
  ]
};

/* 帳簿：觀眾換進來的地方。目前存在每個人自己的瀏覽器裡。
   之後若要讓所有人共看，換掉 load / add 這兩個函式即可。 */
window.HaishiLedger = (function () {
  const KEY = 'haishi-ledger-v2';
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  // 一個地方有多重：寫得越多越重
  function weigh(place, words) {
    const w = Math.min(9.9, 0.8 + ((place || '').length + (words || '').length) * 0.06);
    return Math.round(w * 10) / 10;
  }
  // site：換走的是哪一塊冰的水
  function add(place, words, site) {
    const entry = { place, words, w: weigh(place, words), ts: Date.now() };
    if (site) entry.site = site;
    const all = load(); all.unshift(entry);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
    return entry;
  }
  function all() {
    const now = Date.now();
    const s = window.HAISHI.samples.map((x, i) => Object.assign({ ts: now - (i + 1) * 86400000 }, x));
    return load().concat(s);
  }
  return { load, add, all, weigh, bag: 1.5 };
})();

/* 冰還剩多少斤：依展期與現場紀錄計算。preview 為 0–1 時改用快轉預覽 */
window.HaishiIce = function (preview) {
  const S = window.HAISHI.show, full = S.fullWeight;
  const start = new Date(S.start).getTime(), end = new Date(S.end).getTime();
  const after = end + S.afterDays * 86400000;
  let p;
  if (typeof preview === 'number') p = preview;
  else {
    const now = Date.now();
    if (now < start) p = 0;
    else if (now < end) p = 0.6 * (now - start) / (end - start);
    else if (now < after) p = 0.6 + 0.4 * (now - end) / (after - end);
    else p = 1;
    if (S.measured.length && now < end) {
      const h = (now - start) / 3600000;
      const m = S.measured.filter(r => r[0] <= h).pop();
      if (m) p = 0.6 * (1 - m[1] / full);
    }
  }
  p = Math.max(0, Math.min(1, p));
  const phase = p === 0 ? '開展前，冰還是滿的' : p < 0.6 ? '展期中' : p < 1 ? '收攤後，慢慢化完' : '化完了';
  return { p, weight: full * (1 - p), phase };
};

/* 佔位照片：還沒放真照片時，畫一張這個地方的單色剪影。
   idx 越大鏡頭越近（遠景 → 近景），和實體冰上的輪播順序一樣。 */
window.HaishiPlaceholder = function (site, idx, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  let seed = site.hue * 131 + idx * 977 + 3;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const hue = site.hue;
  const zoom = 1 + idx * .35;               // 越後面越近
  const ink = a => `hsla(${hue},18%,9%,${a})`;
  // 天色：低彩度雙色調
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `hsl(${hue},14%,${14 + idx * 2}%)`);
  g.addColorStop(.55, `hsl(${hue},16%,${46 - idx * 3}%)`);
  g.addColorStop(.62, `hsl(${hue},12%,${58 - idx * 3}%)`);
  g.addColorStop(1, `hsl(${hue},16%,${10}%)`);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const H0 = h * (.6 + idx * .02);          // 地平線

  x.save(); x.translate(w / 2, H0); x.scale(zoom, zoom); x.translate(-w / 2, -H0);
  const glowAt = (gx, gy, rr, a) => { const gl = x.createRadialGradient(gx, gy, 0, gx, gy, rr); gl.addColorStop(0, `rgba(255,214,150,${a})`); gl.addColorStop(.18, `rgba(255,190,110,${a * .45})`); gl.addColorStop(1, 'rgba(255,180,100,0)'); x.fillStyle = gl; x.beginPath(); x.arc(gx, gy, rr, 0, 7); x.fill(); };
  if (site.id === 'shuangxi') {
    // 淺山一層一層圍住小鎮，細雨
    [[.36, .42, 1.3], [.27, .62, 2.1], [.17, .85, 3.3]].forEach(([amp, a, f], k) => {
      x.fillStyle = ink(a); x.beginPath(); x.moveTo(0, H0);
      for (let i = 0; i <= 60; i++) { const u = i / 60; x.lineTo(w * u, H0 - h * amp * (.55 + .3 * Math.sin(u * f * 3 + k * 1.7) + .12 * Math.sin(u * 17 + k))); }
      x.lineTo(w, h); x.lineTo(0, h); x.fill();
    });
    // 老街矮厝與屋頂
    let bx = -w * .02;
    while (bx < w) { const bw = w * (.07 + r() * .05), bh = h * (.07 + r() * .04), top = H0 - bh;
      x.fillStyle = ink(1); x.fillRect(bx, top, bw, bh + h);
      if (r() < .6) { x.beginPath(); x.moveTo(bx - 3, top); x.lineTo(bx + bw / 2, top - bh * .45); x.lineTo(bx + bw + 3, top); x.fill(); }
      if (r() < .3) { x.fillStyle = `rgba(255,200,130,${.5 + r() * .3})`; x.fillRect(bx + bw * .3, top + bh * .3, bw * .25, bh * .22); }
      bx += bw + 1; }
    // 廟的燕尾
    const tx = w * .7, ty = H0 - h * .12; x.fillStyle = ink(1); x.fillRect(tx, ty, w * .12, h * .14);
    x.beginPath(); x.moveTo(tx - w * .02, ty); x.quadraticCurveTo(tx + w * .06, ty - h * .03, tx + w * .14, ty); x.lineTo(tx + w * .15, ty - h * .03); x.lineTo(tx + w * .12, ty - h * .01); x.lineTo(tx, ty - h * .01); x.lineTo(tx - w * .03, ty - h * .03); x.fill();
    glowAt(tx + w * .02, ty + h * .03, w * .03, .8); glowAt(tx + w * .1, ty + h * .03, w * .03, .8);
    // 河面
    x.fillStyle = `hsla(${hue},20%,70%,.12)`; for (let i = 0; i < 30; i++) x.fillRect(r() * w, H0 + h * (.03 + r() * .3), w * (.04 + r() * .2), 1);
    x.strokeStyle = 'rgba(210,225,230,.12)'; x.lineWidth = 1; for (let i = 0; i < 160; i++) { const rx = r() * w * 1.2, ry = r() * h; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 6, ry + 26); x.stroke(); }
  } else if (site.id === 'hangkong') {
    // 平坦的田和埤塘，壓得很低的飛機
    x.fillStyle = ink(1); x.fillRect(0, H0, w, h);
    for (let i = 0; i < 14; i++) { const yy = H0 + h * (.02 + i * i * .0035); x.fillStyle = `hsla(${hue},20%,${30 + r() * 25}%,.25)`; x.fillRect(0, yy, w, 1 + i * .4); }
    let bx = w * .05;
    for (let i = 0; i < 8; i++) { const bw = w * (.05 + r() * .03), bh = h * (.08 + r() * .06), broken = r() < .35;
      x.fillStyle = ink(1); x.beginPath(); x.moveTo(bx, H0); x.lineTo(bx, H0 - bh); x.lineTo(bx + bw, H0 - bh * (broken ? .45 : 1)); x.lineTo(bx + bw, H0); x.fill();
      if (!broken && r() < .25) { x.fillStyle = 'rgba(255,205,140,.7)'; x.fillRect(bx + bw * .3, H0 - bh * .7, bw * .3, bh * .12); }
      bx += bw + w * (.01 + r() * .06); }
    x.fillStyle = 'hsla(130,25%,18%,1)'; x.fillRect(w * .5, H0 - h * .035, w * .5, h * .035);    // 綠色圍籬
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(w * .5, H0 - h * .03, w * .5, 1.5);
    x.save(); x.translate(w * (.58 - idx * .08), h * (.28 + idx * .02)); x.rotate(.05); const s = w * .0019 * (1 + idx * .35);
    x.scale(s, s); x.fillStyle = ink(.92); x.beginPath(); x.ellipse(0, 0, 64, 7, 0, 0, 7); x.fill();
    x.beginPath(); x.moveTo(-6, 0); x.lineTo(16, 44); x.lineTo(26, 44); x.lineTo(12, 0); x.fill();
    x.beginPath(); x.moveTo(-6, 0); x.lineTo(16, -44); x.lineTo(26, -44); x.lineTo(12, 0); x.fill();
    x.beginPath(); x.moveTo(-56, 0); x.lineTo(-64, -22); x.lineTo(-52, -22); x.lineTo(-44, 0); x.fill(); x.restore();
    glowAt(w * (.58 - idx * .08) + w * .12 * (1 + idx * .35), h * (.28 + idx * .02) + 4, w * .05, .9);
    x.strokeStyle = 'rgba(196,54,44,.75)'; x.lineWidth = 2; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(0, H0 + h * .1); x.lineTo(w, H0 + h * .05); x.stroke(); x.setLineDash([]);
  } else if (site.id === 'shezi') {
    // 遠山（觀音山）、堤防後的屋頂、水塔、儲油槽
    x.fillStyle = ink(.45); x.beginPath(); x.moveTo(0, H0 - h * .05);
    for (let i = 0; i <= 40; i++) { const u = i / 40; x.lineTo(w * u, H0 - h * (.06 + .17 * Math.exp(-Math.pow((u - .32) * 3.2, 2)) + .03 * Math.sin(u * 23))); }
    x.lineTo(w, H0); x.lineTo(0, H0); x.fill();
    x.fillStyle = ink(.9);
    for (let i = 0; i < 14; i++) { const bx = r() * w, bw = w * (.05 + r() * .08), bh = h * (.04 + r() * .06), base = H0 - h * .055;
      if (r() < .4) { x.beginPath(); x.moveTo(bx, base); x.lineTo(bx, base - bh * .6); x.lineTo(bx + bw / 2, base - bh); x.lineTo(bx + bw, base - bh * .6); x.lineTo(bx + bw, base); x.fill(); }
      else { x.fillRect(bx, base - bh, bw, bh); if (r() < .7) { x.fillRect(bx + bw * .3, base - bh - 6, bw * .3, 6); x.beginPath(); x.ellipse(bx + bw * .45, base - bh - 8, bw * .16, 4, 0, 0, 7); x.fill(); } } }
    for (let i = 0; i < 3; i++) { const cx = w * (.62 + i * .07), cw = w * .05, ch = h * .07; x.fillRect(cx, H0 - h * .05 - ch, cw, ch); x.beginPath(); x.ellipse(cx + cw / 2, H0 - h * .05 - ch, cw / 2, 4, 0, 0, 7); x.fill(); }
    x.fillStyle = ink(1); x.fillRect(0, H0 - h * .055, w, h * .055);       // 堤防
    x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, H0 - h * .055, w, 1.5);
    x.fillStyle = `hsla(${hue},22%,26%,1)`; x.fillRect(0, H0, w, h);
    x.fillStyle = `hsla(${hue},20%,80%,.14)`; for (let i = 0; i < 40; i++) x.fillRect(r() * w, H0 + r() * h * .35, w * (.03 + r() * .15), 1);
  } else {
    // 龍口：又低又暗的窄巷，兩旁拉下的鐵捲門，盡頭有光
    const vx = w * .56, vy = H0 - h * .02;
    x.fillStyle = ink(1); x.fillRect(0, 0, w, h);
    const lightEnd = x.createRadialGradient(vx, vy, 2, vx, vy, w * .16); lightEnd.addColorStop(0, 'rgba(240,236,220,.9)'); lightEnd.addColorStop(1, 'rgba(240,236,220,0)');
    x.fillStyle = lightEnd; x.fillRect(0, 0, w, h);
    for (let k = 9; k >= 0; k--) { const d = 1 / (1 + k * .5), d2 = 1 / (1 + (k + 1) * .5);
      [-1, 1].forEach(sd => { const blue = r() < .5;
        x.fillStyle = blue ? `rgba(70,96,120,${.35 + d * .5})` : `rgba(96,104,108,${.3 + d * .5})`;
        x.beginPath(); x.moveTo(vx + sd * w * .2 * d, vy - h * .3 * d); x.lineTo(vx + sd * w * .2 * d2, vy - h * .3 * d2); x.lineTo(vx + sd * w * .2 * d2, vy + h * .25 * d2); x.lineTo(vx + sd * w * .2 * d, vy + h * .25 * d); x.fill();
        x.fillStyle = 'rgba(0,0,0,.25)'; for (let q = 0; q < 8; q++) { const yy = vy - h * .3 * d + q * h * .07 * d; x.fillRect(Math.min(vx + sd * w * .2 * d, vx + sd * w * .2 * d2), yy, Math.abs(w * .2 * (d - d2)), 1); }
        if (r() < .4) { x.fillStyle = `rgba(236,235,227,${.4 + d * .5})`; x.fillRect(vx + sd * w * .13 * d - w * .04 * d, vy - h * .26 * d, w * .08 * d, h * .05 * d); } });
      x.fillStyle = r() < .4 ? `rgba(150,170,140,${.12 + d * .15})` : 'rgba(0,0,0,.4)'; x.fillRect(vx - w * .2 * d, vy - h * .31 * d, w * .4 * d, h * .3 * (d - d2) + 1);
      if (r() < .6) { x.fillStyle = `rgba(235,245,255,${.75 * d})`; x.fillRect(vx - 1, vy - h * .29 * d, 2, h * .03 * d); } }
    for (let i = 0; i < 4; i++) { const gx = vx + (r() - .5) * w * .3, gy = vy + h * (.12 + r() * .1); x.fillStyle = 'rgba(60,140,90,.5)'; x.fillRect(gx, gy, w * .04, h * .03); }
  }
  x.restore();

  // 霧、暗角、顆粒
  const fog = x.createLinearGradient(0, H0 - h * .15, 0, H0 + h * .1);
  fog.addColorStop(0, 'rgba(220,226,232,0)'); fog.addColorStop(.6, 'rgba(220,226,232,.16)'); fog.addColorStop(1, 'rgba(220,226,232,0)');
  x.fillStyle = fog; x.fillRect(0, 0, w, h);
  const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  x.fillStyle = 'rgba(235,238,240,.55)'; x.font = `${Math.round(w / 22)}px "Noto Serif TC", serif`;
  x.fillText(`${site.name}　${['一', '二', '三', '四', '五', '六', '七', '八'][idx] || idx + 1}`, w * .06, h * .95);
  return c;
};
