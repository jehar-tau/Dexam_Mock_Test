// Registry of interactive Learn programmes. Add a topic by adding one entry.
// Each programme must pass validateProgramme (covered by tests/learn-programme.test.mjs).
import { cubeNetsProgramme } from './cube-nets.js';
import { netsOfSolidsProgramme } from './nets-of-solids.js';
import { paperFoldingProgramme } from './paper-folding.js';
import { mirrorImagesProgramme } from './mirror-images.js';
import { countingCubesProgramme } from './counting-cubes.js';
import { colourBasicsProgramme } from './colour-basics.js';

export const programmes = Object.freeze([cubeNetsProgramme, netsOfSolidsProgramme, paperFoldingProgramme, mirrorImagesProgramme, countingCubesProgramme, colourBasicsProgramme]);
export const findProgramme = slug => programmes.find(p => p.slug === slug) ?? null;
