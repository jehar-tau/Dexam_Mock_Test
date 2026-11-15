// Fact decks for crafts, textiles, materials and making. Drawn from the
// owner's study guide on textiles, materials and design fundamentals,
// rewritten in our own words; nothing is copied. Preview only until the
// owner has read them (docs/learn/06-curriculum.md).
const PLACE = 'Which region is {name} associated with?', HOW = 'Which best describes {name}?', USE = 'What is {name} best suited to?';

export const textilesDeck = Object.freeze({
  prefix: 'tex', topic: 'crafts',
  fields: { place: PLACE, how: HOW }, fieldWords: { place: 'region', how: 'description' }, twoFields: ['place'],
  types: { embroidery: 'embroidery style', weave: 'woven textile', print: 'printing method', dye: 'dyeing method' },
  near: { embroidery: ['weave', 'print'], weave: ['embroidery', 'dye'], print: ['dye', 'weave'], dye: ['print', 'embroidery'] },
  facts: [
    { name: 'Chikankari', type: 'embroidery', place: 'Lucknow, Uttar Pradesh', how: 'White-on-white shadow work on fine cotton or muslin' },
    { name: 'Phulkari', type: 'embroidery', place: 'Punjab', how: '“Flower work”: silk floss darning stitch on coarse khaddar' },
    { name: 'Kantha', type: 'embroidery', place: 'West Bengal', how: 'Running stitch that quilts layers of old saris into new cloth' },
    { name: 'Zardozi', type: 'embroidery', place: 'Lucknow and Bhopal', how: 'Gold and silver metal thread and sequins for bridal wear' },
    { name: 'Kashida', type: 'embroidery', place: 'Kashmir', how: 'Chain-stitch flowers inspired by chinar leaves and almonds' },
    { name: 'Aari work', type: 'embroidery', place: 'Gujarat', how: 'Chain stitch worked with a hooked needle' },
    { name: 'Shisha work', type: 'embroidery', place: 'Kutch and Rajasthan', how: 'Small mirrors stitched onto the cloth' },
    { name: 'Banarasi silk', type: 'weave', place: 'Varanasi, Uttar Pradesh', how: 'Brocade woven with gold and silver zari' },
    { name: 'Jamdani', type: 'weave', place: 'Bengal', how: 'Fine muslin figured with extra weft threads' },
    { name: 'Kanjeevaram silk', type: 'weave', place: 'Kanchipuram, Tamil Nadu', how: 'Heavy silk with contrasting zari borders' },
    { name: 'Patola', type: 'weave', place: 'Patan, Gujarat', how: 'Double ikat: warp and weft both dyed before weaving' },
    { name: 'Pochampally ikat', type: 'weave', place: 'Telangana', how: 'Geometric single or double ikat' },
    { name: 'Sambalpuri', type: 'weave', place: 'Odisha', how: 'Ikat cloth with the pattern tied and dyed into the yarn' },
    { name: 'Bagru printing', type: 'print', place: 'Rajasthan', how: 'Hand block printing with natural dyes and dabu mud resist' },
    { name: 'Ajrakh', type: 'print', place: 'Gujarat', how: 'Block printing with blocks carved in Pethapur' },
    { name: 'Screen printing', type: 'print', how: 'Dye pushed through a fine mesh stencil' },
    { name: 'Roller printing', type: 'print', how: 'Engraved copper rollers: the fastest method for long runs' },
    { name: 'Digital textile printing', type: 'print', how: 'Inkjet straight onto fabric, for short runs with photographic detail' },
    { name: 'Bandhani', type: 'dye', how: 'Cloth tied in tiny knots before dyeing' },
    { name: 'Batik', type: 'dye', how: 'Wax keeps the dye off parts of the cloth' },
    { name: 'Ikat', type: 'dye', how: 'Yarn bound and dyed before it is woven' },
    { name: 'Mordant dyeing', type: 'dye', how: 'A fixing agent such as alum or iron binds the dye to the fibre' },
  ],
  sequences: [
    { title: 'Making ikat cloth.', steps: ['Bind sections of the yarn', 'Dye the yarn', 'Remove the bindings', 'Weave the cloth'], why: 'In ikat the pattern is in the yarn before weaving; brocade adds pattern during weaving.' },
  ],
});

export const materialsDeck = Object.freeze({
  prefix: 'mat', topic: 'crafts',
  fields: { how: HOW }, fieldWords: { how: 'description' },
  types: { thermoplastic: 'thermoplastic', thermoset: 'thermoset', ferrous: 'ferrous metal', nonferrous: 'non-ferrous metal', plant: 'plant fibre', animal: 'animal fibre', synthetic: 'synthetic fibre', ceramic: 'kind of fired clay', idea: 'sustainability idea' },
  near: { thermoplastic: ['thermoset'], thermoset: ['thermoplastic'], ferrous: ['nonferrous'], nonferrous: ['ferrous'], plant: ['animal', 'synthetic'], animal: ['plant', 'synthetic'], synthetic: ['plant', 'animal'], ceramic: ['nonferrous'], idea: ['ceramic'] },
  facts: [
    { name: 'PET', type: 'thermoplastic', how: 'Softens on heating and can be remoulded: used for drink bottles' },
    { name: 'HDPE', type: 'thermoplastic' }, { name: 'PVC', type: 'thermoplastic' }, { name: 'Polypropylene', type: 'thermoplastic' }, { name: 'ABS', type: 'thermoplastic' },
    { name: 'Epoxy', type: 'thermoset' }, { name: 'Melamine', type: 'thermoset', how: 'Sets hard for good on curing and cannot be remelted' }, { name: 'Bakelite', type: 'thermoset' },
    { name: 'Steel', type: 'ferrous', how: 'Contains iron: strong and magnetic, but rusts' }, { name: 'Cast iron', type: 'ferrous' },
    { name: 'Aluminium', type: 'nonferrous', how: 'Light, corrosion-resistant, endlessly recyclable' }, { name: 'Copper', type: 'nonferrous', how: 'A very good conductor of heat and electricity' },
    { name: 'Brass', type: 'nonferrous', how: 'An alloy of copper and zinc' }, { name: 'Bronze', type: 'nonferrous', how: 'An alloy of copper and tin' }, { name: 'Zinc', type: 'nonferrous' },
    { name: 'Cotton', type: 'plant', how: 'Breathable and absorbent, weaker when wet' }, { name: 'Jute', type: 'plant', how: 'Coarse, strong bast fibre for sacking and rope' },
    { name: 'Silk', type: 'animal', how: 'Fine and lustrous, from silkworm cocoons' }, { name: 'Wool', type: 'animal', how: 'Warm, elastic and naturally flame-resistant' },
    { name: 'Polyester', type: 'synthetic', how: 'Strong and quick-drying, but sheds microplastics' }, { name: 'Nylon', type: 'synthetic' },
    { name: 'Terracotta', type: 'ceramic', how: 'Low-fired, porous and reddish brown' }, { name: 'Stoneware', type: 'ceramic', how: 'Fired hotter, so denser and more durable' }, { name: 'Porcelain', type: 'ceramic', how: 'Kaolin fired hottest: white and translucent' },
    { name: 'Biodegradable', type: 'idea', how: 'Broken down by microbes into water, carbon dioxide and biomass' }, { name: 'Compostable', type: 'idea', how: 'Breaks down into nutrient-rich compost, often only in special conditions' },
    { name: 'Recyclable', type: 'idea', how: 'Can be reprocessed into new material instead of thrown away' }, { name: 'Upcycling', type: 'idea', how: 'Turning waste into something of equal or higher value' },
    { name: 'Downcycling', type: 'idea', how: 'Turning waste into something of lower value' }, { name: 'Design for disassembly', type: 'idea', how: 'Parts that separate easily for repair or recycling, such as screws instead of glue' },
    { name: 'Cradle to cradle', type: 'idea', how: 'Every output is either a safe biological nutrient or a recoverable technical one' },
  ],
  sequences: [
    { title: 'From the lowest firing temperature to the highest.', steps: ['Terracotta', 'Stoneware', 'Porcelain'] },
    { title: 'The stages of a product’s life cycle.', steps: ['Extract the raw material', 'Manufacture the product', 'Transport it', 'Use it', 'Its end of life'] },
    { title: 'From the fastest-turning fashion to the most exclusive.', steps: ['Fast fashion', 'Mid-market', 'Luxury'] },
  ],
});

export const makingDeck = Object.freeze({
  prefix: 'make', topic: 'crafts',
  fields: { use: USE }, fieldWords: { use: 'typical use' },
  types: { moulding: 'moulding process', casting: 'casting process', binding: 'binding method', printing: 'print process', carving: 'carving tradition' },
  near: { moulding: ['casting'], casting: ['moulding'], binding: ['printing'], printing: ['binding'], carving: ['casting', 'moulding'] },
  facts: [
    { name: 'Injection moulding', type: 'moulding', use: 'Mass-producing bottle caps, containers and toys' },
    { name: 'Blow moulding', type: 'moulding', use: 'Hollow plastic bottles' },
    { name: 'Rotational moulding', type: 'moulding', use: 'Large hollow tanks and playground equipment' },
    { name: 'Compression moulding', type: 'moulding', use: 'Pressing thermosets or rubber between heated mould halves' },
    { name: 'Sand casting', type: 'casting', use: 'Large, rough metal parts at low cost' },
    { name: 'Die casting', type: 'casting', use: 'Precise metal parts such as zips, made in large numbers' },
    { name: 'Lost-wax casting', type: 'casting', use: 'Fine jewellery and Dokra figures, from a single-use mould' },
    { name: 'Saddle stitching', type: 'binding', use: 'Thin booklets stapled through the fold' },
    { name: 'Perfect binding', type: 'binding', use: 'Paperbacks with a glued flat spine' },
    { name: 'Case binding', type: 'binding', use: 'Durable hardcover books with sewn sections' },
    { name: 'Offset lithography', type: 'printing', use: 'Books and high-volume packaging' },
    { name: 'Flexography', type: 'printing', use: 'Corrugated packaging and labels' },
    { name: '3D printing', type: 'printing', use: 'Rapid prototypes built up layer by layer' },
    { name: 'Sandalwood carving', type: 'carving', use: 'Fine figures and boxes from Karnataka' },
    { name: 'Granite carving', type: 'carving', use: 'Stone sculpture at Mahabalipuram' },
    { name: 'Walnut wood carving', type: 'carving', use: 'Carved furniture and panels from Kashmir' },
  ],
  sequences: [
    { title: 'Lost-wax casting.', steps: ['Make a wax model', 'Coat it in clay', 'Heat it to melt the wax out', 'Pour in molten metal', 'Break the mould'], why: 'The mould is used once, so every Dokra piece is unique.' },
    { title: 'Packaging, from the product outward.', steps: ['Primary packaging (the bottle)', 'Secondary packaging (the carton of bottles)', 'Tertiary packaging (the pallet)'] },
    { title: 'Sand casting.', steps: ['Make a pattern of the part', 'Pack sand round it to form the mould', 'Remove the pattern', 'Pour in molten metal', 'Break the sand away'] },
  ],
});
