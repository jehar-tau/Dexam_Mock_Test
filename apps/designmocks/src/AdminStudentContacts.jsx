import React, { useState } from "react";
import { studentContactsCsv } from "./student-contacts.mjs";

// Contact details of students who agreed to hear about courses and classes.
export function AdminStudentContacts({ rpc }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const download = async () => {
    setBusy(true); setMessage("");
    try {
      const rows = await rpc("admin_student_contacts", {});
      const csv = studentContactsCsv(rows);
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `dmocks-student-contacts-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${rows.length} ${rows.length === 1 ? "student" : "students"} with permission downloaded.`);
    } catch (error) {
      setMessage(error?.code === "PGRST202" ? "Student contacts need the backend update (migration 202611280200)." : "Couldn’t download the contacts. Try again.");
    } finally { setBusy(false); }
  };
  return <section aria-labelledby="student-contacts-heading">
    <h2 id="student-contacts-heading">Student contacts</h2>
    <p>Students who agreed to hear about DMocks and Design Exam Academy courses and classes. Students who said they are 16 or 17 are never listed. Keep this file private.</p>
    <button type="button" className="button quiet" disabled={busy} onClick={() => void download()}>{busy ? "Preparing…" : "Download contacts (CSV)"}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
