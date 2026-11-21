import React from 'react';

function Block({ x, y, top, left, right }) {
  return <g transform={`translate(${x} ${y})`} stroke="#193d37" strokeWidth="1.6" strokeLinejoin="round">
    <path d="m0 0 36-20 36 20-36 20Z" fill={top}/>
    <path d="m0 0 36 20v40L0 40Z" fill={left}/>
    <path d="m36 20 36-20v40L36 60Z" fill={right}/>
  </g>;
}

const blockTones = [
  { top: '#f4e5aa', left: '#e5be65', right: '#b48446' },
  { top: '#ffe6c5', left: '#f5a072', right: '#cf6249' },
  { top: '#e1efcc', left: '#abc5a0', right: '#729d83' },
];

function Blocks() {
  return <>
    <path d="m-10 127 153-86 144 79-145 83Zm144 69 86-46m-196-6 156-88" fill="none" stroke="#647e70" strokeDasharray="4 5"/>
    <g transform="translate(10 15) scale(.93)">
      <Block x={71} y={74} {...blockTones[2]}/><Block x={107} y={94} {...blockTones[0]}/>
      <Block x={143} y={114} {...blockTones[2]}/><Block x={71} y={114} {...blockTones[1]}/>
      <Block x={107} y={54} {...blockTones[1]}/><Block x={107} y={14} {...blockTones[0]}/>
    </g>
  </>;
}

function Lamp() {
  return <g stroke="#193d37" strokeWidth="2.5" strokeLinejoin="round">
    <ellipse cx="147" cy="175" rx="69" ry="10" fill="#456756" stroke="none"/>
    <path d="m76 153 44 15 38-13-44-15z" fill="#f6d789"/><path d="m76 153 44 15v8l-44-15zm44 15 38-13v8l-38 13z" fill="#de9960"/>
    <path d="m109 155 39-61-35-48 7-4 40 51-42 65z" fill="#f0b96b"/>
    <circle cx="154" cy="94" r="8" fill="#e77955"/><circle cx="117" cy="45" r="6" fill="#f5d287"/>
    <path d="m118 44 42-10 4 7-44 11z" fill="#c0d2ae"/>
    <path d="M146 65q-4-29 19-33t39 27l-55 15Z" fill="#ec835d"/>
    <ellipse cx="177" cy="65" rx="29" ry="6" transform="rotate(-15 177 65)" fill="#ffe8ac"/>
  </g>;
}

function Weave() {
  return <g transform="translate(63 13) rotate(-12 85 85)" stroke="#24443b" strokeWidth="1.6">
    {[0,1,2,3].map(i => <path key={i} d={`m${i*32+13} 2 24 4-4 161-23-3Z`} fill={i%2 ? '#e9b86c' : '#eba082'}/>)}
    {[0,1,2,3].map(row => <g key={row}>
      <path d={`m0 ${row*34+17} 153 4-1 24-151-4z`} fill={row%2 ? '#b5d2aa' : '#f4dd9a'}/>
      {[0,1,2,3].filter(i => (i+row)%2 === 0).map(i => <path key={i} d={`m${i*32+12} ${row*34+16} 23 1-1 27-23-1Z`} fill={i%2 ? '#e9b86c' : '#eba082'}/>)}
    </g>)}
  </g>;
}

function Gear({ x, y, radius, fill }) {
  return <g transform={`translate(${x} ${y})`} fill={fill} stroke="#193d37" strokeWidth="2">
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x="-6" y={-radius-7} width="12" height="16" transform={`rotate(${i*30})`}/>)}
    <circle r={radius}/><circle r={radius*.65} fill="none"/><circle r={radius*.24} fill="#264b40"/>
  </g>;
}

export function ExamStudyArt({ exam }) {
  return <svg className="exam-study-art" viewBox="0 0 280 200" aria-hidden="true" focusable="false">
    {exam === 'uceed' && <Blocks/>}
    {exam === 'nid' && <Lamp/>}
    {exam === 'nift' && <Weave/>}
    {exam === 'ceed' && <><Gear x={112} y={118} radius={48} fill="#f2bd75"/><Gear x={174} y={58} radius={33} fill="#c1d6b5"/></>}
  </svg>;
}
