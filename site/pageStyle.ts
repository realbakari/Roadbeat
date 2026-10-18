// The stylesheet every static page inlines. The layout follows the
// Queensland Government Design System's components (header, banner with
// breadcrumbs, in-page navigation, callout, in-page alert, link columns,
// footer), in Roadbeat's own colours: Roadbeat is not a government site, so
// it borrows the patterns, not the Queensland Government brand.
import { SITE } from './settings.ts'

const DARK = [
  'color-scheme:dark',
  '--bg:#0f0f0f',
  '--fg:#e5e7eb',
  '--sub:#a1a1aa',
  '--line:#2a2a2e',
  '--link:#8ab4ff',
  '--panel:#18181b',
  '--banner:#4a1226',
  '--focus:#fbbf24',
  '--note:#60a5fa',
  '--note-bg:#0c1a30',
  '--warn:#f59e0b',
  '--warn-bg:#2a1b06',
  '--foot:#09090b',
  '--accent:#d0668c',
].join(';')

// Light or dark follows the app's own choice (data-mode, set by the page's mode script) and otherwise the system's.
export const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2937;--sub:#4b5563;--line:#e5e7eb;--link:#1d4ed8;--brand:${SITE.themeColor};--panel:#f6f5f3;--banner:${SITE.themeColor};--focus:#b45309;--note:#1d4ed8;--note-bg:#eff6ff;--warn:#b45309;--warn-bg:#fffbeb;--foot:#1c1917;--accent:${SITE.themeColor};--wrap:72rem}
:root[data-mode=light]{color-scheme:light}:root[data-mode=dark]{${DARK}}
@media (prefers-color-scheme:dark){:root:not([data-mode=light]){${DARK}}}
*{box-sizing:border-box}html{scroll-padding-top:16px}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--link);text-underline-offset:2px}a:hover{text-decoration-thickness:2px}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 16px}
.skip{position:absolute;left:8px;top:-60px;z-index:10;padding:10px 16px;border-radius:6px;background:var(--fg);color:var(--bg);font-weight:600}.skip:focus{top:8px}
.site{border-bottom:1px solid var(--line);background:var(--bg);padding-top:env(safe-area-inset-top)}
@media (display-mode:standalone){body::before{content:"";position:fixed;inset:0 0 auto;height:max(env(safe-area-inset-top),6px);background:var(--bg);z-index:20;pointer-events:none}}
.site .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px;padding-top:12px;padding-bottom:12px}
.brand{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;margin-right:auto}
.brand img{width:32px;height:32px}@media (max-width:479px){.brand b+span{display:none}}.brand b{display:block;font-size:18px;line-height:1.2}.brand span{display:block;font-size:13px;color:var(--sub)}
.site nav{flex-basis:100%}@media (min-width:720px){.site nav{flex-basis:auto;order:-1;margin-left:auto}.brand{order:-2;margin-right:0}}
.site nav ul{display:flex;flex-wrap:wrap;align-items:center;gap:4px 20px;margin:0;padding:0;list-style:none}
.site nav a{color:var(--fg);text-decoration:none;font-weight:500;font-size:15px}.site nav a:hover{text-decoration:underline}
.btn,a.open{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:8px;background:var(--brand);color:#fff!important;font-weight:600;text-decoration:none!important;line-height:1.3}
.btn:hover,a.open:hover{filter:brightness(1.12)}.btn::after,a.open::after{content:"→";content:"→" / "";font-weight:400}
.banner{background:var(--banner);color:#fff}
.banner .wrap{padding-top:20px;padding-bottom:36px}
.banner a{color:#fff}.banner h1{font-size:clamp(28px,5vw,42px);line-height:1.15;font-weight:700;margin:12px 0 0;max-width:44rem;text-wrap:balance}
.banner .lead{font-size:18px;line-height:1.6;max-width:44rem;margin:14px 0 0;color:#fdf2f5}
.banner a.open{margin-top:22px;background:#fff;color:var(--brand)!important}
nav.crumbs{font-size:14px;color:#fbe7ee}nav.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px}nav.crumbs li+li::before{content:"›";margin:0 6px 0 2px}
.page{display:grid;gap:8px 48px;padding-top:28px;padding-bottom:48px}
.content{min-width:0}
.content>:not(ul.links){max-width:46rem}
@media (min-width:960px){.page.has-toc{grid-template-columns:minmax(0,1fr) 16rem}.page.has-toc .toc{grid-column:2;grid-row:1;position:sticky;top:20px;align-self:start}.page.has-toc .content{grid-column:1;grid-row:1}}
.toc{border-left:4px solid var(--accent);padding:2px 0 2px 16px;margin-bottom:12px}
.toc-title{font-weight:700;margin:0 0 6px}.toc ul{list-style:none;margin:0;padding:0}.toc li{margin:4px 0}.toc a{font-size:15px}
h2{font-size:24px;line-height:1.3;font-weight:700;margin:36px 0 10px}.content>h2:first-child{margin-top:4px}
h3{font-size:19px;line-height:1.35;margin:26px 0 8px}
p,ul{margin:10px 0}ul{padding-left:22px}li{margin:6px 0}li::marker{color:var(--sub)}
code{font-size:.9em;background:var(--panel);padding:1px 5px;border-radius:4px}
ul.links{list-style:none;padding:0;columns:9.5rem;column-gap:24px}
ul.links li{break-inside:avoid;margin:0;padding:8px 0;border-bottom:1px solid var(--line)}
.callout{margin:20px 0;padding:16px 20px;border-left:4px solid var(--accent);background:var(--panel);border-radius:0 8px 8px 0}
.callout>:first-child,.alert>p+*{margin-top:0}.callout>:last-child,.alert>:last-child{margin-bottom:0}
.alert{margin:20px 0;padding:14px 20px 16px;border-left:6px solid var(--note);background:var(--note-bg);border-radius:0 8px 8px 0}
.alert-title{font-weight:700;margin:0 0 4px}
.alert-warning,.alert-important{border-color:var(--warn);background:var(--warn-bg)}
.cta{margin:32px 0 0;padding:24px;border-radius:12px;background:var(--panel);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px}
.cta p{margin:0;font-weight:600;font-size:18px}
footer{background:var(--foot);color:#d6d3d1;margin-top:24px}
footer .wrap{padding-top:36px;padding-bottom:max(36px,env(safe-area-inset-bottom))}
footer a{color:#fafaf9}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:24px;margin-bottom:24px}
.cols h2{font-size:15px;margin:0 0 8px;color:#fff}.cols ul{list-style:none;margin:0;padding:0}.cols li{margin:6px 0}
footer .fine{border-top:1px solid #44403c;padding-top:20px;font-size:14px;line-height:1.6;color:#a8a29e}
.top{display:inline-block;margin-top:12px;font-size:14px}.top::before{content:"↑ ";content:"↑ " / ""}`
