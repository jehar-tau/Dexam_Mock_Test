import React, {useLayoutEffect, useRef, useState} from "react";

export function CommunityImageSelection({label, helpId, inputRef, required = false}) {
  const localRef = useRef(null);
  const input = inputRef ?? localRef;
  const [selected, setSelected] = useState([]);

  useLayoutEffect(() => {
    const form = input.current?.form;
    const clear = () => setSelected([]);
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, [input]);

  function remove(index) {
    const remaining = new DataTransfer();
    Array.from(input.current.files).forEach((file, position) => {
      if (position !== index) remaining.items.add(file);
    });
    input.current.files = remaining.files;
    setSelected(Array.from(remaining.files));
    input.current.focus();
  }

  return <div className="community-image-selection">
    <label>{label}
      <input ref={input} name="images" type="file" multiple required={required}
        accept="image/png,image/jpeg,image/webp" aria-describedby={helpId}
        onChange={event => setSelected(Array.from(event.currentTarget.files))} />
    </label>
    {selected.length > 0 && <ul aria-label="Selected images">
      {selected.map((file, index) => <li key={index}>
        <span>{file.name}</span>
        <button type="button" className="text-button" aria-label={`Remove image ${index + 1}: ${file.name}`}
          onClick={() => remove(index)}>Remove</button>
      </li>)}
    </ul>}
  </div>;
}
