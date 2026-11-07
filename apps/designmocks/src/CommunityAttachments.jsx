import React,{useId,useLayoutEffect,useRef,useState} from "react";
import {communityAttachmentFiles} from "./community-attachments.js";

export function CommunityAttachments({target,busy,onSubmit,onClose}) {
  const input=useRef(null),inFlight=useRef(false),scope=useRef(null),helpId=useId(),[message,setMessage]=useState("");
  useLayoutEffect(()=>{const current={};scope.current=current;input.current?.focus();return()=>{scope.current=null;};},[]);
  return <section className="notice community-attachment-form" aria-label={target.targetType==="post"?"Add discussion images":"Add reply images"}>
    <h3>Add images to this saved {target.targetType==="post"?"discussion":"reply"}</h3>
    <p id={helpId}>Up to {Math.max(0,3-target.assetCount)} more images can be added. Existing images stay saved. Keep this page open to retry any unconfirmed images.</p>
    {message&&<p role="alert">{message}</p>}
    <form className="admin-form" onSubmit={async event=>{
      event.preventDefault();if(inFlight.current||busy)return;
      const form=event.currentTarget,files=new FormData(form).getAll("images").filter(file=>file.name),current=scope.current;
      const invalid=communityAttachmentFiles(files);if(invalid){setMessage(invalid);return;}
      inFlight.current=true;setMessage("");
      try{const queued=await onSubmit(target,files);if(scope.current!==current)return;if(queued!==false){form.reset();onClose(true);}}
      catch{if(scope.current===current)setMessage("Couldn’t start these uploads. Keep your selection and try again.");}
      finally{if(scope.current===current)inFlight.current=false;}
    }}>
      <fieldset className="community-fields" disabled={busy}>
        <label>Additional images<input ref={input} name="images" type="file" required multiple accept="image/png,image/jpeg,image/webp" aria-describedby={helpId}/></label>
        <button type="submit" className="button">Add selected images</button>
      </fieldset>
      <button type="button" className="button quiet" disabled={busy} onClick={()=>onClose(false)}>Cancel image selection</button>
    </form>
  </section>;
}
