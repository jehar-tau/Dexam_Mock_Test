// Fact decks for art and design history. Drawn from the owner's art history
// theory document, rewritten in our own words; dated news, awards, civics
// and current affairs are left out (docs/learn/10-completion-plan.md).
// Preview only until the owner has read them.
const PLACE = 'Which region is {name} associated with?', HOW = 'Which best describes {name}?';

export const artDeck = Object.freeze({
  prefix: 'art', topic: 'art-history',
  fields: { place: PLACE, how: HOW }, fieldWords: { place: 'region', how: 'description' }, twoFields: ['place'],
  types: { painting: 'painting tradition', craft: 'craft' },
  near: { painting: ['craft'], craft: ['painting'] },
  facts: [
    { name: 'Ajanta murals', type: 'painting', place: 'Maharashtra', how: 'Buddhist cave murals of the Jataka tales, the oldest surviving Indian paintings' },
    { name: 'Madhubani', type: 'painting', place: 'Bihar', how: 'Every inch filled with pattern, painted with twigs and fingers by women of Mithila' },
    { name: 'Warli', type: 'painting', place: 'Maharashtra', how: 'White figures of circles, triangles and lines on a mud-red wall' },
    { name: 'Pattachitra', type: 'painting', place: 'Odisha', how: '“Cloth picture” scrolls tied to the Jagannath temple, outlined in bold black' },
    { name: 'Tanjore painting', type: 'painting', place: 'Tamil Nadu', how: 'Raised gold-leaf relief, sometimes set with small stones' },
    { name: 'Mughal miniature', type: 'painting', place: 'The Mughal court', how: 'Persian technique with Indian colour: battles, hunts, court life, birds and flowers' },
    { name: 'Kangra painting', type: 'painting', place: 'The Punjab hills', how: 'Soft, dreamlike Radha–Krishna scenes in idealised landscapes' },
    { name: 'Kishangarh painting', type: 'painting', place: 'Rajasthan', how: 'Known for the “Bani Thani” portrait' },
    { name: 'Raja Ravi Varma', type: 'painting', how: 'European oil technique for Hindu gods and goddesses; popular prints' },
    { name: 'Bengal School', type: 'painting', place: 'Bengal', how: 'Softer “Indian” watercolour led by Abanindranath Tagore; Bharat Mata' },
    { name: 'Pashmina', type: 'craft', place: 'Kashmir', how: 'Very soft hand-spun shawls of fine goat wool' },
    { name: 'Blue pottery', type: 'craft', place: 'Jaipur, Rajasthan', how: 'A quartz body, not clay, glazed cobalt blue and turquoise' },
    { name: 'Bidriware', type: 'craft', place: 'Bidar, Karnataka', how: 'Blackened metal inlaid with fine silver wire' },
    { name: 'Dhokra', type: 'craft', place: 'Chhattisgarh, Odisha and West Bengal', how: 'Ancient lost-wax metal casting of animals and deities' },
    { name: 'Meenakari', type: 'craft', place: 'Jaipur, Rajasthan', how: 'Coloured enamel fused onto gold and silver' },
    { name: 'Kalamkari', type: 'craft', place: 'Andhra Pradesh', how: 'Cotton hand-painted or block-printed with natural dyes, often mythological' },
    { name: 'Channapatna toys', type: 'craft', place: 'Karnataka', how: 'Lathe-turned wooden toys coloured with natural dyes' },
  ],
  sequences: [
    { title: 'From the oldest painting tradition to the most recent.', steps: ['Ajanta murals', 'Mughal miniature', 'Raja Ravi Varma', 'Bengal School'] },
  ],
});

export const heritageDeck = Object.freeze({
  prefix: 'her', topic: 'art-history',
  fields: { place: 'Which region or tradition is {name} associated with?', how: HOW }, fieldWords: { place: 'region or tradition', how: 'description' }, twoFields: ['place'],
  types: { monument: 'monument', dance: 'classical dance', instrument: 'musical instrument' },
  near: { monument: ['dance'], dance: ['instrument'], instrument: ['dance'] },
  facts: [
    { name: 'Taj Mahal', type: 'monument', place: 'Agra, Uttar Pradesh', how: 'Mughal white marble tomb built by Shah Jahan, 1632–1653' },
    { name: 'Qutub Minar', type: 'monument', place: 'Delhi', how: 'A 73-metre tower begun in 1192, starting Delhi Sultanate architecture' },
    { name: 'Red Fort', type: 'monument', place: 'Delhi', how: 'Shah Jahan’s fortified palace, where the flag is raised on Independence Day' },
    { name: 'Khajuraho temples', type: 'monument', place: 'Madhya Pradesh', how: 'Nagara-style temples of 950–1050 CE with detailed stone carving' },
    { name: 'Konark Sun Temple', type: 'monument', place: 'Odisha', how: 'A 13th-century stone chariot for the sun god, with 24 carved wheels' },
    { name: 'Hampi', type: 'monument', place: 'Karnataka', how: 'Capital of the Vijayanagara Empire, with the stone chariot at Vittala Temple' },
    { name: 'Ajanta and Ellora caves', type: 'monument', place: 'Maharashtra', how: 'Buddhist, Hindu and Jain caves cut into rock; Kailasa carved from one rock' },
    { name: 'Meenakshi Amman Temple', type: 'monument', place: 'Madurai, Tamil Nadu', how: 'Dravidian temple with tall gopurams covered in painted sculpture' },
    { name: 'Bharatanatyam', type: 'dance', place: 'Tamil Nadu', how: 'The oldest documented form: precise steps and storytelling mudras' },
    { name: 'Kathak', type: 'dance', place: 'North India', how: 'Fast footwork with ankle bells and quick spins' },
    { name: 'Kathakali', type: 'dance', place: 'Kerala', how: 'Painted faces, huge costumes, an all-male telling of Hindu epics' },
    { name: 'Odissi', type: 'dance', place: 'Odisha', how: 'Sculpture-like tribhanga poses that echo temple carvings' },
    { name: 'Kuchipudi', type: 'dance', place: 'Andhra Pradesh', how: 'Dance-drama, famous for dancing on the rim of a brass plate' },
    { name: 'Manipuri', type: 'dance', place: 'Manipur', how: 'Gentle, flowing Radha–Krishna movement with soft footwork' },
    { name: 'Mohiniyattam', type: 'dance', place: 'Kerala', how: 'A graceful solo “dance of the enchantress” in white and gold' },
    { name: 'Sattriya', type: 'dance', place: 'Assam', how: 'Kept alive in Vaishnavite monasteries; dance, drama and devotional song' },
    { name: 'Sitar', type: 'instrument', place: 'Hindustani music', how: 'Long-necked plucked string with sympathetic strings' },
    { name: 'Sarod', type: 'instrument', place: 'Hindustani music', how: 'Fretless string played with a metal plectrum' },
    { name: 'Tabla', type: 'instrument', place: 'Hindustani music', how: 'A pair of hand drums, one deeper and one higher' },
    { name: 'Veena', type: 'instrument', place: 'Carnatic music', how: 'Plucked string with a large gourd resonator, linked to Saraswati' },
    { name: 'Mridangam', type: 'instrument', place: 'Carnatic music', how: 'Barrel drum played with both hands, the rhythm of Carnatic concerts' },
    { name: 'Bansuri', type: 'instrument', place: 'Hindustani music', how: 'A simple bamboo flute linked with Krishna' },
    { name: 'Tanpura', type: 'instrument', place: 'Both Hindustani and Carnatic music', how: 'A drone string that holds one steady note under the raga' },
  ],
  sequences: [
    { title: 'Monuments from the oldest to the most recent.', steps: ['Ajanta and Ellora caves', 'Khajuraho temples', 'Qutub Minar', 'Konark Sun Temple', 'Hampi', 'Taj Mahal'] },
  ],
});

export const designDeck = Object.freeze({
  prefix: 'des', topic: 'art-history',
  fields: { who: 'Who designed the {name}?', how: HOW }, fieldWords: { who: 'designer', how: 'description' },
  types: { product: 'design classic', school: 'design school or studio' },
  near: { product: ['school'], school: ['product'] },
  facts: [
    { name: 'Thonet No. 14 chair', type: 'product', who: 'Michael Thonet', how: 'A bentwood café chair of 1859' },
    { name: 'Barcelona Chair', type: 'product', who: 'Mies van der Rohe and Lilly Reich', how: 'A 1929 steel-and-leather chair' },
    { name: 'Wassily Chair', type: 'product', who: 'Marcel Breuer', how: 'A tubular-steel chair from the Bauhaus' },
    { name: 'Eames Lounge Chair', type: 'product', who: 'Charles and Ray Eames', how: 'A 1956 moulded-plywood and leather chair with ottoman' },
    { name: 'Braun SK4 radio-phonograph', type: 'product', who: 'Dieter Rams and Hans Gugelot', how: 'A 1956 radio and record player in a plain white box' },
    { name: 'Apple iMac G3', type: 'product', who: 'Jonathan Ive', how: 'A 1998 computer in a translucent coloured shell' },
    { name: 'Bauhaus', type: 'school', how: 'German school (1919–1933) founded by Walter Gropius: simple, functional, mass-producible' },
    { name: 'Eames Office', type: 'school', how: 'Husband-and-wife studio in postwar America: plywood, plastic and films such as Powers of Ten' },
    { name: 'National Institute of Design', type: 'school', how: 'India’s leading design school, founded in Ahmedabad in 1961' },
  ],
  sequences: [
    { title: 'Design classics from the oldest to the newest.', steps: ['Thonet No. 14 chair', 'Barcelona Chair', 'Eames Lounge Chair', 'Apple iMac G3'] },
    { title: 'From the oldest to the newest.', steps: ['Bauhaus founded', 'Eames Lounge Chair', 'National Institute of Design founded', 'Apple iMac G3'] },
  ],
});
