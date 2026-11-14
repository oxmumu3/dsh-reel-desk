// Client panel & conversation cards for @oxmumu3/dsh-reel-desk (`制片台` Flow v3).
// Combined with shared/kinds.js + shared/composition-core.js by scripts/build-client.mjs into client.js.

    var PANEL_KEY = 'reel-desk'
    var VIEW_URL = '/api/reel_desk/view'
    var ACTION_URL = '/api/reel_desk/action'
    var ASSET_URL = '/api/reel_desk/asset'
    var MEDIA_URL = '/api/reel_desk/media'
    var MAX_UPLOAD_BYTES = 10 * 1024 * 1024

    function loadReact() {
      try {
        var mod = require('react')
        return mod && mod.createElement ? mod : mod && mod.default
      } catch (_err) {
        return null
      }
    }

    var GLYPH_OPTIONS = [
      { id: 'dot', label: '点' },
      { id: 'tag', label: '小签' },
      { id: 'plugin', label: '插件块' },
      { id: 'none', label: '不放' },
    ]

    var CSS = [
      '.rd{--rd-ink:var(--dsw-alias-label-primary,#141413);',
      '--rd-ink2:var(--dsw-alias-label-secondary,#575650);',
      '--rd-ink3:var(--dsw-alias-label-tertiary,#8a8880);',
      '--rd-bg:var(--dsw-alias-bg-base,#faf9f5);',
      '--rd-card:var(--dsw-alias-bg-layer-2,#ffffff);',
      '--rd-sub:var(--dsw-alias-bg-layer-1,#f3f1ea);',
      '--rd-line:var(--dsw-alias-border-l2,rgba(20,20,19,.1));',
      '--rd-line2:var(--dsw-alias-border-l4,rgba(20,20,19,.2));',
      '--rd-hover:var(--dsw-alias-interactive-bg-hover,rgba(20,20,19,.05));',
      '--rd-brand:var(--dsw-alias-link,#2563eb);',
      '--rd-ok:var(--dsw-alias-state-success-primary,#15803d);',
      '--rd-warn:var(--dsw-alias-state-warn-primary,#d97706);',
      '--rd-err:var(--dsw-alias-state-error-primary,#dc2626);',
      '--rd-well:#0c0c0d;--rd-well-ink:#e9e8e3;--rd-well-ink2:#8d8c86;',
      '--rd-ai:color-mix(in srgb,var(--rd-brand) 9%,var(--rd-card));',
      '--rd-ai-line:color-mix(in srgb,var(--rd-brand) 38%,var(--rd-line));',
      '--rd-sans:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif);',
      '--rd-serif:"Songti SC","STSong","Noto Serif CJK SC",Georgia,serif;',
      '--rd-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;',
      'min-height:100%;width:100%;max-width:100%;background:var(--rd-bg);color:var(--rd-ink);color-scheme:light dark;',
      'font:13.5px/1.55 var(--rd-sans);-webkit-font-smoothing:antialiased;container-type:inline-size;container-name:reeldesk}',
      '.rd,.rd *{box-sizing:border-box}',
      ':where(.rd) :is(h1,h2,h3,h4,p,pre){margin:0}',
      ':where(.rd) :is(button,input,textarea,select){font:inherit;color:inherit}',
      ':where(.rd) button{cursor:pointer;background:none;border:0;padding:0}',
      '.rd :focus-visible{outline:2px solid var(--rd-brand);outline-offset:2px;border-radius:8px}',
      '@media (prefers-reduced-motion:reduce){.rd *{transition:none!important;animation:none!important}}',
      '.rd-wrap{position:relative;max-width:1320px;width:100%;margin:0 auto;padding:18px 28px 140px;display:flex;flex-direction:column;gap:16px;min-width:0}',

      '.rd-top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}',
      '.rd-id{display:flex;align-items:center;gap:9px;color:var(--rd-ink2);font-size:13px;min-width:0}',
      '.rd-mark{display:inline-flex;gap:2.5px;align-items:center;flex:none}',
      '.rd-mark i{display:block;width:7px;height:10px;border-radius:2px;border:1px solid var(--rd-ink3)}',
      '.rd-mark i:nth-child(2){width:9px;height:13px;background:var(--rd-ink);border-color:var(--rd-ink)}',
      '.rd-acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
      '.rd-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border-radius:17px;font-size:13px;white-space:nowrap}',
      '.rd-btn:hover:not(:disabled){background:var(--rd-hover)}',
      '.rd-btn:disabled{opacity:.42;cursor:default}',
      '.rd-btn.line{border:1px solid var(--rd-line2);background:var(--rd-card)}',
      '.rd-btn.quiet{color:var(--rd-ink2)}',
      '.rd-btn.pri{background:var(--rd-ink);color:var(--rd-bg);font-weight:600;padding:0 18px}',
      '.rd-btn.pri:hover:not(:disabled){opacity:.88;background:var(--rd-ink)}',
      '.rd-btn.sm{height:28px;padding:0 11px;font-size:12.5px;border-radius:14px}',
      '.rd-btn svg{flex:none}',
      '.rd-link{color:var(--rd-ink2);font-size:12.5px;text-decoration:underline;text-decoration-color:var(--rd-line2);text-underline-offset:3px}',
      '.rd-link:hover{color:var(--rd-ink)}',
      '.rd-link.err{color:var(--rd-err)}',

      '.rd-title{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;min-width:0}',
      '.rd-title .name{display:inline-flex;align-items:baseline;gap:8px;font:600 25px/1.3 var(--rd-serif);letter-spacing:-.01em;text-align:left;max-width:100%;word-break:break-word}',
      '.rd-title .name svg{align-self:center;color:var(--rd-ink3);flex:none}',
      '.rd-meta{color:var(--rd-ink2);font-size:13px}',
      '.rd-meta b{font-weight:500;color:var(--rd-ink)}',
      '.rd-meta button{color:inherit;font-size:13px;border-bottom:1px dashed var(--rd-line2)}',
      '.rd-meta button:hover{color:var(--rd-ink)}',
      '.rd-saved{display:inline-flex;align-items:center;gap:6px;color:var(--rd-ink3);font-size:12.5px}',
      '.rd-saved::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--rd-ok)}',
      '.rd-saved.busy::before{background:var(--rd-warn)}',

      '.rd-note-bar{display:none;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:9px 12px 9px 14px;border-radius:12px;background:var(--rd-ai);border:1px solid var(--rd-ai-line)}',
      '.rd-note-bar.show{display:flex}',
      '.rd-note-bar.sys{background:var(--rd-sub);border-color:var(--rd-line2)}',
      '.rd-note-bar p{flex:1;min-width:220px}',
      '.rd-note-bar p b{font-weight:600}',
      '.rd-ds{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:var(--rd-brand);color:#fff;font:700 10px/1 var(--rd-sans);flex:none}',

      '.rd-band{display:none;align-items:center;gap:10px 14px;padding:10px 14px;border-radius:14px;border:1px solid var(--rd-line2);background:var(--rd-card);flex-wrap:wrap;min-width:0}',
      '.rd-band.show{display:flex}',
      '.rd-band .t{flex:1;min-width:210px}',
      '.rd-band .t b{display:block;font-weight:600}',
      '.rd-band .t span{color:var(--rd-ink2);font-size:12.5px;display:block;margin-top:2px}',
      '.rd-band .bar{flex-basis:100%;height:4px;border-radius:2px;background:var(--rd-line);overflow:hidden}',
      '.rd-band .bar i{display:block;height:100%;background:var(--rd-brand);transition:width .18s ease}',
      '.rd-band .bar.indet i{width:38%;animation:rdpulse 1.3s ease-in-out infinite}',
      '@keyframes rdpulse{0%{transform:translateX(-80%)}100%{transform:translateX(280%)}}',
      '.rd-band .thumb{width:96px;height:54px;border-radius:8px;overflow:hidden;position:relative;background:var(--rd-well);flex:none}',
      '.rd-band .thumb>div{position:absolute;transform-origin:top left;pointer-events:none}',
      '.rd-band.err{border-color:color-mix(in srgb,var(--rd-err) 45%,var(--rd-line))}',
      '.rd-band.err .t b{color:var(--rd-err)}',
      '.rd-band.stale{border-color:color-mix(in srgb,var(--rd-warn) 50%,var(--rd-line))}',
      '.rd-steps{flex-basis:100%;display:flex;gap:6px 16px;flex-wrap:wrap;font-size:12.5px;color:var(--rd-ink3)}',
      '.rd-steps span{display:inline-flex;align-items:center;gap:6px}',
      '.rd-steps span::before{content:"";width:7px;height:7px;border-radius:50%;border:1.5px solid var(--rd-line2)}',
      '.rd-steps .ok{color:var(--rd-ink2)}.rd-steps .ok::before{background:var(--rd-ok);border-color:var(--rd-ok)}',
      '.rd-steps .now{color:var(--rd-ink);font-weight:600}.rd-steps .now::before{border-color:var(--rd-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--rd-brand) 22%,transparent)}',
      '.rd-log{flex-basis:100%;max-height:150px;overflow:auto;padding:10px 12px;border-radius:10px;background:var(--rd-sub);font:11.5px/1.5 var(--rd-mono);color:var(--rd-ink2);white-space:pre-wrap;word-break:break-all}',

      '.rd-main{display:grid;grid-template-columns:minmax(0,1fr) 348px;gap:28px;align-items:start;min-width:0}',
      '.rd-screen{display:flex;flex-direction:column;gap:12px;min-width:0;max-width:100%}',
      '.rd-well{background:var(--rd-well);border:1px solid var(--rd-line);border-radius:18px;padding:22px 22px 0;display:flex;flex-direction:column;align-items:center;min-width:0;max-width:100%}',
      '.rd-stage{position:relative;overflow:hidden;border-radius:6px;box-shadow:0 18px 50px rgba(0,0,0,.45)}',
      '.rd-stage>.fr{transform-origin:top left;pointer-events:none}',
      '.rd-stage .tag{position:absolute;left:10px;top:10px;padding:3px 9px;border-radius:10px;background:rgba(12,12,13,.78);color:#fff;font-size:12px;z-index:5;pointer-events:none}',
      '.rd-stage video,.rd-stage img.file-prev{width:100%;height:100%;object-fit:contain;background:#000;display:block}',
      '.rd-ov{position:absolute;inset:0;z-index:4;display:none;touch-action:none}',
      '.rd-ov.on{display:block}',
      '.rd-ov.pan{cursor:grab}.rd-ov.focus{cursor:crosshair}.rd-ov.cursor{cursor:crosshair}',
      '.rd-drop{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;border:1.5px dashed rgba(20,20,19,.38);border-radius:10px;background:rgba(250,249,245,.92);color:#141413;padding:12px}',
      '.rd-drop b{font:600 17px/1.4 var(--rd-serif)}',
      '.rd-drop span{font-size:12.5px;color:#575650}',
      '.rd-drop .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}',
      '.rd-drop button{height:28px;padding:0 12px;border-radius:14px;border:1px solid rgba(20,20,19,.25);font-size:12.5px;color:#141413;background:#fff}',
      '.rd-transport{align-self:stretch;display:flex;align-items:center;gap:12px;min-height:52px;color:var(--rd-well-ink);flex-wrap:wrap;min-width:0}',
      '.rd-play{width:32px;height:32px;border-radius:50%;background:var(--rd-well-ink);color:var(--rd-well);display:grid;place-items:center;flex:none}',
      '.rd-time{font:12.5px var(--rd-mono);letter-spacing:.02em;white-space:nowrap}',
      '.rd-time em{font-style:normal;color:var(--rd-well-ink2)}',
      '.rd-keys{margin-left:auto;font-size:12px;color:var(--rd-well-ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.rd-keys.hint{color:var(--rd-well-ink)}',
      '.rd-wseg{margin-left:auto;display:inline-flex;padding:2px;border-radius:10px;background:rgba(233,232,227,.1)}',
      '.rd-wseg[hidden]{display:none}',
      '.rd-wseg button{height:26px;padding:0 11px;border-radius:8px;font-size:12px;color:var(--rd-well-ink2)}',
      '.rd-wseg button.on{background:var(--rd-well-ink);color:var(--rd-well);font-weight:600}',

      '.rd-film{overflow-x:auto;padding-bottom:2px;scrollbar-width:thin;max-width:100%}',
      '.rd-track{position:relative;display:flex;min-width:100%;padding-top:8px;user-select:none}',
      '.rd-cell{position:relative;min-width:104px;border-radius:10px;background:var(--rd-card);overflow:hidden;text-align:left;display:flex;flex-direction:column}',
      '.rd-cell .pic{position:relative;height:74px;overflow:hidden;background:var(--rd-sub);cursor:ew-resize;width:100%}',
      '.rd-cell .pic>div{position:absolute;transform-origin:top left;pointer-events:none}',
      '.rd-cell .cap{display:flex;align-items:baseline;gap:6px;padding:6px 9px 7px;font-size:12px;color:var(--rd-ink2);border-top:1px solid var(--rd-line);cursor:grab;min-width:0}',
      '.rd-cell .cap i{font:11px var(--rd-mono);font-style:normal;color:var(--rd-ink3);flex:none}',
      '.rd-cell .cap b{font-weight:500;color:var(--rd-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}',
      '.rd-cell .cap span{font:11px var(--rd-mono);color:var(--rd-ink3);flex:none}',
      '.rd-cell .cap input{flex:1;min-width:0;height:20px;margin:-3px 0;padding:0 5px;border-radius:5px;border:1px solid var(--rd-ink);background:var(--rd-bg);font:500 12px var(--rd-sans);color:var(--rd-ink);outline:none;cursor:text}',
      '.rd-cell.ren .cap{cursor:default}',
      '.rd-ih h2 button{font:inherit;color:inherit;text-align:left;border-bottom:1px dashed var(--rd-line2);cursor:text}',
      '.rd-ih h2 button:hover{border-bottom-color:var(--rd-ink)}',
      '.rd-ih h2 input{font:inherit;color:inherit;width:8.5em;padding:0 6px;border-radius:7px;border:1px solid var(--rd-ink);background:var(--rd-bg);outline:none}',
      '.rd-cell::after{content:"";position:absolute;inset:0;border-radius:10px;box-shadow:inset 0 0 0 1px var(--rd-line2);pointer-events:none;z-index:2}',
      '.rd-cell.on::after{box-shadow:inset 0 0 0 2px var(--rd-ink)}',
      '.rd-cell.on .cap b{font-weight:600}',
      '.rd-cell.lift{opacity:.45}',
      '.rd-cell .edge{position:absolute;top:0;right:0;bottom:0;width:9px;cursor:col-resize;z-index:3}',
      '.rd-cell .edge::after{content:"";position:absolute;top:26px;right:3px;width:3px;height:22px;border-radius:2px;background:var(--rd-ink);opacity:0}',
      '.rd-cell:hover .edge::after,.rd-cell .edge.act::after{opacity:.55}',
      '.rd-cell .mk{position:absolute;left:6px;top:6px;z-index:2;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:600;background:var(--rd-brand);color:#fff;pointer-events:none}',
      '.rd-cell .mk.w{background:var(--rd-warn)}',
      '.rd-gap{flex:0 0 12px;position:relative;cursor:pointer}',
      '.rd-gap i{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-14px 0 0 -10px;border-radius:50%;background:var(--rd-ink);color:var(--rd-bg);display:grid;place-items:center;font:600 14px/1 var(--rd-sans);font-style:normal;opacity:0;transform:scale(.7);transition:.12s;z-index:3}',
      '.rd-gap:hover i,.rd-gap.hot i{opacity:1;transform:none}',
      '.rd-gap.drop::before{content:"";position:absolute;left:5px;top:0;bottom:0;width:2px;border-radius:1px;background:var(--rd-brand)}',
      '.rd-add{flex:0 0 46px;min-width:46px;margin-left:6px;border-radius:10px;border:1px dashed var(--rd-line2);color:var(--rd-ink3);display:grid;place-items:center;cursor:pointer}',
      '.rd-add:hover{border-color:var(--rd-ink);color:var(--rd-ink)}',
      '.rd-head{position:absolute;top:0;bottom:33px;width:2px;margin-left:-1px;background:var(--rd-brand);border-radius:1px;pointer-events:none;z-index:2}',
      '.rd-head::before{content:"";position:absolute;top:0;left:-4px;width:10px;height:8px;border-radius:2px 2px 5px 5px;background:var(--rd-brand)}',

      '.rd-insp{display:flex;flex-direction:column;gap:15px;min-width:0}',
      '.rd-tabs{display:flex;gap:18px;border-bottom:1px solid var(--rd-line)}',
      '.rd-tabs button{padding:6px 0 9px;color:var(--rd-ink3);font-size:13px;border-bottom:2px solid transparent;margin-bottom:-1px}',
      '.rd-tabs button.on{color:var(--rd-ink);font-weight:600;border-color:var(--rd-ink)}',
      '.rd-ih{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}',
      '.rd-ih h2{font:600 20px/1.35 var(--rd-serif);word-break:break-word}',
      '.rd-kind{color:var(--rd-ink2);font-size:12.5px;margin-top:2px;text-align:left}',
      '.rd-kind:hover{color:var(--rd-ink)}',
      '.rd-icons{display:flex;gap:2px;flex:none}',
      '.rd-icons button{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--rd-ink2)}',
      '.rd-icons button:hover:not(:disabled){background:var(--rd-hover);color:var(--rd-ink)}',
      '.rd-icons button:disabled{opacity:.3;cursor:default}',
      '.rd-f{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.rd-f>label{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--rd-ink2)}',
      '.rd-f>label span{color:var(--rd-ink3)}',
      '.rd-in,.rd-ta,.rd-sel{width:100%;padding:8px 11px;border-radius:10px;border:1px solid var(--rd-line2);background:var(--rd-card);font-size:13.5px;min-width:0}',
      '.rd-ta{min-height:64px;resize:vertical;line-height:1.5;display:block}',
      '.rd-ta.big{font:600 16px/1.5 var(--rd-serif);min-height:72px}',
      '.rd-ta.code{font:12.5px/1.55 var(--rd-mono);min-height:96px}',
      '.rd-in:focus,.rd-ta:focus,.rd-sel:focus{outline:none;border-color:var(--rd-ink)}',
      '.rd-rows{display:flex;flex-direction:column;gap:6px}',
      '.rd-row{display:grid;grid-template-columns:18px minmax(0,.9fr) minmax(0,1.3fr) 24px;gap:6px;align-items:center}',
      '.rd-row.num{grid-template-columns:18px 86px 48px minmax(0,1fr) 24px}',
      '.rd-row>i{font:11px var(--rd-mono);font-style:normal;color:var(--rd-ink3);text-align:center}',
      '.rd-row>button{color:var(--rd-ink3);height:24px;border-radius:6px}',
      '.rd-block-card{display:flex;flex-direction:column;gap:6px;padding:8px 9px;border-radius:10px;border:1px solid var(--rd-line);background:var(--rd-sub)}',
      '.rd-block-card .hd{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--rd-ink2)}',
      '.rd-more{align-self:flex-start;color:var(--rd-ink2);font-size:12.5px;padding:2px 0}',
      '.rd-dur{display:flex;align-items:center;gap:10px}',
      '.rd-dur input{flex:1;accent-color:var(--rd-ink);min-width:0}',
      '.rd-dur b{font:500 12.5px var(--rd-mono);min-width:44px;text-align:right}',
      '.rd-seg{display:inline-flex;padding:3px;border-radius:12px;background:var(--rd-sub);border:1px solid var(--rd-line);gap:2px;flex-wrap:wrap}',
      '.rd-seg button{height:28px;padding:0 12px;border-radius:9px;font-size:12.5px;color:var(--rd-ink2);display:inline-flex;align-items:center;gap:6px}',
      '.rd-seg button.on{background:var(--rd-card);color:var(--rd-ink);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}',
      '.rd-sw{width:14px;height:14px;border-radius:50%;border:1px solid var(--rd-line2);position:relative;overflow:hidden;flex:none}',
      '.rd-sw::after{content:"";position:absolute;inset:0 0 0 50%;background:var(--c2)}',
      '.rd-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}',
      '.rd-toggle button{width:36px;height:20px;border-radius:10px;background:var(--rd-line2);position:relative;flex:none}',
      '.rd-toggle button.on{background:var(--rd-ink)}',
      '.rd-toggle button::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--rd-card);transition:transform .16s ease}',
      '.rd-toggle button.on::after{transform:translateX(16px)}',
      '.rd-note{font-size:12px;color:var(--rd-ink3)}',
      '.rd-note.warn{color:var(--rd-warn)}',

      '.rd-diff{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:12px;background:var(--rd-ai);border:1px solid var(--rd-ai-line)}',
      '.rd-diff p{font-size:12.5px;color:var(--rd-ink2)}',
      '.rd-diff p b{color:var(--rd-ink);font-weight:600}',
      '.rd-diff .r{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.rd-diff .rd-seg{background:var(--rd-card)}',
      '.rd-diff .rd-seg button.on{background:var(--rd-ink);color:var(--rd-bg)}',
      '.rd-clash{display:flex;flex-direction:column;gap:9px;padding:11px 12px;border-radius:12px;background:color-mix(in srgb,var(--rd-warn) 9%,var(--rd-card));border:1px solid color-mix(in srgb,var(--rd-warn) 45%,var(--rd-line))}',
      '.rd-clash p{font-size:12.5px;color:var(--rd-ink2)}',
      '.rd-clash p b{display:block;color:var(--rd-ink);font-weight:600;font-size:13.5px;margin-bottom:2px}',
      '.rd-clash .rd-alt span em{font-style:normal;font-weight:600;color:var(--rd-ink)}',

      '.rd-assets{display:flex;gap:8px;flex-wrap:wrap}',
      '.rd-asset{width:86px;height:56px;border-radius:8px;overflow:hidden;border:1px solid var(--rd-line2);background:var(--rd-sub) center top/cover no-repeat;position:relative}',
      '.rd-asset.on{box-shadow:0 0 0 2px var(--rd-ink)}',
      '.rd-asset.add{display:grid;place-items:center;border-style:dashed;color:var(--rd-ink2);font-size:11.5px;line-height:1.35;text-align:center;padding:4px}',
      '.rd-frame{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}',
      '.rd-mini{position:relative;flex:none;border-radius:8px;overflow:hidden;background:var(--rd-sub) center/100% 100% no-repeat;cursor:grab;touch-action:none;border:1px solid var(--rd-line2)}',
      '.rd-mini .vis{position:absolute;border:2px solid #fff;border-radius:4px;box-shadow:0 0 0 999px rgba(12,12,13,.55),0 0 0 1px rgba(12,12,13,.6) inset;pointer-events:none}',
      '.rd-mini .fx{position:absolute;border:1.5px solid var(--rd-brand);border-radius:2px;pointer-events:none}',
      '.rd-mini .cu{position:absolute;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:var(--rd-brand);box-shadow:0 0 0 1.5px #fff;pointer-events:none}',
      '.rd-fside{flex:1;min-width:150px;display:flex;flex-direction:column;gap:8px}',
      '.rd-tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.rd-tool{height:30px;padding:0 12px;border-radius:15px;border:1px solid var(--rd-line2);font-size:12.5px;color:var(--rd-ink2);display:inline-flex;align-items:center;gap:6px}',
      '.rd-tool.on{background:var(--rd-ink);border-color:var(--rd-ink);color:var(--rd-bg);font-weight:600}',
      '.rd-tool em{font-style:normal;width:6px;height:6px;border-radius:50%;background:var(--rd-ok)}',

      '.rd-ask{display:flex;flex-direction:column;gap:9px;padding-top:14px;border-top:1px solid var(--rd-line)}',
      '.rd-ask h3{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:7px}',
      '.rd-askbox{border:1px solid var(--rd-line2);border-radius:12px;background:var(--rd-card);padding:8px 8px 8px 11px;display:flex;gap:8px;align-items:flex-end}',
      '.rd-askbox textarea{flex:1;border:0;background:none;resize:none;outline:none;min-height:38px;line-height:1.5;font-size:13.5px;padding:2px 0;min-width:0}',
      '.rd-quick{display:flex;gap:6px;flex-wrap:wrap}',
      '.rd-quick button{height:26px;padding:0 10px;border-radius:13px;background:var(--rd-sub);font-size:12px;color:var(--rd-ink2)}',
      '.rd-quick button:hover{color:var(--rd-ink)}',
      '.rd-alts{display:flex;flex-direction:column;gap:8px}',
      '.rd-alt{display:grid;grid-template-columns:128px minmax(0,1fr);gap:10px;align-items:center;padding:6px;border-radius:12px;border:1px solid var(--rd-line2);background:var(--rd-card);text-align:left;width:100%}',
      '.rd-alt:hover{border-color:var(--rd-ink)}',
      '.rd-alt.on{border-color:var(--rd-ink);box-shadow:0 0 0 1px var(--rd-ink)}',
      '.rd-alt .pic{position:relative;height:72px;border-radius:7px;overflow:hidden;background:var(--rd-sub)}',
      '.rd-alt .pic>div{position:absolute;transform-origin:top left;pointer-events:none}',
      '.rd-alt b{display:block;font:600 14px/1.45 var(--rd-serif);word-break:break-word}',
      '.rd-alt span{display:block;font-size:12px;color:var(--rd-ink3);margin-top:2px}',
      '.rd-alt.sk .pic,.rd-alt.sk b,.rd-alt.sk span{background:linear-gradient(90deg,var(--rd-sub),var(--rd-line),var(--rd-sub));background-size:200% 100%;animation:rdsk 1.2s linear infinite;color:transparent;border-radius:6px}',
      '.rd-alt.sk b{height:16px;width:86%}.rd-alt.sk span{height:11px;width:52%;margin-top:8px}',
      '@keyframes rdsk{to{background-position:-200% 0}}',

      '.rd-pop{position:absolute;z-index:30;display:none;width:392px;max-width:calc(100% - 24px);background:var(--rd-card);border:1px solid var(--rd-line2);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.18);padding:14px;flex-direction:column;gap:12px;max-height:min(540px,80vh);overflow:auto}',
      '.rd-pop.show{display:flex}',
      '.rd-pop.wide{width:620px}',
      '.rd-pop h3{font:600 16px/1.4 var(--rd-serif)}',
      '.rd-pop h4{font-size:12px;font-weight:500;color:var(--rd-ink3);margin:0}',
      '.rd-pop .sub{font-size:12.5px;color:var(--rd-ink2);margin-top:2px}',
      '.rd-lib{display:flex;flex-direction:column;gap:4px}',
      '.rd-li{display:grid;grid-template-columns:76px minmax(0,1fr) auto;gap:10px;align-items:center;padding:6px;border-radius:10px;text-align:left;width:100%}',
      '.rd-li:hover{background:var(--rd-hover)}',
      '.rd-li.on{background:var(--rd-sub)}',
      '.rd-li .pic{position:relative;height:43px;border-radius:6px;overflow:hidden;background:var(--rd-well);cursor:pointer}',
      '.rd-li .pic>div{position:absolute;transform-origin:top left;pointer-events:none}',
      '.rd-li .mid{min-width:0;cursor:pointer}',
      '.rd-li b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.rd-li span{display:block;font-size:12px;color:var(--rd-ink3)}',
      '.rd-li .ops{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--rd-ink2);white-space:nowrap;flex-shrink:0}',
      '.rd-vers{display:flex;flex-direction:column}',
      '.rd-ver{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:8px 4px;border-top:1px solid var(--rd-line);font-size:12.5px}',
      '.rd-ver:first-child{border-top:0}',
      '.rd-ver i{font:11.5px var(--rd-mono);font-style:normal;color:var(--rd-ink3);white-space:nowrap}',
      '.rd-ver b{font-weight:500}',
      '.rd-ver span{color:var(--rd-ink3)}',
      '.rd-ver .who{display:inline-flex;align-items:center;gap:5px;margin-right:6px;color:var(--rd-ink2)}',
      '.rd-kinds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
      '.rd-kcard{border:1px solid var(--rd-line2);border-radius:10px;overflow:hidden;text-align:left;background:var(--rd-card);display:flex;flex-direction:column}',
      '.rd-kcard:hover{border-color:var(--rd-ink)}',
      '.rd-kcard.cur{box-shadow:0 0 0 2px var(--rd-ink)}',
      '.rd-kcard .pic{position:relative;height:78px;overflow:hidden;background:var(--rd-sub);width:100%}',
      '.rd-kcard .pic>div{position:absolute;transform-origin:top left;pointer-events:none}',
      '.rd-kcard p{padding:6px 8px 8px;font-size:12.5px;font-weight:600;line-height:1.35}',
      '.rd-kcard p span{display:block;font-weight:400;font-size:11.5px;color:var(--rd-ink3)}',
      '.rd-opt{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:10px;border:1px solid var(--rd-line2);text-align:left;width:100%}',
      '.rd-opt.on{border-color:var(--rd-ink);box-shadow:0 0 0 1px var(--rd-ink)}',
      '.rd-opt::before{content:"";width:14px;height:14px;border-radius:50%;border:1.5px solid var(--rd-line2);margin-top:3px;flex:none}',
      '.rd-opt.on::before{border:4.5px solid var(--rd-ink)}',
      '.rd-opt b{display:block;font-weight:600}',
      '.rd-opt span{display:block;font-size:12px;color:var(--rd-ink2)}',
      '.rd-kv{display:grid;grid-template-columns:44px minmax(0,1fr);gap:6px 10px;font-size:12.5px;align-items:baseline;margin:0}',
      '.rd-kv dt{color:var(--rd-ink3)}.rd-kv dd{margin:0;word-break:break-all}',
      '.rd-first{padding:9px 11px;border-radius:10px;background:var(--rd-sub);font-size:12.5px;color:var(--rd-ink2)}',

      '.rd-new{display:none;flex-direction:column;gap:22px;max-width:820px;margin:28px auto 0;width:100%}',
      '.rd-new h1{font:400 34px/1.55 var(--rd-serif);letter-spacing:.01em;text-wrap:balance}',
      '.rd-new h1 .rd-mark{transform:translateY(-3px) scale(1.5);margin:0 12px}',
      '.rd-brief{border:1px solid var(--rd-line2);border-radius:18px;background:var(--rd-card);padding:14px 14px 12px;display:flex;flex-direction:column;gap:12px}',
      '.rd-brief textarea{border:0;background:none;resize:none;min-height:66px;font-size:15px;line-height:1.6;outline:none;width:100%}',
      '.rd-brief .opts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.rd-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;border:1px solid var(--rd-line2);font-size:12.5px;color:var(--rd-ink2)}',
      '.rd-chip.on{background:var(--rd-ink);border-color:var(--rd-ink);color:var(--rd-bg)}',
      '.rd-chip.ws{background:var(--rd-card);color:var(--rd-ink)}',
      '.rd-chip.ws:hover{background:var(--rd-hover);border-color:var(--rd-ink3)}',
      '.rd-chip.ws[aria-expanded="true"]{border-color:var(--rd-ink)}',
      '.rd-brief .go{margin-left:auto}',
      '.rd-wait{display:none;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:11px 14px;border-radius:14px;background:var(--rd-ai);border:1px solid var(--rd-ai-line)}',
      '.rd-wait.show{display:flex}',
      '.rd-wait p{flex:1;min-width:220px}',
      '.rd-wait p span{display:block;color:var(--rd-ink2);font-size:12.5px}',
      '.rd-samples h3{font-size:12.5px;font-weight:500;color:var(--rd-ink2);margin-bottom:10px}',
      '.rd-sgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
      '.rd-sample{border:1px solid var(--rd-line2);border-radius:12px;overflow:hidden;background:var(--rd-card);text-align:left;cursor:pointer}',
      '.rd-sample .pic{position:relative;height:124px;overflow:hidden;background:var(--rd-well);width:100%}',
      '.rd-sample .pic>div{position:absolute;transform-origin:top left;pointer-events:none}',
      '.rd-sample p{padding:9px 11px 10px;font-size:12.5px;line-height:1.45}',
      '.rd-sample p span{display:block;color:var(--rd-ink3);font-size:11.5px}',
      '.rd[data-page="new"] :is(.rd-main,.rd-title,.rd-note-bar,.rd-band){display:none}',
      '.rd[data-page="new"] .rd-new{display:flex}',
      '.rd[data-page="new"] :is(#undo,#btnExport,#btnNew svg){display:none}',
      '.rd[data-first="1"] #btnNew{display:none}',

      '.rd[data-aspect="9:16"] .rd-main{grid-template-columns:max-content minmax(0,1fr);grid-template-areas:"well film" "well insp";grid-template-rows:auto 1fr;gap:16px 28px}',
      '.rd[data-aspect="9:16"] .rd-screen{display:contents}',
      '.rd[data-aspect="9:16"] .rd-well{grid-area:well;position:sticky;top:8px}',
      '.rd[data-aspect="9:16"] .rd-film{grid-area:film;min-width:0}',
      '.rd[data-aspect="9:16"] .rd-main>.rd-insp{grid-area:insp;max-width:560px}',
      '.rd[data-aspect="9:16"] .rd-cell .pic{height:112px}',

      '@container reeldesk (max-width: 900px){',
      '.rd-wrap{padding:14px 16px 160px}',
      '.rd-main{grid-template-columns:minmax(0,1fr)!important;gap:18px}',
      '.rd-screen{display:contents}',
      '.rd-well{position:sticky;top:8px;z-index:5;padding:12px 12px 0;border-radius:14px;box-shadow:0 -14px 0 8px var(--rd-bg),0 0 0 8px var(--rd-bg)}',
      '.rd-transport{min-height:44px}',
      '.rd-cell{min-width:132px}',
      '.rd-keys:not(.hint){display:none}',
      '.rd-cell .pic{height:48px}',
      '.rd-gap i{opacity:.55;transform:scale(.8)}',
      '.rd-title .name{font-size:21px}',
      '.rd-sgrid{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.rd-new h1{font-size:27px}',
      '.rd-kinds{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.rd-pop{left:12px!important;right:12px;width:auto!important;max-width:none}',
      '.rd[data-aspect="9:16"] .rd-main{grid-template-columns:max-content minmax(0,1fr)!important;column-gap:16px}',
      '.rd[data-aspect="9:16"] .rd-cell .pic{height:84px}}',

      '@container reeldesk (max-width: 640px){',
      '.rd[data-aspect="9:16"] .rd-main{grid-template-columns:minmax(0,1fr)!important;grid-template-areas:"well" "film" "insp"}}',

      '@container reeldesk (max-width: 560px){',
      '.rd-id span.n,.rd-top .rd-btn .lbl{display:none}',
      '.rd-top .rd-btn{padding:0 10px}.rd-top .rd-btn.pri{padding:0 14px}',
      '.rd-new h1{font-size:23px}',
      '.rd-sgrid{grid-template-columns:minmax(0,1fr)}',
      '.rd-alt{grid-template-columns:104px minmax(0,1fr)}',
      '.rd-row.num{grid-template-columns:16px 68px 42px minmax(0,1fr) 22px}}',

      /* Conversation cards (.rd-tcard) & compact toolview receipt */
      '.rd-tcard{--rd-ink:var(--dsw-alias-label-primary,#141413);--rd-ink2:var(--dsw-alias-label-secondary,#575650);--rd-ink3:var(--dsw-alias-label-tertiary,#8a8880);--rd-bg:var(--dsw-alias-bg-base,#faf9f5);--rd-card:var(--dsw-alias-bg-layer-2,#fff);--rd-sub:var(--dsw-alias-bg-layer-1,#f3f1ea);--rd-line:var(--dsw-alias-border-l2,rgba(20,20,19,.1));--rd-line2:var(--dsw-alias-border-l4,rgba(20,20,19,.2));--rd-hover:var(--dsw-alias-interactive-bg-hover,rgba(20,20,19,.05));--rd-brand:var(--dsw-alias-link,#2563eb);--rd-serif:"Songti SC","STSong",Georgia,serif;--rd-mono:ui-monospace,Menlo,monospace;',
      'border:1px solid var(--rd-line2);border-radius:16px;background:var(--rd-card);padding:14px;display:flex;flex-direction:column;gap:11px;font-size:13.5px;line-height:1.55;color:var(--rd-ink);margin:8px 0}',
      '.rd-tcard *{box-sizing:border-box}',
      '.rd-tcard button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0}',
      '.rd-tcard .hd{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--rd-ink2)}',
      '.rd-tcard .rd-mark{display:inline-flex;gap:2.5px;align-items:center}',
      '.rd-tcard .rd-mark i{display:block;width:7px;height:10px;border-radius:2px;border:1px solid var(--rd-ink3)}',
      '.rd-tcard .rd-mark i:nth-child(2){width:9px;height:13px;background:var(--rd-ink);border-color:var(--rd-ink)}',
      '.rd-tcard h3{margin:0;font:600 19px/1.35 var(--rd-serif);word-break:break-word}',
      '.rd-tcard h3 span{font:400 12.5px/1 -apple-system,"PingFang SC",sans-serif;color:var(--rd-ink2);margin-left:8px}',
      '.rd-tstrip{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}',
      '.rd-tstrip figure{margin:0;flex:1 1 0;min-width:120px}',
      '.rd-tstrip .pic{position:relative;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:var(--rd-sub);border:1px solid var(--rd-line)}',
      '.rd-tstrip.tall .pic{aspect-ratio:9/16;max-height:180px}',
      '.rd-tstrip .pic>div{position:absolute;transform-origin:top left;pointer-events:none}',
      '.rd-tstrip figcaption{font-size:12px;color:var(--rd-ink2);margin-top:4px;display:flex;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.rd-tstrip figcaption i{font:11px var(--rd-mono);font-style:normal;color:var(--rd-ink3)}',
      '.rd-tpair{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);gap:8px;align-items:center}',
      '.rd-tpair .pic{position:relative;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:var(--rd-sub);border:1px solid var(--rd-line)}',
      '.rd-tpair.tall .pic{aspect-ratio:9/16;max-height:170px}',
      '.rd-tpair .pic>div{position:absolute;transform-origin:top left;pointer-events:none}',
      '.rd-tpair .ar{color:var(--rd-ink3);text-align:center}',
      '.rd-tpair p{grid-column:1/-1;margin:0;font-size:12.5px;color:var(--rd-ink2)}',
      '.rd-tpair p b{color:var(--rd-ink);font-weight:600}',
      '.rd-tact{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.rd-tact .rd-btn{display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:16px;font-size:13px}',
      '.rd-tact .rd-btn.pri{background:var(--rd-ink);color:var(--rd-bg);font-weight:600}',
      '.rd-tact .rd-btn.line{border:1px solid var(--rd-line2)}',
      '.rd-tact .say{height:30px;padding:0 12px;border-radius:15px;background:var(--rd-sub);font-size:12.5px;color:var(--rd-ink2)}',
      '.rd-tact .say:hover{color:var(--rd-ink)}',
      '.rd-tool-receipt{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dsw-alias-label-secondary,#575650);padding:2px 0}',
      '.rd-toast{position:fixed;right:20px;bottom:20px;padding:10px 16px;border-radius:999px;background:var(--rd-ink,#141413);color:var(--rd-bg,#faf9f5);font-size:12.5px;box-shadow:0 12px 30px rgba(0,0,0,.22);z-index:95;max-width:calc(100vw - 40px)}',
    ].join('')

    function injectStylesOnce() {
      if (typeof document === 'undefined') return
      var existing = document.getElementById('dsh-reel-desk-styles')
      if (existing) {
        if (existing.textContent !== CSS) existing.textContent = CSS
        return
      }
      var style = document.createElement('style')
      style.id = 'dsh-reel-desk-styles'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    async function apiGet(params) {
      var qs = []
      if (params && params.project) qs.push('project=' + encodeURIComponent(params.project))
      if (params && params.sinceVersion !== undefined && params.sinceVersion !== null) {
        qs.push('sinceVersion=' + encodeURIComponent(String(params.sinceVersion)))
      }
      var url = qs.length ? (VIEW_URL + '?' + qs.join('&')) : VIEW_URL
      var res = await fetch(url, { headers: { Accept: 'application/json' } })
      var data = await res.json().catch(function () { return {} })
      if (!res.ok) throw new Error(data.error || ('读取失败 HTTP ' + res.status))
      return data
    }

    async function apiPost(payload, opts) {
      var res = await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: opts && opts.signal ? opts.signal : undefined,
      })
      var data = await res.json().catch(function () { return {} })
      if (!res.ok) {
        var err = new Error(data.error || ('操作失败 HTTP ' + res.status))
        err.status = res.status
        err.code = data.code
        err.data = data
        throw err
      }
      return data
    }

    async function apiUploadAsset(projectId, file) {
      var url = ASSET_URL + '?id=' + encodeURIComponent(projectId) +
        (file && file.name ? '&name=' + encodeURIComponent(file.name) : '')
      var res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': (file && file.type) || 'application/octet-stream',
          Accept: 'application/json',
        },
        body: file,
      })
      var data = await res.json().catch(function () { return {} })
      if (!res.ok || data.ok === false) {
        var err = new Error(data.error || ('上传图片失败 HTTP ' + res.status))
        err.status = res.status
        err.code = data.code
        throw err
      }
      return data
    }

    function selectHostWorkspaceItems(state) {
      return state && Array.isArray(state.items) ? state.items : null
    }

    function getHostService(hostCtx, name, allowDirectOnGetCtx) {
      if (!hostCtx) return null
      if (typeof hostCtx.get === 'function') {
        try {
          var v = hostCtx.get(name, false)
          if (v) return v
        } catch (_err) {}
        if (!allowDirectOnGetCtx) return null
      }
      try {
        return hostCtx[name] || null
      } catch (_err2) {
        return null
      }
    }

    function canUseWorkspacePicker(hostCtx, props) {
      if (!props || typeof props.renderFactorySlot !== 'function') return false
      var slots = getHostService(hostCtx, 'slots', true)
      if (!slots) return false
      if (typeof slots.snapshot === 'function') {
        var snap = slots.snapshot('factory:workspace.picker')
        return Array.isArray(snap) && snap.length > 0
      }
      if (typeof slots.spec === 'function') {
        return Boolean(slots.spec('workspace.picker.directoryFlow'))
      }
      if (typeof slots.factory === 'function') {
        return Boolean(slots.factory('workspace.picker'))
      }
      return false
    }

    function listHostWorkspaces(hostCtx, serverWorkspaces, hookItems) {
      try {
        var workspaces = getHostService(hostCtx, 'workspaces', false)
        var uiWorkspace = getHostService(hostCtx, 'uiWorkspace', false)
        var wsSnap = workspaces && workspaces.list && workspaces.list.getSnapshot && workspaces.list.getSnapshot()
        var liveItems = (wsSnap && Array.isArray(wsSnap.items)) ? wsSnap.items : []
        var rawItems = liveItems.length
          ? liveItems
          : (Array.isArray(hookItems) && hookItems.length ? hookItems : (Array.isArray(serverWorkspaces) ? serverWorkspaces : []))
        var seen = {}
        var merged = []
        rawItems.concat(Array.isArray(hookItems) ? hookItems : []).forEach(function (it) {
          if (!it) return
          var p = it.path || it.rootPath || it.cwd || ''
          var id = it.workspaceId || it.id || p
          if (!id || seen[id]) return
          seen[id] = true
          var name = it.title || it.name || (p ? p.split('/').filter(Boolean).pop() : '') || '默认工作区'
          merged.push({
            workspaceId: id,
            name: name,
            path: p,
          })
        })
        var activeId = null
        try {
          var uiSnap = uiWorkspace && uiWorkspace.state && uiWorkspace.state.getSnapshot && uiWorkspace.state.getSnapshot()
          activeId = (uiSnap && (uiSnap.workspaceId || uiSnap.activeWorkspaceId)) ||
            (uiWorkspace && (uiWorkspace.workspaceId || uiWorkspace.activeWorkspaceId)) ||
            null
        } catch (_e) {
          activeId = null
        }
        return {
          items: merged,
          activeWorkspaceId: activeId,
        }
      } catch (_err) {
        return { items: [], activeWorkspaceId: null }
      }
    }

    function extractCreatedSessionId(created) {
      if (!created) return null
      if (typeof created === 'string') return created
      if (created.value && typeof created.value.sessionId === 'string') return created.value.sessionId
      if (typeof created.sessionId === 'string') return created.sessionId
      if (typeof created.id === 'string') return created.id
      return null
    }

    function getConversationService(hostCtx, binding) {
      var direct = getHostService(hostCtx, 'conversation', false)
      if (direct && direct.input) return direct
      return binding && binding.ctx && binding.ctx.get && binding.ctx.get('conversation', false)
    }

    async function createSessionAndPrefill(hostCtx, targetWorkspaceId, promptText, whenDraftExists) {
      var sessions = getHostService(hostCtx, 'sessions', false)
      var uiWorkspace = getHostService(hostCtx, 'uiWorkspace', false)
      var layout = getHostService(hostCtx, 'layout', false)
      if (!sessions || !uiWorkspace || !layout) return null

      var created = null
      if (typeof sessions.create === 'function') {
        created = await sessions.create(targetWorkspaceId ? { workspaceId: targetWorkspaceId } : {})
      } else if (typeof uiWorkspace.startSession === 'function') {
        created = await uiWorkspace.startSession(targetWorkspaceId ? { workspaceId: targetWorkspaceId } : {})
      } else if (targetWorkspaceId && typeof uiWorkspace.connectWorkspace === 'function') {
        created = await uiWorkspace.connectWorkspace(targetWorkspaceId)
      }
      var sid = extractCreatedSessionId(created)
      if (!sid || typeof sessions.retain !== 'function') return null

      var ref = sessions.retain(sid, { source: 'controllerOperation' })
      try {
        await ref.ready
        var conv = getConversationService(hostCtx, ref.binding)
        if (conv && conv.input && typeof conv.input.requestDraftInitialization === 'function') {
          conv.input.requestDraftInitialization(ref.binding, {
            prompt: promptText,
            whenDraftExists: whenDraftExists || 'replace',
          })
        }
        if (typeof uiWorkspace.openSession === 'function') {
          await uiWorkspace.openSession(sid)
        }
        layout.selectPanel(null)
        return sid
      } finally {
        if (ref && typeof ref.release === 'function') ref.release()
        else if (ref && typeof ref.dispose === 'function') ref.dispose()
      }
    }

    async function handoffNewFilmToHost(hostCtx, opts, onFeedback) {
      var wsInfo = listHostWorkspaces(hostCtx, opts.serverWorkspaces, opts.hookWorkspaces)
      var targetWs = wsInfo.items.find(function (w) { return w.workspaceId === opts.workspaceId }) ||
        wsInfo.items.find(function (w) { return w.workspaceId === wsInfo.activeWorkspaceId }) ||
        wsInfo.items[0] || null
      var wsId = opts.workspaceId || (targetWs && targetWs.workspaceId) || null

      try {
        var sid = await createSessionAndPrefill(hostCtx, wsId, opts.prompt, 'replace')
        if (sid) {
          await apiPost({
            action: 'note_handoff',
            sessionId: sid,
            workspaceId: wsId,
            brief: opts.brief,
            aspect: opts.aspect,
            targetDurationSec: Number(opts.targetDurationSec) || 15,
          }).catch(function () {})
          if (onFeedback) onFeedback('已打开原生对话并填好说明，按发送即可交给 DeepSeek')
          return sid
        }
      } catch (_err) {
        // Fallback below
      }

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(opts.prompt)
        }
      } catch (_e2) {}
      var layout = getHostService(hostCtx, 'layout', false)
      if (layout && typeof layout.selectPanel === 'function') {
        try { layout.selectPanel(null) } catch (_e3) {}
      }
      if (onFeedback) onFeedback('已复制排片说明并切回对话页，粘贴发送即可')
      return null
    }

    async function reopenOrHandoffFilmSession(hostCtx, opts, onFeedback) {
      var sessions = getHostService(hostCtx, 'sessions', false)
      var uiWorkspace = getHostService(hostCtx, 'uiWorkspace', false)
      var layout = getHostService(hostCtx, 'layout', false)
      var originSessionId = opts.sessionId || null

      if (originSessionId && sessions && uiWorkspace && layout) {
        var listSnap = sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot()
        var sessionStillExists = Boolean(listSnap && listSnap.byId && listSnap.byId[originSessionId])
        if (sessionStillExists && typeof sessions.retain === 'function') {
          var ref = sessions.retain(originSessionId, { source: 'controllerOperation' })
          try {
            await ref.ready
            var conv = getConversationService(hostCtx, ref.binding)
            if (conv && conv.input && typeof conv.input.requestDraftInitialization === 'function') {
              conv.input.requestDraftInitialization(ref.binding, {
                prompt: opts.prompt,
                whenDraftExists: 'append',
              })
            }
            if (typeof uiWorkspace.openSession === 'function') {
              await uiWorkspace.openSession(originSessionId)
            }
            layout.selectPanel(null)
            if (onFeedback) onFeedback('已回到排这条片的对话，看一眼按发送即可')
            return { reopened: true, sessionId: originSessionId }
          } catch (_err) {
            // Fall through to creating a new session
          } finally {
            if (ref && typeof ref.release === 'function') ref.release()
            else if (ref && typeof ref.dispose === 'function') ref.dispose()
          }
        }
      }

      var wsInfo = listHostWorkspaces(hostCtx, opts.serverWorkspaces)
      var targetWs = wsInfo.items.find(function (w) { return w.workspaceId === opts.workspaceId }) ||
        wsInfo.items.find(function (w) { return w.workspaceId === wsInfo.activeWorkspaceId }) ||
        wsInfo.items[0] || null
      var fallbackPrompt = '（接着上次排好的片子 id="' + opts.projectId + '"《' + opts.projectTitle + '》继续调整）\n' + opts.prompt
      var newSid = await createSessionAndPrefill(hostCtx, targetWs && targetWs.workspaceId, fallbackPrompt, 'append')
      if (newSid) {
        if (onFeedback) {
          onFeedback(originSessionId ? '原对话已不在，已新开一条对话并带上这条片的信息' : '已打开对话并填好重排要求')
        }
        return { reopened: false, sessionId: newSid }
      }
      if (onFeedback) onFeedback('未能打开对话，请手动切到对话页')
      return { reopened: false, sessionId: null }
    }

    async function openExistingSessionOnly(hostCtx, sessionId, onFeedback) {
      var sessions = getHostService(hostCtx, 'sessions', false)
      var uiWorkspace = getHostService(hostCtx, 'uiWorkspace', false)
      var layout = getHostService(hostCtx, 'layout', false)
      if (sessionId && sessions && uiWorkspace && layout) {
        var listSnap = sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot()
        if (listSnap && listSnap.byId && listSnap.byId[sessionId]) {
          await uiWorkspace.openSession(sessionId)
          layout.selectPanel(null)
          return true
        }
      }
      if (onFeedback) onFeedback('原对话已被删除或不存在')
      return false
    }

    async function openPanelToProject(hostCtx, projectId) {
      if (projectId) {
        await apiPost({ action: 'select_project', id: projectId }).catch(function () {})
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          window.dispatchEvent(new CustomEvent('reel-desk:select', { detail: { projectId: projectId } }))
        } catch (_e) {}
      }
      var layout = getHostService(hostCtx, 'layout', false)
      if (layout && typeof layout.selectPanel === 'function') {
        layout.selectPanel(PANEL_KEY)
      }
    }

    function formatTimecode(frame, fps) {
      var safeFps = fps || 60
      var cs = Math.round((Math.max(0, frame) / safeFps) * 100)
      var whole = Math.floor(cs / 100)
      var mins = Math.floor(whole / 60)
      var remSec = whole % 60
      var hundredths = cs % 100
      return String(mins).padStart(2, '0') + ':' +
        String(remSec).padStart(2, '0') + '.' +
        String(hundredths).padStart(2, '0')
    }

    function computeClientRanges(sb) {
      if (!sb || !Array.isArray(sb.scenes)) return { ranges: [], totalFrames: 1, totalSec: 0 }
      var fps = sb.fps || 60
      var cursor = 0
      var ranges = sb.scenes.map(function (sc, idx) {
        var dur = Number(sc.durationInFrames) || Math.max(1, Math.round((Number(sc.durationSec) || 3) * fps))
        var r = {
          index: idx,
          startFrame: cursor,
          endFrame: cursor + dur,
          durationInFrames: dur,
          durationSec: Number((dur / fps).toFixed(1)),
        }
        cursor += dur
        return r
      })
      return {
        ranges: ranges,
        totalFrames: Math.max(1, cursor),
        totalSec: Number((cursor / fps).toFixed(1)),
      }
    }

    function describeSceneDiff(beforeSc, afterSc, fps) {
      if (!beforeSc && afterSc) return '新增这一镜'
      if (beforeSc && !afterSc) return '已删除这一镜'
      if (!beforeSc || !afterSc) return '内容调整'
      var safeFps = fps || 60
      var out = []
      var checkKeys = ['headline', 'eyebrow', 'lines', 'blocks', 'codeLines', 'steps', 'ctaLabel', 'caption', 'asset', 'typedQuery', 'view', 'focus', 'cursor']
      for (var i = 0; i < checkKeys.length; i++) {
        var k = checkKeys[i]
        var label = FIELD_LABELS[k] || k
        if (JSON.stringify(beforeSc[k] || null) !== JSON.stringify(afterSc[k] || null)) {
          if (Array.isArray(beforeSc[k]) && Array.isArray(afterSc[k]) && beforeSc[k].length !== afterSc[k].length) {
            out.push(label + ' ' + beforeSc[k].length + ' → ' + afterSc[k].length + ' 条')
          } else {
            out.push(label)
          }
        }
      }
      var befFrames = beforeSc.durationInFrames || Math.round((beforeSc.durationSec || 3) * safeFps)
      var aftFrames = afterSc.durationInFrames || Math.round((afterSc.durationSec || 3) * safeFps)
      if (befFrames !== aftFrames) {
        out.push('停留 ' + (befFrames / safeFps).toFixed(1) + ' → ' + (aftFrames / safeFps).toFixed(1) + ' 秒')
      }
      return out.length ? out.join('、') : '微调内容'
    }

    function coalesceTurnCards(rawNodes) {
      var list = []
      var patchByProj = {}
      for (var i = 0; i < (rawNodes || []).length; i++) {
        var node = rawNodes[i]
        var rawMeta = node && node.data ? node.data : node
        var card = (rawMeta && rawMeta.reelDeskCard) ? rawMeta.reelDeskCard : rawMeta
        if (!card || !card.kind) continue
        if (card.kind === 'patch-card' && card.projectId) {
          var existing = patchByProj[card.projectId]
          if (!existing) {
            var cloned = JSON.parse(JSON.stringify(card))
            patchByProj[card.projectId] = cloned
            list.push(cloned)
          } else {
            existing.version = card.version
            existing.nextDurationSec = card.nextDurationSec
            existing.storyboard = card.storyboard
            var byId = {}
            ;(existing.pairs || []).forEach(function (p) { byId[p.sceneId] = p })
            ;(card.pairs || []).forEach(function (p) {
              if (byId[p.sceneId]) {
                byId[p.sceneId].afterScene = p.afterScene
                byId[p.sceneId].sceneIndex = p.sceneIndex
              } else {
                existing.pairs.push(JSON.parse(JSON.stringify(p)))
              }
            })
          }
        } else {
          list.push(card)
        }
      }
      return list
    }

    function makeIconComponent(React) {
      var h = React.createElement
      return function ReelSidebarIcon(props) {
        var size = (props && props.size) || 18
        var active = Boolean(props && props.active)
        return h('svg', {
          width: size,
          height: size,
          viewBox: '0 0 20 20',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
          h('rect', { x: 2.5, y: 5, width: 3.8, height: 10, rx: 1.2, stroke: 'currentColor', strokeWidth: active ? 1.7 : 1.4 }),
          h('rect', { x: 8.1, y: 3.2, width: 3.8, height: 13.6, rx: 1.2, fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1.2 }),
          h('rect', { x: 13.7, y: 5, width: 3.8, height: 10, rx: 1.2, stroke: 'currentColor', strokeWidth: active ? 1.7 : 1.4 }),
        )
      }
    }

    function DsBadge(React) {
      return React.createElement('span', { className: 'rd-ds', 'aria-hidden': 'true' }, 'D')
    }

    function ScaledFrameBox(props) {
      var React = props.React
      var h = React.createElement
      var sb = props.storyboard
      var kit = props.brandKit
      var frame = props.frame || 0
      var cover = Boolean(props.cover)
      var projectId = props.projectId || (sb && sb.id) || ''
      var boxRef = React.useRef(null)
      var _sz = React.useState({ w: props.fallbackW || 220, h: props.fallbackH || 74 })
      var boxSize = _sz[0]
      var setBoxSize = _sz[1]

      React.useEffect(function () {
        var el = boxRef.current
        if (!el) return undefined
        function measure() {
          var w = el.clientWidth
          var hgt = el.clientHeight
          if (w > 0 && hgt > 0) {
            setBoxSize(function (prev) {
              return (prev.w === w && prev.h === hgt) ? prev : { w: w, h: hgt }
            })
          }
        }
        measure()
        if (typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(measure)
          ro.observe(el)
          return function () { ro.disconnect() }
        }
        return undefined
      }, [sb && sb.aspect])

      if (!sb) return h('div', { ref: boxRef, className: props.className || 'pic' })
      var compW = sb.width || 1920
      var compH = sb.height || 1080
      var scale = cover
        ? Math.max(boxSize.w / compW, boxSize.h / compH)
        : Math.min(boxSize.w / compW, boxSize.h / compH)
      var left = cover ? (boxSize.w - compW * scale) / 2 : 0
      var top = cover ? (boxSize.h - compH * scale) / 2 : 0

      return h('div', {
        ref: boxRef,
        className: props.className || 'pic',
        style: props.style || undefined,
      },
        h('div', {
          style: {
            position: 'absolute',
            width: compW + 'px',
            height: compH + 'px',
            left: left + 'px',
            top: top + 'px',
            transform: 'scale(' + scale + ')',
            transformOrigin: 'top left',
            pointerEvents: 'none',
          },
        },
          renderStoryboardFrame(React, {
            frame: frame,
            fps: sb.fps || 60,
            storyboard: sb,
            brandKit: kit,
            assetMeta: sb.assetMeta || props.assetMeta || null,
            resolveAsset: function (assetName) {
              return MEDIA_URL + '?project=' + encodeURIComponent(projectId) + '&asset=' + encodeURIComponent(assetName)
            },
          }),
        ),
      )
    }

    function prefillComposerFromCard(hostCtx, inputActions, sessionId, text) {
      if (inputActions && typeof inputActions.setDraft === 'function') {
        inputActions.setDraft(text)
        return
      }
      var sessions = getHostService(hostCtx, 'sessions', false)
      var conv = getHostService(hostCtx, 'conversation', false)
      if (sessionId && sessions && typeof sessions.binding === 'function' && conv && conv.input) {
        var b = sessions.binding(sessionId)
        if (b && typeof conv.input.requestDraftInitialization === 'function') {
          conv.input.requestDraftInitialization(b, { prompt: text, whenDraftExists: 'append' })
        }
      }
    }

    function renderConversationCard(React, hostCtx, card, handlers) {
      var h = React.createElement
      injectStylesOnce()
      if (!card || !card.storyboard) return null
      var sb = card.storyboard
      var isTall = sb.aspect === '9:16'
      var tl = computeClientRanges(sb)

      if (card.kind === 'patch-card') {
        var pairs = card.pairs || []
        return h('div', {
          className: 'rd-tcard',
          'data-reel-card': 'patch',
          'data-project-id': card.projectId,
        },
          h('div', { className: 'hd' },
            h('span', { className: 'rd-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
            '制片台 · 改了 ' + (pairs.length || 1) + ' 镜　' +
              Number(card.prevDurationSec || tl.totalSec).toFixed(1) + ' → ' +
              Number(card.nextDurationSec || tl.totalSec).toFixed(1) + ' 秒',
          ),
          pairs.map(function (pair, idx) {
            var befSb = pair.beforeScene ? Object.assign({}, sb, { scenes: [pair.beforeScene] }) : null
            var aftSb = pair.afterScene ? Object.assign({}, sb, { scenes: [pair.afterScene] }) : null
            var befDur = pair.beforeScene ? (pair.beforeScene.durationInFrames || 120) : 120
            var aftDur = pair.afterScene ? (pair.afterScene.durationInFrames || 120) : 120
            var labelSc = pair.afterScene || pair.beforeScene || {}
            return h('div', {
              key: pair.sceneId || idx,
              className: 'rd-tpair' + (isTall ? ' tall' : ''),
            },
              befSb
                ? h(ScaledFrameBox, {
                    React: React,
                    className: 'pic',
                    storyboard: befSb,
                    brandKit: card.brandKit,
                    projectId: card.projectId,
                    frame: Math.round(befDur * 0.72),
                    cover: true,
                  })
                : h('div', { className: 'pic' }),
              h('span', { className: 'ar' }, '→'),
              aftSb
                ? h(ScaledFrameBox, {
                    React: React,
                    className: 'pic',
                    storyboard: aftSb,
                    brandKit: card.brandKit,
                    projectId: card.projectId,
                    frame: Math.round(aftDur * 0.72),
                    cover: true,
                  })
                : h('div', { className: 'pic' }),
              h('p', null,
                h('b', null, '第 ' + ((pair.sceneIndex || 0) + 1) + ' 镜　' + (labelSc.label || labelSc.kind || '')),
                '　' + describeSceneDiff(pair.beforeScene, pair.afterScene, sb.fps || 60),
              ),
            )
          }),
          h('div', { className: 'rd-tact' },
            h('button', {
              type: 'button',
              className: 'rd-btn pri',
              onClick: function () { openPanelToProject(hostCtx, card.projectId) },
            }, '去制片台看改动'),
            card.baseVersion >= 1
              ? h('button', {
                  type: 'button',
                  className: 'rd-btn line',
                  onClick: function () {
                    apiPost({ action: 'restore_version', id: card.projectId, version: card.baseVersion })
                      .then(function () { return openPanelToProject(hostCtx, card.projectId) })
                      .catch(function () {})
                  },
                }, '全部退回')
              : null,
          ),
        )
      }

      // FilmCard
      return h('div', {
        className: 'rd-tcard',
        'data-reel-card': 'film',
        'data-project-id': card.projectId,
      },
        h('div', { className: 'hd' },
          h('span', { className: 'rd-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
          card.isNew === false ? '制片台 · 重排了整条片' : '制片台 · 排好了一条新片',
        ),
        h('h3', null,
          card.title || sb.title,
          h('span', null, (isTall ? '竖屏' : '横屏') + ' · ' + sb.scenes.length + ' 镜 · ' + Number(card.totalDurationSec || tl.totalSec).toFixed(1) + ' 秒'),
        ),
        h('div', { className: 'rd-tstrip' + (isTall ? ' tall' : '') },
          sb.scenes.map(function (sc, i) {
            var r = tl.ranges[i]
            var f = r ? Math.min(r.endFrame - 1, r.startFrame + Math.round(r.durationInFrames * 0.72)) : 36
            return h('figure', { key: sc.id || i },
              h(ScaledFrameBox, {
                React: React,
                className: 'pic',
                storyboard: sb,
                brandKit: card.brandKit,
                projectId: card.projectId,
                frame: f,
                cover: true,
              }),
              h('figcaption', null,
                h('i', null, String(i + 1).padStart(2, '0')),
                sc.label || KIND_LABELS[sc.kind] || sc.kind,
              ),
            )
          }),
        ),
        h('div', { className: 'rd-tact' },
          h('button', {
            type: 'button',
            className: 'rd-btn pri',
            onClick: function () { openPanelToProject(hostCtx, card.projectId) },
          }, '去制片台看片改片'),
          h('button', {
            type: 'button',
            className: 'say',
            onClick: function () { handlers.onSay('再短一点，压到 8 秒') },
          }, '再短一点'),
          h('button', {
            type: 'button',
            className: 'say',
            onClick: function () { handlers.onSay('第 2 镜换成真实界面截图') },
          }, '加一镜真实界面'),
        ),
      )
    }

    function makeTurnTailComponent(React, hostCtx) {
      var h = React.createElement
      return function ReelTurnTail(props) {
        var turn = props && props.turn
        var turnNum = typeof turn === 'number' ? turn : (turn && turn.turn)
        var useReelCards = props && props.useReelCards
        var rawNodes = (useReelCards && turnNum !== undefined) ? useReelCards(String(turnNum)) : null
        if (!Array.isArray(rawNodes) || rawNodes.length === 0) return null
        var cards = coalesceTurnCards(rawNodes)
        if (cards.length === 0) return null
        return h(React.Fragment, null, cards.map(function (card, idx) {
          return h('div', { key: (card.projectId || 'card') + ':' + (card.version || idx) },
            renderConversationCard(React, hostCtx, card, {
              onSay: function (text) {
                prefillComposerFromCard(hostCtx, props && props.inputActions, props && props.sessionId, text)
              },
            }),
          )
        }))
      }
    }

    function makeToolViewReceiptComponent(React, hostCtx, toolLabel) {
      var h = React.createElement
      return function ReelToolViewReceipt(props) {
        injectStylesOnce()
        var phase = props && props.phase
        var block = props && props.block
        if (block && block.isError) {
          return h('div', { className: 'rd-tool-receipt' }, '制片台 · 参数校验未通过，正在让模型修正…')
        }
        var card = block && block.meta && (block.meta.reelDeskCard || block.meta)
        if (phase !== 'result' || !card) {
          return h('div', { className: 'rd-tool-receipt' }, '制片台 · ' + toolLabel + '…')
        }
        return h('div', { className: 'rd-tool-receipt' },
          h('span', null, '✓ 制片台 · 已更新《' + (card.title || card.projectId) + '》（第 ' + (card.version || 1) + ' 版）'),
          h('button', {
            type: 'button',
            className: 'rd-link',
            style: { cursor: 'pointer', background: 'none', border: 0 },
            onClick: function () { openPanelToProject(hostCtx, card.projectId) },
          }, '打开制片台'),
        )
      }
    }

    function makePanelComponent(React, hostCtx) {
      var h = React.createElement

      return function ReelDeskPanel(props) {
        props = props || {}
        injectStylesOnce()

        var _s = React.useState({
          loading: true,
          error: null,
          snapshot: null,
          renderer: null,
          capabilities: { wechat: false, inlineRewrite: true },
          serverWorkspaces: [],
          page: 'edit', // 'edit' | 'new'
          inspTab: 'scene', // 'scene' | 'film'
          sceneIdx: 0,
          frame: 48,
          playing: false,
          watchMode: 'board', // 'board' | 'file'
          saveStatus: 'saved', // 'saved' | 'saving'
          toast: '',
          pop: null, // null | 'kind' | 'lib' | 'ver' | 'export'
          popCtx: null,
          popPos: { left: 16, top: 64 },
          exportOpts: { quality: 'full', format: 'mp4' },
          showErrorLog: false,
          renaming: null, // null | { idx, where: 'cell' | 'head', val }
          libRenameId: null,
          libRenameVal: '',
          libDeleteConfirmId: null,
          cellMarks: {}, // { [sceneId]: 'new' | 'ds' | 'frame' | 'clash' }
          sysNote: null, // { gotoIdx, titleBold, restText }
          showBefore: false,
          clash: null, // { sceneId, sceneIndex, field, mineScene, theirsScene, mergedText, serverNote }
          shotTool: null, // null | 'pan' | 'focus' | 'cursor'
          showWsAssetInput: false,
          wsAssetPath: '',
          rawTextDrafts: {},
          sugState: null, // null | 'loading' | 'ready' | 'picked' | 'error'
          sugText: '',
          sugCandidates: [],
          sugError: '',
          askFilmBrief: '',
          newBrief: '',
          newAspect: '16:9',
          newDurPreset: '15',
          selectedWorkspaceId: null,
          wsPickerOpen: false,
          wsFactoryTick: 0,
          panelMetrics: { panelW: 1040, wellW: 680, winH: 820 },
          headLeftPx: 0,
          dropGapIdx: null,
          liftingIdx: null,
        })
        var state = _s[0]
        var setState = _s[1]

        var stateRef = React.useRef(state)
        stateRef.current = state

        var rootRef = React.useRef(null)
        var wrapRef = React.useRef(null)
        var wellRef = React.useRef(null)
        var stageRef = React.useRef(null)
        var trackRef = React.useRef(null)
        var miniRef = React.useRef(null)
        var fileInputRef = React.useRef(null)
        var renInputRef = React.useRef(null)
        var wsPickerBtnRef = React.useRef(null)
        var hookWorkspaceItems = typeof props.useWorkspaces === 'function'
          ? props.useWorkspaces(selectHostWorkspaceItems)
          : null

        var saveTimerRef = React.useRef(null)
        var toastTimerRef = React.useRef(null)
        var sugAbortRef = React.useRef(null)
        var pendingPatchRef = React.useRef(null) // { projectId, sceneId, sceneIndex, baseSceneRev, baseScene, changedFields: Set, scene, coalesceKey, note }
        var loadedSceneRevsRef = React.useRef({}) // { [sceneId]: rev }
        var loadedScenesRef = React.useRef({}) // { [sceneId]: sceneSnapshot }
        var discardedMineRef = React.useRef(null) // { projectId, sceneId, sceneIndex, scene, label }
        var lastCapTapRef = React.useRef({ idx: -1, ts: 0 })
        var trackDragRef = React.useRef(null)
        var stageDragRef = React.useRef(null)
        var miniDragRef = React.useRef(false)
        var ackedCreateProjectRef = React.useRef({})

        function patchState(updater) {
          setState(function (prev) {
            var next = typeof updater === 'function' ? updater(prev) : updater
            return Object.assign({}, prev, next)
          })
        }

        function showToast(msg) {
          if (!msg) return
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
          patchState({ toast: msg })
          toastTimerRef.current = setTimeout(function () {
            patchState({ toast: '' })
          }, 3600)
        }

        function syncLoadedRevs(snap, preserveMarks) {
          var proj = snap && snap.activeProject
          var revs = {}
          var scenesMap = {}
          var nextMarks = preserveMarks ? Object.assign({}, stateRef.current.cellMarks) : {}
          if (proj && proj.storyboard && Array.isArray(proj.storyboard.scenes)) {
            proj.storyboard.scenes.forEach(function (sc) {
              revs[sc.id] = sc.rev || 1
              scenesMap[sc.id] = JSON.parse(JSON.stringify(sc))
            })
            var ac = proj.agentChanges
            if (ac && ac.kind === 'created' && !ackedCreateProjectRef.current[proj.id]) {
              ;(ac.sceneIds || []).forEach(function (id, idx) {
                if (idx > 0 && !nextMarks[id]) nextMarks[id] = 'new'
              })
            } else if (ac && ac.kind === 'patched') {
              ;(ac.sceneIds || []).forEach(function (id) {
                if (nextMarks[id] !== 'clash') nextMarks[id] = 'ds'
              })
            }
          }
          loadedSceneRevsRef.current = revs
          loadedScenesRef.current = scenesMap
          return nextMarks
        }

        function buildConflictState(proj, idx, localScene, serverScene, conflictingFields, nonConflictingFields, serverNote, baseScene) {
          var field = conflictingFields[0] || 'headline'
          var mergedLabels = (nonConflictingFields || []).map(function (k) {
            if (k === 'durationSec' || k === 'durationInFrames') {
              var fps = (proj && proj.storyboard && proj.storyboard.fps) || 60
              var fromSc = baseScene || localScene
              return '停留 ' + ((fromSc.durationInFrames || 180) / fps).toFixed(1) + ' → ' + ((serverScene.durationInFrames || 180) / fps).toFixed(1) + ' 秒'
            }
            return FIELD_LABELS[k] || k
          }).join('、')
          return {
            sceneId: serverScene.id,
            sceneIndex: idx,
            field: field,
            fields: conflictingFields,
            mineScene: JSON.parse(JSON.stringify(localScene)),
            theirsScene: JSON.parse(JSON.stringify(serverScene)),
            mergedText: mergedLabels,
            serverNote: serverNote || (proj && proj.lastNote) || '刚才的要求',
          }
        }

        async function flushPendingSave() {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
          }
          var p = pendingPatchRef.current
          if (!p) return
          pendingPatchRef.current = null
          try {
            var d = await apiPost({
              action: 'patch_scene',
              id: p.projectId,
              op: 'update',
              sceneIndex: p.sceneIndex,
              sceneId: p.sceneId,
              baseSceneRev: p.baseSceneRev,
              changedFields: Array.from(p.changedFields),
              scene: p.scene,
              coalesceKey: p.coalesceKey,
              note: p.note,
            })
            var marks = syncLoadedRevs(d.snapshot, true)
            patchState({
              saveStatus: 'saved',
              snapshot: d.snapshot,
              renderer: d.renderer,
              cellMarks: marks,
            })
          } catch (err) {
            if (err && err.status === 409 && err.code === 'SCENE_CONFLICT' && err.data && err.data.conflict) {
              var c = err.data.conflict
              var snap = err.data.snapshot || stateRef.current.snapshot
              var proj = snap && snap.activeProject
              var idx = c.sceneIndex != null ? c.sceneIndex : p.sceneIndex
              var mergedMine = Object.assign({}, c.theirs || p.scene)
              ;(c.fields || ['headline']).forEach(function (fk) {
                mergedMine[fk] = p.scene[fk]
              })
              var nextSnap = JSON.parse(JSON.stringify(snap))
              if (nextSnap && nextSnap.activeProject && nextSnap.activeProject.storyboard.scenes[idx]) {
                nextSnap.activeProject.storyboard.scenes[idx] = mergedMine
              }
              var marks409 = syncLoadedRevs(snap, true)
              marks409[p.sceneId] = 'clash'
              patchState({
                saveStatus: 'saved',
                snapshot: nextSnap,
                renderer: err.data.renderer || stateRef.current.renderer,
                cellMarks: marks409,
                clash: buildConflictState(proj, idx, mergedMine, c.theirs || p.scene, c.fields || ['headline'], c.nonConflictingFields || [], c.serverNote, c.baseScene || p.baseScene),
              })
            } else {
              patchState({ saveStatus: 'saved' })
              showToast(err.message || '保存失败')
            }
          }
        }

        function scheduleScenePatch(nextScene, changedFieldKeys, note, coalesceKey) {
          var cur = stateRef.current
          var snap = cur.snapshot
          var proj = snap && snap.activeProject
          if (!proj || !proj.storyboard) return
          var idx = cur.sceneIdx
          var nextSnap = JSON.parse(JSON.stringify(snap))
          nextSnap.activeProject.storyboard.scenes[idx] = nextScene

          var nextClash = cur.clash
          if (nextClash && nextClash.sceneId === nextScene.id) {
            nextClash = Object.assign({}, nextClash, { mineScene: JSON.parse(JSON.stringify(nextScene)) })
            // While in unresolved conflict, keep editing local `mineScene` without overwriting server until user clicks `留我的`!
            patchState({ snapshot: nextSnap, clash: nextClash })
            return
          }

          var existing = pendingPatchRef.current
          var baseRev = (existing && existing.sceneId === nextScene.id)
            ? existing.baseSceneRev
            : (loadedSceneRevsRef.current[nextScene.id] || nextScene.rev || 1)
          var baseScene = (existing && existing.sceneId === nextScene.id && existing.baseScene)
            ? existing.baseScene
            : JSON.parse(JSON.stringify(loadedScenesRef.current[nextScene.id] || snap.activeProject.storyboard.scenes[idx] || nextScene))
          var fieldSet = (existing && existing.sceneId === nextScene.id)
            ? existing.changedFields
            : new Set()
          ;(changedFieldKeys || []).forEach(function (k) { fieldSet.add(k) })

          pendingPatchRef.current = {
            projectId: proj.id,
            sceneId: nextScene.id,
            sceneIndex: idx,
            baseSceneRev: baseRev,
            baseScene: baseScene,
            changedFields: fieldSet,
            scene: nextScene,
            coalesceKey: coalesceKey || (proj.id + ':' + nextScene.id + ':' + Array.from(fieldSet).join(',')),
            note: note || ('改第 ' + (idx + 1) + ' 镜'),
          }

          patchState({
            snapshot: nextSnap,
            saveStatus: 'saving',
          })

          var debounceMs = (typeof window !== 'undefined' && Number(window.__REEL_DESK_SAVE_DEBOUNCE_MS__) >= 50)
            ? Number(window.__REEL_DESK_SAVE_DEBOUNCE_MS__)
            : 340
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(function () {
            flushPendingSave()
          }, debounceMs)
        }

        function applyIncomingView(data, resetFrame) {
          var snap = data.snapshot
          var hasProjects = Boolean(snap && snap.projects && snap.projects.length > 0)
          var marks = syncLoadedRevs(snap, !resetFrame)
          var nextPage = !hasProjects ? 'new' : (resetFrame ? 'edit' : stateRef.current.page)
          if (hasProjects && stateRef.current.page === 'new' && stateRef.current.snapshot && stateRef.current.snapshot.projects.length === 0) {
            // Auto-land on newly created film when pendingHandoff finishes!
            nextPage = 'edit'
          }
          var sb = snap && snap.activeProject && snap.activeProject.storyboard
          var tl = computeClientRanges(sb)
          var nextIdx = sb ? Math.min(stateRef.current.sceneIdx, Math.max(0, sb.scenes.length - 1)) : 0
          if (resetFrame) nextIdx = 0
          var r0 = tl.ranges[nextIdx] || tl.ranges[0]
          var nextFrame = Math.min(stateRef.current.frame, Math.max(0, tl.totalFrames - 1))
          if (r0 && (resetFrame || (!stateRef.current.playing && (nextFrame < r0.startFrame || nextFrame >= r0.endFrame)))) {
            nextFrame = Math.round(r0.startFrame + r0.durationInFrames * 0.78)
          }

          var wsInfo = listHostWorkspaces(hostCtx, data.workspaces || stateRef.current.serverWorkspaces)
          var wsId = stateRef.current.selectedWorkspaceId || wsInfo.activeWorkspaceId || (wsInfo.items[0] && wsInfo.items[0].workspaceId) || null

          patchState({
            loading: false,
            error: null,
            snapshot: snap,
            renderer: data.renderer || stateRef.current.renderer,
            capabilities: data.capabilities || stateRef.current.capabilities,
            serverWorkspaces: data.workspaces || stateRef.current.serverWorkspaces,
            page: nextPage,
            sceneIdx: nextIdx,
            frame: nextFrame,
            cellMarks: marks,
            selectedWorkspaceId: wsId,
            rawTextDrafts: resetFrame ? {} : stateRef.current.rawTextDrafts,
          })
        }

        // Initial fetch + cross-slot `reel-desk:select` listener
        React.useEffect(function () {
          var alive = true
          apiGet()
            .then(function (data) {
              if (!alive) return
              applyIncomingView(data, true)
            })
            .catch(function (err) {
              if (!alive) return
              patchState({ loading: false, error: err.message || String(err) })
            })

          function onExternalSelect(ev) {
            var pid = ev && ev.detail && ev.detail.projectId
            apiGet({ project: pid }).then(function (data) {
              if (!alive) return
              applyIncomingView(data, true)
              patchState({ page: 'edit', pop: null, showBefore: false })
            }).catch(function () {})
          }

          if (typeof window !== 'undefined') {
            window.addEventListener('reel-desk:select', onExternalSelect)
          }

          var unsubWs = null
          var unsubFactory = null
          try {
            var wsSvc = getHostService(hostCtx, 'workspaces', false)
            if (wsSvc && wsSvc.list && typeof wsSvc.list.subscribe === 'function') {
              unsubWs = wsSvc.list.subscribe(function () {
                if (!alive) return
                patchState(function (prev) { return { wsFactoryTick: (prev.wsFactoryTick || 0) + 1 } })
              })
            }
            var slotSvc = getHostService(hostCtx, 'slots', true)
            var onFactoryChange = function () {
              if (!alive) return
              patchState(function (prev) { return { wsFactoryTick: (prev.wsFactoryTick || 0) + 1 } })
            }
            if (slotSvc && typeof slotSvc.subscribe === 'function') {
              unsubFactory = slotSvc.subscribe('workspace.picker.directoryFlow', onFactoryChange)
            } else if (slotSvc && typeof slotSvc.subscribeFactory === 'function') {
              unsubFactory = slotSvc.subscribeFactory('workspace.picker', onFactoryChange)
            }
          } catch (_subErr) {}

          return function () {
            alive = false
            if (typeof unsubWs === 'function') try { unsubWs() } catch (_eWs) {}
            if (typeof unsubFactory === 'function') try { unsubFactory() } catch (_eFac) {}
            if (typeof window !== 'undefined') {
              window.removeEventListener('reel-desk:select', onExternalSelect)
            }
            if (sugAbortRef.current) {
              try { sugAbortRef.current.abort() } catch (_e) {}
            }
            flushPendingSave()
          }
        }, [])

        // Lightweight 2s `sinceVersion` polling + window `focus` refresh (with live merge / conflict detection!)
        React.useEffect(function () {
          if (state.loading) return undefined
          var job = state.renderer && state.renderer.activeJob
          var jobRunning = Boolean(job && ['bootstrapping', 'bundling', 'rendering'].includes(job.stage))
          var intervalMs = jobRunning ? 850 : 2000

          async function pollOnce() {
            var cur = stateRef.current
            if (cur.loading) return
            var proj = cur.snapshot && cur.snapshot.activeProject
            var sinceVer = proj ? proj.version : 0
            try {
              var d = await apiGet({
                project: proj ? proj.id : undefined,
                sinceVersion: sinceVer,
              })
              if (d.unchanged) {
                patchState({
                  renderer: d.renderer || cur.renderer,
                  capabilities: d.capabilities || cur.capabilities,
                })
                return
              }
              if (!d.snapshot) return

              // Check if user currently has unsaved typing on a scene that server also updated!
              var pending = pendingPatchRef.current
              var incomingProj = d.snapshot.activeProject
              if (pending && incomingProj && incomingProj.id === pending.projectId) {
                var sIdx = incomingProj.storyboard.scenes.findIndex(function (s) { return s.id === pending.sceneId })
                if (sIdx >= 0) {
                  var serverSc = incomingProj.storyboard.scenes[sIdx]
                  var loadedRev = loadedSceneRevsRef.current[pending.sceneId] || 1
                  if ((serverSc.rev || 1) !== loadedRev) {
                    var baseSc = pending.baseScene || loadedScenesRef.current[pending.sceneId] || serverSc
                    var userFields = Array.from(pending.changedFields)
                    // A field only conflicts if BOTH user AND server changed it from `baseSc`, and to different values!
                    var conflicts = userFields.filter(function (k) {
                      if (k === 'durationSec') {
                        return serverSc.durationInFrames !== baseSc.durationInFrames &&
                          serverSc.durationInFrames !== pending.scene.durationInFrames
                      }
                      return JSON.stringify(serverSc[k] || null) !== JSON.stringify(baseSc[k] || null) &&
                        JSON.stringify(serverSc[k] || null) !== JSON.stringify(pending.scene[k] || null)
                    })

                    var mergedSc = Object.assign({}, serverSc)
                    userFields.forEach(function (k) {
                      mergedSc[k] = pending.scene[k]
                      if (k === 'durationSec') mergedSc.durationInFrames = pending.scene.durationInFrames
                    })

                    var snapClone = JSON.parse(JSON.stringify(d.snapshot))
                    snapClone.activeProject.storyboard.scenes[sIdx] = mergedSc
                    var cMarks = syncLoadedRevs(d.snapshot, true)

                    var mergedTl = computeClientRanges(snapClone.activeProject.storyboard)
                    var mergedR = mergedTl.ranges[sIdx]
                    var mergedFrame = cur.frame
                    if (mergedR && !cur.playing && (mergedFrame < mergedR.startFrame || mergedFrame >= mergedR.endFrame)) {
                      mergedFrame = Math.round(mergedR.startFrame + mergedR.durationInFrames * 0.78)
                    }

                    if (conflicts.length > 0) {
                      if (saveTimerRef.current) {
                        clearTimeout(saveTimerRef.current)
                        saveTimerRef.current = null
                      }
                      pendingPatchRef.current = null
                      cMarks[serverSc.id] = 'clash'
                      var otherChanged = ['durationSec', 'eyebrow', 'headline', 'lines', 'blocks', 'codeLines', 'ctaLabel'].filter(function (k) {
                        if (conflicts.includes(k)) return false
                        if (k === 'durationSec') return serverSc.durationInFrames !== baseSc.durationInFrames
                        return JSON.stringify(serverSc[k] || null) !== JSON.stringify(baseSc[k] || null)
                      })
                      patchState({
                        saveStatus: 'saved',
                        snapshot: snapClone,
                        renderer: d.renderer,
                        capabilities: d.capabilities || cur.capabilities,
                        cellMarks: cMarks,
                        frame: mergedFrame,
                        clash: buildConflictState(incomingProj, sIdx, mergedSc, serverSc, conflicts, otherChanged, incomingProj.lastNote, baseSc),
                      })
                      return
                    }

                    // Non-overlapping concurrent edit (Check #16): keep user's unsaved fields merged onto serverSc without conflict!
                    pending.sceneIndex = sIdx
                    pending.baseSceneRev = serverSc.rev || 1
                    pending.baseScene = JSON.parse(JSON.stringify(serverSc))
                    pending.scene = mergedSc
                    patchState({
                      snapshot: snapClone,
                      renderer: d.renderer,
                      capabilities: d.capabilities || cur.capabilities,
                      cellMarks: cMarks,
                      frame: mergedFrame,
                    })
                    return
                  }
                }
              }

              applyIncomingView(d, false)
            } catch (_err) {
              // ignore transient poll error
            }
          }

          var timer = setInterval(pollOnce, intervalMs)
          function onWinFocus() { pollOnce() }
          if (typeof window !== 'undefined') {
            window.addEventListener('focus', onWinFocus)
          }
          return function () {
            clearInterval(timer)
            if (typeof window !== 'undefined') {
              window.removeEventListener('focus', onWinFocus)
            }
          }
        }, [state.loading, state.renderer && state.renderer.activeJob && state.renderer.activeJob.stage])

        // Measure panel & screening well via ResizeObserver
        React.useEffect(function () {
          var rootEl = rootRef.current
          if (!rootEl) return undefined
          function measure() {
            var pw = rootEl.clientWidth || 1040
            var ww = (wellRef.current && wellRef.current.clientWidth) || Math.min(720, pw - 40)
            var wh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 820
            patchState(function (prev) {
              var m = prev.panelMetrics
              if (m.panelW === pw && m.wellW === ww && m.winH === wh) return {}
              return { panelMetrics: { panelW: pw, wellW: ww, winH: wh } }
            })
          }
          measure()
          if (typeof ResizeObserver !== 'undefined') {
            var ro = new ResizeObserver(measure)
            ro.observe(rootEl)
            if (wellRef.current) ro.observe(wellRef.current)
            return function () { ro.disconnect() }
          }
          return undefined
        }, [state.loading, state.page, state.snapshot && state.snapshot.activeProject && state.snapshot.activeProject.storyboard.aspect])

        // Focus inline rename input when opened
        React.useEffect(function () {
          if (state.renaming && renInputRef.current) {
            try {
              renInputRef.current.focus()
              renInputRef.current.select()
            } catch (_e) {}
          }
        }, [state.renaming && state.renaming.idx, state.renaming && state.renaming.where])

        // Compute playhead X across filmstrip cells
        React.useEffect(function () {
          var trackEl = trackRef.current
          var sb = state.snapshot && state.snapshot.activeProject && state.snapshot.activeProject.storyboard
          if (!trackEl || !sb) return
          var tl = computeClientRanges(sb)
          var activeRange = tl.ranges.find(function (r) { return state.frame < r.endFrame }) || tl.ranges[tl.ranges.length - 1]
          if (!activeRange) return
          var cellNodes = trackEl.querySelectorAll('.rd-cell')
          var cellEl = cellNodes[activeRange.index]
          if (!cellEl) return
          var localRatio = Math.max(0, Math.min(1, (state.frame - activeRange.startFrame) / Math.max(1, activeRange.durationInFrames)))
          var px = cellEl.offsetLeft + localRatio * cellEl.offsetWidth
          if (Math.abs(px - state.headLeftPx) > 0.5) {
            patchState({ headLeftPx: px })
          }
        }, [state.frame, state.panelMetrics.panelW, state.snapshot && state.snapshot.activeProject && state.snapshot.activeProject.version])

        // 60fps deterministic playback loop
        React.useEffect(function () {
          if (!state.playing) return undefined
          var sb = stateRef.current.snapshot && stateRef.current.snapshot.activeProject && stateRef.current.snapshot.activeProject.storyboard
          if (!sb) return undefined
          var fps = sb.fps || 60
          var tl = computeClientRanges(sb)
          var rafId = 0
          var lastTs = performance.now()
          var startFrame = stateRef.current.frame

          function step(now) {
            var elapsedSec = (now - lastTs) / 1000
            var nextF = (startFrame + Math.floor(elapsedSec * fps)) % tl.totalFrames
            var rIdx = tl.ranges.findIndex(function (r) { return nextF < r.endFrame })
            patchState(function (prev) {
              var u = { frame: nextF }
              if (rIdx >= 0 && rIdx !== prev.sceneIdx) u.sceneIdx = rIdx
              return u
            })
            rafId = requestAnimationFrame(step)
          }
          rafId = requestAnimationFrame(step)
          return function () { cancelAnimationFrame(rafId) }
        }, [state.playing])

        async function handleImageFileUpload(file) {
          if (!file) return false
          var cur = stateRef.current
          var proj = cur.snapshot && cur.snapshot.activeProject
          if (!proj) return false
          if (file.size > MAX_UPLOAD_BYTES) {
            showToast('图片不能超过 10 MB（请裁剪或压缩后再试）')
            return true
          }
          try {
            await flushPendingSave()
            patchState({ saveStatus: 'saving' })
            var uploaded = await apiUploadAsset(proj.id, file)
            var sb = uploaded.snapshot.activeProject.storyboard
            var targetIdx = cur.sceneIdx
            var curSc = sb.scenes[targetIdx]
            if (curSc && curSc.kind === 'screen-shot') {
              var patched = await apiPost({
                action: 'patch_scene',
                id: proj.id,
                op: 'update',
                sceneIndex: targetIdx,
                sceneId: curSc.id,
                scene: Object.assign({}, curSc, { asset: uploaded.asset }),
                note: '放进截图',
              })
              var marks = syncLoadedRevs(patched.snapshot, true)
              var r = computeClientRanges(patched.snapshot.activeProject.storyboard).ranges[targetIdx]
              patchState({
                saveStatus: 'saved',
                snapshot: patched.snapshot,
                renderer: patched.renderer,
                cellMarks: marks,
                shotTool: 'pan',
                frame: r ? r.startFrame + Math.min(r.durationInFrames - 1, 70) : cur.frame,
              })
            } else {
              var marks2 = syncLoadedRevs(uploaded.snapshot, true)
              patchState({
                saveStatus: 'saved',
                snapshot: uploaded.snapshot,
                renderer: uploaded.renderer,
                cellMarks: marks2,
              })
            }
            showToast('已导入截图 ' + uploaded.asset + '（' + uploaded.width + '×' + uploaded.height + '）')
          } catch (err) {
            patchState({ saveStatus: 'saved' })
            showToast(err.message || '图片上传失败')
          }
          return true
        }

        // Global paste, outside-popover click, keyboard transport & undo
        React.useEffect(function () {
          function onPaste(e) {
            var cur = stateRef.current
            if (cur.page !== 'edit' || !cur.snapshot || !cur.snapshot.activeProject) return
            var files = e.clipboardData && e.clipboardData.files ? Array.from(e.clipboardData.files) : []
            var imgFile = files.find(function (f) { return f.type && f.type.indexOf('image/') === 0 })
            if (imgFile) {
              e.preventDefault()
              handleImageFileUpload(imgFile)
            }
          }

          function onPointerDownCapture(e) {
            var cur = stateRef.current
            if (!cur.pop) return
            var t = e.target
            if (t && t.closest && t.closest('#pop,#projBtn,#verBtn,#btnExport,#kindBtn,.rd-gap,.rd-add')) return
            patchState({ pop: null, popCtx: null, libRenameId: null, libDeleteConfirmId: null })
          }

          function onKeyDown(e) {
            var cur = stateRef.current
            if (e.key === 'Escape') {
              if (cur.renaming) {
                e.stopPropagation()
                patchState({ renaming: null })
                return
              }
              if (cur.pop || cur.shotTool) {
                patchState({ pop: null, popCtx: null, shotTool: null })
                return
              }
            }
            var tag = e.target && e.target.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault()
              triggerUndo()
              return
            }
            if (cur.page !== 'edit' || !cur.snapshot || !cur.snapshot.activeProject) return
            var sb = cur.snapshot.activeProject.storyboard
            var tl = computeClientRanges(sb)
            if (e.code === 'Space') {
              e.preventDefault()
              patchState({ playing: !cur.playing, watchMode: 'board' })
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              setFrameAndSyncScene(Math.min(tl.totalFrames - 1, cur.frame + (e.shiftKey ? 10 : 1)))
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setFrameAndSyncScene(Math.max(0, cur.frame - (e.shiftKey ? 10 : 1)))
            }
          }

          window.addEventListener('paste', onPaste)
          window.addEventListener('pointerdown', onPointerDownCapture, true)
          window.addEventListener('keydown', onKeyDown)
          return function () {
            window.removeEventListener('paste', onPaste)
            window.removeEventListener('pointerdown', onPointerDownCapture, true)
            window.removeEventListener('keydown', onKeyDown)
          }
        }, [])

        function setFrameAndSyncScene(nextFrame) {
          var sb = stateRef.current.snapshot && stateRef.current.snapshot.activeProject && stateRef.current.snapshot.activeProject.storyboard
          if (!sb) return
          var tl = computeClientRanges(sb)
          var clamped = Math.max(0, Math.min(tl.totalFrames - 1, Math.round(nextFrame)))
          var idx = tl.ranges.findIndex(function (r) { return clamped < r.endFrame })
          patchState(function (prev) {
            var next = { playing: false, frame: clamped, watchMode: 'board' }
            if (idx >= 0 && idx !== prev.sceneIdx) {
              next.sceneIdx = idx
              next.showBefore = false
              next.sugState = null
              next.sugCandidates = []
              var sc = sb.scenes[idx]
              if (sc && (prev.cellMarks[sc.id] === 'new' || prev.cellMarks[sc.id] === 'frame')) {
                var cm = Object.assign({}, prev.cellMarks)
                delete cm[sc.id]
                next.cellMarks = cm
              }
            }
            return next
          })
        }

        function selectScene(idx, keepFrame) {
          flushPendingSave()
          var sb = stateRef.current.snapshot && stateRef.current.snapshot.activeProject && stateRef.current.snapshot.activeProject.storyboard
          if (!sb || !sb.scenes[idx]) return
          var tl = computeClientRanges(sb)
          var r = tl.ranges[idx]
          var sc = sb.scenes[idx]
          patchState(function (prev) {
            var cm = Object.assign({}, prev.cellMarks)
            if (cm[sc.id] === 'new' || cm[sc.id] === 'frame') delete cm[sc.id]
            return {
              sceneIdx: idx,
              playing: false,
              watchMode: 'board',
              showBefore: false,
              shotTool: null,
              sugState: null,
              sugCandidates: [],
              sugError: '',
              rawTextDrafts: {},
              cellMarks: cm,
              frame: keepFrame ? prev.frame : (r ? Math.round(r.startFrame + r.durationInFrames * 0.78) : 36),
            }
          })
        }

        async function triggerUndo() {
          await flushPendingSave()
          var cur = stateRef.current
          var proj = cur.snapshot && cur.snapshot.activeProject
          if (!proj) return
          if (discardedMineRef.current && discardedMineRef.current.projectId === proj.id) {
            var disc = discardedMineRef.current
            discardedMineRef.current = null
            try {
              var d = await apiPost({
                action: 'patch_scene',
                id: proj.id,
                op: 'update',
                sceneIndex: disc.sceneIndex,
                sceneId: disc.sceneId,
                forceResolveConflict: true,
                scene: disc.scene,
                note: '恢复刚才丢掉的写法',
              })
              var m = syncLoadedRevs(d.snapshot, true)
              patchState({ snapshot: d.snapshot, renderer: d.renderer, cellMarks: m, rawTextDrafts: {} })
              showToast('已恢复你刚才那份写法')
              return
            } catch (_e) {}
          }
          if (!proj.canUndo) return
          try {
            var res = await apiPost({ action: 'undo', id: proj.id })
            var marks = syncLoadedRevs(res.snapshot, false)
            patchState({
              snapshot: res.snapshot,
              renderer: res.renderer,
              cellMarks: marks,
              clash: null,
              showBefore: false,
              rawTextDrafts: {},
            })
            showToast('已撤销上一步改动')
          } catch (err) {
            showToast(err.message)
          }
        }

        function openPopover(kind, anchorEl, ctxObj) {
          var wrapEl = wrapRef.current
          var left = 16
          var top = 64
          if (wrapEl && anchorEl && anchorEl.getBoundingClientRect) {
            var wr = wrapEl.getBoundingClientRect()
            var ar = anchorEl.getBoundingClientRect()
            var popW = kind === 'kind' ? Math.min(620, wr.width - 24) : Math.min(392, wr.width - 24)
            var rawLeft = ar.left - wr.left + (kind === 'export' ? ar.width - popW : 0)
            left = Math.max(12, Math.min(rawLeft, wr.width - popW - 12))
            top = Math.max(44, ar.bottom - wr.top + 8)
          }
          patchState({
            pop: kind,
            popCtx: ctxObj || null,
            popPos: { left: left, top: top },
            libRenameId: null,
            libDeleteConfirmId: null,
          })
        }

        function startInlineRename(idx, where, initVal) {
          var sb = stateRef.current.snapshot && stateRef.current.snapshot.activeProject && stateRef.current.snapshot.activeProject.storyboard
          if (!sb || !sb.scenes[idx]) return
          var r = computeClientRanges(sb).ranges[idx]
          patchState(function (prev) {
            return {
              sceneIdx: idx,
              frame: idx !== prev.sceneIdx && r ? Math.round(r.startFrame + r.durationInFrames * 0.78) : prev.frame,
              renaming: {
                idx: idx,
                where: where,
                val: initVal !== undefined ? initVal : (sb.scenes[idx].label || ''),
              },
            }
          })
        }

        async function commitInlineRename(shouldSave) {
          var cur = stateRef.current
          var ren = cur.renaming
          if (!ren) return
          patchState({ renaming: null })
          if (!shouldSave) return
          var proj = cur.snapshot && cur.snapshot.activeProject
          var sb = proj && proj.storyboard
          var sc = sb && sb.scenes[ren.idx]
          if (!sc) return
          var nextLabel = String(ren.val || '').trim().slice(0, 16) || KIND_LABELS[sc.kind] || sc.label
          if (nextLabel === sc.label) return
          var oldLabel = sc.label
          await flushPendingSave()
          try {
            var d = await apiPost({
              action: 'patch_scene',
              id: proj.id,
              op: 'update',
              sceneIndex: ren.idx,
              sceneId: sc.id,
              changedFields: ['label'],
              scene: Object.assign({}, sc, { label: nextLabel }),
              note: '把「' + oldLabel + '」改名为「' + nextLabel + '」',
            })
            var marks = syncLoadedRevs(d.snapshot, true)
            patchState({ snapshot: d.snapshot, renderer: d.renderer, cellMarks: marks })
          } catch (err) {
            showToast(err.message)
          }
        }

        async function runSuggestScene(overrideIntent) {
          var cur = stateRef.current
          var proj = cur.snapshot && cur.snapshot.activeProject
          var sb = proj && proj.storyboard
          var sc = sb && sb.scenes[cur.sceneIdx]
          if (!proj || !sc) return
          await flushPendingSave()
          if (sugAbortRef.current) {
            try { sugAbortRef.current.abort() } catch (_e) {}
          }
          var ac = new AbortController()
          sugAbortRef.current = ac
          var intent = (overrideIntent !== undefined ? overrideIntent : cur.sugText).trim() || '口语一点'
          patchState({
            sugText: intent,
            sugState: 'loading',
            sugCandidates: [],
            sugError: '',
          })
          try {
            var res = await apiPost({
              action: 'suggest_scene',
              id: proj.id,
              sceneId: sc.id,
              sceneIndex: cur.sceneIdx,
              intent: intent,
              n: 3,
            }, { signal: ac.signal })
            if (ac.signal.aborted) return
            if (!res.ok || !Array.isArray(res.candidates) || res.candidates.length === 0) {
              patchState({
                sugState: 'error',
                sugError: res.message || '暂时没拿到改写候选，可以再试一次或去对话里说。',
              })
              return
            }
            patchState({
              sugState: 'ready',
              sugCandidates: res.candidates,
              sugError: '',
            })
          } catch (err) {
            if (ac.signal.aborted) return
            patchState({
              sugState: 'error',
              sugError: err.message || '请求超时或网络异常，可以再试一次或去对话里说。',
            })
          }
        }

        // Pointer move/up window listeners for track drag, stage overlay drag, and minimap drag
        React.useEffect(function () {
          function getStageViewportPoint(e) {
            var stEl = stageRef.current
            if (!stEl) return null
            var vpEl = stEl.querySelector('[data-reel-shot-viewport="1"]')
            if (!vpEl) return null
            var r = vpEl.getBoundingClientRect()
            if (!r.width || !r.height) return null
            return {
              x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
              y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
              rect: r,
            }
          }

          function computeDropIndex(clientX) {
            var trackEl = trackRef.current
            if (!trackEl) return 0
            var cells = Array.from(trackEl.querySelectorAll('.rd-cell'))
            for (var i = 0; i < cells.length; i++) {
              var b = cells[i].getBoundingClientRect()
              if (clientX < b.left + b.width / 2) return i
            }
            return cells.length
          }

          function seekOnTrack(clientX) {
            var trackEl = trackRef.current
            var sb = stateRef.current.snapshot && stateRef.current.snapshot.activeProject && stateRef.current.snapshot.activeProject.storyboard
            if (!trackEl || !sb) return
            var cells = Array.from(trackEl.querySelectorAll('.rd-cell'))
            var tl = computeClientRanges(sb)
            for (var i = 0; i < cells.length; i++) {
              var b = cells[i].getBoundingClientRect()
              if (clientX >= b.left && clientX <= b.right + 12) {
                var ratio = Math.max(0, Math.min(0.999, (clientX - b.left) / Math.max(1, b.width)))
                setFrameAndSyncScene(tl.ranges[i].startFrame + ratio * tl.ranges[i].durationInFrames)
                return
              }
            }
          }

          function onPointerMove(e) {
            // 1) Track drag (seek / dur / move)
            var tk = trackDragRef.current
            if (tk) {
              var cur = stateRef.current
              var sb = cur.snapshot && cur.snapshot.activeProject && cur.snapshot.activeProject.storyboard
              if (!sb) return
              if (tk.mode === 'seek') {
                seekOnTrack(e.clientX)
              } else if (tk.mode === 'dur') {
                var fps = sb.fps || 60
                var rawFrames = tk.startFrames + (e.clientX - tk.startX) / Math.max(0.05, tk.pxPerFrame)
                var snapped = Math.max(Math.round(1.5 * fps), Math.min(10 * fps, Math.round(rawFrames / 6) * 6))
                var nextDurSec = Number((snapped / fps).toFixed(2))
                var nextSnap = JSON.parse(JSON.stringify(cur.snapshot))
                var targetSc = nextSnap.activeProject.storyboard.scenes[tk.idx]
                if (targetSc) {
                  targetSc.durationInFrames = snapped
                  targetSc.durationSec = nextDurSec
                  tk.latestScene = targetSc
                  patchState({ snapshot: nextSnap })
                }
              } else if (tk.mode === 'move') {
                if (Math.abs(e.clientX - tk.startX) > 6) {
                  tk.moved = true
                  var dropAt = computeDropIndex(e.clientX)
                  tk.dropAt = dropAt
                  patchState({ liftingIdx: tk.idx, dropGapIdx: dropAt })
                }
              }
              return
            }

            // 2) Stage overlay drag (pan / focus)
            var od = stageDragRef.current
            if (od) {
              var cur2 = stateRef.current
              var sb2 = cur2.snapshot && cur2.snapshot.activeProject && cur2.snapshot.activeProject.storyboard
              var sc2 = sb2 && sb2.scenes[cur2.sceneIdx]
              if (!sc2) return
              var pt = getStageViewportPoint(e)
              if (!pt) return
              var nextSc = Object.assign({}, sc2)
              if (od.tool === 'pan') {
                var ovx = (od.geom.dw - od.geom.vp.w) / od.geom.vp.w
                var ovy = (od.geom.dh - od.geom.vp.h) / od.geom.vp.h
                nextSc.view = {
                  z: od.v0.z,
                  x: ovx > 0.001 ? Math.max(0, Math.min(1, Number((od.v0.x - (e.clientX - od.x0) / od.rect.width / ovx).toFixed(4)))) : od.v0.x,
                  y: ovy > 0.001 ? Math.max(0, Math.min(1, Number((od.v0.y - (e.clientY - od.y0) / od.rect.height / ovy).toFixed(4)))) : od.v0.y,
                }
              } else if (od.tool === 'focus') {
                nextSc.focus = shotViewportRectToImage(od.geom, od.p0, pt)
              }
              od.latestScene = nextSc
              var snap2 = JSON.parse(JSON.stringify(cur2.snapshot))
              snap2.activeProject.storyboard.scenes[cur2.sceneIdx] = nextSc
              patchState({ snapshot: snap2 })
              return
            }

            // 3) Minimap drag
            if (miniDragRef.current && miniRef.current) {
              var cur3 = stateRef.current
              var sb3 = cur3.snapshot && cur3.snapshot.activeProject && cur3.snapshot.activeProject.storyboard
              var sc3 = sb3 && sb3.scenes[cur3.sceneIdx]
              if (!sc3) return
              var mr = miniRef.current.getBoundingClientRect()
              if (!mr.width || !mr.height) return
              var geom = computeShotGeometry(sb3, sc3, sb3.assetMeta)
              var v = normalizeShotView(sc3.view)
              var uw = geom.vp.w / geom.dw
              var vh = geom.vp.h / geom.dh
              var pu = (e.clientX - mr.left) / mr.width
              var pv = (e.clientY - mr.top) / mr.height
              var nextView = {
                z: v.z,
                x: uw < 0.999 ? Math.max(0, Math.min(1, Number(((pu - uw / 2) / (1 - uw)).toFixed(4)))) : v.x,
                y: vh < 0.999 ? Math.max(0, Math.min(1, Number(((pv - vh / 2) / (1 - vh)).toFixed(4)))) : v.y,
              }
              var snap3 = JSON.parse(JSON.stringify(cur3.snapshot))
              snap3.activeProject.storyboard.scenes[cur3.sceneIdx].view = nextView
              miniDragRef.current = { latestScene: snap3.activeProject.storyboard.scenes[cur3.sceneIdx] }
              patchState({ snapshot: snap3 })
            }
          }

          function onPointerUp(e) {
            var tk = trackDragRef.current
            if (tk) {
              trackDragRef.current = null
              patchState({ liftingIdx: null, dropGapIdx: null })
              var cur = stateRef.current
              var proj = cur.snapshot && cur.snapshot.activeProject
              if (!proj) return
              if (tk.mode === 'dur' && tk.latestScene) {
                apiPost({
                  action: 'patch_scene',
                  id: proj.id,
                  op: 'update',
                  sceneIndex: tk.idx,
                  sceneId: tk.latestScene.id,
                  changedFields: ['durationSec'],
                  scene: tk.latestScene,
                  note: '改第 ' + (tk.idx + 1) + ' 镜时长',
                }).then(function (d) {
                  var m = syncLoadedRevs(d.snapshot, true)
                  patchState({ snapshot: d.snapshot, renderer: d.renderer, cellMarks: m })
                }).catch(function (err) { showToast(err.message) })
              } else if (tk.mode === 'move') {
                if (!tk.moved) {
                  var now = performance.now()
                  var isDbl = lastCapTapRef.current.idx === tk.idx && (now - lastCapTapRef.current.ts) < 420
                  lastCapTapRef.current = { idx: tk.idx, ts: now }
                  if (isDbl) startInlineRename(tk.idx, 'cell')
                  else selectScene(tk.idx, false)
                  return
                }
                var rawDrop = tk.dropAt != null ? tk.dropAt : computeDropIndex(e.clientX)
                var toIdx = rawDrop > tk.idx ? rawDrop - 1 : rawDrop
                if (toIdx !== tk.idx && toIdx >= 0 && toIdx < proj.storyboard.scenes.length) {
                  var movedSc = proj.storyboard.scenes[tk.idx]
                  flushPendingSave().then(function () {
                    return apiPost({
                      action: 'patch_scene',
                      id: proj.id,
                      op: 'move',
                      sceneIndex: tk.idx,
                      toIndex: toIdx,
                      note: '挪动「' + (movedSc ? movedSc.label : '') + '」',
                    })
                  }).then(function (d) {
                    var m = syncLoadedRevs(d.snapshot, true)
                    var r = computeClientRanges(d.snapshot.activeProject.storyboard).ranges[toIdx]
                    patchState({
                      snapshot: d.snapshot,
                      renderer: d.renderer,
                      cellMarks: m,
                      sceneIdx: toIdx,
                      frame: r ? Math.round(r.startFrame + r.durationInFrames * 0.78) : 36,
                    })
                  }).catch(function (err) { showToast(err.message) })
                }
              }
              return
            }

            var od = stageDragRef.current
            if (od) {
              stageDragRef.current = null
              if (od.latestScene) {
                scheduleScenePatch(
                  od.latestScene,
                  [od.tool === 'pan' ? 'view' : 'focus'],
                  od.tool === 'pan' ? '取景' : '框重点',
                )
              }
              return
            }

            var md = miniDragRef.current
            if (md) {
              miniDragRef.current = false
              if (md.latestScene) {
                scheduleScenePatch(md.latestScene, ['view'], '取景')
              }
            }
          }

          window.addEventListener('pointermove', onPointerMove)
          window.addEventListener('pointerup', onPointerUp)
          return function () {
            window.removeEventListener('pointermove', onPointerMove)
            window.removeEventListener('pointerup', onPointerUp)
          }
        }, [])


        // Measure `[data-reel-shot-viewport="1"]` relative to `.rd-stage` for `.rd-drop` box placement
        var _dropRect = React.useState(null)
        var dropRect = _dropRect[0]
        var setDropRect = _dropRect[1]

        React.useEffect(function () {
          var proj = state.snapshot && state.snapshot.activeProject
          var sb = proj && proj.storyboard
          var sc = sb && sb.scenes[state.sceneIdx]
          if (!sc || sc.kind !== 'screen-shot' || sc.asset || !stageRef.current) {
            if (dropRect !== null) setDropRect(null)
            return
          }
          var stEl = stageRef.current
          var vpEl = stEl.querySelector('[data-reel-shot-viewport="1"]')
          if (!vpEl) return
          var sr = stEl.getBoundingClientRect()
          var vr = vpEl.getBoundingClientRect()
          if (sr.width > 0 && vr.width > 0) {
            var nextR = {
              left: Math.max(8, Math.round(vr.left - sr.left + 8)),
              top: Math.max(8, Math.round(vr.top - sr.top + 8)),
              width: Math.max(80, Math.round(vr.width - 16)),
              height: Math.max(60, Math.round(vr.height - 16)),
            }
            if (!dropRect ||
                Math.abs(dropRect.left - nextR.left) > 2 ||
                Math.abs(dropRect.top - nextR.top) > 2 ||
                Math.abs(dropRect.width - nextR.width) > 2 ||
                Math.abs(dropRect.height - nextR.height) > 2) {
              setDropRect(nextR)
            }
          }
        }, [
          state.sceneIdx,
          state.frame,
          state.panelMetrics.panelW,
          state.panelMetrics.wellW,
          state.snapshot && state.snapshot.activeProject && state.snapshot.activeProject.version,
        ])

        function renderField(label, hintNode, bodyNode, key) {
          return h('div', { className: 'rd-f', key: key || label },
            h('label', null,
              label,
              hintNode ? h('span', null, hintNode) : null,
            ),
            bodyNode,
          )
        }

        function renderSvgIcon(kind) {
          var paths = null
          if (kind === 'l') {
            paths = h('path', { d: 'M13 8H3M7 4 3 8l4 4' })
          } else if (kind === 'r') {
            paths = h('path', { d: 'M3 8h10M9 4l4 4-4 4' })
          } else if (kind === 'dup') {
            paths = [
              h('rect', { key: 'a', x: 5.5, y: 5.5, width: 7.5, height: 7.5, rx: 1.5 }),
              h('path', { key: 'b', d: 'M3 10.5v-6A1.5 1.5 0 0 1 4.5 3h6' }),
            ]
          } else if (kind === 'del') {
            paths = h('path', { d: 'M3.5 4.5h9M6.5 4.5v-1h3v1M5 4.5l.5 8h5l.5-8' })
          } else if (kind === 'x') {
            return h('svg', { width: 10, height: 10, viewBox: '0 0 10 10', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' },
              h('path', { d: 'm2 2 6 6M8 2 2 8' }),
            )
          }
          return h('svg', {
            width: 14,
            height: 14,
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }, paths)
        }

        function renderMultilineListTextarea(sc, listKey, placeholder, isCode) {
          var draftKey = sc.id + ':' + listKey
          var rawVal = state.rawTextDrafts[draftKey] !== undefined
            ? state.rawTextDrafts[draftKey]
            : (sc[listKey] || []).join('\n')
          return h('textarea', {
            className: 'rd-ta' + (isCode ? ' code' : ''),
            style: isCode ? undefined : { minHeight: '96px' },
            value: rawVal,
            placeholder: placeholder || '',
            onChange: function (e) {
              var v = e.target.value
              patchState(function (prev) {
                var d = Object.assign({}, prev.rawTextDrafts)
                d[draftKey] = v
                return { rawTextDrafts: d }
              })
              var parsed = v.split(/\r?\n/).map(function (s) { return s.trim() }).filter(Boolean)
              var nextSc = Object.assign({}, sc)
              nextSc[listKey] = parsed
              scheduleScenePatch(nextSc, [listKey])
            },
            onBlur: function () {
              patchState(function (prev) {
                if (prev.rawTextDrafts[draftKey] === undefined) return {}
                var d = Object.assign({}, prev.rawTextDrafts)
                delete d[draftKey]
                return { rawTextDrafts: d }
              })
            },
          })
        }

        async function handleImportWorkspacePath(projId, curSc, curIdx) {
          var rel = String(stateRef.current.wsAssetPath || '').trim()
          if (!rel) {
            showToast('请填写当前工作区内的图片相对路径（例如 docs/shot.png）')
            return
          }
          await flushPendingSave()
          try {
            var added = await apiPost({
              action: 'add_asset',
              id: projId,
              path: rel,
              workspaceId: stateRef.current.selectedWorkspaceId || undefined,
            })
            if (curSc && curSc.kind === 'screen-shot') {
              var patched = await apiPost({
                action: 'patch_scene',
                id: projId,
                op: 'update',
                sceneIndex: curIdx,
                sceneId: curSc.id,
                scene: Object.assign({}, curSc, { asset: added.asset }),
                note: '放进截图',
              })
              var m = syncLoadedRevs(patched.snapshot, true)
              var r = computeClientRanges(patched.snapshot.activeProject.storyboard).ranges[curIdx]
              patchState({
                snapshot: patched.snapshot,
                renderer: patched.renderer,
                cellMarks: m,
                shotTool: 'pan',
                showWsAssetInput: false,
                wsAssetPath: '',
                frame: r ? r.startFrame + Math.min(r.durationInFrames - 1, 70) : stateRef.current.frame,
              })
            } else {
              var m2 = syncLoadedRevs(added.snapshot, true)
              patchState({
                snapshot: added.snapshot,
                renderer: added.renderer,
                cellMarks: m2,
                showWsAssetInput: false,
                wsAssetPath: '',
              })
            }
            showToast('已从工作区导入 ' + added.asset)
          } catch (err) {
            showToast(err.message || '导入失败')
          }
        }

        function renderSceneKindFields(proj, sb, sc, idx) {
          var k = sc.kind
          var out = []

          if (k === 'screen-shot') {
            var projAssets = (proj.assets || []).map(function (a) { return a.name })
            if (sc.asset && !projAssets.includes(sc.asset)) projAssets.unshift(sc.asset)

            out.push(renderField('截图', '可以放多张，点一张换上', h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              h('div', { className: 'rd-assets' },
                projAssets.map(function (aName) {
                  var aUrl = MEDIA_URL + '?project=' + encodeURIComponent(proj.id) + '&asset=' + encodeURIComponent(aName)
                  return h('button', {
                    key: aName,
                    type: 'button',
                    className: 'rd-asset' + (aName === sc.asset ? ' on' : ''),
                    style: { backgroundImage: 'url("' + aUrl + '")' },
                    title: aName,
                    onClick: function () {
                      scheduleScenePatch(Object.assign({}, sc, { asset: aName }), ['asset'], '换截图')
                    },
                  })
                }),
                h('button', {
                  type: 'button',
                  className: 'rd-asset add',
                  onClick: function () {
                    if (fileInputRef.current) fileInputRef.current.click()
                  },
                }, '⌘V 粘贴', h('br'), '或选文件'),
              ),
              state.showWsAssetInput
                ? h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
                    h('input', {
                      className: 'rd-in',
                      placeholder: '工作区内图片路径，如 output/shot.png',
                      value: state.wsAssetPath,
                      onChange: function (e) { patchState({ wsAssetPath: e.target.value }) },
                      onKeyDown: function (e) {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleImportWorkspacePath(proj.id, sc, idx)
                        }
                      },
                    }),
                    h('button', {
                      type: 'button',
                      className: 'rd-btn line sm',
                      onClick: function () { handleImportWorkspacePath(proj.id, sc, idx) },
                    }, '导入'),
                    h('button', {
                      type: 'button',
                      className: 'rd-btn quiet sm',
                      onClick: function () { patchState({ showWsAssetInput: false }) },
                    }, '收起'),
                  )
                : h('button', {
                    type: 'button',
                    className: 'rd-link',
                    style: { alignSelf: 'flex-start' },
                    onClick: function () { patchState({ showWsAssetInput: true }) },
                  }, '或从当前工作区按路径导入…'),
            ), 'shot-assets'))

            if (sc.asset) {
              var geom = computeShotGeometry(sb, sc, sb.assetMeta)
              var v = normalizeShotView(sc.view)
              var uw = Math.min(1, geom.vp.w / geom.dw)
              var vh = Math.min(1, geom.vp.h / geom.dh)
              var u0 = Math.max(0, Math.min(1 - uw, -geom.ox / geom.dw))
              var v0 = Math.max(0, Math.min(1 - vh, -geom.oy / geom.dh))
              var fx = sc.focus
              var fxOutOfBounds = Boolean(fx && (
                fx.x < u0 - 0.01 ||
                fx.y < v0 - 0.01 ||
                (fx.x + fx.w) > (u0 + uw + 0.01) ||
                (fx.y + fx.h) > (v0 + vh + 0.01)
              ))
              var assetUrl = MEDIA_URL + '?project=' + encodeURIComponent(proj.id) + '&asset=' + encodeURIComponent(sc.asset)
              var miniW = Math.max(68, Math.min(180, Math.round(150 * (geom.im.w / Math.max(1, geom.im.h)))))

              out.push(renderField(
                '取景',
                sb.aspect === '9:16' ? '竖屏只放得下截图的一条' : '亮框里是片子里看得到的部分',
                h('div', { className: 'rd-frame' },
                  h('div', {
                    ref: miniRef,
                    id: 'mini',
                    className: 'rd-mini',
                    title: '拖亮框选要讲的那一块',
                    style: {
                      width: 'min(100%, ' + miniW + 'px)',
                      aspectRatio: geom.im.w + ' / ' + geom.im.h,
                      backgroundImage: 'url("' + assetUrl + '")',
                    },
                    onPointerDown: function (e) {
                      e.preventDefault()
                      var r = computeClientRanges(sb).ranges[idx]
                      var mr = e.currentTarget.getBoundingClientRect()
                      if (!mr.width || !mr.height) return
                      var pu = (e.clientX - mr.left) / mr.width
                      var pv = (e.clientY - mr.top) / mr.height
                      var nextView = {
                        z: v.z,
                        x: uw < 0.999 ? Math.max(0, Math.min(1, Number(((pu - uw / 2) / (1 - uw)).toFixed(4)))) : v.x,
                        y: vh < 0.999 ? Math.max(0, Math.min(1, Number(((pv - vh / 2) / (1 - vh)).toFixed(4)))) : v.y,
                      }
                      var nextSc = Object.assign({}, sc, { view: nextView })
                      miniDragRef.current = { latestScene: nextSc }
                      var nextSnap = JSON.parse(JSON.stringify(stateRef.current.snapshot))
                      nextSnap.activeProject.storyboard.scenes[idx] = nextSc
                      patchState({
                        snapshot: nextSnap,
                        playing: false,
                        watchMode: 'board',
                        frame: r ? r.startFrame + Math.min(r.durationInFrames - 1, 70) : stateRef.current.frame,
                      })
                    },
                  },
                    h('i', {
                      className: 'vis',
                      style: {
                        left: (u0 * 100).toFixed(2) + '%',
                        top: (v0 * 100).toFixed(2) + '%',
                        width: (uw * 100).toFixed(2) + '%',
                        height: (vh * 100).toFixed(2) + '%',
                      },
                    }),
                    fx
                      ? h('i', {
                          className: 'fx',
                          style: {
                            left: (fx.x * 100).toFixed(2) + '%',
                            top: (fx.y * 100).toFixed(2) + '%',
                            width: (fx.w * 100).toFixed(2) + '%',
                            height: (fx.h * 100).toFixed(2) + '%',
                          },
                        })
                      : null,
                    sc.cursor
                      ? h('i', {
                          className: 'cu',
                          style: {
                            left: (sc.cursor.x * 100).toFixed(2) + '%',
                            top: (sc.cursor.y * 100).toFixed(2) + '%',
                          },
                        })
                      : null,
                  ),
                  h('div', { className: 'rd-fside' },
                    h('div', { className: 'rd-dur' },
                      h('input', {
                        type: 'range',
                        id: 'zoom',
                        min: 1,
                        max: 3,
                        step: 0.05,
                        value: v.z,
                        'aria-label': '放大',
                        onChange: function (e) {
                          var z = Number(e.target.value) || 1
                          scheduleScenePatch(Object.assign({}, sc, { view: { x: v.x, y: v.y, z: z } }), ['view'], '取景')
                        },
                      }),
                      h('b', { id: 'zoomN' }, v.z.toFixed(1) + '×'),
                    ),
                    h('p', { className: 'rd-note' }, '拖亮框选要讲的那一块，也可以在左边画面上直接拖。滑杆是放大。框和光标跟着截图走。'),
                    fxOutOfBounds
                      ? h('p', { className: 'rd-note warn', id: 'fxWarn' }, '框出的重点有一部分在画面外。拖一下亮框，或把框画小一点。')
                      : null,
                  ),
                ),
                'shot-framing',
              ))

              out.push(renderField('在画面上标记', '选一个，然后直接在左边画面上操作', h('div', { className: 'rd-tools' },
                [
                  { id: 'pan', label: '取景', hasVal: Boolean(sc.view) },
                  { id: 'focus', label: '框重点', hasVal: Boolean(sc.focus) },
                  { id: 'cursor', label: '放光标', hasVal: Boolean(sc.cursor) },
                ].map(function (t) {
                  var active = state.shotTool === t.id
                  return h('button', {
                    key: t.id,
                    type: 'button',
                    className: 'rd-tool' + (active ? ' on' : ''),
                    'data-tool': t.id,
                    onClick: function () {
                      var r = computeClientRanges(sb).ranges[idx]
                      patchState({
                        shotTool: active ? null : t.id,
                        playing: false,
                        watchMode: 'board',
                        frame: r ? r.startFrame + Math.min(r.durationInFrames - 1, 70) : state.frame,
                      })
                    },
                  }, t.label, t.hasVal ? h('em') : null)
                }),
                (sc.focus || sc.cursor || sc.view)
                  ? h('button', {
                      type: 'button',
                      className: 'rd-link',
                      'data-tool': 'clear',
                      onClick: function () {
                        var cleaned = Object.assign({}, sc, { focus: null, cursor: null, view: null })
                        patchState({ shotTool: null })
                        scheduleScenePatch(cleaned, ['focus', 'cursor', 'view'], '清掉标记')
                      },
                    }, '清掉标记')
                  : null,
              ), 'shot-tools'))
            }

            out.push(renderField('窗口标题栏上的字', '', h('input', {
              className: 'rd-in',
              value: sc.windowTitle || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { windowTitle: e.target.value }), ['windowTitle'])
              },
            }), 'shot-win'))
            out.push(renderField('图下面的一句说明', '留空则不显示', h('input', {
              className: 'rd-in',
              value: sc.caption || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { caption: e.target.value }), ['caption'])
              },
            }), 'shot-cap'))
            return out
          }

          if (k === 'pain-input') {
            out.push(renderField('输入框里逐字打出的那句话', '', h('input', {
              className: 'rd-in',
              value: sc.typedQuery || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { typedQuery: e.target.value }), ['typedQuery'])
              },
            }), 'pain-q'))
            out.push(renderField('按钮上的字', '', h('input', {
              className: 'rd-in',
              value: sc.ctaLabel || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { ctaLabel: e.target.value }), ['ctaLabel'])
              },
            }), 'pain-cta'))
            out.push(renderField('底部小字', '留空则不显示', h('input', {
              className: 'rd-in',
              value: sc.footnote || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { footnote: e.target.value }), ['footnote'])
              },
            }), 'pain-fn'))
            return out
          }

          if (k === 'funnel-ticker') {
            var steps = sc.steps || []
            out.push(renderField('每一级的数字和说法', '数字会滚动到位', h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              h('div', { className: 'rd-rows' },
                steps.map(function (st, si) {
                  return h('div', { className: 'rd-row num', key: si },
                    h('i', null, String(si + 1)),
                    h('input', {
                      className: 'rd-in',
                      type: 'number',
                      value: st.count,
                      onChange: function (e) {
                        var nextSteps = steps.slice()
                        nextSteps[si] = Object.assign({}, st, { count: Math.max(0, Number(e.target.value) || 0) })
                        scheduleScenePatch(Object.assign({}, sc, { steps: nextSteps }), ['steps'])
                      },
                    }),
                    h('input', {
                      className: 'rd-in',
                      value: st.unit || '',
                      onChange: function (e) {
                        var nextSteps = steps.slice()
                        nextSteps[si] = Object.assign({}, st, { unit: e.target.value })
                        scheduleScenePatch(Object.assign({}, sc, { steps: nextSteps }), ['steps'])
                      },
                    }),
                    h('input', {
                      className: 'rd-in',
                      value: st.title || '',
                      onChange: function (e) {
                        var nextSteps = steps.slice()
                        nextSteps[si] = Object.assign({}, st, { title: e.target.value })
                        scheduleScenePatch(Object.assign({}, sc, { steps: nextSteps }), ['steps'])
                      },
                    }),
                    h('button', {
                      type: 'button',
                      title: '删掉这一级',
                      disabled: steps.length <= 2,
                      onClick: function () {
                        if (steps.length <= 2) return
                        var nextSteps = steps.filter(function (_, k2) { return k2 !== si })
                        scheduleScenePatch(Object.assign({}, sc, { steps: nextSteps }), ['steps'])
                      },
                    }, renderSvgIcon('x')),
                  )
                }),
              ),
              steps.length < 4
                ? h('button', {
                    type: 'button',
                    className: 'rd-more',
                    onClick: function () {
                      var nextSteps = steps.concat([{ count: 1, unit: '项', title: '新筛选层级' }])
                      scheduleScenePatch(Object.assign({}, sc, { steps: nextSteps }), ['steps'])
                    },
                  }, '＋ 加一级（最多 4 级）')
                : null,
            ), 'ft-steps'))
            out.push(renderField('筛除说明前缀', '留空则不显示前缀', h('input', {
              className: 'rd-in',
              value: sc.excludedLabel || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { excludedLabel: e.target.value }), ['excludedLabel'])
              },
            }), 'ft-exlbl'))
            out.push(renderField('底部一行小标签', '每行一个', renderMultilineListTextarea(sc, 'excluded', '每行一条筛除说明', false), 'ft-ex'))
            return out
          }

          if (k === 'lego-snap') {
            var blocks = sc.blocks || []
            out.push(renderField('模块', '最后一块可以从「待补」亮成「已通」', h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              blocks.map(function (blk, bi) {
                return h('div', { className: 'rd-block-card', key: bi },
                  h('div', { className: 'hd' },
                    h('span', null, '模块 ' + (bi + 1)),
                    blocks.length > 2
                      ? h('button', {
                          type: 'button',
                          title: '删掉这一块',
                          onClick: function () {
                            var nb = blocks.filter(function (_, k2) { return k2 !== bi })
                            scheduleScenePatch(Object.assign({}, sc, { blocks: nb }), ['blocks'])
                          },
                        }, renderSvgIcon('x'))
                      : null,
                  ),
                  h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '6px' } },
                    h('input', {
                      className: 'rd-in',
                      placeholder: '模块名称',
                      value: blk.name || '',
                      onChange: function (e) {
                        var nb = blocks.slice()
                        nb[bi] = Object.assign({}, blk, { name: e.target.value })
                        scheduleScenePatch(Object.assign({}, sc, { blocks: nb }), ['blocks'])
                      },
                    }),
                    h('input', {
                      className: 'rd-in',
                      placeholder: '职责描述',
                      value: blk.role || '',
                      onChange: function (e) {
                        var nb = blocks.slice()
                        nb[bi] = Object.assign({}, blk, { role: e.target.value })
                        scheduleScenePatch(Object.assign({}, sc, { blocks: nb }), ['blocks'])
                      },
                    }),
                  ),
                  h('div', { style: { display: 'grid', gridTemplateColumns: blk.status === 'gap-to-solved' ? '1.1fr 0.9fr 0.9fr' : '1.1fr 1fr', gap: '6px' } },
                    h('select', {
                      className: 'rd-sel',
                      value: blk.status || 'ready',
                      onChange: function (e) {
                        var nb = blocks.slice()
                        nb[bi] = Object.assign({}, blk, { status: e.target.value })
                        scheduleScenePatch(Object.assign({}, sc, { blocks: nb }), ['blocks'])
                      },
                    },
                      h('option', { value: 'ready' }, '现成点亮'),
                      h('option', { value: 'gap' }, '虚线待补'),
                      h('option', { value: 'gap-to-solved' }, '待补 → 已跑通'),
                    ),
                    h('input', {
                      className: 'rd-in',
                      placeholder: '初始角标',
                      value: blk.tag || '',
                      onChange: function (e) {
                        var nb = blocks.slice()
                        nb[bi] = Object.assign({}, blk, { tag: e.target.value })
                        scheduleScenePatch(Object.assign({}, sc, { blocks: nb }), ['blocks'])
                      },
                    }),
                    blk.status === 'gap-to-solved'
                      ? h('input', {
                          className: 'rd-in',
                          placeholder: '跑通后角标',
                          value: blk.solvedTag || '',
                          onChange: function (e) {
                            var nb = blocks.slice()
                            nb[bi] = Object.assign({}, blk, { solvedTag: e.target.value })
                            scheduleScenePatch(Object.assign({}, sc, { blocks: nb }), ['blocks'])
                          },
                        })
                      : null,
                  ),
                )
              }),
              blocks.length < 3
                ? h('button', {
                    type: 'button',
                    className: 'rd-more',
                    onClick: function () {
                      var nb = blocks.concat([{ name: '新模块', role: '补充配合职责', status: 'gap-to-solved', tag: '待补', solvedTag: '已跑通' }])
                      scheduleScenePatch(Object.assign({}, sc, { blocks: nb }), ['blocks'])
                    },
                  }, '＋ 加一块（最多 3 块）')
                : null,
            ), 'ls-blocks'))
            out.push(renderField('右下角按钮上的字', '留空则不显示', h('input', {
              className: 'rd-in',
              value: sc.ctaLabel || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { ctaLabel: e.target.value }), ['ctaLabel'])
              },
            }), 'ls-cta'))
            out.push(renderField('底部说明', '留空则不显示', h('input', {
              className: 'rd-in',
              value: sc.footnote || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { footnote: e.target.value }), ['footnote'])
              },
            }), 'ls-fn'))
            return out
          }

          if (k === 'dual-showcase') {
            out.push(renderField('浅色卡片的小标题与副标题', '', h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              h('input', {
                className: 'rd-in',
                placeholder: '浅色卡片主标题',
                value: sc.lightCardTitle || '',
                onChange: function (e) {
                  scheduleScenePatch(Object.assign({}, sc, { lightCardTitle: e.target.value }), ['lightCardTitle'])
                },
              }),
              h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 96px', gap: '6px' } },
                h('input', {
                  className: 'rd-in',
                  placeholder: '浅色卡片副标题',
                  value: sc.lightCardSub || '',
                  onChange: function (e) {
                    scheduleScenePatch(Object.assign({}, sc, { lightCardSub: e.target.value }), ['lightCardSub'])
                  },
                }),
                h('input', {
                  className: 'rd-in',
                  type: 'number',
                  min: 0,
                  max: 24,
                  title: '示意格数（0 为不显示）',
                  value: sc.lightBrickCount != null ? sc.lightBrickCount : 0,
                  onChange: function (e) {
                    scheduleScenePatch(Object.assign({}, sc, { lightBrickCount: Math.max(0, Math.min(24, Number(e.target.value) || 0)) }), ['lightBrickCount'])
                  },
                }),
              ),
            ), 'ds-light'))
            out.push(renderField('深色卡片眉标与主句', '', h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              h('input', {
                className: 'rd-in',
                placeholder: '深色卡片顶部小字（可选）',
                value: sc.darkCardEyebrow || '',
                onChange: function (e) {
                  scheduleScenePatch(Object.assign({}, sc, { darkCardEyebrow: e.target.value }), ['darkCardEyebrow'])
                },
              }),
              h('textarea', {
                className: 'rd-ta',
                value: sc.darkCardTitle || '',
                onChange: function (e) {
                  scheduleScenePatch(Object.assign({}, sc, { darkCardTitle: e.target.value }), ['darkCardTitle'])
                },
              }),
            ), 'ds-dark'))
            out.push(renderField('深色卡片右上角', '', h('input', {
              className: 'rd-in',
              value: sc.darkCardBadge || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { darkCardBadge: e.target.value }), ['darkCardBadge'])
              },
            }), 'ds-badge'))
            out.push(renderField('两个按钮上的字', '', h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } },
              h('input', {
                className: 'rd-in',
                placeholder: '主按钮',
                value: sc.ctaPrimary || '',
                onChange: function (e) {
                  scheduleScenePatch(Object.assign({}, sc, { ctaPrimary: e.target.value }), ['ctaPrimary'])
                },
              }),
              h('input', {
                className: 'rd-in',
                placeholder: '次按钮',
                value: sc.ctaSecondary || '',
                onChange: function (e) {
                  scheduleScenePatch(Object.assign({}, sc, { ctaSecondary: e.target.value }), ['ctaSecondary'])
                },
              }),
            ), 'ds-ctas'))
            return out
          }

          if (k === 'code-diff') {
            out.push(renderField('对比的旧做法', '', h('input', {
              className: 'rd-in',
              value: sc.beforeLabel || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { beforeLabel: e.target.value }), ['beforeLabel'])
              },
            }), 'cd-bef'))
            out.push(renderField('文件名', '', h('input', {
              className: 'rd-in',
              value: sc.fileLabel || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { fileLabel: e.target.value }), ['fileLabel'])
              },
            }), 'cd-file'))
            out.push(renderField('逐行出现的代码', '每行一条，最多 6 行', renderMultilineListTextarea(sc, 'codeLines', '每行一条命令或代码', true), 'cd-lines'))
            out.push(renderField('底部徽章', '留空则不显示', h('input', {
              className: 'rd-in',
              value: sc.badge || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { badge: e.target.value }), ['badge'])
              },
            }), 'cd-badge'))
            return out
          }

          if (k === 'quote-kinetic') {
            out.push(renderField('逐行弹出的金句', '每行一张卡，最多 4 行', renderMultilineListTextarea(sc, 'lines', '按回车换行，每行一张金句卡', false), 'qk-lines'))
            out.push(renderField('底部小字', '留空则不显示', h('input', {
              className: 'rd-in',
              value: sc.footnote || '',
              onChange: function (e) {
                scheduleScenePatch(Object.assign({}, sc, { footnote: e.target.value }), ['footnote'])
              },
            }), 'qk-fn'))
            return out
          }

          // end-cta
          out.push(renderField('顶部徽章', '留空则不显示', h('input', {
            className: 'rd-in',
            value: sc.badge || '',
            onChange: function (e) {
              scheduleScenePatch(Object.assign({}, sc, { badge: e.target.value }), ['badge'])
            },
          }), 'ec-badge'))
          out.push(renderField('按钮上的字', '', h('input', {
            className: 'rd-in',
            value: sc.ctaLabel || '',
            onChange: function (e) {
              scheduleScenePatch(Object.assign({}, sc, { ctaLabel: e.target.value }), ['ctaLabel'])
            },
          }), 'ec-cta'))
          out.push(renderField('最下面一行小字', '留空则不显示', h('input', {
            className: 'rd-in',
            value: sc.subline || '',
            onChange: function (e) {
              scheduleScenePatch(Object.assign({}, sc, { subline: e.target.value }), ['subline'])
            },
          }), 'ec-sub'))
          return out
        }


        function renderAskSceneBlock(proj, sb, sc, idx, kit) {
          if (state.capabilities && state.capabilities.inlineRewrite === false) {
            return null
          }
          var sug = state.sugState
          var bodyNode = null
          if (sug === 'loading') {
            bodyNode = h(React.Fragment, null,
              h('div', { className: 'rd-alts' },
                [0, 1, 2].map(function (i) {
                  return h('div', { key: i, className: 'rd-alt sk' },
                    h('div', { className: 'pic' }),
                    h('div', null, h('b', null, '\u00a0'), h('span', null, '\u00a0')),
                  )
                }),
              ),
              h('p', { className: 'rd-note' },
                'DeepSeek 在写，只看了这一镜和片子的简介。　',
                h('button', {
                  type: 'button',
                  className: 'rd-link',
                  'data-sug': 'cancel',
                  onClick: function () {
                    if (sugAbortRef.current) {
                      try { sugAbortRef.current.abort() } catch (_e) {}
                      sugAbortRef.current = null
                    }
                    patchState({ sugState: null, sugCandidates: [], sugError: '' })
                  },
                }, '不等了'),
              ),
            )
          } else if (sug === 'ready' || sug === 'picked') {
            bodyNode = h(React.Fragment, null,
              h('div', { className: 'rd-alts' },
                (state.sugCandidates || []).map(function (cand, ci) {
                  var candSc = cand.scene || Object.assign({}, sc, cand.patch || {})
                  var candSb = Object.assign({}, sb, { scenes: [candSc] })
                  var isPicked = sug === 'picked' && sc.headline === candSc.headline
                  var dur = candSc.durationInFrames || 180
                  return h('button', {
                    key: ci,
                    type: 'button',
                    className: 'rd-alt' + (isPicked ? ' on' : ''),
                    'data-alt': String(ci),
                    onClick: function () {
                      var changed = Object.keys(cand.patch || { headline: candSc.headline })
                      patchState({ sugState: 'picked' })
                      scheduleScenePatch(candSc, changed.length ? changed : ['headline'], '换成 DeepSeek 的写法')
                    },
                  },
                    h(ScaledFrameBox, {
                      React: React,
                      className: 'pic',
                      storyboard: candSb,
                      brandKit: kit,
                      projectId: proj.id,
                      frame: Math.round(dur * 0.72),
                      cover: true,
                    }),
                    h('div', null,
                      h('b', null, candSc.headline || ''),
                      h('span', null, cand.why || ''),
                    ),
                  )
                }),
              ),
              h('p', { className: 'rd-note' },
                sug === 'picked' ? '已换上，其余字段没动。　' : '原稿没动，点一个才换上。　',
                h('button', {
                  type: 'button',
                  className: 'rd-link',
                  'data-sug': 'again',
                  onClick: function () { runSuggestScene() },
                }, '再来三个'),
                '　',
                h('button', {
                  type: 'button',
                  className: 'rd-link',
                  'data-sug': 'cancel',
                  onClick: function () { patchState({ sugState: null, sugCandidates: [], sugError: '' }) },
                }, '都不要'),
              ),
            )
          } else if (sug === 'error') {
            bodyNode = h('p', { className: 'rd-note warn' },
              state.sugError || '暂时没拿到改写候选。',
              '　',
              h('button', {
                type: 'button',
                className: 'rd-link',
                onClick: function () { runSuggestScene() },
              }, '再试一次'),
              '　',
              h('button', {
                type: 'button',
                className: 'rd-link',
                onClick: function () {
                  var prompt = '请把《' + sb.title + '》（id="' + proj.id + '"）的第 ' + (idx + 1) + ' 镜「' + sc.label + '」按这个方向改一下：' + (state.sugText || '更口语一点')
                  reopenOrHandoffFilmSession(hostCtx, {
                    sessionId: proj.origin && proj.origin.sessionId,
                    workspaceId: (proj.origin && proj.origin.workspaceId) || state.selectedWorkspaceId,
                    projectId: proj.id,
                    projectTitle: sb.title,
                    prompt: prompt,
                    serverWorkspaces: state.serverWorkspaces,
                  }, showToast)
                },
              }, '去对话里说'),
            )
          }

          return h('div', { className: 'rd-ask' },
            h('h3', null, DsBadge(React), '让 DeepSeek 改这一镜'),
            h('div', { className: 'rd-askbox' },
              h('textarea', {
                id: 'ask',
                placeholder: '想怎么改？比如：口语一点，把数字放到最前面',
                value: state.sugText,
                onChange: function (e) { patchState({ sugText: e.target.value }) },
                onKeyDown: function (e) {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    runSuggestScene()
                  }
                },
              }),
              h('button', {
                type: 'button',
                className: 'rd-btn line sm',
                'data-sug': 'go',
                onClick: function () { runSuggestScene() },
              }, '写三个改法'),
            ),
            !sug
              ? h('div', { className: 'rd-quick' },
                  ['口语一点', '短一点', '换个角度'].map(function (q) {
                    return h('button', {
                      key: q,
                      type: 'button',
                      'data-q': q,
                      onClick: function () { runSuggestScene(q) },
                    }, q)
                  }),
                )
              : null,
            bodyNode,
            !sug
              ? h('p', { className: 'rd-note' }, '就在这里改，不跳走。要它读工作区、重排整条片，去「整片」。')
              : null,
          )
        }

        function renderClashBlock(proj, sb, sc, idx, kit) {
          var c = state.clash
          if (!c || c.sceneId !== sc.id) return null
          var fieldLbl = FIELD_LABELS[c.field] || c.field
          var mineSb = Object.assign({}, sb, { scenes: [c.mineScene] })
          var theirsSb = Object.assign({}, sb, { scenes: [c.theirsScene] })
          var mineVal = Array.isArray(c.mineScene[c.field]) ? c.mineScene[c.field].join(' / ') : String(c.mineScene[c.field] || c.mineScene.headline || '')
          var theirsVal = Array.isArray(c.theirsScene[c.field]) ? c.theirsScene[c.field].join(' / ') : String(c.theirsScene[c.field] || c.theirsScene.headline || '')

          return h('div', { className: 'rd-clash', role: 'alert' },
            h('p', null,
              h('b', null, '你和 DeepSeek 都改了这一镜的' + fieldLbl),
              '画面上是你的写法，没有被盖掉。',
              c.mergedText ? ('它另外改的「' + c.mergedText + '」和你不冲突，已经合进来。') : '',
            ),
            h('div', { className: 'rd-alts' },
              h('button', {
                type: 'button',
                className: 'rd-alt on',
                'data-clash': 'mine',
                onClick: async function () {
                  try {
                    var res = await apiPost({
                      action: 'patch_scene',
                      id: proj.id,
                      op: 'update',
                      sceneIndex: idx,
                      sceneId: sc.id,
                      forceResolveConflict: true,
                      scene: c.mineScene,
                      note: '留我的写法（第 ' + (idx + 1) + ' 镜）',
                    })
                    var m = syncLoadedRevs(res.snapshot, true)
                    delete m[sc.id]
                    patchState({
                      snapshot: res.snapshot,
                      renderer: res.renderer,
                      cellMarks: m,
                      clash: null,
                    })
                  } catch (err) {
                    showToast(err.message)
                  }
                },
              },
                h(ScaledFrameBox, {
                  React: React,
                  className: 'pic',
                  storyboard: mineSb,
                  brandKit: kit,
                  projectId: proj.id,
                  frame: Math.round((c.mineScene.durationInFrames || 180) * 0.72),
                  cover: true,
                }),
                h('div', null,
                  h('b', null, mineVal),
                  h('span', null, h('em', null, '留我的'), '　刚才在这里打的'),
                ),
              ),
              h('button', {
                type: 'button',
                className: 'rd-alt',
                'data-clash': 'theirs',
                onClick: async function () {
                  discardedMineRef.current = {
                    projectId: proj.id,
                    sceneId: sc.id,
                    sceneIndex: idx,
                    scene: JSON.parse(JSON.stringify(c.mineScene)),
                    label: sc.label,
                  }
                  try {
                    var fresh = await apiGet({ project: proj.id })
                    var m = syncLoadedRevs(fresh.snapshot, true)
                    m[sc.id] = 'ds'
                    patchState({
                      snapshot: fresh.snapshot,
                      renderer: fresh.renderer || stateRef.current.renderer,
                      cellMarks: m,
                      clash: null,
                    })
                    showToast('已改用 DeepSeek 的写法（点撤销可恢复你刚才打的字）')
                  } catch (err) {
                    showToast(err.message)
                  }
                },
              },
                h(ScaledFrameBox, {
                  React: React,
                  className: 'pic',
                  storyboard: theirsSb,
                  brandKit: kit,
                  projectId: proj.id,
                  frame: Math.round((c.theirsScene.durationInFrames || 180) * 0.72),
                  cover: true,
                }),
                h('div', null,
                  h('b', null, theirsVal),
                  h('span', null, h('em', null, '用 DeepSeek 的'), '　' + (c.serverNote || '按刚才的要求改的')),
                ),
              ),
            ),
            h('p', { className: 'rd-note' }, '点一个留下，选错了可以撤销。没选之前，存下来的是 DeepSeek 那一版，导出用的也是它。'),
          )
        }

        function renderNoteBar(proj, sb, tl) {
          if (!proj || !sb) return h('div', { className: 'rd-note-bar', id: 'noteBar', role: 'status' })

          if (state.sysNote) {
            var sn = state.sysNote
            return h('div', { className: 'rd-note-bar show sys', id: 'noteBar', role: 'status' },
              h('p', null, h('b', null, sn.titleBold), sn.restText || ''),
              sn.gotoIdx != null
                ? h('button', {
                    type: 'button',
                    className: 'rd-btn line sm',
                    onClick: function () {
                      var gi = sn.gotoIdx
                      var r = tl.ranges[gi]
                      patchState({
                        sysNote: null,
                        inspTab: 'scene',
                        sceneIdx: gi,
                        shotTool: 'pan',
                        frame: r ? r.startFrame + Math.min(r.durationInFrames - 1, Math.round(r.durationInFrames * 0.6)) : 48,
                      })
                    },
                  }, '去看第 ' + (sn.gotoIdx + 1) + ' 镜')
                : null,
              h('button', {
                type: 'button',
                className: 'rd-btn quiet sm',
                onClick: function () { patchState({ sysNote: null }) },
              }, '知道了'),
            )
          }

          var ac = proj.agentChanges
          if (!ac) return h('div', { className: 'rd-note-bar', id: 'noteBar', role: 'status' })
          if (ac.kind === 'created' && ackedCreateProjectRef.current[proj.id]) {
            return h('div', { className: 'rd-note-bar', id: 'noteBar', role: 'status' })
          }

          var sid = ac.sessionId || (proj.origin && proj.origin.sessionId)
          if (ac.kind === 'created') {
            return h('div', { className: 'rd-note-bar show', id: 'noteBar', role: 'status' },
              DsBadge(React),
              h('p', null,
                h('b', null, 'DeepSeek 刚排好这条片'),
                '：' + sb.scenes.length + ' 镜，' + tl.totalSec.toFixed(1) + ' 秒。先整条放一遍，哪一镜不对就点哪一镜改。',
              ),
              sid
                ? h('button', {
                    type: 'button',
                    className: 'rd-btn line sm',
                    onClick: function () { openExistingSessionOnly(hostCtx, sid, showToast) },
                  }, '回到那条对话')
                : null,
              h('button', {
                type: 'button',
                className: 'rd-btn quiet sm',
                onClick: function () {
                  ackedCreateProjectRef.current[proj.id] = true
                  apiPost({ action: 'ack_changes', id: proj.id }).then(function (d) {
                    patchState({ snapshot: d.snapshot, cellMarks: {} })
                  }).catch(function () {})
                },
              }, '知道了'),
            )
          }

          // ac.kind === 'patched'
          var changedNums = (ac.sceneIds || []).map(function (id) {
            var k = sb.scenes.findIndex(function (s) { return s.id === id })
            return k >= 0 ? (k + 1) : null
          }).filter(Boolean)
          var numsStr = changedNums.length ? ('第 ' + changedNums.join('、') + ' 镜') : '部分分镜'
          var durSummary = (ac.prevDurationSec != null && ac.nextDurationSec != null && ac.prevDurationSec !== ac.nextDurationSec)
            ? ('，总长 ' + Number(ac.prevDurationSec).toFixed(1) + ' → ' + Number(ac.nextDurationSec).toFixed(1) + ' 秒')
            : ''

          return h('div', { className: 'rd-note-bar show', id: 'noteBar', role: 'status' },
            DsBadge(React),
            state.clash
              ? h('p', null,
                  h('b', null, 'DeepSeek 改了' + numsStr + '。'),
                  '第 ' + (state.clash.sceneIndex + 1) + ' 镜你也正在改，两边都动了' + (FIELD_LABELS[state.clash.field] || state.clash.field) + '，等你选一个。',
                )
              : h('p', null,
                  h('b', null, 'DeepSeek 改了' + numsStr),
                  durSummary + '。点开那一镜可对比改之前与改之后。',
                ),
            ac.baseVersion >= 1
              ? h('button', {
                  type: 'button',
                  className: 'rd-btn line sm',
                  onClick: function () {
                    apiPost({ action: 'restore_version', id: proj.id, version: ac.baseVersion }).then(function (d) {
                      var m = syncLoadedRevs(d.snapshot, false)
                      patchState({ snapshot: d.snapshot, renderer: d.renderer, cellMarks: m, clash: null, showBefore: false })
                      showToast('已全部退回到第 ' + ac.baseVersion + ' 版')
                    }).catch(function (err) { showToast(err.message) })
                  },
                }, '全部退回')
              : null,
            sid
              ? h('button', {
                  type: 'button',
                  className: 'rd-btn line sm',
                  onClick: function () { openExistingSessionOnly(hostCtx, sid, showToast) },
                }, '回到那条对话')
              : null,
            h('button', {
              type: 'button',
              className: 'rd-btn quiet sm',
              onClick: function () {
                apiPost({ action: 'ack_changes', id: proj.id }).then(function (d) {
                  patchState({ snapshot: d.snapshot, cellMarks: {}, showBefore: false })
                }).catch(function () {})
              },
            }, '知道了'),
          )
        }


        async function startExportRender(overrideOpts) {
          await flushPendingSave()
          var cur = stateRef.current
          var proj = cur.snapshot && cur.snapshot.activeProject
          if (!proj) return
          var opts = Object.assign({}, cur.exportOpts, overrideOpts || {})
          patchState({ pop: null, popCtx: null, showErrorLog: false })
          try {
            var res = await apiPost({
              action: 'start_render',
              id: proj.id,
              quality: opts.quality || 'full',
              format: opts.format || 'mp4',
            })
            patchState({
              snapshot: res.snapshot,
              renderer: res.renderer,
            })
          } catch (err) {
            if (err && err.data && err.data.renderer) {
              patchState({
                snapshot: err.data.snapshot || cur.snapshot,
                renderer: err.data.renderer,
              })
            } else {
              showToast(err.message || '启动导出失败')
            }
          }
        }

        function resolveLatestProjectRender(proj) {
          if (!proj) return null
          var job = state.renderer && state.renderer.activeJob
          if (job && job.projectId === proj.id && job.stage === 'done' && (job.fileName || job.file)) {
            return {
              file: job.fileName || job.file,
              outputPath: job.outputPath,
              format: job.format || 'mp4',
              quality: job.quality || 'full',
              version: job.version || proj.version,
              elapsedMs: job.elapsedMs,
              bytes: job.bytes,
            }
          }
          var r0 = proj.renders && proj.renders[0]
          if (!r0) return null
          return {
            file: r0.file || r0.fileName,
            outputPath: r0.outputPath,
            format: r0.format || (r0.spec && r0.spec.format) || 'mp4',
            quality: r0.quality || (r0.spec && r0.spec.quality) || 'full',
            version: r0.version || 1,
            elapsedMs: r0.elapsedMs,
            bytes: r0.bytes,
          }
        }

        function renderBand(proj, sb, kit, tl) {
          if (!proj || !sb) return h('div', { className: 'rd-band', id: 'band' })
          var job = state.renderer && state.renderer.activeJob
          var activeForThis = job && job.projectId === proj.id ? job : null
          var isRunning = Boolean(activeForThis && ['bootstrapping', 'bundling', 'rendering'].includes(activeForThis.stage))

          if (isRunning) {
            var stage = activeForThis.stage
            var totalF = activeForThis.totalFrames || tl.totalFrames
            var doneF = activeForThis.renderedFrames || 0
            var pct = stage === 'rendering'
              ? Math.max(1, Math.min(99, Math.round((doneF / Math.max(1, totalF)) * 100)))
              : (activeForThis.percent || 8)
            var isIndet = stage === 'bootstrapping' || stage === 'bundling'

            return h('div', { className: 'rd-band show', id: 'band', role: 'status' },
              h('div', { className: 't' },
                h('b', null,
                  stage === 'bootstrapping'
                    ? '正在准备合成环境（首次下载 Remotion 依赖）…'
                    : stage === 'bundling'
                      ? '正在打包画面代码…'
                      : ('正在合成画面　' + doneF + ' / ' + totalF + ' 帧'),
                ),
                h('span', null, '导出用的是点「开始」那一刻的分镜（第 ' + (activeForThis.version || proj.version) + ' 版）。现在可以继续改，改动算进下一次导出。'),
              ),
              h('button', {
                type: 'button',
                className: 'rd-btn line',
                onClick: function () {
                  apiPost({ action: 'cancel_render', id: proj.id }).then(function (d) {
                    patchState({ renderer: d.renderer, snapshot: d.snapshot })
                    showToast('已取消导出')
                  }).catch(function (err) { showToast(err.message) })
                },
              }, '取消导出'),
              h('div', { className: 'rd-steps' },
                h('span', { className: stage === 'bootstrapping' ? 'now' : 'ok' }, '准备合成环境'),
                h('span', { className: stage === 'bundling' ? 'now' : (stage === 'rendering' ? 'ok' : '') }, '打包画面代码'),
                h('span', { className: stage === 'rendering' ? 'now' : '' }, stage === 'rendering' ? ('合成画面 ' + pct + '%') : '合成画面'),
                h('span', null, '写入文件'),
              ),
              h('div', { className: 'bar' + (isIndet ? ' indet' : '') },
                h('i', { style: isIndet ? undefined : { width: pct + '%' } }),
              ),
            )
          }

          if (activeForThis && activeForThis.stage === 'failed') {
            var det = activeForThis.errorDetail || {}
            var errTitle = det.title || ('导出没成功：' + (activeForThis.error || '未知错误'))
            var errHint = det.hint || '合成未完成，分镜没有任何改动。排查后可点「再试一次」。'
            var logText = activeForThis.logTail || activeForThis.error || ''

            return h('div', { className: 'rd-band show err', id: 'band', role: 'alert' },
              h('div', { className: 't' },
                h('b', null, errTitle),
                h('span', null, errHint),
              ),
              h('button', {
                type: 'button',
                className: 'rd-btn pri',
                onClick: function () {
                  startExportRender({ quality: activeForThis.quality || 'full', format: activeForThis.format || 'mp4' })
                },
              }, '再试一次'),
              logText
                ? h('button', {
                    type: 'button',
                    className: 'rd-btn quiet',
                    onClick: function () { patchState({ showErrorLog: !state.showErrorLog }) },
                  }, state.showErrorLog ? '收起日志' : '看日志')
                : null,
              h('button', {
                type: 'button',
                className: 'rd-btn quiet',
                onClick: function () {
                  apiPost({ action: 'clear_render_error', id: proj.id }).then(function (d) {
                    patchState({ renderer: d.renderer, showErrorLog: false })
                  }).catch(function () {})
                },
              }, '关闭'),
              state.showErrorLog && logText
                ? h('pre', { className: 'rd-log' }, logText)
                : null,
            )
          }

          var latest = resolveLatestProjectRender(proj)
          if (!latest || !latest.file) return h('div', { className: 'rd-band', id: 'band' })

          var staleCount = (latest.version && proj.version > latest.version) ? (proj.version - latest.version) : 0
          var fmtUpper = String(latest.format || 'mp4').toUpperCase()
          var specStr = sb.width + '×' + sb.height + ' · ' + tl.totalSec.toFixed(1) + ' 秒 · ' + fmtUpper
          var canWechat = Boolean(state.capabilities && state.capabilities.wechat)

          if (staleCount > 0) {
            return h('div', { className: 'rd-band show stale', id: 'band' },
              h(ScaledFrameBox, {
                React: React,
                className: 'thumb',
                storyboard: sb,
                brandKit: kit,
                projectId: proj.id,
                frame: Math.round(tl.totalFrames * 0.3),
                cover: true,
                fallbackW: 96,
                fallbackH: 54,
              }),
              h('div', { className: 't' },
                h('b', null, '成片是第 ' + latest.version + ' 版，之后分镜又改了 ' + staleCount + ' 处'),
                h('span', null, '文件还在，只是不是最新的。'),
              ),
              h('button', {
                type: 'button',
                className: 'rd-btn pri',
                onClick: function () {
                  startExportRender({ quality: latest.quality || 'full', format: latest.format || 'mp4' })
                },
              }, '重新导出'),
              h('button', {
                type: 'button',
                className: 'rd-btn line',
                onClick: function () { patchState({ watchMode: 'file', playing: false }) },
              }, '看旧成片'),
              h('button', {
                type: 'button',
                className: 'rd-btn line',
                onClick: function () {
                  apiPost({ action: 'reveal_in_finder', id: proj.id, fileName: latest.file }).catch(function (err) {
                    showToast(err.message)
                  })
                },
              }, '在访达中显示'),
            )
          }

          return h('div', { className: 'rd-band show', id: 'band' },
            h(ScaledFrameBox, {
              React: React,
              className: 'thumb',
              storyboard: sb,
              brandKit: kit,
              projectId: proj.id,
              frame: Math.round(tl.totalFrames * 0.3),
              cover: true,
              fallbackW: 96,
              fallbackH: 54,
            }),
            h('div', { className: 't' },
              h('b', null, '成片已导出 · 第 ' + latest.version + ' 版'),
              h('span', null, specStr + '　存在 ~/.dsh/reel-desk/projects/' + proj.id + '/renders/'),
            ),
            h('button', {
              type: 'button',
              className: 'rd-btn pri',
              onClick: function () { patchState({ watchMode: 'file', playing: false }) },
            }, '看成片'),
            h('button', {
              type: 'button',
              className: 'rd-btn line',
              onClick: function () {
                apiPost({ action: 'reveal_in_finder', id: proj.id, fileName: latest.file }).catch(function (err) {
                  showToast(err.message)
                })
              },
            }, '在访达中显示'),
            h('button', {
              type: 'button',
              className: 'rd-btn line',
              onClick: function () {
                var p = latest.outputPath || ('~/.dsh/reel-desk/projects/' + proj.id + '/renders/' + latest.file)
                if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(p).then(function () { showToast('已拷贝成片路径') }).catch(function () {})
                } else {
                  showToast(p)
                }
              },
            }, '拷贝文件路径'),
            canWechat
              ? h('button', {
                  type: 'button',
                  className: 'rd-btn line',
                  onClick: function () {
                    apiPost({ action: 'send_wechat', id: proj.id, fileName: latest.file }).then(function () {
                      showToast('已投递到微信手机端')
                    }).catch(function (err) { showToast(err.message) })
                  },
                }, '发到微信')
              : null,
          )
        }

        function renderPopover(proj, sb, kit, tl) {
          if (!state.pop) return h('div', { className: 'rd-pop', id: 'pop' })
          var pop = state.pop
          var pCtx = state.popCtx || {}
          var stylePos = { left: state.popPos.left + 'px', top: state.popPos.top + 'px' }

          if (pop === 'kind') {
            var isSwap = pCtx.swap != null
            var targetIdx = isSwap ? pCtx.swap : (pCtx.at != null ? pCtx.at : (sb ? sb.scenes.length : 0))
            var curSc = (isSwap && sb && sb.scenes[targetIdx]) ? sb.scenes[targetIdx] : null

            return h('div', { className: 'rd-pop show wide', id: 'pop', style: stylePos },
              h('div', null,
                h('h3', null, isSwap
                  ? ('把第 ' + (targetIdx + 1) + ' 镜换成另一种样式')
                  : (sb && targetIdx >= sb.scenes.length ? '在最后加一镜' : ('在第 ' + targetIdx + ' 镜后面加一镜'))),
                h('p', { className: 'sub' }, isSwap
                  ? '主标题、小字和时长会留下，其余内容按新样式重新填。'
                  : '每一种都用这条片的配色画给你看。'),
              ),
              h('div', { className: 'rd-kinds' },
                SCENE_KINDS.map(function (kDef) {
                  var starter = createKindStarterScene(kDef.kind, targetIdx)
                  var previewSb = sb ? Object.assign({}, sb, { scenes: [starter] }) : null
                  var isCur = Boolean(curSc && curSc.kind === kDef.kind)
                  return h('button', {
                    key: kDef.kind,
                    type: 'button',
                    className: 'rd-kcard' + (isCur ? ' cur' : ''),
                    'data-kind': kDef.kind,
                    onClick: async function () {
                      if (!proj || !sb) return
                      await flushPendingSave()
                      patchState({ pop: null, popCtx: null })
                      try {
                        var nextSc
                        var res
                        if (isSwap && curSc) {
                          nextSc = Object.assign({}, starter, {
                            id: curSc.id,
                            label: curSc.label,
                            headline: curSc.headline,
                            eyebrow: curSc.eyebrow,
                            durationSec: curSc.durationSec,
                            durationInFrames: curSc.durationInFrames,
                          })
                          res = await apiPost({
                            action: 'patch_scene',
                            id: proj.id,
                            op: 'update',
                            sceneIndex: targetIdx,
                            sceneId: curSc.id,
                            scene: nextSc,
                            note: '把第 ' + (targetIdx + 1) + ' 镜换成「' + kDef.label + '」',
                          })
                        } else {
                          nextSc = Object.assign({}, starter, { label: kDef.label })
                          res = await apiPost({
                            action: 'patch_scene',
                            id: proj.id,
                            op: 'insert',
                            sceneIndex: targetIdx,
                            scene: nextSc,
                            note: '加一镜「' + kDef.label + '」',
                          })
                        }
                        var m = syncLoadedRevs(res.snapshot, true)
                        var newTl = computeClientRanges(res.snapshot.activeProject.storyboard)
                        var r = newTl.ranges[targetIdx] || newTl.ranges[0]
                        patchState({
                          snapshot: res.snapshot,
                          renderer: res.renderer,
                          cellMarks: m,
                          inspTab: 'scene',
                          sceneIdx: targetIdx,
                          shotTool: null,
                          frame: r ? Math.round(r.startFrame + r.durationInFrames * (kDef.kind === 'screen-shot' ? 0.45 : 0.78)) : 36,
                        })
                      } catch (err) {
                        showToast(err.message)
                      }
                    },
                  },
                    previewSb
                      ? h(ScaledFrameBox, {
                          React: React,
                          className: 'pic',
                          storyboard: previewSb,
                          brandKit: kit,
                          projectId: proj.id,
                          frame: Math.round((starter.durationInFrames || 180) * 0.72),
                          cover: true,
                        })
                      : h('div', { className: 'pic' }),
                    h('p', null, kDef.label, h('span', null, kDef.fit)),
                  )
                }),
              ),
            )
          }

          if (pop === 'lib') {
            var userProjects = (state.snapshot && state.snapshot.projects) || []
            var samples = (state.snapshot && state.snapshot.samples) || []
            var kits = (state.snapshot && state.snapshot.brandKits) || []

            return h('div', { className: 'rd-pop show', id: 'pop', style: stylePos },
              h('h4', null, '我的片子'),
              userProjects.length === 0
                ? h('p', { className: 'rd-note' }, '还没有自己的片子。在下面挑一条示例或点「＋ 开一条新片」。')
                : h('div', { className: 'rd-lib' },
                    userProjects.map(function (pr) {
                      var isOn = proj && pr.id === proj.id
                      var pKit = kits.find(function (k) { return k.id === pr.brandKitId }) || kit
                      var isRen = state.libRenameId === pr.id
                      var isDel = state.libDeleteConfirmId === pr.id

                      return h('div', { key: pr.id, className: 'rd-li' + (isOn ? ' on' : '') },
                        h('div', {
                          onClick: function () {
                            apiPost({ action: 'select_project', id: pr.id }).then(function (d) {
                              applyIncomingView(d, true)
                              patchState({ page: 'edit', pop: null })
                            }).catch(function (err) { showToast(err.message) })
                          },
                        },
                          pr.coverStoryboard
                            ? h(ScaledFrameBox, {
                                React: React,
                                className: 'pic',
                                storyboard: pr.coverStoryboard,
                                brandKit: pKit,
                                projectId: pr.id,
                                frame: 48,
                                cover: true,
                                fallbackW: 76,
                                fallbackH: 43,
                              })
                            : h('div', { className: 'pic' }),
                        ),
                        isRen
                          ? h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
                              h('input', {
                                className: 'rd-in',
                                style: { padding: '4px 8px', fontSize: '12.5px' },
                                value: state.libRenameVal,
                                autoFocus: true,
                                onChange: function (e) { patchState({ libRenameVal: e.target.value }) },
                                onKeyDown: function (e) {
                                  if (e.key === 'Enter') {
                                    apiPost({ action: 'rename_project', id: pr.id, title: state.libRenameVal }).then(function (d) {
                                      patchState({ snapshot: d.snapshot, libRenameId: null })
                                    }).catch(function (err) { showToast(err.message) })
                                  } else if (e.key === 'Escape') {
                                    patchState({ libRenameId: null })
                                  }
                                },
                              }),
                              h('button', {
                                type: 'button',
                                className: 'rd-link',
                                onClick: function () {
                                  apiPost({ action: 'rename_project', id: pr.id, title: state.libRenameVal }).then(function (d) {
                                    patchState({ snapshot: d.snapshot, libRenameId: null })
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, '保存'),
                            )
                          : h('div', {
                              className: 'mid',
                              onClick: function () {
                                apiPost({ action: 'select_project', id: pr.id }).then(function (d) {
                                  applyIncomingView(d, true)
                                  patchState({ page: 'edit', pop: null })
                                }).catch(function (err) { showToast(err.message) })
                              },
                            },
                              h('b', null, pr.title),
                              h('span', null, (pr.aspect === '9:16' ? '竖屏' : '横屏') + ' · ' + pr.sceneCount + ' 镜 · ' + Number(pr.totalDurationSec).toFixed(1) + ' 秒 · 第 ' + (pr.version || 1) + ' 版'),
                            ),
                        isDel
                          ? h('div', { className: 'ops' },
                              h('button', {
                                type: 'button',
                                className: 'rd-link err',
                                onClick: function () {
                                  apiPost({ action: 'delete_project', id: pr.id }).then(function (d) {
                                    applyIncomingView(d, true)
                                    patchState({ pop: null, libDeleteConfirmId: null })
                                    showToast('已删除《' + pr.title + '》')
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, '确认删'),
                              h('button', {
                                type: 'button',
                                className: 'rd-link',
                                onClick: function () { patchState({ libDeleteConfirmId: null }) },
                              }, '取消'),
                            )
                          : h('div', { className: 'ops' },
                              h('button', {
                                type: 'button',
                                className: 'rd-link',
                                onClick: function () { patchState({ libRenameId: pr.id, libRenameVal: pr.title }) },
                              }, '改名'),
                              h('button', {
                                type: 'button',
                                className: 'rd-link',
                                onClick: function () {
                                  apiPost({ action: 'duplicate_project', id: pr.id }).then(function (d) {
                                    applyIncomingView(d, true)
                                    patchState({ page: 'edit', pop: null })
                                    showToast('已复制一份副本')
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, '复制'),
                              h('button', {
                                type: 'button',
                                className: 'rd-link',
                                onClick: function () { patchState({ libDeleteConfirmId: pr.id }) },
                              }, '删除'),
                            ),
                      )
                    }),
                  ),
              h('h4', null, '示例（不算在你的片子里，点了才复制一份）'),
              h('div', { className: 'rd-lib' },
                samples.map(function (smp) {
                  var sKit = kits.find(function (k) { return k.id === smp.brandKitId }) || kit
                  var sTl = computeClientRanges(smp)
                  return h('button', {
                    key: smp.id,
                    type: 'button',
                    className: 'rd-li',
                    onClick: function () {
                      apiPost({ action: 'create_from_sample', sampleId: smp.id }).then(function (d) {
                        applyIncomingView(d, true)
                        patchState({ page: 'edit', pop: null })
                        showToast('已从示例复制为你的新片')
                      }).catch(function (err) { showToast(err.message) })
                    },
                  },
                    h(ScaledFrameBox, {
                      React: React,
                      className: 'pic',
                      storyboard: smp,
                      brandKit: sKit,
                      projectId: smp.id,
                      frame: 48,
                      cover: true,
                      fallbackW: 76,
                      fallbackH: 43,
                    }),
                    h('div', { className: 'mid' },
                      h('b', null, smp.title),
                      h('span', null, (smp.aspect === '9:16' ? '竖屏' : '横屏') + ' · ' + smp.scenes.length + ' 镜 · ' + sTl.totalSec.toFixed(1) + ' 秒'),
                    ),
                    h('span', { className: 'rd-link' }, '用它开一条'),
                  )
                }),
              ),
              h('button', {
                type: 'button',
                className: 'rd-btn line',
                onClick: function () { patchState({ pop: null, page: 'new' }) },
              }, '＋ 开一条新片'),
            )
          }

          if (pop === 'ver' && proj) {
            var rows = proj.history || []
            return h('div', { className: 'rd-pop show', id: 'pop', style: stylePos },
              h('div', null,
                h('h3', null, '这条片的改动记录'),
                h('p', { className: 'sub' }, '留最近 20 版。点一行回到那一版，之后的改动不会丢，还能再回来。'),
              ),
              h('div', { className: 'rd-vers' },
                rows.map(function (row, ri) {
                  var isAgent = row.by === 'agent'
                  return h('div', { key: row.version + ':' + ri, className: 'rd-ver' },
                    h('i', null, '第 ' + row.version + ' 版'),
                    h('div', null,
                      h('span', { className: 'who' }, isAgent ? [DsBadge(React), 'DeepSeek'] : '你'),
                      h('b', null, row.note || '改动'),
                    ),
                    row.current
                      ? h('span', null, '现在')
                      : h('button', {
                          type: 'button',
                          className: 'rd-link',
                          onClick: function () {
                            apiPost({ action: 'restore_version', id: proj.id, version: row.version }).then(function (d) {
                              var m = syncLoadedRevs(d.snapshot, false)
                              patchState({
                                snapshot: d.snapshot,
                                renderer: d.renderer,
                                cellMarks: m,
                                pop: null,
                                clash: null,
                                showBefore: false,
                              })
                              showToast('已回到第 ' + row.version + ' 版')
                            }).catch(function (err) { showToast(err.message) })
                          },
                        }, '回到这一版'),
                  )
                }),
              ),
            )
          }

          if (pop === 'export' && proj && sb) {
            var x = state.exportOpts
            var runtimeReady = Boolean(state.renderer && state.renderer.runtimeReady)
            var lastR = proj.renders && proj.renders[0]
            var lastSecHint = (lastR && lastR.elapsedMs) ? ('上次合成耗时约 ' + Math.max(1, Math.round(lastR.elapsedMs / 1000)) + ' 秒') : ''

            return h('div', { className: 'rd-pop show', id: 'pop', style: stylePos },
              h('h3', null, '导出《' + sb.title + '》'),
              h('button', {
                type: 'button',
                className: 'rd-opt' + (x.quality === 'full' ? ' on' : ''),
                'data-xq': 'full',
                onClick: function () { patchState({ exportOpts: Object.assign({}, x, { quality: 'full' }) }) },
              },
                h('div', null,
                  h('b', null, '正式　' + sb.width + '×' + sb.height + ' · ' + sb.fps + ' 帧'),
                  h('span', null, '共 ' + tl.totalFrames + ' 帧，' + tl.totalSec.toFixed(1) + ' 秒' + (lastSecHint ? (' · ' + lastSecHint) : '')),
                ),
              ),
              h('button', {
                type: 'button',
                className: 'rd-opt' + (x.quality === 'draft' ? ' on' : ''),
                'data-xq': 'draft',
                onClick: function () { patchState({ exportOpts: Object.assign({}, x, { quality: 'draft' }) }) },
              },
                h('div', null,
                  h('b', null, '草稿　' + Math.round(sb.width / 2) + '×' + Math.round(sb.height / 2) + ' · 30 帧'),
                  h('span', null, '一半帧数、四分之一像素，先看节奏用'),
                ),
              ),
              h('div', { className: 'rd-seg', style: { alignSelf: 'flex-start' } },
                h('button', {
                  type: 'button',
                  className: x.format === 'mp4' ? 'on' : '',
                  'data-xf': 'mp4',
                  onClick: function () { patchState({ exportOpts: Object.assign({}, x, { format: 'mp4' }) }) },
                }, 'MP4'),
                h('button', {
                  type: 'button',
                  className: x.format === 'gif' ? 'on' : '',
                  'data-xf': 'gif',
                  onClick: function () { patchState({ exportOpts: Object.assign({}, x, { format: 'gif' }) }) },
                }, 'GIF，放进 README'),
              ),
              h('dl', { className: 'rd-kv' },
                h('dt', null, '存到'),
                h('dd', null, '~/.dsh/reel-desk/projects/' + proj.id + '/renders/'),
              ),
              !runtimeReady
                ? h('div', { className: 'rd-first' }, '这台电脑还没准备过合成环境。第一次导出会先联网下载 Remotion 和它的依赖，只需要一次；下载了多少、还要多久，开始后按实际进度显示。')
                : null,
              h('p', { className: 'rd-note' }, '合成用的是 Remotion。个人和 3 人以内的团队免费，4 人及以上的公司需要向 Remotion 购买授权。'),
              h('button', {
                type: 'button',
                className: 'rd-btn pri',
                'data-xgo': '1',
                onClick: function () { startExportRender() },
              }, '开始导出'),
            )
          }

          return h('div', { className: 'rd-pop', id: 'pop' })
        }


        if (state.loading && !state.snapshot) {
          return h('div', { className: 'rd', ref: rootRef },
            h('div', { className: 'rd-wrap' },
              h('p', { className: 'rd-note' }, '正在加载制片台…'),
            ),
          )
        }

        if (state.error && !state.snapshot) {
          return h('div', { className: 'rd', ref: rootRef },
            h('div', { className: 'rd-wrap' },
              h('p', { className: 'rd-note warn' }, '读取制片台失败：' + state.error),
              h('button', {
                type: 'button',
                className: 'rd-btn line sm',
                style: { alignSelf: 'flex-start' },
                onClick: function () {
                  patchState({ loading: true, error: null })
                  apiGet().then(function (d) { applyIncomingView(d, true) }).catch(function (e) {
                    patchState({ loading: false, error: e.message || String(e) })
                  })
                },
              }, '重试'),
            ),
          )
        }

        var snap = state.snapshot
        var userProjects = (snap && snap.projects) || []
        var hasUserProjects = userProjects.length > 0
        var proj = snap && snap.activeProject
        var effectivePage = (!hasUserProjects || !proj) ? 'new' : state.page
        var sb = proj ? proj.storyboard : null
        var kit = snap && snap.activeBrandKit
        var tl = sb ? computeClientRanges(sb) : { ranges: [], totalFrames: 1, totalSec: 0 }
        var safeIdx = sb ? Math.min(state.sceneIdx, Math.max(0, sb.scenes.length - 1)) : 0
        var sc = sb ? sb.scenes[safeIdx] : null

        // Stage scale calculation (matches `reel-desk-flow-v3.html` lines 2098-2102)
        var isTall = Boolean(sb && sb.height > sb.width)
        var cw = state.panelMetrics.panelW || 1040
        var wh = state.panelMetrics.winH || 820
        var stacked = cw <= (isTall ? 640 : 900)
        var stageScale = 0.35
        if (sb) {
          if (isTall && !stacked) {
            stageScale = Math.min(Math.min(600, wh * 0.62) / sb.height, (cw * 0.38) / sb.width)
          } else {
            var availW = Math.max(180, (state.panelMetrics.wellW || (cw - 40)) - (stacked ? 24 : 44))
            var maxH = isTall ? wh * 0.46 : (stacked ? wh * 0.40 : 9999)
            stageScale = Math.min(availW / sb.width, maxH / sb.height)
          }
          stageScale = Math.max(0.08, Math.min(1, stageScale))
        }
        var stageW = sb ? Math.round(sb.width * stageScale) : 640
        var stageH = sb ? Math.round(sb.height * stageScale) : 360

        var sceneAgentInfo = (proj && proj.agentChanges && proj.agentChanges.scenes && sc)
          ? proj.agentChanges.scenes[sc.id]
          : null
        var beforeScene = sceneAgentInfo && sceneAgentInfo.beforeScene ? sceneAgentInfo.beforeScene : null
        var showingBefore = Boolean(state.showBefore && beforeScene)
        var latestRender = resolveLatestProjectRender(proj)
        var hasCompletedRender = Boolean(latestRender && latestRender.file)
        var showingFilePreview = Boolean(state.watchMode === 'file' && hasCompletedRender)

        var activeJob = state.renderer && state.renderer.activeJob
        var exportRunningForThis = Boolean(
          proj && activeJob && activeJob.projectId === proj.id &&
          ['bootstrapping', 'bundling', 'rendering'].includes(activeJob.stage),
        )
        var exportPct = exportRunningForThis
          ? Math.max(1, Math.min(99, Math.round(((activeJob.renderedFrames || 0) / Math.max(1, activeJob.totalFrames || tl.totalFrames)) * 100)))
          : 0

        var hasDiscardedMine = Boolean(proj && discardedMineRef.current && discardedMineRef.current.projectId === proj.id)
        var canUndoNow = Boolean(proj && (proj.canUndo || hasDiscardedMine))
        var undoText = hasDiscardedMine
          ? '撤销「丢掉我的写法」'
          : (proj && proj.canUndo && proj.lastUndoNote
              ? ('撤销「' + proj.lastUndoNote.replace(/「/g, '『').replace(/」/g, '』') + '」')
              : '撤销上一改')

        var shotHintMap = {
          pan: '取景：在画面上拖，选要讲的那一块',
          focus: '框重点：在画面上拖出一个框',
          cursor: '放光标：在要点的地方点一下',
        }
        var activeShotHint = (sc && sc.kind === 'screen-shot' && state.shotTool) ? shotHintMap[state.shotTool] : null

        var wsInfo = listHostWorkspaces(hostCtx, state.serverWorkspaces, hookWorkspaceItems)
        var currentWs = wsInfo.items.find(function (w) { return w.workspaceId === state.selectedWorkspaceId }) || wsInfo.items[0] || null
        var pendingHandoff = snap && snap.pendingHandoff

        return h('div', {
          className: 'rd',
          id: 'rd',
          ref: rootRef,
          'data-page': effectivePage,
          'data-aspect': sb ? sb.aspect : '16:9',
          'data-first': hasUserProjects ? '0' : '1',
        },
          h('div', { className: 'rd-wrap', id: 'wrap', ref: wrapRef },
            // 1. Top bar
            h('header', { className: 'rd-top' },
              h('div', { className: 'rd-id' },
                h('span', { className: 'rd-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
                h('span', { className: 'n' }, '制片台'),
              ),
              h('div', { className: 'rd-acts' },
                h('button', {
                  type: 'button',
                  className: 'rd-btn quiet',
                  id: 'undo',
                  title: '⌘Z',
                  disabled: !canUndoNow,
                  onClick: function () { triggerUndo() },
                },
                  h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
                    h('path', { d: 'M3 6h7a3.5 3.5 0 0 1 0 7H6' }),
                    h('path', { d: 'M5.5 3.5 3 6l2.5 2.5' }),
                  ),
                  h('span', { className: 'lbl', id: 'undoLbl' }, undoText),
                ),
                h('button', {
                  type: 'button',
                  className: 'rd-btn line',
                  id: 'btnNew',
                  onClick: function () {
                    patchState({
                      page: effectivePage === 'new' ? 'edit' : 'new',
                      pop: null,
                    })
                  },
                },
                  h('svg', { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' },
                    h('path', { d: 'M8 3v10M3 8h10' }),
                  ),
                  h('span', { className: 'lbl', id: 'newLbl' }, effectivePage === 'new' ? '回到片子' : '新片'),
                ),
                h('button', {
                  type: 'button',
                  className: 'rd-btn pri',
                  id: 'btnExport',
                  onClick: function (e) {
                    if (state.pop === 'export') patchState({ pop: null, popCtx: null })
                    else openPopover('export', e.currentTarget)
                  },
                }, exportRunningForThis ? ('导出中 ' + exportPct + '%') : '导出成片'),
              ),
            ),

            // 2. Project title row + Note bar + Export band (shown when page === 'edit')
            proj && sb
              ? h('div', { className: 'rd-title' },
                  h('button', {
                    type: 'button',
                    className: 'name',
                    id: 'projBtn',
                    title: '片库：切换、改名、复制、删除',
                    onClick: function (e) {
                      if (state.pop === 'lib') patchState({ pop: null, popCtx: null })
                      else openPopover('lib', e.currentTarget)
                    },
                  },
                    h('span', { id: 'projTitle' }, sb.title),
                    h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
                      h('path', { d: 'm4 6 4 4 4-4' }),
                    ),
                  ),
                  h('span', { className: 'rd-meta', id: 'projMeta' },
                    (sb.aspect === '9:16' ? '竖屏' : '横屏') + ' · ',
                    h('b', null, String(sb.scenes.length)),
                    ' 镜 · ',
                    h('b', null, tl.totalSec.toFixed(1)),
                    ' 秒 · ',
                    h('button', {
                      type: 'button',
                      id: 'verBtn',
                      title: '看改动记录',
                      onClick: function (e) {
                        if (state.pop === 'ver') patchState({ pop: null, popCtx: null })
                        else openPopover('ver', e.currentTarget)
                      },
                    }, '第 ' + (proj.version || 1) + ' 版'),
                  ),
                  h('span', {
                    className: 'rd-saved' + (state.saveStatus === 'saving' ? ' busy' : ''),
                    id: 'saved',
                  }, state.saveStatus === 'saving' ? '保存中…' : '已保存'),
                )
              : null,

            renderNoteBar(proj, sb, tl),
            renderBand(proj, sb, kit, tl),

            // 3. Edit workbench (`main.rd-main`)
            proj && sb && sc
              ? h('main', { className: 'rd-main' },
                  h('section', { className: 'rd-screen' },
                    h('div', { className: 'rd-well', id: 'well', ref: wellRef },
                      h('div', {
                        className: 'rd-stage',
                        id: 'stage',
                        ref: stageRef,
                        style: { width: stageW + 'px', height: stageH + 'px' },
                        onDragOver: function (e) { e.preventDefault() },
                        onDrop: function (e) {
                          e.preventDefault()
                          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
                          if (f) handleImageFileUpload(f)
                        },
                      },
                        showingFilePreview
                          ? h(React.Fragment, null,
                              String(latestRender.file).toLowerCase().endsWith('.gif') || latestRender.format === 'gif'
                                ? h('img', {
                                    className: 'file-prev',
                                    src: MEDIA_URL + '?project=' + encodeURIComponent(proj.id) + '&file=' + encodeURIComponent(latestRender.file),
                                    alt: sb.title,
                                  })
                                : h('video', {
                                    src: MEDIA_URL + '?project=' + encodeURIComponent(proj.id) + '&file=' + encodeURIComponent(latestRender.file),
                                    controls: true,
                                    autoPlay: true,
                                    muted: true,
                                    preload: 'auto',
                                    loop: true,
                                    playsInline: true,
                                  }),
                              h('span', { className: 'tag' }, '成片 · 导出的文件'),
                            )
                          : h(React.Fragment, null,
                              h('div', {
                                className: 'fr',
                                style: {
                                  width: sb.width + 'px',
                                  height: sb.height + 'px',
                                  transform: 'scale(' + stageScale + ')',
                                  transformOrigin: 'top left',
                                  pointerEvents: 'none',
                                },
                              },
                                renderStoryboardFrame(React, {
                                  frame: showingBefore ? Math.round((beforeScene.durationInFrames || 180) * 0.72) : state.frame,
                                  fps: sb.fps || 60,
                                  storyboard: showingBefore ? Object.assign({}, sb, { scenes: [beforeScene] }) : sb,
                                  brandKit: kit,
                                  assetMeta: sb.assetMeta || null,
                                  resolveAsset: function (aName) {
                                    return MEDIA_URL + '?project=' + encodeURIComponent(proj.id) + '&asset=' + encodeURIComponent(aName)
                                  },
                                }),
                              ),
                              showingBefore ? h('span', { className: 'tag' }, '改之前') : null,
                              // Stage direct manipulation / drop overlay
                              sc.kind === 'screen-shot' && !showingBefore && (!sc.asset || state.shotTool)
                                ? h('div', {
                                    className: 'rd-ov on' + (sc.asset && state.shotTool ? (' ' + state.shotTool) : ''),
                                    id: 'ov',
                                    onPointerDown: function (e) {
                                      if (!sc.asset || !state.shotTool) return
                                      var stEl = stageRef.current
                                      var vpEl = stEl && stEl.querySelector('[data-reel-shot-viewport="1"]')
                                      if (!vpEl) return
                                      var r = vpEl.getBoundingClientRect()
                                      if (!r.width || !r.height) return
                                      e.preventDefault()
                                      var p0 = {
                                        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                                        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
                                      }
                                      var geom = computeShotGeometry(sb, sc, sb.assetMeta)
                                      if (state.shotTool === 'cursor') {
                                        var imgPt = shotViewportToImage(geom, p0)
                                        scheduleScenePatch(Object.assign({}, sc, { cursor: imgPt }), ['cursor'], '放光标')
                                      } else {
                                        stageDragRef.current = {
                                          tool: state.shotTool,
                                          p0: p0,
                                          geom: geom,
                                          v0: normalizeShotView(sc.view),
                                          x0: e.clientX,
                                          y0: e.clientY,
                                          rect: r,
                                          latestScene: null,
                                        }
                                      }
                                    },
                                  },
                                    !sc.asset
                                      ? h('div', {
                                          className: 'rd-drop',
                                          style: dropRect
                                            ? {
                                                left: dropRect.left + 'px',
                                                top: dropRect.top + 'px',
                                                width: dropRect.width + 'px',
                                                height: dropRect.height + 'px',
                                              }
                                            : { inset: '28% 7% 10% 7%' },
                                        },
                                          h('b', null, '把截图贴到这里'),
                                          h('span', null, '⌘V 粘贴，或把图片拖进来（不超过 10 MB）'),
                                          h('div', { className: 'row' },
                                            h('button', {
                                              type: 'button',
                                              onClick: function () {
                                                if (fileInputRef.current) fileInputRef.current.click()
                                              },
                                            }, '选本地图片'),
                                            h('button', {
                                              type: 'button',
                                              id: 'pick',
                                              onClick: function () {
                                                patchState({ inspTab: 'scene', showWsAssetInput: true })
                                              },
                                            }, '从工作区导入'),
                                          ),
                                        )
                                      : null,
                                  )
                                : null,
                            ),
                      ),
                      h('div', { className: 'rd-transport' },
                        h('button', {
                          type: 'button',
                          className: 'rd-play',
                          id: 'play',
                          'aria-label': '播放 / 暂停',
                          onClick: function () {
                            patchState({ playing: !state.playing, watchMode: 'board' })
                          },
                        },
                          state.playing
                            ? h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'currentColor' },
                                h('rect', { x: 2, y: 1.5, width: 3, height: 9, rx: 1 }),
                                h('rect', { x: 7, y: 1.5, width: 3, height: 9, rx: 1 }),
                              )
                            : h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'currentColor' },
                                h('path', { d: 'M3 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5Z' }),
                              ),
                        ),
                        h('span', { className: 'rd-time', id: 'time' },
                          formatTimecode(state.frame, sb.fps) + ' ',
                          h('em', null, '/ ' + formatTimecode(tl.totalFrames, sb.fps)),
                        ),
                        (!hasCompletedRender || activeShotHint)
                          ? h('span', {
                              className: 'rd-keys' + (activeShotHint ? ' hint' : ''),
                              id: 'keys',
                            }, activeShotHint || '空格 播放 · ← → 逐帧')
                          : null,
                        hasCompletedRender
                          ? h('span', { className: 'rd-wseg', id: 'wseg' },
                              h('button', {
                                type: 'button',
                                className: state.watchMode === 'board' ? 'on' : '',
                                'data-m': 'board',
                                onClick: function () { patchState({ watchMode: 'board' }) },
                              }, '分镜预演'),
                              h('button', {
                                type: 'button',
                                className: state.watchMode === 'file' ? 'on' : '',
                                'data-m': 'file',
                                onClick: function () { patchState({ watchMode: 'file', playing: false }) },
                              }, '成片'),
                            )
                          : null,
                      ),
                    ),

                    // Filmstrip (`div.rd-film > div.rd-track`)
                    h('div', { className: 'rd-film' },
                      h('div', { className: 'rd-track', id: 'track', ref: trackRef },
                        sb.scenes.map(function (cellSc, ci) {
                          var r = tl.ranges[ci] || { startFrame: 0, endFrame: 120, durationInFrames: 120, durationSec: 2 }
                          var isSel = ci === safeIdx
                          var isCellRen = Boolean(state.renaming && state.renaming.where === 'cell' && state.renaming.idx === ci)
                          var mk = state.cellMarks[cellSc.id]
                          var mkText = mk ? ({ new: '新', ds: '改过', frame: '看取景', clash: '待选' }[mk] || '') : ''
                          var gapHot = Boolean(state.pop === 'kind' && state.popCtx && state.popCtx.at === ci)
                          var gapDrop = Boolean(state.dropGapIdx === ci && state.liftingIdx != null && state.liftingIdx !== ci && state.liftingIdx + 1 !== ci)

                          return h(React.Fragment, { key: cellSc.id || ci },
                            ci > 0
                              ? h('button', {
                                  type: 'button',
                                  className: 'rd-gap' + (gapHot ? ' hot' : '') + (gapDrop ? ' drop' : ''),
                                  'data-at': String(ci),
                                  title: '在这里加一镜',
                                  onClick: function (e) { openPopover('kind', e.currentTarget, { at: ci }) },
                                }, h('i', null, '+'))
                              : null,
                            h('div', {
                              className: 'rd-cell' + (isSel ? ' on' : '') + (isCellRen ? ' ren' : '') + (state.liftingIdx === ci ? ' lift' : ''),
                              style: { flex: r.durationInFrames + ' 1 0' },
                              'data-i': String(ci),
                              tabIndex: 0,
                              role: 'button',
                              onKeyDown: function (e) {
                                if (isCellRen) return
                                if (e.key === 'F2') {
                                  e.preventDefault()
                                  startInlineRename(ci, 'cell')
                                } else if (e.key === 'Enter') {
                                  selectScene(ci, false)
                                }
                              },
                            },
                              h('div', {
                                onPointerDown: function (e) {
                                  e.preventDefault()
                                  trackDragRef.current = { mode: 'seek' }
                                  var b = e.currentTarget.getBoundingClientRect()
                                  var ratio = Math.max(0, Math.min(0.999, (e.clientX - b.left) / Math.max(1, b.width)))
                                  setFrameAndSyncScene(r.startFrame + ratio * r.durationInFrames)
                                },
                              },
                                h(ScaledFrameBox, {
                                  React: React,
                                  className: 'pic',
                                  style: { background: kit ? kit.bg : undefined },
                                  storyboard: sb,
                                  brandKit: kit,
                                  projectId: proj.id,
                                  frame: Math.min(r.endFrame - 1, r.startFrame + Math.round(r.durationInFrames * 0.72)),
                                  cover: true,
                                }),
                              ),
                              mkText
                                ? h('span', { className: 'mk' + (mk === 'frame' || mk === 'clash' ? ' w' : '') }, mkText)
                                : null,
                              h('div', {
                                className: 'cap',
                                title: isCellRen ? '' : '按住拖动换位置，双击改名',
                                onPointerDown: function (e) {
                                  if (isCellRen || (e.target && e.target.tagName === 'INPUT')) return
                                  e.preventDefault()
                                  trackDragRef.current = {
                                    mode: 'move',
                                    idx: ci,
                                    startX: e.clientX,
                                    moved: false,
                                    dropAt: null,
                                  }
                                },
                              },
                                h('i', null, String(ci + 1).padStart(2, '0')),
                                isCellRen
                                  ? h('input', {
                                      id: 'renIn',
                                      ref: renInputRef,
                                      maxLength: 16,
                                      'aria-label': '这一镜的名字',
                                      value: state.renaming.val,
                                      onChange: function (e) {
                                        patchState({ renaming: Object.assign({}, state.renaming, { val: e.target.value }) })
                                      },
                                      onKeyDown: function (e) {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          commitInlineRename(true)
                                        } else if (e.key === 'Escape') {
                                          e.stopPropagation()
                                          commitInlineRename(false)
                                        }
                                      },
                                      onBlur: function () { commitInlineRename(true) },
                                    })
                                  : h('b', null, cellSc.label),
                                h('span', null, r.durationSec.toFixed(1) + 's'),
                              ),
                              h('span', {
                                className: 'edge',
                                title: '拖动改时长',
                                onPointerDown: function (e) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  var cellEl = e.currentTarget.parentElement
                                  var cellW = (cellEl && cellEl.offsetWidth) || 140
                                  trackDragRef.current = {
                                    mode: 'dur',
                                    idx: ci,
                                    startX: e.clientX,
                                    startFrames: r.durationInFrames,
                                    pxPerFrame: cellW / Math.max(1, r.durationInFrames),
                                    latestScene: null,
                                  }
                                },
                              }),
                            ),
                          )
                        }),
                        h('button', {
                          type: 'button',
                          className: 'rd-add',
                          'data-at': String(sb.scenes.length),
                          title: '在最后加一镜',
                          onClick: function (e) { openPopover('kind', e.currentTarget, { at: sb.scenes.length }) },
                        },
                          h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' },
                            h('path', { d: 'M8 3v10M3 8h10' }),
                          ),
                        ),
                        h('i', {
                          className: 'rd-head',
                          id: 'head',
                          style: { left: state.headLeftPx + 'px' },
                        }),
                      ),
                    ),
                  ),

                  // Inspector (`aside.rd-insp`)
                  h('aside', { className: 'rd-insp' },
                    h('div', { className: 'rd-tabs' },
                      h('button', {
                        type: 'button',
                        id: 'tabScene',
                        className: state.inspTab === 'scene' ? 'on' : '',
                        onClick: function () { patchState({ inspTab: 'scene' }) },
                      }, '这一镜'),
                      h('button', {
                        type: 'button',
                        id: 'tabFilm',
                        className: state.inspTab === 'film' ? 'on' : '',
                        onClick: function () { patchState({ inspTab: 'film' }) },
                      }, '整片'),
                    ),

                    state.inspTab === 'film'
                      ? h('div', { id: 'insp', className: 'rd-insp', style: { gap: '16px' } },
                          renderField('片名', '', h('input', {
                            className: 'rd-in',
                            value: sb.title || '',
                            onChange: function (e) {
                              var nextTitle = e.target.value
                              var nextSnap = JSON.parse(JSON.stringify(snap))
                              nextSnap.activeProject.storyboard.title = nextTitle
                              patchState({ snapshot: nextSnap, saveStatus: 'saving' })
                              if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                              saveTimerRef.current = setTimeout(function () {
                                apiPost({
                                  action: 'save_storyboard',
                                  id: proj.id,
                                  storyboard: nextSnap.activeProject.storyboard,
                                  coalesceKey: proj.id + ':top:title',
                                  note: '改片名',
                                }).then(function (d) {
                                  patchState({ snapshot: d.snapshot, renderer: d.renderer, saveStatus: 'saved' })
                                }).catch(function (err) {
                                  patchState({ saveStatus: 'saved' })
                                  showToast(err.message)
                                })
                              }, 380)
                            },
                          }), 'film-title'),

                          renderField('画面右上角的小标签', '留空则不显示', h('input', {
                            className: 'rd-in',
                            value: sb.productTag || '',
                            onChange: function (e) {
                              var nextTag = e.target.value
                              var nextSnap = JSON.parse(JSON.stringify(snap))
                              nextSnap.activeProject.storyboard.productTag = nextTag
                              patchState({ snapshot: nextSnap, saveStatus: 'saving' })
                              if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                              saveTimerRef.current = setTimeout(function () {
                                apiPost({
                                  action: 'save_storyboard',
                                  id: proj.id,
                                  storyboard: nextSnap.activeProject.storyboard,
                                  coalesceKey: proj.id + ':top:productTag',
                                  note: '改右上角小标签',
                                }).then(function (d) {
                                  patchState({ snapshot: d.snapshot, renderer: d.renderer, saveStatus: 'saved' })
                                }).catch(function (err) {
                                  patchState({ saveStatus: 'saved' })
                                  showToast(err.message)
                                })
                              }, 380)
                            },
                          }), 'film-tag'),

                          renderField('配色', '', h('div', { className: 'rd-seg' },
                            (snap.brandKits || []).map(function (bk) {
                              return h('button', {
                                key: bk.id,
                                type: 'button',
                                className: bk.id === sb.brandKitId ? 'on' : '',
                                'data-kit': bk.id,
                                onClick: function () {
                                  flushPendingSave().then(function () {
                                    return apiPost({ action: 'set_brand_kit', id: proj.id, brandKitId: bk.id })
                                  }).then(function (d) {
                                    patchState({ snapshot: d.snapshot, renderer: d.renderer })
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              },
                                h('i', { className: 'rd-sw', style: { background: bk.bg, '--c2': bk.ink } }),
                                String(bk.name || bk.id).replace(' + 宋体', ''),
                              )
                            }),
                          ), 'film-kit'),

                          renderField('画幅', '换了以后，截图镜要看一眼取景', h('div', { className: 'rd-seg' },
                            [
                              { id: '16:9', label: '横屏 16:9' },
                              { id: '9:16', label: '竖屏 9:16' },
                            ].map(function (asp) {
                              return h('button', {
                                key: asp.id,
                                type: 'button',
                                className: sb.aspect === asp.id ? 'on' : '',
                                'data-asp': asp.id,
                                onClick: function () {
                                  if (sb.aspect === asp.id) return
                                  flushPendingSave().then(function () {
                                    return apiPost({ action: 'set_aspect', id: proj.id, aspect: asp.id })
                                  }).then(function (d) {
                                    var reframed = d.reframed || []
                                    var m = syncLoadedRevs(d.snapshot, true)
                                    reframed.forEach(function (rf) {
                                      if (rf.sceneId) m[rf.sceneId] = 'frame'
                                    })
                                    var isNowTall = asp.id === '9:16'
                                    var shotNums = reframed.map(function (rf) { return (rf.sceneIndex != null ? rf.sceneIndex : 0) + 1 })
                                    var sysNote = {
                                      gotoIdx: reframed.length ? (reframed[0].sceneIndex || 0) : null,
                                      titleBold: '换成' + (isNowTall ? '竖屏' : '横屏') + '了。',
                                      restText: '文字镜头已经自动重排。' + (shotNums.length
                                        ? ('第 ' + shotNums.join('、') + ' 镜是截图，' + (isNowTall ? '竖屏只放得下它中间的一条' : '横屏看得到的范围变了') + '，已经按你框的重点对好位置，点开看一眼。')
                                        : ''),
                                    }
                                    patchState({
                                      snapshot: d.snapshot,
                                      renderer: d.renderer,
                                      cellMarks: m,
                                      sysNote: sysNote,
                                    })
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, asp.label)
                            }),
                          ), 'film-aspect'),

                          renderField('画面里的小图形', '跟着产品走', h('div', { className: 'rd-seg' },
                            GLYPH_OPTIONS.map(function (gl) {
                              return h('button', {
                                key: gl.id,
                                type: 'button',
                                className: (sb.glyph || 'none') === gl.id ? 'on' : '',
                                'data-glyph': gl.id,
                                onClick: function () {
                                  flushPendingSave().then(function () {
                                    return apiPost({ action: 'set_glyph', id: proj.id, glyph: gl.id })
                                  }).then(function (d) {
                                    patchState({ snapshot: d.snapshot, renderer: d.renderer })
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, gl.label)
                            }),
                          ), 'film-glyph'),

                          h('div', { className: 'rd-toggle' },
                            h('span', null,
                              '成片里显示镜号和时间码',
                              h('br'),
                              h('span', { className: 'rd-note' }, '排片时好对帧，发出去的片子一般不需要'),
                            ),
                            h('button', {
                              type: 'button',
                              className: sb.showHud ? 'on' : '',
                              'aria-pressed': String(Boolean(sb.showHud)),
                              onClick: function () {
                                flushPendingSave().then(function () {
                                  return apiPost({ action: 'set_show_hud', id: proj.id, showHud: !sb.showHud })
                                }).then(function (d) {
                                  patchState({ snapshot: d.snapshot, renderer: d.renderer })
                                }).catch(function (err) { showToast(err.message) })
                              },
                            }),
                          ),

                          h('div', { className: 'rd-ask' },
                            h('h3', null, DsBadge(React), '让 DeepSeek 重排整片'),
                            h('div', { className: 'rd-askbox' },
                              h('textarea', {
                                id: 'askFilm',
                                placeholder: '想让整条片怎么调？比如：节奏再快一点，压到 12 秒',
                                value: state.askFilmBrief,
                                onChange: function (e) { patchState({ askFilmBrief: e.target.value }) },
                              }),
                              h('button', {
                                type: 'button',
                                className: 'rd-btn line sm',
                                id: 'goFilm',
                                onClick: async function () {
                                  await flushPendingSave()
                                  var reqText = (state.askFilmBrief || '').trim() || ('请帮我调整《' + sb.title + '》的整体节奏与分镜')
                                  var prompt = '请先调用 reel_get(id="' + proj.id + '") 读取最新分镜（当前第 ' + proj.version + ' 版），再按以下要求用 reel_patch_scene(id="' + proj.id + '", baseVersion=' + proj.version + ', ops=[...]) 局部修改分镜（不必重写的镜头请保持不动）：\n' + reqText
                                  reopenOrHandoffFilmSession(hostCtx, {
                                    sessionId: proj.origin && proj.origin.sessionId,
                                    workspaceId: (proj.origin && proj.origin.workspaceId) || state.selectedWorkspaceId,
                                    projectId: proj.id,
                                    projectTitle: sb.title,
                                    prompt: prompt,
                                    serverWorkspaces: state.serverWorkspaces,
                                  }, showToast)
                                },
                              }, '去对话里说'),
                            ),
                            h('p', { className: 'rd-note' }, '重排要读整条片和工作区，所以优先回到当初排这条片的那条对话，不另开新的。改完这里会标出动了哪几镜，每一镜都能单独退回。'),
                          ),
                        )
                      : h('div', { id: 'insp', className: 'rd-insp', style: { gap: '14px' } },
                          // Scene header
                          h('div', { className: 'rd-ih' },
                            h('div', null,
                              h('h2', null,
                                '第 ' + (safeIdx + 1) + ' 镜　',
                                (state.renaming && state.renaming.where === 'head' && state.renaming.idx === safeIdx)
                                  ? h('input', {
                                      id: 'renIn',
                                      ref: renInputRef,
                                      maxLength: 16,
                                      'aria-label': '这一镜的名字',
                                      value: state.renaming.val,
                                      onChange: function (e) {
                                        patchState({ renaming: Object.assign({}, state.renaming, { val: e.target.value }) })
                                      },
                                      onKeyDown: function (e) {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          commitInlineRename(true)
                                        } else if (e.key === 'Escape') {
                                          e.stopPropagation()
                                          commitInlineRename(false)
                                        }
                                      },
                                      onBlur: function () { commitInlineRename(true) },
                                    })
                                  : h('button', {
                                      type: 'button',
                                      id: 'renBtn',
                                      title: '点一下改名',
                                      onClick: function () { startInlineRename(safeIdx, 'head') },
                                    }, sc.label),
                              ),
                              h('button', {
                                type: 'button',
                                className: 'rd-kind',
                                id: 'kindBtn',
                                onClick: function (e) { openPopover('kind', e.currentTarget, { swap: safeIdx }) },
                              }, (KIND_LABELS[sc.kind] || sc.kind) + ' ▾　换一种镜头样式'),
                            ),
                            h('div', { className: 'rd-icons' },
                              h('button', {
                                type: 'button',
                                title: '往前挪',
                                disabled: safeIdx === 0,
                                onClick: function () {
                                  flushPendingSave().then(function () {
                                    return apiPost({
                                      action: 'patch_scene',
                                      id: proj.id,
                                      op: 'move',
                                      sceneIndex: safeIdx,
                                      toIndex: safeIdx - 1,
                                      note: '挪动「' + sc.label + '」',
                                    })
                                  }).then(function (d) {
                                    var m = syncLoadedRevs(d.snapshot, true)
                                    var r = computeClientRanges(d.snapshot.activeProject.storyboard).ranges[safeIdx - 1]
                                    patchState({
                                      snapshot: d.snapshot,
                                      renderer: d.renderer,
                                      cellMarks: m,
                                      sceneIdx: safeIdx - 1,
                                      frame: r ? Math.round(r.startFrame + r.durationInFrames * 0.78) : 36,
                                    })
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, renderSvgIcon('l')),
                              h('button', {
                                type: 'button',
                                title: '往后挪',
                                disabled: safeIdx >= sb.scenes.length - 1,
                                onClick: function () {
                                  flushPendingSave().then(function () {
                                    return apiPost({
                                      action: 'patch_scene',
                                      id: proj.id,
                                      op: 'move',
                                      sceneIndex: safeIdx,
                                      toIndex: safeIdx + 1,
                                      note: '挪动「' + sc.label + '」',
                                    })
                                  }).then(function (d) {
                                    var m = syncLoadedRevs(d.snapshot, true)
                                    var r = computeClientRanges(d.snapshot.activeProject.storyboard).ranges[safeIdx + 1]
                                    patchState({
                                      snapshot: d.snapshot,
                                      renderer: d.renderer,
                                      cellMarks: m,
                                      sceneIdx: safeIdx + 1,
                                      frame: r ? Math.round(r.startFrame + r.durationInFrames * 0.78) : 36,
                                    })
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, renderSvgIcon('r')),
                              h('button', {
                                type: 'button',
                                title: '复制这一镜',
                                disabled: sb.scenes.length >= 12,
                                onClick: function () {
                                  var cloned = JSON.parse(JSON.stringify(sc))
                                  delete cloned.id
                                  flushPendingSave().then(function () {
                                    return apiPost({
                                      action: 'patch_scene',
                                      id: proj.id,
                                      op: 'insert',
                                      sceneIndex: safeIdx + 1,
                                      scene: cloned,
                                      note: '复制「' + sc.label + '」',
                                    })
                                  }).then(function (d) {
                                    var m = syncLoadedRevs(d.snapshot, true)
                                    var r = computeClientRanges(d.snapshot.activeProject.storyboard).ranges[safeIdx + 1]
                                    patchState({
                                      snapshot: d.snapshot,
                                      renderer: d.renderer,
                                      cellMarks: m,
                                      sceneIdx: safeIdx + 1,
                                      frame: r ? Math.round(r.startFrame + r.durationInFrames * 0.78) : 36,
                                    })
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, renderSvgIcon('dup')),
                              h('button', {
                                type: 'button',
                                title: '删掉这一镜（可撤销）',
                                disabled: sb.scenes.length <= 1,
                                onClick: function () {
                                  flushPendingSave().then(function () {
                                    return apiPost({
                                      action: 'patch_scene',
                                      id: proj.id,
                                      op: 'delete',
                                      sceneIndex: safeIdx,
                                      note: '删掉「' + sc.label + '」',
                                    })
                                  }).then(function (d) {
                                    var m = syncLoadedRevs(d.snapshot, true)
                                    var nextIdx = Math.max(0, Math.min(safeIdx, d.snapshot.activeProject.storyboard.scenes.length - 1))
                                    var r = computeClientRanges(d.snapshot.activeProject.storyboard).ranges[nextIdx]
                                    patchState({
                                      snapshot: d.snapshot,
                                      renderer: d.renderer,
                                      cellMarks: m,
                                      sceneIdx: nextIdx,
                                      frame: r ? Math.round(r.startFrame + r.durationInFrames * 0.78) : 36,
                                    })
                                  }).catch(function (err) { showToast(err.message) })
                                },
                              }, renderSvgIcon('del')),
                            ),
                          ),

                          // Conflict card (.rd-clash) or Agent diff card (.rd-diff)
                          renderClashBlock(proj, sb, sc, safeIdx, kit),

                          (beforeScene && !(state.clash && state.clash.sceneId === sc.id))
                            ? h('div', { className: 'rd-diff' },
                                h('p', null,
                                  DsBadge(React),
                                  ' ',
                                  h('b', null, 'DeepSeek 改了这一镜：'),
                                  describeSceneDiff(beforeScene, sc, sb.fps),
                                ),
                                h('div', { className: 'r' },
                                  h('div', { className: 'rd-seg' },
                                    h('button', {
                                      type: 'button',
                                      className: state.showBefore ? 'on' : '',
                                      onClick: function () { patchState({ showBefore: true, playing: false, watchMode: 'board' }) },
                                    }, '改之前'),
                                    h('button', {
                                      type: 'button',
                                      className: !state.showBefore ? 'on' : '',
                                      onClick: function () { patchState({ showBefore: false }) },
                                    }, '改之后'),
                                  ),
                                  h('button', {
                                    type: 'button',
                                    className: 'rd-btn line sm',
                                    onClick: function () {
                                      apiPost({
                                        action: 'revert_scene',
                                        id: proj.id,
                                        sceneId: sc.id,
                                        toVersion: sceneAgentInfo.toVersion,
                                      }).then(function (d) {
                                        var m = syncLoadedRevs(d.snapshot, true)
                                        delete m[sc.id]
                                        patchState({
                                          snapshot: d.snapshot,
                                          renderer: d.renderer,
                                          cellMarks: m,
                                          showBefore: false,
                                        })
                                        showToast('已退回第 ' + (safeIdx + 1) + ' 镜')
                                      }).catch(function (err) { showToast(err.message) })
                                    },
                                  }, '退回这一镜'),
                                  h('button', {
                                    type: 'button',
                                    className: 'rd-btn quiet sm',
                                    onClick: function () {
                                      apiPost({ action: 'ack_changes', id: proj.id, sceneId: sc.id }).then(function (d) {
                                        var m = syncLoadedRevs(d.snapshot, true)
                                        delete m[sc.id]
                                        patchState({ snapshot: d.snapshot, cellMarks: m, showBefore: false })
                                      }).catch(function () {})
                                    },
                                  }, '留下'),
                                ),
                              )
                            : null,

                          // Headline + Eyebrow + Kind fields + Duration + Inline Ask
                          (function () {
                            var hlLen = Array.from(sc.headline || '').length
                            return renderField(
                              '主标题',
                              hlLen + ' 字' + (hlLen > 28 ? ' · 偏长，字会缩小' : ''),
                              h('textarea', {
                                className: 'rd-ta big',
                                value: sc.headline || '',
                                onChange: function (e) {
                                  scheduleScenePatch(Object.assign({}, sc, { headline: e.target.value }), ['headline'])
                                },
                              }),
                              'sc-hl',
                            )
                          })(),

                          renderField('标题上方的小字', '留空则不显示', h('input', {
                            className: 'rd-in',
                            value: sc.eyebrow || '',
                            onChange: function (e) {
                              scheduleScenePatch(Object.assign({}, sc, { eyebrow: e.target.value }), ['eyebrow'])
                            },
                          }), 'sc-eb'),

                          renderSceneKindFields(proj, sb, sc, safeIdx),

                          (function () {
                            var durSec = Number(((sc.durationInFrames || 180) / (sb.fps || 60)).toFixed(1))
                            return renderField('这一镜停留多久', '也可以拖胶片格的右边缘', h('div', { className: 'rd-dur' },
                              h('input', {
                                type: 'range',
                                id: 'dur',
                                min: 1.5,
                                max: 10,
                                step: 0.1,
                                value: durSec,
                                onChange: function (e) {
                                  var sec = Number(e.target.value) || 3
                                  var frames = Math.round(sec * (sb.fps || 60))
                                  scheduleScenePatch(
                                    Object.assign({}, sc, { durationSec: sec, durationInFrames: frames }),
                                    ['durationSec'],
                                    '改第 ' + (safeIdx + 1) + ' 镜时长',
                                  )
                                },
                              }),
                              h('b', { id: 'durN' }, durSec.toFixed(1) + ' 秒'),
                            ), 'sc-dur')
                          })(),

                          renderAskSceneBlock(proj, sb, sc, safeIdx, kit),
                        ),
                  ),
                )
              : null,

            // 4. New Film page (`section.rd-new`)
            h('section', { className: 'rd-new' },
              h('h1', null,
                '说一句想给什么做片子，',
                h('span', { className: 'rd-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
                '分镜替你排好，你只管挑和改。',
              ),
              pendingHandoff
                ? h('div', { className: 'rd-wait show', id: 'wait', role: 'status' },
                    DsBadge(React),
                    h('p', null,
                      h('b', null, '已经交给 DeepSeek，它在对话里排分镜'),
                      h('span', null, '「' + (pendingHandoff.brief || '') + '」　排好后会出现在这里，不用守着。'),
                    ),
                    pendingHandoff.sessionId
                      ? h('button', {
                          type: 'button',
                          className: 'rd-btn line sm',
                          onClick: function () { openExistingSessionOnly(hostCtx, pendingHandoff.sessionId, showToast) },
                        }, '回到那条对话')
                      : null,
                    h('button', {
                      type: 'button',
                      className: 'rd-btn quiet sm',
                      onClick: function () {
                        apiPost({ action: 'clear_handoff' }).then(function (d) {
                          patchState({ snapshot: d.snapshot })
                        }).catch(function () {})
                      },
                    }, '不等了'),
                  )
                : h('div', { className: 'rd-wait', id: 'wait', role: 'status' }),

              h('div', { className: 'rd-brief' },
                h('textarea', {
                  id: 'brief',
                  placeholder: '例如：给 Dot 做一条 15 秒的发布片，重点讲「资料一变它就替你看一遍」，结尾引导去插件页安装。',
                  value: state.newBrief,
                  onChange: function (e) { patchState({ newBrief: e.target.value }) },
                }),
                h('div', { className: 'opts', id: 'opts' },
                  canUseWorkspacePicker(hostCtx, props)
                    ? h(React.Fragment || 'react.fragment', null,
                        h('button', {
                          ref: wsPickerBtnRef,
                          type: 'button',
                          id: 'btnWsPicker',
                          className: 'rd-chip ws',
                          'aria-haspopup': 'menu',
                          'aria-expanded': Boolean(state.wsPickerOpen),
                          title: (currentWs && currentWs.path) || '选择工作区或添加本地目录',
                          onClick: function () {
                            patchState({ wsPickerOpen: !state.wsPickerOpen })
                          },
                        },
                          '读这个工作区：' + ((currentWs && currentWs.name) || '选择工作区'),
                          h('span', { 'aria-hidden': 'true', style: { opacity: 0.65, fontSize: '10px' } }, '▾'),
                        ),
                        props.renderFactorySlot('workspace.picker', {
                          open: Boolean(state.wsPickerOpen),
                          anchorRef: wsPickerBtnRef,
                          selectedId: (currentWs && currentWs.workspaceId) || undefined,
                          onPick: function (pickedId) {
                            patchState({ selectedWorkspaceId: pickedId, wsPickerOpen: false })
                          },
                          onClose: function () {
                            patchState({ wsPickerOpen: false })
                          },
                        }),
                      )
                    : wsInfo.items.length > 1
                      ? h('select', {
                          className: 'rd-chip',
                          value: (currentWs && currentWs.workspaceId) || '',
                          onChange: function (e) { patchState({ selectedWorkspaceId: e.target.value }) },
                        },
                          wsInfo.items.map(function (w) {
                            return h('option', { key: w.workspaceId, value: w.workspaceId }, '读这个工作区：' + w.name)
                          }),
                        )
                      : h('span', { className: 'rd-chip' },
                          '读这个工作区：' + ((currentWs && currentWs.name) || '当前工作区'),
                        ),
                  h('button', {
                    type: 'button',
                    className: 'rd-chip' + (state.newAspect === '16:9' ? ' on' : ''),
                    onClick: function () { patchState({ newAspect: '16:9' }) },
                  }, '横屏 16:9'),
                  h('button', {
                    type: 'button',
                    className: 'rd-chip' + (state.newAspect === '9:16' ? ' on' : ''),
                    onClick: function () { patchState({ newAspect: '9:16' }) },
                  }, '竖屏 9:16'),
                  h('button', {
                    type: 'button',
                    className: 'rd-chip' + (state.newDurPreset === '15' ? ' on' : ''),
                    onClick: function () { patchState({ newDurPreset: '15' }) },
                  }, '15 秒左右'),
                  h('button', {
                    type: 'button',
                    className: 'rd-chip' + (state.newDurPreset === '30' ? ' on' : ''),
                    onClick: function () { patchState({ newDurPreset: '30' }) },
                  }, '30 秒左右'),
                  h('button', {
                    type: 'button',
                    className: 'rd-btn pri go',
                    id: 'btnGo',
                    onClick: function () {
                      var brief = (state.newBrief || '').trim() || '给当前工作区的项目做一条结构清晰的产品发布短片，重点展示真实功能与使用场景。'
                      var aspText = state.newAspect === '9:16' ? '竖屏 9:16 (1080×1920)' : '横屏 16:9 (1920×1080)'
                      var prompt = [
                        '请用「制片台」工具帮我新排一条视频分镜（不要传 id，避免覆盖已有片子）：',
                        '- 创作需求：' + brief,
                        '- 画幅规格：' + aspText + '，总时长控制在 ' + state.newDurPreset + ' 秒左右。',
                        '- 请先调 reel_list 查看 8 种镜头样式，再先读当前工作区里的真实说明或截图（若有合适界面截图可调 reel_add_asset 导入），最后调用 reel_save_storyboard 保存分镜单。仓库里没有的统计数字不要硬编。',
                      ].join('\n')
                      handoffNewFilmToHost(hostCtx, {
                        workspaceId: currentWs && currentWs.workspaceId,
                        brief: brief,
                        aspect: state.newAspect,
                        targetDurationSec: Number(state.newDurPreset) || 15,
                        prompt: prompt,
                        serverWorkspaces: state.serverWorkspaces,
                        hookWorkspaces: hookWorkspaceItems,
                      }, showToast)
                    },
                  }, '交给 DeepSeek 排分镜'),
                ),
              ),

              h('p', { className: 'rd-note' },
                '会打开一条原生对话并带上这段话。它要读你的工作区才排得准，所以这一步在对话里做；排好后对话里会出现这条片的画面，点一下回到这里。不会覆盖已有的片子。　',
                h('button', {
                  type: 'button',
                  className: 'rd-link',
                  id: 'btnBlank',
                  onClick: function () {
                    apiPost({
                      action: 'create_project',
                      title: (state.newBrief || '').trim().slice(0, 20) || '未命名新片',
                      aspect: state.newAspect,
                      brief: state.newBrief || '',
                      workspaceId: currentWs && currentWs.workspaceId,
                    }).then(function (d) {
                      applyIncomingView(d, true)
                      patchState({ page: 'edit' })
                      showToast('已创建空白片，可直接编辑')
                    }).catch(function (err) { showToast(err.message) })
                  },
                }, '不用它，直接建一条空白片'),
              ),

              h('div', { className: 'rd-samples' },
                h('h3', null, '或者挑一条示例，直接改成你的'),
                h('div', { className: 'rd-sgrid', id: 'samples' },
                  ((snap && snap.samples) || []).map(function (smp) {
                    var sKit = (snap.brandKits || []).find(function (k) { return k.id === smp.brandKitId }) || kit
                    var sTl = computeClientRanges(smp)
                    return h('button', {
                      key: smp.id,
                      type: 'button',
                      className: 'rd-sample',
                      onClick: function () {
                        apiPost({ action: 'create_from_sample', sampleId: smp.id }).then(function (d) {
                          applyIncomingView(d, true)
                          patchState({ page: 'edit' })
                          showToast('已从示例复制一份新片')
                        }).catch(function (err) { showToast(err.message) })
                      },
                    },
                      h(ScaledFrameBox, {
                        React: React,
                        className: 'pic',
                        storyboard: smp,
                        brandKit: sKit,
                        projectId: smp.id,
                        frame: 48,
                        cover: true,
                      }),
                      h('p', null,
                        smp.title,
                        h('span', null, '示例 · ' + (smp.aspect === '9:16' ? '竖屏' : '横屏') + ' · ' + smp.scenes.length + ' 镜 · ' + sTl.totalSec.toFixed(1) + ' 秒'),
                      ),
                    )
                  }),
                ),
              ),
            ),

            // 5. Popovers + Hidden file input + Toast
            renderPopover(proj, sb, kit, tl),

            h('input', {
              ref: fileInputRef,
              type: 'file',
              accept: 'image/png,image/jpeg,image/webp,image/gif',
              style: { display: 'none' },
              onChange: function (e) {
                var f = e.target.files && e.target.files[0]
                e.target.value = ''
                if (f) handleImageFileUpload(f)
              },
            }),

            state.toast
              ? h('div', { className: 'rd-toast', role: 'status' }, state.toast)
              : null,
          ),
        )
      }
    }

    exports.inject = ['slots', 'layout', 'uiWorkspace', 'workspaces', 'sessions', 'uiConversation', 'conversation']

    exports.apply = function apply(ctx) {
      var React = loadReact()
      if (!React) return
      if (typeof window !== 'undefined' && window.__REEL_DESK_ENABLE_TEST_HOOK__) {
        window.__REEL_DESK_CTX__ = ctx
      }

      ctx.effect(function () {
        var cleanups = []

        // 1. Project reel_save_storyboard & reel_patch_scene tool calls/results into turnTail view nodes
        var uiConvEvents = getHostService(ctx, 'uiConversation', false)
        if (uiConvEvents && uiConvEvents.events && typeof uiConvEvents.events.register === 'function') {
          var matchReelEvent = function (event) {
            if (!event || !event.data) return null
            if (event.type === 'tool/call' && (event.data.name === 'reel_save_storyboard' || event.data.name === 'reel_patch_scene')) {
              return { id: String(event.data.callId), role: 'start' }
            }
            if (event.type === 'tool/result' && event.data.meta && (event.data.meta.reelDeskCard || event.data.meta.kind)) {
              var callId = (event.data.message && event.data.message.source && event.data.message.source.callId) ||
                event.data.callId ||
                event.data.toolCallId
              if (callId) return { id: String(callId), role: 'update' }
            }
            return null
          }

          var offEvents = uiConvEvents.events.register({
            kind: 'reel-desk-card',
            target: 'chat',
            match: {
              'tool/call': matchReelEvent,
              'tool/result': matchReelEvent,
            },
            start: function () { return { status: 'running', meta: null } },
            update: function (c, match) {
              return match.event.type === 'tool/result'
                ? { status: 'done', meta: match.event.data.meta }
                : c.state
            },
            buildViewNode: function (c) {
              var anchor = c.start || (c.matches && c.matches[0])
              var resMatch = c.matches && c.matches.find(function (m) {
                return m.event.type === 'tool/result' && m.event.data && m.event.data.meta
              })
              var meta = (c.state && c.state.meta) || (resMatch && resMatch.event.data.meta)
              if (!anchor || !meta) return null
              return {
                key: c.key,
                kind: 'reel-desk-card',
                id: c.id,
                target: 'chat',
                anchorSeq: anchor.event.seq,
                location: anchor.location,
                visibility: 'hidden',
                data: meta,
              }
            },
          })
          if (typeof offEvents === 'function') cleanups.push(offEvents)
        }

        // 2. Register conversation.chat.turnTail (stays visible outside folded TurnProcessNodeView!)
        var offTurnTail = ctx.slots.inject('conversation.chat.turnTail', function () {
          return ctx.slots.register({
            name: 'conversation.chat.turnTail',
            id: '@oxmumu3/dsh-reel-desk',
            order: 15,
            inject: function (sessionId) {
              var sessions = getHostService(ctx, 'sessions', false)
              var uiConv = getHostService(ctx, 'uiConversation', false)
              var binding = (sessions && typeof sessions.binding === 'function') ? sessions.binding(sessionId) : null
              var chat = (binding && uiConv && typeof uiConv.binding === 'function')
                ? uiConv.binding(binding).target('chat')
                : null
              return {
                keyedHooks: {
                  reelCards: function (turnNum) {
                    var snap = chat ? chat.getSnapshot() : null
                    return snap ? snap.nodes.turnDataSource(Number(turnNum), 'reel-desk-card') : undefined
                  },
                },
              }
            },
          }, makeTurnTailComponent(React, ctx))
        })
        if (typeof offTurnTail === 'function') cleanups.push(offTurnTail)

        // 3. Register compact tool.call.toolview receipts
        var offSaveView = ctx.slots.inject('tool.call.toolview', function () {
          return ctx.slots.register(
            { name: 'tool.call.toolview', key: 'reel_save_storyboard' },
            makeToolViewReceiptComponent(React, ctx, '正在排分镜'),
          )
        })
        if (typeof offSaveView === 'function') cleanups.push(offSaveView)

        var offPatchView = ctx.slots.inject('tool.call.toolview', function () {
          return ctx.slots.register(
            { name: 'tool.call.toolview', key: 'reel_patch_scene' },
            makeToolViewReceiptComponent(React, ctx, '正在局部调整分镜'),
          )
        })
        if (typeof offPatchView === 'function') cleanups.push(offPatchView)

        // 4. Register main panel & sidebar icon
        var offMain = ctx.slots.inject('main', function () {
          return ctx.slots.register(
            { name: 'main', key: PANEL_KEY },
            makePanelComponent(React, ctx),
          )
        })
        if (typeof offMain === 'function') cleanups.push(offMain)

        var offSidebar = ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register(
            { name: 'sidebar.panellist', id: PANEL_KEY, order: 94, label: function () { return '制片台' } },
            makeIconComponent(React),
          )
        })
        if (typeof offSidebar === 'function') cleanups.push(offSidebar)

        return function () {
          while (cleanups.length) {
            var fn = cleanups.pop()
            try { fn() } catch (_e) {}
          }
        }
      })
    }
