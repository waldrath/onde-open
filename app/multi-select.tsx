'use client';
import {useEffect,useRef} from 'react';
import {ChevronDown} from 'lucide-react';

type MultiSelectGroup={label?:string;options:readonly (readonly [value:string,label:string])[]};

// A filter that takes several values: a disclosure listing checkboxes (by
// group), summarised like a select. No value ticked means "all".
export function MultiSelect({className,label,ariaLabel,allLabel,countLabel,groups,selected,onChange}:{className?:string;label:string;ariaLabel:string;allLabel:string;countLabel:(count:number)=>string;groups:readonly MultiSelectGroup[];selected:readonly string[];onChange:(values:string[])=>void}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  // Closes on a press outside it and on Escape, like a native select; the
  // page is listened to only while the list is open.
  const el=ref.current;if(!el)return;
  const outside=(event:PointerEvent)=>{if(!el.contains(event.target as Node))el.open=false;};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();el.open=false;el.querySelector('summary')?.focus();}};
  const listen=(on:boolean)=>{const method=on?'addEventListener':'removeEventListener';document[method]('pointerdown',outside as EventListener);document[method]('keydown',escape as EventListener,true);};
  const toggle=()=>listen(el.open);
  el.addEventListener('toggle',toggle);
  return()=>{el.removeEventListener('toggle',toggle);listen(false);};
 },[]);
 const labels=new Map(groups.flatMap(group=>group.options.map(([value,text])=>[value,text] as const)));
 const chosen=selected.filter(value=>labels.has(value));
 const summary=chosen.length===0?allLabel:chosen.length<=2?chosen.map(value=>labels.get(value)).join(', '):countLabel(chosen.length);
 const toggle=(value:string,on:boolean)=>onChange(on?[...selected.filter(item=>item!==value),value]:selected.filter(item=>item!==value));
 return <div className={`filter-field multi-field${className?' '+className:''}`}>
  <span className="filter-field-label">{label}</span>
  <details className="multi-select" ref={ref}>
   <summary className="multi-select-summary" aria-label={`${ariaLabel} : ${summary}`}><span>{summary}</span>{chosen.length>0&&<span className="multi-select-count" aria-hidden="true">{chosen.length}</span>}<ChevronDown size={16} aria-hidden="true"/></summary>
   <div className="multi-select-panel" role="group" aria-label={ariaLabel}>
    <label className="multi-select-option multi-select-all"><input type="checkbox" checked={chosen.length===0} onChange={()=>onChange([])}/>{allLabel}</label>
    {groups.map((group,index)=><div key={group.label??index} className="multi-select-group">{group.label&&<span className="multi-select-group-label">{group.label}</span>}{group.options.map(([value,text])=><label key={value} className="multi-select-option"><input type="checkbox" checked={selected.includes(value)} onChange={event=>toggle(value,event.target.checked)}/>{text}</label>)}</div>)}
   </div>
  </details>
 </div>;
}
