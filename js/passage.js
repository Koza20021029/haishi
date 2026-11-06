/* 《海市》換頁：三頁是同一個地方，換頁像運鏡，不像點連結。
   往市場：拉下一道鐵捲門，到了市場再拉起來。
   往海上（3D）：起霧，接上 3D 開場的夜霧。
   回地平線：夜色從地平線那條線往上下展開，到了入口再收回那條線。
   記號放在 sessionStorage，下一頁的 <head> 讀到就先蓋住畫面（見各頁 head 裡那一行），這裡負責掀開。
   開新分頁（Cmd／Ctrl／Shift、中鍵）、下載、外部連結、同頁錨點照常；減少動態時直接換頁。 */
(() => {
  const KEY = 'haishi-passage', html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEAVE_MS = { shutter: 720, fog: 760, horizon: 700 };
  const page = p => (p.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  const here = page(location.pathname);
  const kindFor = href => {
    let u; try { u = new URL(href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin) return null;
    const to = page(u.pathname);
    if (to === here) return null;                        // 同一頁（含錨點）不換頁
    return to === 'market' ? 'shutter' : to === 'world' ? 'fog' : to === 'index' ? 'horizon' : null;
  };

  /* 掀開：head 裡已經依記號把畫面蓋住，等第一幀畫好再拉起來 */
  const opened = () => { html.removeAttribute('data-arrive'); html.removeAttribute('data-arrive-go'); };
  if (html.dataset.arrive) {
    if (reduce) opened();
    else {
      const go = () => requestAnimationFrame(() => requestAnimationFrame(() => { html.setAttribute('data-arrive-go', ''); setTimeout(opened, 1400); }));
      // 字型還沒到時先等一下（最多 600ms），免得掀開的瞬間字跳一下
      const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 600))]) : Promise.resolve();
      fonts.then(go);
    }
  }

  /* 離開 */
  let leaving = false;
  function go(href, kind) {
    if (leaving) return; leaving = true;
    try { sessionStorage.setItem(KEY, kind); } catch (e) {}
    if (reduce) { location.href = href; return; }
    html.setAttribute('data-leave', kind);
    setTimeout(() => { location.href = href; }, LEAVE_MS[kind] || 700);
  }
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const kind = kindFor(a.href); if (!kind) return;
    e.preventDefault(); go(a.href, kind);
  });
  // 按「上一頁」回來時（頁面快取），把蓋著的東西拿掉
  addEventListener('pageshow', e => { if (!e.persisted) return; leaving = false; html.removeAttribute('data-leave'); opened(); });
  window.HaishiPassage = { go, kindFor };
})();
