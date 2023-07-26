import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import { Alg } from "cubing/alg"
import { KState } from "cubing/kpuzzle"
import shuffle from "lodash/shuffle"
import { cube3x3x3 } from "cubing/puzzles"
import { cloneDeep } from "lodash";
import sampleSize from "lodash/sampleSize"

// this code is messy, going to be cleaned up and ported to crystalcube

const solvedState = {
  "EDGES": {
    "pieces": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    "orientation": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  "CORNERS": {
    "pieces": [0, 1, 2, 3, 4, 5, 6, 7],
    "orientation": [0, 0, 0, 0, 0, 0, 0, 0]
  },
  "CENTERS": {
    "pieces": [0, 1, 2, 3, 4, 5],
    "orientation": [0, 0, 0, 0, 0, 0],
    "orientationMod": [1, 1, 1, 1, 1, 1]
  }
}

type State3x3 = typeof solvedState

// 1 means scramble that piece
type bool = 0 | 1
interface ScrambleMask {
  eo: bool[],
  ep: bool[],
  co: bool[],
  cp: bool[],
}

const pairSolvedEOMask: ScrambleMask = {
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ep: [1, 1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0],
  co: [1, 1, 1, 1, 1, 0, 0, 0],
  cp: [1, 1, 1, 1, 1, 0, 0, 0],
}

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0)
}

// taken from onionhoney roux-trainers https://github.com/onionhoney/roux-trainers
function getParity(perm: number[]) {
  let visited = Array(perm.length).fill(false)
  let follow = (i: number, cnt: number) : number => {
      if (visited[i]) {
          return 0
      } else {
          visited[i] = 1
          if (visited[perm[i]]) {
              return cnt;
          } else
              return follow(perm[i], cnt + 1)
      }
  }
  let res = 0
  for (let x of perm) {
      res += follow(x, 0)
  }
  return res
}

function getRandomState(initialState: State3x3, mask: ScrambleMask) {
  // randomize eo
  const state: State3x3 = cloneDeep(initialState)
  const numEdgesToOrient = sum(mask.eo)
  const numEdgesToPermute = sum(mask.ep)
  const numCornersToOrient = sum(mask.co)
  const numCornersToPermute = sum(mask.cp)

  const partialEO = state.EDGES.orientation.filter((_, idx) => !!mask.eo[idx]);
  const partialEOParity = sum(partialEO) % 2;
  const randomEO = partialEO.map(_ => getRandomInt(0, 2))
  const newEOParity = sum(randomEO) % 2;

  if (partialEOParity !== newEOParity) {
    // fix the wrong parity by flipping a random edge
    const idx = getRandomInt(0, numEdgesToOrient)
    randomEO[idx] = (randomEO[idx] + 1) % 2;
  }
  let edgeCounter = 0;
  mask.eo.forEach((shouldScramble, idx) => {
    if (shouldScramble) {
      state.EDGES.orientation[idx] = randomEO[edgeCounter]
      edgeCounter++
    }
  })

  // randomize co
  const partialCO = state.CORNERS.orientation.filter((_, idx) => !!mask.co[idx]);
  const partialCOParity = sum(partialCO) % 3;
  const randomCO = partialCO.map(_ => getRandomInt(0, 3))
  const newCOParity = sum(randomCO) % 3;

  if (partialCOParity !== newCOParity) {
    // fix the wrong parity by twisting a random corner the right amount
    const idx = getRandomInt(0, numCornersToOrient)
    const difference = (newCOParity - partialCOParity) % 3;
    randomCO[idx] = (randomCO[idx] - difference) % 3;
  }
  let cornerCounter = 0;
  mask.co.forEach((shouldScramble, idx) => {
    if (shouldScramble) {
      state.CORNERS.orientation[idx] = randomCO[cornerCounter]
      cornerCounter++
    }
  })

  // randomize EP and CP together
  const partialEP = state.EDGES.pieces.filter((_, idx) => !!mask.ep[idx]);
  const randomEP = shuffle(partialEP)

  const partialCP = state.CORNERS.pieces.filter((_, idx) => !!mask.cp[idx]);
  const randomCP = shuffle(partialCP)

  edgeCounter = 0;
  mask.ep.forEach((shouldScramble, idx) => {
    if (shouldScramble) {
      state.EDGES.pieces[idx] = randomEP[edgeCounter]
      edgeCounter++
    }
  })

  cornerCounter = 0;
  mask.cp.forEach((shouldScramble, idx) => {
    if (shouldScramble) {
      state.CORNERS.pieces[idx] = randomCP[cornerCounter]
      cornerCounter++
    }
  })

  // fix permutation parity
  const parity = (getParity(state.CORNERS.pieces) + getParity(state.EDGES.pieces)) & 1
  if (parity !== 0) {
    if (numEdgesToPermute >= 2 || getRandomInt(0, 2) === 1) {
      // swap 2 edges
      const edgeIndices = [...Array(numEdgesToPermute).keys()].filter(idx => !!mask.ep[idx]);
      const [edgeIndexA, edgeIndexB] = sampleSize(edgeIndices, 2);
  
      // swap a and b
      const tmp = state.EDGES.pieces[edgeIndexA]
      state.EDGES.pieces[edgeIndexA] = state.EDGES.pieces[edgeIndexB]
      state.EDGES.pieces[edgeIndexB] = tmp;
    } else {
      // swap 2 corners
      const cornerIndices = [...Array(numCornersToPermute).keys()].filter(idx => !!mask.cp[idx]);
      const [cornerIndexA, cornerIndexB] = sampleSize(cornerIndices, 2);
  
      // swap a and b
      const tmp = state.CORNERS.pieces[cornerIndexA]
      state.EDGES.pieces[cornerIndexA] = state.EDGES.pieces[cornerIndexB]
      state.EDGES.pieces[cornerIndexB] = tmp;
    }

  }
  return state;
  
}

async function getEOPairScrams(caseAlg: Alg, numScrambles: number): Promise<string[]> {
  const kpuzzle = await cube3x3x3.kpuzzle()
  // const state = getRandomState(solvedState, pairSolvedEOMask)
  const setup = caseAlg.invert()
  const scrambles: string[] = []
  for (let i = 0; i < numScrambles; ++i) {
    const randomSolvedEOPair = getRandomState(solvedState, pairSolvedEOMask)
    const scramState = new KState(kpuzzle, randomSolvedEOPair).applyAlg(setup)
    const solution = await experimentalSolve3x3x3IgnoringCenters(scramState)
    const formatted = solution.invert().toString().split(" ").map(move => move.replace("2'", "2")).join(" ")
    scrambles.push(formatted);
  }
  return scrambles
}

interface Case {
  name: string,
  alg: string,
}

interface CaseWithScrambles {
  name: string,
  alg: string,
  scrambles: string[]
}
/*
# sketchy python code to parse rows copied from apb alg sheet
setups = """(U') R' U' F' U F R'	R' U R' U' F' U' F	(U) F R' F' R2	F R' F' R U R U' R	R' U R' f' U' f	R' U R' F' U' F
R2' F R' F' R	R F R F'	R' f R f' R'	R2 F' U' F	f' U' f R'	(U) f R' f' R2
R U' F' R' U R F	R U2 R' f R' f' U' R	R2 F' U F
R2 U2 S' U' S	(U') S' U S R2	S R U' R' U R S'	(U2) S' U' S U' R2	R U2 R' U S R S' U R	(U) S' U' S R2
f R U R' U' R' f' R2	R2 S' U' S	R U R' S R S' U' R	R D' r U' r' D R	R' f R U R U' R' f' R'	R U' R2 S R S' U R
R' U2 R U S' U' S R2	f R' S' R F' R2	(U) R' S R S' R U' R2
(U2) D r' U' r D' F R' F' R2""".replace("(", "").replace(")", "").replace("\n", "\t")
setups = setups.split("\t")
print(setups)

*/

// source: https://docs.google.com/spreadsheets/d/1Hs9ikHz-4cfbqBfqvuvE8X9sjCb4Jtm482ZvsFQA2rY/edit#gid=1684874333
type SpreadsheetFormat = { setName: string, caseNames: string[], algs: string[]}[]
const spreadsheet: SpreadsheetFormat = [
  {
    setName: "pair-solved-eo",
    caseNames: ['UF/UR', 'UL/UR', 'UF/FR', 'UF/DR', 'FR/DR', 'UF/UL/UB/UR', 'UB/UR/UF/FR', 'UB/UR/UF/DR', 'UF/UR/FR/DR', 'UL/UR/FR/DR', 'UF/UL/UB/UR/FR/DR'],
    algs: ["F R' F' R", "U F R U R' U' F'", "R' F R F'", "U2 f' U' f", "S' R U' R' U' S", "r U r' U2 M' U M", "U S R' U' R U R S'", "S' U' S", "U' S' U R U2 R' S", "R U R' S' U' S", "F R' F' R U S' U' S"]
  },
  {
    setName: "oriented-pair-u",
    caseNames:['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'],
    algs: ["U2 F R' F' U R", "U' R U f' U f", "U' F R2 U R' U' F'", "U2 F' U F R", "U' F R F'", "f R f' U2 R", "U' F' U' F U R", "U' R F' U' F", "U f R' f' U' R", "U' R f' U f", "U' R f' U2 f", "U' R f' U' f", "U' R F' U F", "U2 R' f R U R U' f'", "U' R U' f' U' f", "U R' U' R S R' S' U' R", "U R' U2 R S' U' S", "U' R U2 S' U' S", "U2 F' U F2 R F'", "U2 S' U' R' U2 R S", "U' R U' S' U' S", "U' R' f' U' f2 R f' R'", "S' U R' U2 R S", "U' R U S' U' S", "R S R' S' U' R", "U2 R' S R S' U R", "U' R S' U' S", "U' R S' U' R U2 R' S", "U' R2 U' R' S' U' S", "U2 R2 S R S' U R", "U2 S R S' R' F R U R U' F'"],
  },
  {
    setName: "oriented-pair-r",
    caseNames: [...Array(31).keys()].map(num => `${num+1}`),
    algs: ["U' R' U' F' U F R'", "R' U R' U' F' U' F", "U F R' F' R2", "F R' F' R U R U' R", "R' U R' f' U' f", "R' U R' F' U' F", "R2' F R' F' R", "R F R F'", "R' f R f' R'", "R2 F' U' F", "f' U' f R'", "U f R' f' R2", "R U' F' R' U R F", "R U2 R' f R' f' U' R", "R2 F' U F", "R2 U2 S' U' S", "U' S' U S R2", "S R U' R' U R S'", "U2 S' U' S U' R2", "R U2 R' U S R S' U R", "U S' U' S R2", "f R U R' U' R' f' R2", "R2 S' U' S", "R U R' S R S' U' R", "R D' r U' r' D R", "R' f R U R U' R' f' R'", "R U' R2 S R S' U R", "R' U2 R U S' U' S R2", "f R' S' R F' R2", "U R' S R S' R U' R2", "U2 D r' U' r D' F R' F' R2"],
  },
  {
    setName: "misoriented-pair-u",
    caseNames: [...Array(32).keys()].map(num => `${num+1}`),
    algs: ["U R' F' U' F R", "U f U R' U' f'", "f' U f R'", "U' F' U' F R2", "U2 R' f R2 f'", "U f R' f'", "U' R U2 R U R' S R' S'", "R' U2 R U S R S'", "U2 F R2 f' U' S", "U R D r' U' r D' R'", "U R' F' U' F2 R F'", "R' U' S R S'", "U2 R U2 R' U' S R S'", "U' f U R' U' F' R S'", "U S' U' S R' U' R", "U R U R' S R' S'", "U' R U R' S' U' S R", "U2 f' U' f2 R2 f'", "R' S' U' S R", "U' D' r U r' U' D R", "U2 R' S R F R2 f'", "U f' R' U2 R f", "R' U' R2 U2 S R' S'", "U' D r' U r D' R'", "U2 S R' F R2 f'", "U' R2 U R' S' U' S R", "U S' U' S R' U' F R F'", "U' D r' U r D' R2 F R F'", "U R D r' U' r D' R2 F R F'", "D r' U' r D' R F R' F'", "U' R' U2 R S R S' R2 F R' F'", "U2 S R S' R' f R2 f'"],
  },
  {
    setName: "misoriented-pair-r",
    caseNames: [...Array(32).keys()].map(num => `${num+1}`),
    algs: ["F R2 F' U' R", "R2 F' U' F R", "U' f R f' R' U2 R2", "U f U R U' f' R", "R' U R' F R2 F'", "R' f R' f'", "S R U' R' U R S' R", "R U2 R' U S R S' R", "U R2 U' R S R' S'", "R U' R' S R S' R' U R2", "R U' R' U S R S' R", "R D' r U' r' D R2", "U' R U' R' U' S R S' R", "D r' U' r D' R'", "U R2 U R2 S R S' R", "R' f' R' U2 R f", "U' f' R' U2 R f R", "S' U' R' U2 R S R", "S R S' R' U R2", "R' S R S' U R2", "U S R S' R", "U R' S R' S'", "R D' U r U' r' D R2", "U2 S R S' R' f R' f' R2", "U R' U2 R2 S R S'", "R U2 R2 f R2 F' R S'", "U2 F R' F' R2 D r' U r D'", "D r' U' r D' R2 F R F'", "S R S' R2 F R' F'", "R' S R S' U2 S' U' S R2", "R' B' R2 B R' S R S' R", "U R S' U' S2 R' S' U R"],
  },
]

function convertSpreadsheet(s: SpreadsheetFormat): { setName: string, cases: Case[] }[] {
  return s.map(({ setName, caseNames, algs }) => {
    if (caseNames.length !== algs.length) {
      throw new Error("invalid spreadsheet format");
    }
    const cases = caseNames.map((caseName, idx) => ({
      name: caseName,
      alg: algs[idx]
    }))
    return {
      setName,
      cases
    }
  })
}

const algSheet = convertSpreadsheet(spreadsheet)

async function addScramblesToCases(cases: Case[]): Promise<CaseWithScrambles[]> {
  const casesWithScrambles = cases.map(async ({ name, alg }) => {
    const scrambles = await getEOPairScrams(new Alg(alg), 50)
    return {
      name,
      alg,
      scrambles,
    }
  })
  return Promise.all(casesWithScrambles);
}

// generate EOPair scrambles
// async function main() {
//   const algSheetWithScrambles = await Promise.all(algSheet.map(async ({ setName, cases }) => {
//     const newCases = await addScramblesToCases(cases)
//     return {
//       setName,
//       cases: newCases
//     }
//   }))
//   console.log(algSheetWithScrambles)
// }

// main();

async function getLXS() {
  const kpuzzle = await cube3x3x3.kpuzzle()
  const randomLXS = getRandomState(solvedState, pairSolvedEOMask)
  const scramState = new KState(kpuzzle, randomLXS)
  const solution = await experimentalSolve3x3x3IgnoringCenters(scramState)
  const formatted = solution.invert().toString().split(" ").map(move => move.replace("2'", "2")).join(" ")
  document.getElementById("scramble")!.innerText = formatted;
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<p id="scramble"></p>
<button id="getscram" onclick="getLXS()">Generate LXS scramble</button>
`
document.getElementById("getscram")!.addEventListener('click', getLXS)
