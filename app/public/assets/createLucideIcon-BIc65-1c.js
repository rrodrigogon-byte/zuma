import{r as c}from"./index-CvEA7DeT.js";/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=e=>(e.match(/\d+[xX]\d+|[A-Z]?[a-z]+|[A-Z]|\d+/g)??[]).join("-").toLowerCase();/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function B(e,t,n=[]){if(t==null)throw new Error("[lucide]: iconNode is required when icon name is used");return{name:j(e),size:24,node:t,...n.length>0?{aliases:n}:{}}}/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=e=>{let t="",n=!1;for(const o of e){if(o==="-"||o==="_"||o<=" "){n=t.length>0;continue}t.length===0?t+=o.toLowerCase():t+=n?o.toUpperCase():o,n=!1}return t};/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=e=>{const t=E(e);return t.charAt(0).toUpperCase()+t.slice(1)};/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=(...e)=>{const t=new Set;for(const n of e)if(typeof n=="string")for(const o of n.split(/\s+/))o&&t.add(o);return[...t].join(" ")};/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function S(e){return e!=null}function P(e,t={}){var g,w;const n=t.attributeNames??{},o=i=>n[i]??i,l=e.size??e.width??r.width,a=e.size??e.height??r.height,h=((g=e.aliases)==null?void 0:g.filter(i=>typeof i=="string"&&i.trim()!=="").map(i=>`lucide-${i}`))??[],f=[...e.name?[`lucide-${e.name}`]:[],...h],s=((w=t.className)==null?void 0:w.split(" ").filter(Boolean))??[],k=t.includeDefaultClasses===!1?m(...s):m("lucide",...f,...s),x=t.absoluteStrokeWidth?Number(t.strokeWidth??r["stroke-width"])*Number(e.size??e.width??r.width)/Number(t.size??t.width??r.width):t.strokeWidth??r["stroke-width"];return["svg",{...Object.entries(r).reduce((i,[u,d])=>(i[o(u)]=d,i),{}),..."color"in t&&t.color&&{[o("stroke")]:t.color},..."size"in t&&S(t.size)&&{[o("width")]:t.size,[o("height")]:t.size},..."width"in t&&S(t.width)&&{[o("width")]:t.width},..."height"in t&&S(t.height)&&{[o("height")]:t.height},[o("stroke-width")]:x,...k&&{[o("class")]:k},[o("viewBox")]:`0 0 ${l} ${a}`,...t.hasA11yProp===!1?{[o("aria-hidden")]:"true"}:{},..."attributes"in t&&t.attributes},e.node.map(i=>{const[u,d,b]=i,C=t.nonScalingStroke?{[o("vector-effect")]:"non-scaling-stroke",...d}:d;return b?[u,C,b]:[u,C]})]}/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function $(e,t={}){return P(e,{...t,attributeNames:{...t.attributeNames,class:"className","stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap","stroke-linejoin":"strokeLinejoin","vector-effect":"vectorEffect"}})}/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R=e=>{if(e==null||typeof e!="object")return!1;for(const t in e)if(Object.prototype.hasOwnProperty.call(e,t)&&(t.startsWith("aria-")||t==="role"||t==="title")&&e[t]!=null)return!0;return!1},D=c.createContext({}),F=()=>c.useContext(D),U=c.forwardRef(({color:e,size:t,width:n,height:o,strokeWidth:l,absoluteStrokeWidth:a,nonScalingStroke:h,className:f="",children:s,iconNode:k=[],icon:x={node:k,aliases:[],size:24},...N},g)=>{const{size:w=24,strokeWidth:i=2,absoluteStrokeWidth:u=!1,nonScalingStroke:d=!1,color:b="currentColor",className:C=""}=F()??{},A=!!s||R(N),[W,y,z=[]]=$(x,{color:e??b,width:n??t??w,height:o??t??w,strokeWidth:l??i,absoluteStrokeWidth:a??u,nonScalingStroke:h??d,className:m(C,f),hasA11yProp:A,attributes:N});return c.createElement(W,{ref:g,...y},[...z.map(([v,L])=>c.createElement(v,L)),...Array.isArray(s)?s:[s]])});/**
 * @license lucide-react v1.77.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */function q(e,t=[],n=[]){const o=typeof e=="string"?B(e,t,n):e,l=c.forwardRef(({className:a,...h},f)=>c.createElement(U,{ref:f,icon:o,className:a,...h}));return o.name&&(l.displayName=I(o.name)),l}export{q as c};
