// Mirror and water images.
export const mirrorImagesProgramme = Object.freeze({
  slug: 'mirror-images',
  title: 'Mirror and water images',
  summary: 'Reflect a figure left to right or top to bottom, and never confuse a reflection with a turn.',
  topic: 'visualisation',
  exams: ['uceed', 'ceed', 'nid', 'nift'],
  minutes: 25,
  lessons: [
    {
      id: 'mirror', title: 'Mirror images', minutes: 10,
      summary: 'A mirror beside a figure swaps left and right and nothing else.',
      steps: [
        { id: 'swap', kind: 'slide', title: 'Left becomes right', text: 'A mirror standing beside a figure swaps left and right. The part nearest the mirror stays nearest it. Top stays top.', tool: 'mirror', hint: 'Draw on the grid and watch both reflections change.' },
        { id: 'not-turn', kind: 'slide', title: 'A reflection is not a turn', text: ['Turn a figure by half a turn and both left-right and top-bottom swap. A mirror swaps only one of them.', 'Letters help: in a mirror, F becomes a backwards F, never an upside-down one.'] },
        { id: 'check-1', kind: 'check', question: { kind: 'mirror-image', seed: 91 } },
        { id: 'check-2', kind: 'check', question: { kind: 'mirror-image', seed: 92 } },
        { id: 'check-3', kind: 'check', question: { kind: 'mirror-image', seed: 93 } },
        { id: 'check-4', kind: 'check', question: { kind: 'mirror-image', seed: 94 } },
        { id: 'remember', kind: 'takeaway', body: 'Mirror beside the figure: left and right swap, top stays top. If it looks turned, it is wrong.' },
      ],
    },
    {
      id: 'water', title: 'Water images', minutes: 10,
      summary: 'A still pool below a figure swaps top and bottom and nothing else.',
      steps: [
        { id: 'flip', kind: 'slide', title: 'Top becomes bottom', text: 'A water image is the reflection in a still pool below the figure. Top and bottom swap. Whatever touches the water line stays at the water line, and left stays left.', tool: 'mirror', props: { initial: ['0,0', '1,0', '2,0', '0,1', '0,2', '1,2', '0,3', '0,4', '3,1'] } },
        { id: 'compare', kind: 'slide', title: 'Mirror or water?', text: 'Ask one question: which pair swapped? Left-right means mirror. Top-bottom means water. Both means a half turn, which neither reflection can make.' },
        { id: 'check-1', kind: 'check', question: { kind: 'water-image', seed: 101 } },
        { id: 'check-2', kind: 'check', question: { kind: 'water-image', seed: 102 } },
        { id: 'check-3', kind: 'check', question: { kind: 'water-image', seed: 103 } },
        { id: 'check-4', kind: 'check', question: { kind: 'mirror-image', seed: 104 } },
        { id: 'remember', kind: 'takeaway', body: 'Water below the figure: top and bottom swap, left stays left. One pair swaps, never both.' },
      ],
    },
  ],
  challenge: {
    title: 'Reflection challenge', minutes: 6,
    description: 'Eight mixed mirror and water questions.',
    questions: [{ kind: 'mirror-image', count: 4 }, { kind: 'water-image', count: 4 }],
  },
});
