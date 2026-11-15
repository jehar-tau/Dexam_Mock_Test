// Registry of interactive Learn programmes. Add a topic by adding one entry.
// Each programme must pass validateProgramme (covered by tests/learn-programme.test.mjs).
import { cubeNetsProgramme } from './cube-nets.js';
import { netsOfSolidsProgramme } from './nets-of-solids.js';
import { diceProgramme } from './dice.js';
import { paperFoldingProgramme } from './paper-folding.js';
import { mirrorImagesProgramme } from './mirror-images.js';
import { countingCubesProgramme } from './counting-cubes.js';
import { viewsRotationProgramme } from './views-and-rotation.js';
import { mechanismsProgramme } from './mechanisms.js';
import { countingFiguresProgramme } from './counting-figures.js';
import { quantProgramme } from './quant.js';
import { arrangementsProgramme, codesPatternsProgramme, directionsProgramme } from './logic.js';
import { colourBasicsProgramme } from './colour-basics.js';

export const programmes = Object.freeze([cubeNetsProgramme, netsOfSolidsProgramme, diceProgramme, paperFoldingProgramme, mirrorImagesProgramme, countingCubesProgramme, viewsRotationProgramme, mechanismsProgramme, countingFiguresProgramme, quantProgramme, codesPatternsProgramme, arrangementsProgramme, directionsProgramme, colourBasicsProgramme]);
export const findProgramme = slug => programmes.find(p => p.slug === slug) ?? null;
