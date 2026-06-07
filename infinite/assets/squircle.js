(()=>{function x({topLeftCornerRadius:t,topRightCornerRadius:n,bottomRightCornerRadius:$,bottomLeftCornerRadius:e,width:o,height:f}){let c={topLeft:-1,topRight:-1,bottomLeft:-1,bottomRight:-1},i={topLeft:t,topRight:n,bottomLeft:e,bottomRight:$};return Object.entries(i).sort(([,m],[,s])=>s-m).forEach(([m,s])=>{let r=m,h=T[r],u=Math.min(...h.map(a=>{let g=i[a.corner];if(s===0&&g===0)return 0;let l=c[a.corner],P=a.side==="top"||a.side==="bottom"?o:f;return l>=0?P-c[a.corner]:s/(s+g)*P}));c[r]=u,i[r]=Math.min(s,u)}),{topLeft:{radius:i.topLeft,roundingAndSmoothingBudget:c.topLeft},topRight:{radius:i.topRight,roundingAndSmoothingBudget:c.topRight},bottomLeft:{radius:i.bottomLeft,roundingAndSmoothingBudget:c.bottomLeft},bottomRight:{radius:i.bottomRight,roundingAndSmoothingBudget:c.bottomRight}}}var T={topLeft:[{corner:"topRight",side:"top"},{corner:"bottomLeft",side:"left"}],topRight:[{corner:"topLeft",side:"top"},{corner:"bottomRight",side:"right"}],bottomLeft:[{corner:"bottomRight",side:"bottom"},{corner:"topLeft",side:"left"}],bottomRight:[{corner:"bottomLeft",side:"bottom"},{corner:"topRight",side:"right"}]};function d({cornerRadius:t,cornerSmoothing:n,preserveSmoothing:$,roundingAndSmoothingBudget:e}){let o=(1+n)*t;if(!$){let g=e/t-1;n=Math.min(n,g),o=Math.min(o,e)}let f=90*(1-n),c=Math.sin(M(f/2))*t*Math.sqrt(2),i=(90-f)/2,m=t*Math.tan(M(i/2)),s=45*n,r=m*Math.cos(M(s)),h=r*Math.tan(M(s)),u=(o-c-r-h)/3,a=2*u;if($&&o>e){let g=e-h-c-r,l=g/6,P=g-l;u=Math.min(u,P),a=g-u,o=Math.min(o,e)}return{a,b:u,c:r,d:h,p:o,arcSectionLength:c,cornerRadius:t}}function A({width:t,height:n,topLeftPathParams:$,topRightPathParams:e,bottomLeftPathParams:o,bottomRightPathParams:f}){return`
    M ${t-e.p} 0
    ${F(e)}
    L ${t} ${n-f.p}
    ${S(f)}
    L ${o.p} ${n}
    ${b(o)}
    L 0 ${$.p}
    ${q($)}
    Z
  `.replace(/[\t\s\n]+/g," ").trim()}function F({cornerRadius:t,a:n,b:$,c:e,d:o,p:f,arcSectionLength:c}){return t?p`
    c ${n} 0 ${n+$} 0 ${n+$+e} ${o}
    a ${t} ${t} 0 0 1 ${c} ${c}
    c ${o} ${e}
        ${o} ${$+e}
        ${o} ${n+$+e}`:p`l ${f} 0`}function S({cornerRadius:t,a:n,b:$,c:e,d:o,p:f,arcSectionLength:c}){return t?p`
    c 0 ${n}
      0 ${n+$}
      ${-o} ${n+$+e}
    a ${t} ${t} 0 0 1 -${c} ${c}
    c ${-e} ${o}
      ${-($+e)} ${o}
      ${-(n+$+e)} ${o}`:p`l 0 ${f}`}function b({cornerRadius:t,a:n,b:$,c:e,d:o,p:f,arcSectionLength:c}){return t?p`
    c ${-n} 0
      ${-(n+$)} 0
      ${-(n+$+e)} ${-o}
    a ${t} ${t} 0 0 1 -${c} -${c}
    c ${-o} ${-e}
      ${-o} ${-($+e)}
      ${-o} ${-(n+$+e)}`:p`l ${-f} 0`}function q({cornerRadius:t,a:n,b:$,c:e,d:o,p:f,arcSectionLength:c}){return t?p`
    c 0 ${-n}
      0 ${-(n+$)}
      ${o} ${-(n+$+e)}
    a ${t} ${t} 0 0 1 ${c} -${c}
    c ${e} ${-o}
      ${$+e} ${-o}
      ${n+$+e} ${-o}`:p`l 0 ${-f}`}function M(t){return t*Math.PI/180}function p(t,...n){return t.reduce(($,e,o)=>{let f=n[o];return typeof f=="number"?$+e+f.toFixed(4):$+e+(f!=null?f:"")},"")}function y({cornerRadius:t=0,topLeftCornerRadius:n,topRightCornerRadius:$,bottomRightCornerRadius:e,bottomLeftCornerRadius:o,cornerSmoothing:f,width:c,height:i,preserveSmoothing:m=!1}){if(n=n!=null?n:t,$=$!=null?$:t,o=o!=null?o:t,e=e!=null?e:t,n===$&&$===e&&e===o&&o===n){let a=Math.min(c,i)/2,g=Math.min(n,a),l=d({cornerRadius:g,cornerSmoothing:f,preserveSmoothing:m,roundingAndSmoothingBudget:a});return A({width:c,height:i,topLeftPathParams:l,topRightPathParams:l,bottomLeftPathParams:l,bottomRightPathParams:l})}let{topLeft:s,topRight:r,bottomLeft:h,bottomRight:u}=x({topLeftCornerRadius:n,topRightCornerRadius:$,bottomRightCornerRadius:e,bottomLeftCornerRadius:o,width:c,height:i});return A({width:c,height:i,topLeftPathParams:d({cornerSmoothing:f,preserveSmoothing:m,cornerRadius:s.radius,roundingAndSmoothingBudget:s.roundingAndSmoothingBudget}),topRightPathParams:d({cornerSmoothing:f,preserveSmoothing:m,cornerRadius:r.radius,roundingAndSmoothingBudget:r.roundingAndSmoothingBudget}),bottomRightPathParams:d({cornerSmoothing:f,preserveSmoothing:m,cornerRadius:u.radius,roundingAndSmoothingBudget:u.roundingAndSmoothingBudget}),bottomLeftPathParams:d({cornerSmoothing:f,preserveSmoothing:m,cornerRadius:h.radius,roundingAndSmoothingBudget:h.roundingAndSmoothingBudget})})}function B(t){let n=t.offsetWidth,$=t.offsetHeight;if(!n||!$)return;let e=parseFloat(getComputedStyle(t).borderTopLeftRadius)||12,o=y({width:n,height:$,cornerRadius:e,cornerSmoothing:1,preserveSmoothing:!0});t.style.clipPath=`path('${o}')`}function L(){let t=document.querySelector(".controls");if(!t)return;let n=new ResizeObserver(()=>B(t));B(t),n.observe(t),document.fonts&&document.fonts.ready&&document.fonts.ready.then(()=>B(t))}document.readyState!=="loading"?L():document.addEventListener("DOMContentLoaded",L);})();
