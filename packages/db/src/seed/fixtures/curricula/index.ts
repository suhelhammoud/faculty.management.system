import { legacyCommon, legacySpecializations } from './legacy.js';
import { revisedCurricula } from './revised.js';

const catalog = [
  { code: 'software-engineering', name: 'Software Engineering', key: 1, revisedCount: 60 },
  { code: 'network-systems', name: 'Networks and Computer Systems', key: 2, revisedCount: 58 },
  { code: 'artificial-intelligence', name: 'Artificial Intelligence', key: 3, revisedCount: 59 },
] as const;

function stableId(departmentKey: number, entryKey: number) {
  return `17c4d825-b742-48f3-a412-${String(departmentKey * 10 + entryKey).padStart(12, '0')}`;
}

function readModules(terms: readonly string[], version: 1 | 2, expectedCount: number) {
  if (terms.length !== 10) throw new Error('Expected ten semesters in each curriculum fixture.');
  const modules = terms.flatMap((term, index) => {
    const studyYear = Math.floor(index / 2) + 1;
    const semester = (index % 2) + 1;
    return term
      .trim()
      .split('\n')
      .map((line, row) => {
        const code = `Y${studyYear}-S${semester}-${String(row + 1).padStart(2, '0')}`;
        const [nameAr, name, theory = '2', practical = '2', grading, ...extra] = line.split('|');
        const theoryHours = Number(theory);
        const labHours = Number(practical);
        if (
          !/\p{Script=Arabic}/u.test(nameAr) ||
          !/[A-Za-z]/.test(name ?? '') ||
          !/^\d+$/.test(theory) ||
          !/^\d+$/.test(practical) ||
          theoryHours > 80 ||
          labHours > 80 ||
          extra.length ||
          (grading && grading !== (version === 1 ? 'total' : 'capstone'))
        )
          throw new Error(`Invalid curriculum fixture row ${code}: ${line}`);

        const splitMarks = version === 1 ? !grading : labHours > 0 && !grading;
        return {
          studyYear,
          semester,
          code,
          name,
          nameAr,
          theoryHours,
          labHours,
          credits: null,
          theoryMarks: splitMarks ? 70 : null,
          practicalMarks: splitMarks ? 30 : null,
          totalMarks: splitMarks || grading ? 100 : null,
          progressMarks: grading === 'capstone' ? 30 : null,
          requirement: 'required' as const,
        };
      });
  });
  if (modules.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} curriculum rows, found ${modules.length}.`);
  }
  return modules;
}

export const curriculumFixtures = catalog.map(({ code, name, key, revisedCount }) => ({
  code,
  name,
  familyId: stableId(key, 0),
  familyName: 'Curriculum 2025–2026',
  versions: [
    {
      id: stableId(key, 1),
      version: 1,
      name: 'Legacy Curriculum',
      description: `Legacy five-year curriculum for ${code === 'software-engineering' ? 'Software Engineering and Information Systems' : name}.`,
      remarks: 'Years 1–3 follow the common curriculum. Years 4–5 follow the department schedule.',
      modules: readModules([...legacyCommon, ...legacySpecializations[code]], 1, 64),
    },
    {
      id: stableId(key, 2),
      version: 2,
      name: 'Curriculum 2025–2026',
      description: `The 2025–2026 curriculum for ${name} under the internal regulations of the Faculty of Informatics Engineering at the University of Homs.`,
      remarks:
        'Article 12 provides for phased implementation, one study year at a time over five years.',
      modules: readModules(revisedCurricula[code], 2, revisedCount),
    },
  ],
}));
