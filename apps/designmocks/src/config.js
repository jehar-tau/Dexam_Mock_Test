export const brand = {
  name: "DesignMocks",
  proposedDomain: "designmocks.in",
  description: "Design entrance mock tests.",
  price: 1193,
  currency: "INR",
  months: 12,
  supportUrl: "https://designexam.com/contact/",
};
export const exams = [
  {
    id: "uceed",
    name: "UCEED",
    level: "B.Des",
    category: "undergraduate",
    art: "space",
    tag: "SEE IT FROM ANOTHER SIDE",
    title: "A different angle. A clearer answer.",
    description:
      "Visual thinking, spatial reasoning and design aptitude. Get comfortable looking a little closer.",
    skills: [
      "Visual & spatial ability",
      "Reasoning & observation",
      "Drawing & design thinking",
    ],
    source: "https://www.uceed.iitb.ac.in/2027/",
  },
  {
    id: "nid",
    name: "NID DAT",
    level: "Design",
    category: "undergraduate",
    art: "ideas",
    tag: "THINK BEYOND THE OBVIOUS",
    title: "Small observations. Big possibilities.",
    description:
      "Observation, ideas and drawing. Give your imagination a brief, a clock and somewhere to begin.",
    skills: [
      "Observation & interpretation",
      "Idea generation",
      "Drawing & communication",
    ],
    source: "https://admissions.nid.edu/",
  },
  {
    id: "nift",
    name: "NIFT",
    level: "Design",
    category: "undergraduate",
    art: "pattern",
    tag: "FIND YOUR OWN PATTERN",
    title: "An eye for detail. A mind for making.",
    description:
      "Creative thinking meets aptitude. Explore colour, composition and the details that make a difference.",
    skills: ["Creative ability", "Colour & composition", "General aptitude"],
    source: "https://nift.ac.in/admissions",
  },
  {
    id: "ceed",
    name: "CEED",
    level: "M.Des",
    category: "postgraduate",
    art: "object",
    tag: "MAKE YOUR THINKING VISIBLE",
    title: "Better questions. More considered ideas.",
    description:
      "Reasoning, visualisation and problem solving for your next step into postgraduate design.",
    skills: [
      "Visualisation & reasoning",
      "Problem solving",
      "Design communication",
    ],
    source: "https://www.ceed.iitb.ac.in/2027/",
  },
];
export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
