import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const imageType = (bytes: Uint8Array) => {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP") return "image/webp";
  return null;
};

Deno.serve(async (request) => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const headers = { "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" };
  const respond = (body: unknown,status=200) => new Response(JSON.stringify(body),{status,headers});
  if (!origin || request.headers.get("origin") !== origin) return respond({error:"Origin not allowed"},403);
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({error:"Community images are not connected"},503);
  const student=createClient(url,anon,{global:{headers:{Authorization:request.headers.get("authorization")??""}},auth:{persistSession:false}});
  const {data:{user}}=await student.auth.getUser();
  if (!user) return respond({error:"Sign in required"},401);
  const admin=createClient(url,service,{auth:{persistSession:false}});
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const {targetType,targetId}=await request.json();
      if (!['post','comment'].includes(targetType)||typeof targetId!=="string") return respond({error:"Invalid community target"},400);
      const paths=await student.rpc("community_media_paths",{p_target_type:targetType,p_target_id:targetId});
      if (paths.error) throw paths.error;
      if (!paths.data?.length) return respond({media:[]});
      const signed=await admin.storage.from("community-media").createSignedUrls(paths.data.map((item:{path:string})=>item.path),300);
      if (signed.error) throw signed.error;
      return respond({media:paths.data.map((item:{id:string;ordinal:number},index:number)=>({id:item.id,ordinal:item.ordinal,url:signed.data[index].signedUrl}))});
    }
    const form=await request.formData(),targetType=String(form.get("targetType")??""),targetId=String(form.get("targetId")??""),ordinal=Number(form.get("ordinal")),file=form.get("file");
    if (!(file instanceof File)||!['post','comment'].includes(targetType)||!Number.isInteger(ordinal)||ordinal<1||ordinal>3||file.size<1||file.size>5242880) return respond({error:"Invalid community image"},400);
    const bytes=new Uint8Array(await file.arrayBuffer()),detected=imageType(bytes);
    if (!detected||detected!==file.type) return respond({error:"Image content does not match its file type"},400);
    const extension=detected==='image/jpeg'?'jpg':detected.split('/')[1];
    const path=`community/${user.id}/${targetType}/${targetId}/${crypto.randomUUID()}.${extension}`;
    const uploaded=await admin.storage.from("community-media").upload(path,bytes,{contentType:detected,upsert:false});
    if (uploaded.error) throw uploaded.error;
    const registered=await admin.rpc("register_community_asset",{p_user_id:user.id,p_target_type:targetType,p_target_id:targetId,p_storage_path:path,p_ordinal:ordinal,p_mime_type:detected,p_byte_size:file.size});
    if (registered.error) { await admin.storage.from("community-media").remove([path]); throw registered.error; }
    return respond({id:registered.data,ordinal});
  } catch(error) { return respond({error:error instanceof Error?error.message:"Community image request failed"},400); }
});
