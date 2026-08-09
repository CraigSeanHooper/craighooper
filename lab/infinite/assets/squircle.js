(()=>{function x({topLeftCornerRadius:e,topRightCornerRadius:t,bottomRightCornerRadius:n,bottomLeftCornerRadius:o,width:$,height:f}){let c={topLeft:-1,topRight:-1,bottomLeft:-1,bottomRight:-1},s={topLeft:e,topRight:t,bottomLeft:o,bottomRight:n};return Object.entries(s).sort(([,i],[,r])=>r-i).forEach(([i,r])=>{let m=i,h=T[m],a=Math.min(...h.map(g=>{let u=s[g.corner];if(r===0&&u===0)return 0;let l=c[g.corner],P=g.side==="top"||g.side==="bottom"?$:f;return l>=0?P-c[g.corner]:r/(r+u)*P}));c[m]=a,s[m]=Math.min(r,a)}),{topLeft:{radius:s.topLeft,roundingAndSmoothingBudget:c.topLeft},topRight:{radius:s.topRight,roundingAndSmoothingBudget:c.topRight},bottomLeft:{radius:s.bottomLeft,roundingAndSmoothingBudget:c.bottomLeft},bottomRight:{radius:s.bottomRight,roundingAndSmoothingBudget:c.bottomRight}}}var T={topLeft:[{corner:"topRight",side:"top"},{corner:"bottomLeft",side:"left"}],topRight:[{corner:"topLeft",side:"top"},{corner:"bottomRight",side:"right"}],bottomLeft:[{corner:"bottomRight",side:"bottom"},{corner:"topLeft",side:"left"}],bottomRight:[{corner:"bottomLeft",side:"bottom"},{corner:"topRight",side:"right"}]};function d({cornerRadius:e,cornerSmoothing:t,preserveSmoothing:n,roundingAndSmoothingBudget:o}){let $=(1+t)*e;if(!n){let u=o/e-1;t=Math.min(t,u),$=Math.min($,o)}let f=90*(1-t),c=Math.sin(M(f/2))*e*Math.sqrt(2),s=(90-f)/2,i=e*Math.tan(M(s/2)),r=45*t,m=i*Math.cos(M(r)),h=m*Math.tan(M(r)),a=($-c-m-h)/3,g=2*a;if(n&&$>o){let u=o-h-c-m,l=u/6,P=u-l;a=Math.min(a,P),g=u-a,$=Math.min($,o)}return{a:g,b:a,c:m,d:h,p:$,arcSectionLength:c,cornerRadius:e}}function A({width:e,height:t,topLeftPathParams:n,topRightPathParams:o,bottomLeftPathParams:$,bottomRightPathParams:f}){return`
    M ${e-o.p} 0
    ${E(o)}
    L ${e} ${t-f.p}
    ${F(f)}
    L ${$.p} ${t}
    ${S($)}
    L 0 ${n.p}
    ${b(n)}
    Z
  `.replace(/[\t\s\n]+/g," ").trim()}function E({cornerRadius:e,a:t,b:n,c:o,d:$,p:f,arcSectionLength:c}){return e?p`
    c ${t} 0 ${t+n} 0 ${t+n+o} ${$}
    a ${e} ${e} 0 0 1 ${c} ${c}
    c ${$} ${o}
        ${$} ${n+o}
        ${$} ${t+n+o}`:p`l ${f} 0`}function F({cornerRadius:e,a:t,b:n,c:o,d:$,p:f,arcSectionLength:c}){return e?p`
    c 0 ${t}
      0 ${t+n}
      ${-$} ${t+n+o}
    a ${e} ${e} 0 0 1 -${c} ${c}
    c ${-o} ${$}
      ${-(n+o)} ${$}
      ${-(t+n+o)} ${$}`:p`l 0 ${f}`}function S({cornerRadius:e,a:t,b:n,c:o,d:$,p:f,arcSectionLength:c}){return e?p`
    c ${-t} 0
      ${-(t+n)} 0
      ${-(t+n+o)} ${-$}
    a ${e} ${e} 0 0 1 -${c} -${c}
    c ${-$} ${-o}
      ${-$} ${-(n+o)}
      ${-$} ${-(t+n+o)}`:p`l ${-f} 0`}function b({cornerRadius:e,a:t,b:n,c:o,d:$,p:f,arcSectionLength:c}){return e?p`
    c 0 ${-t}
      0 ${-(t+n)}
      ${$} ${-(t+n+o)}
    a ${e} ${e} 0 0 1 ${c} -${c}
    c ${o} ${-$}
      ${n+o} ${-$}
      ${t+n+o} ${-$}`:p`l 0 ${-f}`}function M(e){return e*Math.PI/180}function p(e,...t){return e.reduce((n,o,$)=>{let f=t[$];return typeof f=="number"?n+o+f.toFixed(4):n+o+(f!=null?f:"")},"")}function y({cornerRadius:e=0,topLeftCornerRadius:t,topRightCornerRadius:n,bottomRightCornerRadius:o,bottomLeftCornerRadius:$,cornerSmoothing:f,width:c,height:s,preserveSmoothing:i=!1}){if(t=t!=null?t:e,n=n!=null?n:e,$=$!=null?$:e,o=o!=null?o:e,t===n&&n===o&&o===$&&$===t){let g=Math.min(c,s)/2,u=Math.min(t,g),l=d({cornerRadius:u,cornerSmoothing:f,preserveSmoothing:i,roundingAndSmoothingBudget:g});return A({width:c,height:s,topLeftPathParams:l,topRightPathParams:l,bottomLeftPathParams:l,bottomRightPathParams:l})}let{topLeft:r,topRight:m,bottomLeft:h,bottomRight:a}=x({topLeftCornerRadius:t,topRightCornerRadius:n,bottomRightCornerRadius:o,bottomLeftCornerRadius:$,width:c,height:s});return A({width:c,height:s,topLeftPathParams:d({cornerSmoothing:f,preserveSmoothing:i,cornerRadius:r.radius,roundingAndSmoothingBudget:r.roundingAndSmoothingBudget}),topRightPathParams:d({cornerSmoothing:f,preserveSmoothing:i,cornerRadius:m.radius,roundingAndSmoothingBudget:m.roundingAndSmoothingBudget}),bottomRightPathParams:d({cornerSmoothing:f,preserveSmoothing:i,cornerRadius:a.radius,roundingAndSmoothingBudget:a.roundingAndSmoothingBudget}),bottomLeftPathParams:d({cornerSmoothing:f,preserveSmoothing:i,cornerRadius:h.radius,roundingAndSmoothingBudget:h.roundingAndSmoothingBudget})})}function B(e){let t=e.offsetWidth,n=e.offsetHeight;if(!t||!n)return;let o=parseFloat(getComputedStyle(e).borderTopLeftRadius)||12;e.style.clipPath=`path('${y({width:t,height:n,cornerRadius:o,cornerSmoothing:1,preserveSmoothing:!0})}')`}function L(){let e=document.querySelectorAll(".controls, .controls .pct");if(!e.length)return;let t=new ResizeObserver(n=>{for(let o of n)B(o.target)});e.forEach(n=>{B(n),t.observe(n)}),document.fonts&&document.fonts.ready&&document.fonts.ready.then(()=>e.forEach(B))}document.readyState!=="loading"?L():document.addEventListener("DOMContentLoaded",L);})();
