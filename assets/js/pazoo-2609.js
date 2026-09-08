(function(){



  /* 現れる動き：Renoca と同じ判定
     (scrollTop + 画面高) > 要素の上端 + 画面高 * 0.20 で .on を付ける */
  (function(){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      document.querySelectorAll('.anime').forEach(function(el){ el.classList.add('on'); });
      var h0 = document.querySelector('.hero'); if (h0) h0.classList.add('ready');
      return;
    }
    function check(){
      var st = window.scrollY, h = window.innerHeight;
      document.querySelectorAll('.anime:not(.on)').forEach(function(el){
        var top = el.getBoundingClientRect().top + st;
        if ((st + h) > top + (h * 0.20)) el.classList.add('on');
      });
      var hd = document.querySelector('.hd');
      if (hd) hd.classList.toggle('min', st > 90);
    }
    window.addEventListener('scroll', check, { passive:true });
    window.addEventListener('resize', check);
    check();
    /* ヒーローは読み込み直後に順番に出す */
    setTimeout(function(){ var h1 = document.querySelector('.hero'); if (h1) h1.classList.add('ready'); }, 150);
  })();

  /* ロゴ（置いてあれば自動で差し替わる） */
  var names = ['pazoo-logo.png','pazoo-logo.webp','pazoo-logo.jpg','pazoo-logo.svg','logo.png','logo.webp'];
  function bindLogo(imgId, txtId){
    var img = document.getElementById(imgId), txt = document.getElementById(txtId);
    if (!img) return;
    var i = 0;
    function next(){
      if (i >= names.length) { img.hidden = true; if (txt) txt.hidden = false; return; }
      img.src = '素材/' + names[i++];
    }
    img.addEventListener('load', function(){ img.hidden = false; if (txt) txt.hidden = true; });
    img.addEventListener('error', next);
    next();
  }
  bindLogo('logo','logoTxt');
  bindLogo('logoFt','logoFtTxt');   /* フッターにもロゴ（社長 2026-09-04） */

  /* 3本線メニュー（社長 2026-09-04） */
  var menuBtn = document.getElementById('menuBtn'), drawer = document.getElementById('drawer'), hdEl = document.querySelector('.hd');
  if (menuBtn && drawer) {
    function setMenu(open){
      drawer.classList.toggle('open', open);
      hdEl.classList.toggle('nav-open', open);
      document.body.classList.toggle('no-scroll', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    }
    menuBtn.addEventListener('click', function(){ setMenu(!drawer.classList.contains('open')); });
    drawer.querySelectorAll('a[href^="#"]').forEach(function(a){ a.addEventListener('click', function(){ setMenu(false); }); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', function(){ if (window.innerWidth > 1040) setMenu(false); });
  }

  /* ヒーローのスライド（進捗バーが5秒で満ちたら次へ＝Renoca方式） */
  var bg = document.getElementById('hbg'), bars = document.getElementById('bars');
  if (bg && bars) {
    var slides = bg.querySelectorAll('.slide'), btns = bars.querySelectorAll('button');
    var i = 0, t = null;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* 差し色は蛍光ミント1色（社長 2026-09-04「1色 ミントだけで大丈夫」。写真ごとの切替は取りやめ） */
    /* タイピングは最初の表示だけ（社長 2026-09-04「画像切り替わりの際はタイピングいらない」） */
    var hero = document.querySelector('.hero'), l1 = hero.querySelector('.l1'), l2 = hero.querySelector('.l2');
    var L1TXT = l1.textContent, typer = null, firstShow = true;
    function retype(){
      if (reduce) return;
      if (typer) { clearTimeout(typer); typer = null; }
      l1.style.transition = 'none'; l1.style.opacity = '1'; l1.style.transform = 'none'; l1.textContent = '';
      l2.style.transition = 'opacity 1.6s ease, transform 1.6s ease'; l2.style.opacity = '0'; l2.style.transform = 'translateY(16px)';
      hero.classList.add('typing');
      var k = 0;
      function step(){
        if (k <= L1TXT.length) { l1.textContent = L1TXT.slice(0, k); k++; typer = setTimeout(step, 140); }
        else { hero.classList.remove('typing'); l2.style.opacity = '1'; l2.style.transform = 'none'; typer = null; }
      }
      typer = setTimeout(step, 600);
    }
    function show(n){
      i = (n + slides.length) % slides.length;
      if (firstShow) { firstShow = false; retype(); }   /* 最初の1回だけタイピング */
      slides.forEach(function(el,k){ el.classList.toggle('on', k===i); });
      btns.forEach(function(b,k){
        var sp = b.querySelector('span');
        if (k === i) {
          sp.style.transition = 'none'; sp.style.width = '0';
          void sp.offsetWidth;           /* いったん巻き戻してから伸ばす */
          sp.style.transition = ''; b.classList.add('on');
        } else {
          b.classList.remove('on');
          sp.style.transition = 'none'; sp.style.width = '0';
        }
      });
    }
    function start(){ if (reduce) return; stop(); t = setInterval(function(){ show(i+1); }, 5000); }
    function stop(){ if (t) { clearInterval(t); t = null; } }
    btns.forEach(function(b){ b.addEventListener('click', function(){ show(Number(b.dataset.i)); start(); }); });
    document.addEventListener('visibilitychange', function(){ document.hidden ? stop() : start(); });
    show(0); start();
  }

  /* Instagram（Behold.so）。★顧客がBehold連携後に Feed ID を入れる。空なら待ちの板のまま。
     取得先＝https://feeds.behold.so/<Feed ID> 。Artifact は外部への通信ができないので、
     配布用の1枚では並ばない（本番のサイトでは並ぶ）。 */
  var BEHOLD_FEED_ID = '';
  var INSTA_MAX = 8;
  (function(){
    var feed = document.getElementById('igfeed');
    if (!feed || !BEHOLD_FEED_ID) return;
    fetch('https://feeds.behold.so/' + BEHOLD_FEED_ID)
      .then(function(r){ if (!r.ok) throw new Error('feed ' + r.status); return r.json(); })
      .then(function(data){
        var posts = (data && (data.posts || data)) || [];
        if (!posts.length) return;
        feed.innerHTML = '';
        posts.slice(0, INSTA_MAX).forEach(function(p){
          var a = document.createElement('a');
          a.href = p.permalink || '#'; a.target = '_blank'; a.rel = 'noopener nofollow';
          var img = document.createElement('img');
          img.src = p.thumbnailUrl || p.mediaUrl || (p.sizes && p.sizes.small && p.sizes.small.mediaUrl);
          img.alt = (p.caption || 'Instagram').slice(0, 60); img.loading = 'lazy';
          a.appendChild(img); feed.appendChild(a);
        });
      })
      .catch(function(e){ console.warn('Instagram feed:', e); });
  })();

  /* 在庫（2026-09-02 グーネット掲載の実在庫6台） */
  var STOCK = {
    updated: "2026.09.09",
    cars: [
      {name:"スズキ ジムニー ランドベンチャー", year:1997, km:20.3, price:75, shaken:"車検なし", badge:"Jimny", repair:"修復歴あり",
       photo:"https://picture1.goo-net.com/7000902905/30240807/J/70009029053024080700100.jpg",
       url:"https://www.goo-net.com/usedcar/spread/goo/11/700090290530240807001.html"},
      {name:"スズキ ジムニー XL", year:1997, km:14.6, price:103, shaken:"車検2026年12月まで", badge:"Jimny", repair:null,
       photo:"https://picture1.goo-net.com/7000902905/30260716/J/70009029053026071600100.jpg",
       url:"https://www.goo-net.com/usedcar/spread/goo/11/700090290530260716001.html"},
      {name:"ジープ・グランドワゴニア", year:1990, km:null, price:407.5, shaken:"車検なし", badge:"Classic", repair:null,
       photo:"https://picture1.goo-net.com/7000902905/30260420/J/70009029053026042000100.jpg",
       url:"https://www.goo-net.com/usedcar/spread/goo/11/700090290530260420001.html"},
      {name:"スズキ キャリイトラック", year:2015, km:2.2, price:77, shaken:"車検2028年6月まで", badge:null, repair:null,
       photo:"https://picture1.goo-net.com/7000902905/30260518/J/70009029053026051800100.jpg",
       url:"https://www.goo-net.com/usedcar/spread/goo/11/700090290530260518001.html"}
    ]
  };

  var rail = document.getElementById('rail');
  var upd = document.getElementById('upd');
  if (rail) {
    if (upd) upd.textContent = STOCK.updated;
    var updNote = document.getElementById('updNote');
    if (updNote) updNote.textContent = STOCK.updated.split('.').join('-');/* 注記の日付も STOCK.updated に追従させる（2026-09-04） */
    var ts = Date.parse(STOCK.updated.replace(/\./g,'/'));
    if (!isNaN(ts) && (Date.now() - ts) > 48*60*60*1000) {
      var w = document.createElement('p'); w.className = 'note';
      w.textContent = '在庫情報の更新が確認できないため、一時的に表示を止めています。お手数ですがお電話でお問い合わせください。';
      rail.parentNode.insertBefore(w, rail);
    } else {
      /* 自動で流すのは取りやめ（社長 2026-09-04「在庫自動スライド無し」）。並びは1組だけ */
      function makeCar(c){
        var a = document.createElement('a');
        a.className = 'car'; a.href = c.url; a.target = '_blank'; a.rel = 'noopener';
        a.setAttribute('aria-label', c.name + '（詳しいページを別のタブで開きます）');

        var ph = document.createElement('div'); ph.className = 'ph';
        if (c.photo) { var im = document.createElement('img'); im.src = c.photo; im.alt = c.name; im.loading = 'lazy'; ph.appendChild(im); }
        if (c.badge) { var bd = document.createElement('span'); bd.className = 'badge'; bd.textContent = c.badge; ph.appendChild(bd); }

        var b = document.createElement('div'); b.className = 'body';
        var nm = document.createElement('div'); nm.className = 'name'; nm.textContent = c.name;
        var sp = document.createElement('div'); sp.className = 'spec';
        var bits = [];
        bits.push(c.year + '年');
        bits.push((c.km || c.km === 0) ? c.km + '万km' : '走行距離不明');
        if (c.shaken) bits.push(c.shaken);
        if (c.repair) bits.push(c.repair);
        sp.textContent = bits.join('　/　');
        var pr = document.createElement('div'); pr.className = 'price';
        pr.innerHTML = c.price ? (c.price + ' <small>万円（支払総額）</small>') : 'ASK <small>価格応談</small>';
        var go = document.createElement('div'); go.className = 'go'; go.textContent = 'View Detail';
        b.appendChild(nm); b.appendChild(sp); b.appendChild(pr); b.appendChild(go);
        a.appendChild(ph); a.appendChild(b);
        return a;
      }
      STOCK.cars.forEach(function(c){ rail.appendChild(makeCar(c)); });
    }
    /* 在庫は手で送る（社長 2026-09-04「在庫自動スライド無し」）。自動で流す仕掛けは取りやめた。
       指でのスワイプ・←→ボタン・キーボードで動かす。吸い付き（scroll-snap）はCSSのまま効かせる。 */
    var p = document.getElementById('prev'), n = document.getElementById('next');
    if (p && n) {
      p.addEventListener('click', function(){ rail.scrollBy({left:-386, behavior:'smooth'}); });
      n.addEventListener('click', function(){ rail.scrollBy({left: 386, behavior:'smooth'}); });
    }
    /* 矢印は「まだ右に続きがある」ときだけ出す。右端まで送ったら消える */
    var hint = document.getElementById('railHint');
    if (hint) {
      var updHint = function(){
        var more = rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 8;
        hint.classList.toggle('off', !more);
      };
      hint.addEventListener('click', function(){ rail.scrollBy({ left: 386, behavior:'smooth' }); });
      rail.addEventListener('scroll', updHint, { passive:true });
      window.addEventListener('resize', updHint);
      window.addEventListener('load', updHint);
      updHint();
    }
  }
})();
