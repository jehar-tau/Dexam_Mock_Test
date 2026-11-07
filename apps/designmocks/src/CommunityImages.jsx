import React,{useEffect,useLayoutEffect,useRef,useState} from "react";
import { PrivateRasterImage,PrivateImageInspectionDialog } from "./DrawingInspection.jsx";
import { communityImageKey,communityImageSelection } from "./community-inspection.js";
let latestInspection=0;
export function CommunityImages({ images = [], label,expiresAt=null,onUnavailableFocus=()=>{} }) {
  const [selection,setSelection]=useState(null),buttons=useRef(new Map()),alive=useRef(false),active=useRef(null),previous=useRef(null),scope=useRef(null),fallback=useRef(onUnavailableFocus);
  fallback.current=onUnavailableFocus;
  const expired=Number.isFinite(expiresAt)&&performance.now()>=expiresAt,visible=expired||!Array.isArray(images)?[]:images;
  scope.current={images:visible,expiresAt};
  const selected=communityImageSelection(visible,selection?.key);active.current=selected?.key??null;
  useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current=null;};},[]);
  useLayoutEffect(()=>{
    const prior=previous.current;
    if(selection&&!selected)setSelection(value=>value?.key===selection.key?null:value);
    if(prior&&!selected&&prior.intent===latestInspection&&document.activeElement===document.body){
      const replacement=visible.find(image=>image.id===prior.image.id),button=buttons.current.get(replacement&&communityImageKey(replacement));
      if(button?.isConnected)button.focus();else fallback.current();
    }
    previous.current=selected?{...selected,intent:selection.intent}:null;
  },[selected?.key,images,expired]);
  useEffect(()=>{
    if(!Number.isFinite(expiresAt))return;
    const timer=setTimeout(()=>{if(alive.current&&scope.current.expiresAt===expiresAt){active.current=null;setSelection(null);}},Math.max(0,expiresAt-performance.now()));
    return()=>clearTimeout(timer);
  },[expiresAt]);
  function open(key,button) {
    const current=scope.current;
    if(!alive.current||!button.isConnected||(Number.isFinite(current.expiresAt)&&performance.now()>=current.expiresAt)||!communityImageSelection(current.images,key))return;
    active.current=key;setSelection({key,intent:++latestInspection});
  }
  function close(key) {
    if(!alive.current||active.current!==key)return;
    active.current=null;setSelection(null);const button=buttons.current.get(key);
    if(selection?.intent===latestInspection&&!document.querySelector("dialog[open]")&&button?.isConnected)button.focus();
  }
  return <>
    {visible.map((image,index)=>{
      const key=communityImageKey(image),name=`${label} ${index+1}`;
      return key&&<div className="community-image-frame" key={key}>
        <PrivateRasterImage image={image} label={name}/>
        <button type="button" className="button quiet" ref={node=>{if(node)buttons.current.set(key,node);else buttons.current.delete(key);}} onClick={event=>open(key,event.currentTarget)}>Inspect {name.toLowerCase()}</button>
      </div>;
    })}
    {selected&&<PrivateImageInspectionDialog key={selected.key} image={selected.image} label={`${label} ${selected.index+1}`} onClose={()=>close(selected.key)}/>}
  </>;
}
