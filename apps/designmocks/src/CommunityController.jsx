import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "./PortalShell.jsx";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { checkCommunityFiles, communityLinkLifetime, resumeCommunityImages } from "./community-media.js";

async function rpc(name, input, signal) {
  signal.throwIfAborted();
  const { data, error } = await platform.rpc(name, input).abortSignal(signal);
  if (error) throw error;
  return data;
}

function CommunitySession({ View }) {
  const [posts, setPosts] = useState([]), [thread, setThread] = useState(null), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [pendingPost, setPendingPost] = useState(null), [pendingReply, setPendingReply] = useState(null);
  const scope = useRef(null), threadRequest = useRef(null), expiry = useRef(null), mutationBusy = useRef(false);
  const current = signal => !signal.aborted && scope.current?.signal === signal;
  async function load(signal) {
    try { const result = await rpc("community_feed", { p_exam: null, p_topic: null }, signal); if (current(signal)) setPosts(result); }
    catch { if (current(signal)) setMessage("Couldn’t refresh discussions. Try again."); }
  }
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    load(controller.signal);
    return () => { controller.abort(); threadRequest.current?.abort(); clearTimeout(expiry.current); };
  }, []);
  async function openThread(id) {
    const sessionSignal = scope.current?.signal;
    if (!sessionSignal || !current(sessionSignal)) return;
    threadRequest.current?.abort(); clearTimeout(expiry.current); setThread(null);
    if (!id) return;
    const request = new AbortController(); threadRequest.current = request;
    const cancel = () => request.abort(); sessionSignal.addEventListener("abort", cancel, { once: true });
    try {
      const value = await rpc("community_thread", { p_post_id: id }, request.signal), deadlines = [];
      const targets = [{ type: "post", item: value }, ...value.comments.map(item => ({ type: "comment", item }))];
      await Promise.all(targets.map(async ({ type, item }) => {
        if (!item.assetCount) return;
        const started = performance.now();
        const { data, error } = await platform.functions.invoke("community-media", { body: { targetType: type, targetId: item.id }, signal: request.signal });
        if (error) throw error;
        const lifetime = communityLinkLifetime(data, performance.now() - started);
        item.media = data.media.slice().sort((a, b) => a.ordinal - b.ordinal);
        if (data.media.length) deadlines.push(performance.now() + lifetime);
      }));
      if (!current(sessionSignal) || request.signal.aborted || threadRequest.current !== request) return;
      setThread(value);
      if (deadlines.length) expiry.current = setTimeout(() => {
        if (!current(sessionSignal) || threadRequest.current !== request) return;
        setThread(previous => previous && ({ ...previous, media: [], comments: previous.comments.map(item => ({ ...item, media: [] })) }));
        setMessage("Image links expired. Refresh the discussion to view them again.");
      }, Math.max(0, Math.min(...deadlines) - performance.now()));
    } catch {
      if (current(sessionSignal) && !request.signal.aborted && threadRequest.current === request) setMessage("This discussion or its images are unavailable. Refresh the feed or try again.");
    } finally { sessionSignal.removeEventListener("abort", cancel); }
  }
  async function mutate(action) {
    const signal = scope.current?.signal;
    if (mutationBusy.current || !signal || !current(signal)) return false;
    mutationBusy.current = true; setBusy(true); setMessage("");
    try { return await action(signal); }
    catch { if (current(signal)) setMessage("Couldn’t save this change. Check the discussion and try again."); return false; }
    finally { mutationBusy.current = false; if (current(signal)) setBusy(false); }
  }
  async function finishImages(job, signal) {
    const setPending = job.targetType === "post" ? setPendingPost : setPendingReply;
    try {
      await resumeCommunityImages(job, (body, requestSignal) => platform.functions.invoke("community-media", { body, signal: requestSignal }), signal,
        () => { if (current(signal)) setPending({ ...job }); });
      if (!current(signal)) return false;
      setPending(null); setMessage(job.targetType === "post" ? "Your post is live. All images confirmed." : "Reply added. All images confirmed.");
      await load(signal); if (current(signal)) await openThread(job.postId);
      return true;
    } catch (error) {
      if (current(signal)) { setPending({ ...job }); setMessage(error.message); await load(signal); }
      return false;
    }
  }
  function skipImages(job) {
    if (mutationBusy.current || !job) return;
    (job.targetType === "post" ? setPendingPost : setPendingReply)(null);
    setMessage(`Your ${job.targetType === "post" ? "post" : "reply"} and ${job.next} confirmed images are saved. Remaining images were not uploaded.`);
  }
  return <PortalShell><View posts={posts} thread={thread} message={message} busy={busy} pendingPost={pendingPost} pendingReply={pendingReply}
    onOpen={openThread}
    onRetryPost={() => mutate(signal => finishImages(pendingPost, signal))} onSkipPost={() => skipImages(pendingPost)}
    onRetryReply={() => mutate(signal => finishImages(pendingReply, signal))} onSkipReply={() => skipImages(pendingReply)}
    onSubmit={(fields, files) => mutate(async signal => {
      if (pendingPost) return false;
      const invalid = checkCommunityFiles(files); if (invalid) { setMessage(invalid); return false; }
      const id = await rpc("create_community_post", { p_exam: fields.exam, p_topic: fields.topic, p_title: fields.title, p_body: fields.body }, signal);
      if (!current(signal)) return false;
      if (files.length) {
        const job = { targetType: "post", targetId: id, postId: id, files, next: 0 }; setPendingPost(job);
        await finishImages(job, signal);
      } else { setMessage("Your post is live."); await load(signal); }
      return true; // Text is saved; retrying attachments must never create another post.
    })}
    onComment={(postId, parentId, body, files) => mutate(async signal => {
      if (pendingReply) return false;
      const invalid = checkCommunityFiles(files); if (invalid) { setMessage(invalid); return false; }
      const id = await rpc("add_community_comment", { p_post_id: postId, p_parent_id: parentId, p_body: body }, signal);
      if (!current(signal)) return false;
      if (files.length) {
        const job = { targetType: "comment", targetId: id, postId, files, next: 0 }; setPendingReply(job);
        await finishImages(job, signal);
      } else { setMessage("Reply added."); await load(signal); if (current(signal)) await openThread(postId); }
      return true;
    })}
    onHelpful={id => mutate(async signal => {
      await rpc("mark_community_helpful", { p_comment_id: id }, signal);
      if (current(signal) && thread) { await openThread(thread.id); setMessage("Marked helpful."); }
    })}
    onReport={(postId, commentId) => mutate(async signal => {
      await rpc("report_community_content", { p_post_id: postId, p_comment_id: commentId, p_reason: "other", p_details: "Reported from discussion view" }, signal);
      if (current(signal)) setMessage("Report sent for moderator review.");
    })}
  /></PortalShell>;
}

export function CommunityController({ View }) {
  const { session, loading } = useAuthState();
  if (loading) return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if (!session) return <section className="wrap section"><h1>Sign in to the <em>community.</em></h1><Link to="/account">Student sign in</Link></section>;
  return <CommunitySession key={session.user.id} View={View} />;
}
