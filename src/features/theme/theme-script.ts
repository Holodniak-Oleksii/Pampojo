import { DARK_QUERY, THEME_COLOR, THEME_STORAGE_KEY } from './constants';

/**
 * Runs in <head> before the first paint, so a dark page never flashes light while React loads.
 * It mirrors `parseTheme`, `resolveTheme` and `applyTheme` without imports.
 */
export const THEME_SCRIPT = `(function(){try{var t;try{t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}var d=t==='dark'||(t!=='light'&&matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);var r=d?'dark':'light';var h=document.documentElement;h.classList.add(r);h.classList.remove(d?'light':'dark');h.style.colorScheme=r;var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}m.content=d?${JSON.stringify(
  THEME_COLOR.dark,
)}:${JSON.stringify(THEME_COLOR.light)}}catch(e){}})();`;
