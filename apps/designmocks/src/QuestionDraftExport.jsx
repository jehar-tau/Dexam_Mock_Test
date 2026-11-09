import React, { useLayoutEffect, useRef, useState } from "react";

function ExportPacketDownload({ artifact, onDownload }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const downloadRequest = useRef(null);
  useLayoutEffect(() => () => { downloadRequest.current?.abort(); }, []);

  const download = async () => {
    if (downloadRequest.current) return;
    const controller = new AbortController();
    downloadRequest.current = controller;
    setDownloadError("");
    setDownloading(true);
    try {
      await onDownload(artifact, controller.signal);
    } catch {
      if (!controller.signal.aborted) setDownloadError("Couldn’t verify this export packet. Refresh the review queue and try again.");
    } finally {
      downloadRequest.current = null;
      if (!controller.signal.aborted) setDownloading(false);
    }
  };
  return <>
    <button type="button" className="button quiet" disabled={downloading} onClick={download}>
      {downloading ? "Preparing packet…" : "Download bank review packet"}
    </button>
    {downloadError && <p role="alert" className="error">{downloadError}</p>}
  </>;
}

export function QuestionDraftExport({ draft, onExport, onDownload }) {
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await onExport({
        id: draft.id,
        externalKey: form.get("externalKey"),
        rightsConfirmed: form.get("rights") === "on",
        rightsNote: form.get("rightsNote"),
      });
      setMessage("Canonical review artifact created. A reviewed Git change is still required before import.");
    } catch (error) { setMessage(error.message); }
  };
  if (draft.export) return <div className="export-artifact">
    <p><b>{draft.export.externalKey}</b> · canonical review artifact</p>
    <code>{draft.export.contentSha256}</code>
    <p>Git review required before import.</p>
    {onDownload && draft.export.id && <ExportPacketDownload key={draft.export.id} artifact={draft.export} onDownload={onDownload} />}
    <details><summary>Review JSON</summary><pre>{JSON.stringify(draft.export.payload, null, 2)}</pre></details>
  </div>;
  if (draft.status !== "approved") return null;
  return <form className="admin-form" onSubmit={submit}>
    <label>Stable external key<input name="externalKey" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="dmocks-uceed-observation-001" /></label>
    <label>Rights record<textarea name="rightsNote" required minLength="10" maxLength="1000" placeholder="Original DMocks question authored for this bank." /></label>
    <label className="profile-check"><input name="rights" type="checkbox" required /> I confirm DMocks has the right to use this content.</label>
    <button>Create canonical review artifact</button>
    {message&&<p role="status">{message}</p>}
  </form>;
}

export function QuestionDraftExportPreview(){
  const [draft,setDraft]=useState({id:"preview",status:"approved",sourceName:"Original fictional question",payload:{prompt:"Which composition has the clearest hierarchy?",type:"MCQ",provenance:{exam:"uceed"},holds:["human-review"]}});
  return <section className="wrap section admin-page"><span className="eyebrow">CANONICAL EXPORT PREVIEW</span><h1>Review, record rights, then <em>export.</em></h1><p>Export never publishes directly. The immutable artifact must still enter the Git-managed bank through review.</p><QuestionDraftExport draft={draft} onExport={async input=>setDraft(current=>({...current,status:"exported",export:{externalKey:input.externalKey,contentSha256:"a".repeat(64),payload:{...current.payload,externalKey:input.externalKey,holds:[]}}}))}/></section>;
}
