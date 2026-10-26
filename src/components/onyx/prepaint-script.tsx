import { ACCENTS, BROWSER_CHROME, resolveAccent, type ThemeMode } from "@/lib/themes";
import { STORE_KEY } from "@/lib/storage-keys";

const THEMES: ThemeMode[] = ["dark", "light", "frosted"];

/** Contrast-resolved accent for every theme, computed once on the server. */
const accentTable = Object.fromEntries(
  THEMES.map((theme) => [
    theme,
    Object.fromEntries(
      ACCENTS.map((a) => {
        const r = resolveAccent(a.color, theme);
        return [a.id, [r.primary, r.onPrimary, r.hover]];
      })
    ),
  ])
);

/**
 * Runs before first paint. Reads the persisted preferences and sets language,
 * direction, theme, accent and display options on <html> so Arabic users never
 * see a flash of left-to-right layout or the wrong theme.
 */
const source = `(function(){try{
var raw=localStorage.getItem(${JSON.stringify(STORE_KEY)});
var s=(raw&&JSON.parse(raw).state)||{};var st=s.settings||{};
var d=document.documentElement;
var lang=s.lang==="ar"?"ar":(s.lang==="fa"?"fa":"en");
var theme=s.theme;
if(st.followSystemTheme)theme=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
if(theme!=="light"&&theme!=="frosted")theme="dark";
d.lang=lang;d.dir=(lang==="ar"||lang==="fa")?"rtl":"ltr";
d.classList.remove("theme-dark","theme-light","theme-frosted");d.classList.add("theme-"+theme);
d.dataset.corners=st.corners||"soft";d.dataset.density=st.density||"comfortable";
d.dataset.poster=st.posterSize||"md";d.dataset.motion=st.motion||"system";d.dataset.font=st.fontStyle||"editorial";
var a=${JSON.stringify(accentTable)}[theme][s.accent]||${JSON.stringify(accentTable)}[theme]["white"];
if(a){d.style.setProperty("--primary",a[0]);d.style.setProperty("--primary-foreground",a[1]);d.style.setProperty("--accent",a[2]);d.style.setProperty("--ring",a[0]);}
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute("content",${JSON.stringify(BROWSER_CHROME)}[theme]);
}catch(e){}})();`;

export function PrepaintScript() {
  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
