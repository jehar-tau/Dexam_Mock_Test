import React, { useState } from "react";
import { AttemptSession } from "./Workspace.jsx";
import { createPreviewPaper, previewPaperId } from "./preview-paper.mjs";

export function PreviewPaper({example = false}) {
  const [generation, setGeneration] = useState(0);
  const [services, setServices] = useState(() => createPreviewPaper({storage:tabStorage(),example}));
  const restart = () => {
    setServices(createPreviewPaper({storage:tabStorage(),fresh:true}));
    setGeneration(value => value+1);
  };
  return <AttemptSession key={generation} id={previewPaperId} actorId="original-paper-demo" services={services}
    workspaceHref="/portal-preview" practicePath="/topic-practice-preview" demo
    onRestart={example ? undefined : restart} />;
}

function tabStorage() {
  try { return window.sessionStorage; } catch { return undefined; }
}
