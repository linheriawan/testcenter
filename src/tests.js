// Test definitions and scoring.
//
// "type16": an original 32-item, 16-type preference test written for this app
//           (not the official MBTI and not OEJTS, so no licensing restrictions).
//           Items should be reviewed and validated by the psychologist before launch.
// "bigfive": the IPIP 50-item Big-Five Factor Markers (public domain, ipip.ori.org).

// ---------------- 16-type preference test ----------------
// Each item is a pair. Answer 1 = strongly the left statement, 5 = strongly the right one.
// `right` names the pole the right-hand statement points to.

const TYPE16_ITEMS = [
  { dim: 'EI', left: 'Recharge by spending time with friends', right: 'Recharge by spending time alone', rightPole: 'I' },
  { dim: 'SN', left: 'Focus on facts and details', right: 'Focus on ideas and possibilities', rightPole: 'N' },
  { dim: 'TF', left: 'Decide with logic and consistency', right: "Decide by weighing people's feelings", rightPole: 'F' },
  { dim: 'JP', left: 'Plan my week in advance', right: 'Take each day as it comes', rightPole: 'P' },

  { dim: 'EI', left: 'Think things through before speaking', right: 'Think out loud while talking', rightPole: 'E' },
  { dim: 'SN', left: 'Imagine how things could be', right: 'Deal with how things are', rightPole: 'S' },
  { dim: 'TF', left: 'Value harmony in a group', right: 'Value honest debate in a group', rightPole: 'T' },
  { dim: 'JP', left: 'Enjoy keeping my options open', right: 'Enjoy having things settled', rightPole: 'J' },

  { dim: 'EI', left: 'Prefer working in a team', right: 'Prefer working on my own', rightPole: 'I' },
  { dim: 'SN', left: 'Learn best through hands-on practice', right: 'Learn best through concepts and theory', rightPole: 'N' },
  { dim: 'TF', left: 'Give feedback directly, even if it stings', right: 'Give feedback gently and carefully', rightPole: 'F' },
  { dim: 'JP', left: 'Finish tasks well before the deadline', right: 'Do my best work close to the deadline', rightPole: 'P' },

  { dim: 'EI', left: 'Have a few close friends', right: 'Have a wide circle of friends', rightPole: 'E' },
  { dim: 'SN', left: 'Trust my hunches', right: 'Trust experience and proven methods', rightPole: 'S' },
  { dim: 'TF', left: "Am easily moved by others' stories", right: 'Stay objective when others share problems', rightPole: 'T' },
  { dim: 'JP', left: 'Am fine with last-minute changes', right: 'Prefer to stick to the plan', rightPole: 'J' },

  { dim: 'EI', left: 'Enjoy being the center of attention', right: 'Prefer staying in the background', rightPole: 'I' },
  { dim: 'SN', left: 'Like clear step-by-step instructions', right: 'Like figuring out my own way', rightPole: 'N' },
  { dim: 'TF', left: 'Think fairness means the same rules for everyone', right: 'Think fairness means considering each situation', rightPole: 'F' },
  { dim: 'JP', left: 'Keep my workspace organized', right: 'Have a messy workspace but know where things are', rightPole: 'P' },

  { dim: 'EI', left: 'Am quiet in a new group', right: 'Easily start conversations with strangers', rightPole: 'E' },
  { dim: 'SN', left: 'Notice the big picture first', right: 'Notice specific details first', rightPole: 'S' },
  { dim: 'TF', left: 'Want to be seen as kind', right: 'Want to be seen as competent', rightPole: 'T' },
  { dim: 'JP', left: 'Start many things at once', right: 'Finish one thing before starting another', rightPole: 'J' },

  { dim: 'EI', left: 'Spend the weekend out with many people', right: 'Spend the weekend at home', rightPole: 'I' },
  { dim: 'SN', left: 'Set practical, realistic goals', right: 'Set ambitious, visionary goals', rightPole: 'N' },
  { dim: 'TF', left: 'Weigh pros and cons carefully', right: 'Go with what feels right', rightPole: 'F' },
  { dim: 'JP', left: 'Make to-do lists', right: 'Rely on memory and flow', rightPole: 'P' },

  { dim: 'EI', left: 'Prefer chatting by message', right: 'Prefer calling or meeting in person', rightPole: 'E' },
  { dim: 'SN', left: 'Enjoy talking about the future and what-ifs', right: 'Enjoy talking about real events and experiences', rightPole: 'S' },
  { dim: 'TF', left: 'Ask how people will be affected', right: 'Ask whether it makes sense', rightPole: 'T' },
  { dim: 'JP', left: 'Travel with a loose idea', right: 'Travel with a full itinerary', rightPole: 'J' }
];

const DIMS = {
  EI: { a: 'E', b: 'I', aName: 'Extraversion', bName: 'Introversion' },
  SN: { a: 'S', b: 'N', aName: 'Sensing', bName: 'Intuition' },
  TF: { a: 'T', b: 'F', aName: 'Thinking', bName: 'Feeling' },
  JP: { a: 'J', b: 'P', aName: 'Judging', bName: 'Perceiving' }
};

const TYPE_LABELS = {
  INTJ: ['The Strategic Planner', 'You think in systems, plan ahead and enjoy going deep on hard problems.'],
  INTP: ['The Curious Analyst', 'You love understanding how things work and testing ideas for logic.'],
  ENTJ: ['The Decisive Leader', 'You set direction, organize people and push toward ambitious goals.'],
  ENTP: ['The Inventive Challenger', 'You spot new possibilities quickly and enjoy debating ideas.'],
  INFJ: ['The Insightful Guide', 'You read people well and work quietly toward meaningful goals.'],
  INFP: ['The Idealistic Creator', 'You are guided by your values and drawn to creative, meaningful work.'],
  ENFJ: ['The Inspiring Mentor', 'You bring people together and help others grow.'],
  ENFP: ['The Enthusiastic Explorer', 'You are energized by people, ideas and new experiences.'],
  ISTJ: ['The Reliable Organizer', 'You are dependable, thorough and value doing things the right way.'],
  ISFJ: ['The Caring Supporter', 'You are loyal and attentive, and you look after the people around you.'],
  ESTJ: ['The Efficient Manager', 'You like structure, clear rules and getting results on time.'],
  ESFJ: ['The Warm Coordinator', 'You keep groups running smoothly and make people feel included.'],
  ISTP: ['The Practical Problem-Solver', 'You stay calm, work with your hands and fix what is broken.'],
  ISFP: ['The Gentle Artist', 'You are sensitive to beauty and prefer to express yourself through action.'],
  ESTP: ['The Action Taker', 'You think on your feet and thrive when things move fast.'],
  ESFP: ['The Lively Performer', 'You are spontaneous and fun, and you bring energy to any room.']
};

function scoreType16(answers) {
  const points = { EI: 0, SN: 0, TF: 0, JP: 0 }; // points toward the first pole (E, S, T, J)
  const max = { EI: 0, SN: 0, TF: 0, JP: 0 };
  TYPE16_ITEMS.forEach((item, i) => {
    const a = answers[i];
    const d = DIMS[item.dim];
    const towardRight = a - 1; // 0..4
    const towardLeft = 5 - a; // 0..4
    points[item.dim] += item.rightPole === d.a ? towardRight : towardLeft;
    max[item.dim] += 4;
  });
  let code = '';
  const dimensions = Object.keys(DIMS).map((k) => {
    const d = DIMS[k];
    const aPct = Math.round((points[k] / max[k]) * 100);
    const letter = aPct > 50 ? d.a : d.b;
    code += letter;
    return { key: k, a: d.a, b: d.b, aName: d.aName, bName: d.bName, aPct, bPct: 100 - aPct, letter };
  });
  // Present the letters in the usual order: E/I, S/N, T/F, J/P
  const label = TYPE_LABELS[code] || ['', ''];
  return { code, title: label[0], description: label[1], dimensions };
}

// ---------------- Big Five (IPIP 50-item markers, public domain) ----------------
// key: +1 scored as is, -1 reverse scored. Likert 1 (very inaccurate) .. 5 (very accurate).

const BIGFIVE_ITEMS = [
  ['E', 1, 'Am the life of the party.'],
  ['A', -1, 'Feel little concern for others.'],
  ['C', 1, 'Am always prepared.'],
  ['N', 1, 'Get stressed out easily.'],
  ['O', 1, 'Have a rich vocabulary.'],
  ['E', -1, "Don't talk a lot."],
  ['A', 1, 'Am interested in people.'],
  ['C', -1, 'Leave my belongings around.'],
  ['N', -1, 'Am relaxed most of the time.'],
  ['O', -1, 'Have difficulty understanding abstract ideas.'],
  ['E', 1, 'Feel comfortable around people.'],
  ['A', -1, 'Insult people.'],
  ['C', 1, 'Pay attention to details.'],
  ['N', 1, 'Worry about things.'],
  ['O', 1, 'Have a vivid imagination.'],
  ['E', -1, 'Keep in the background.'],
  ['A', 1, "Sympathize with others' feelings."],
  ['C', -1, 'Make a mess of things.'],
  ['N', -1, 'Seldom feel blue.'],
  ['O', -1, 'Am not interested in abstract ideas.'],
  ['E', 1, 'Start conversations.'],
  ['A', -1, "Am not interested in other people's problems."],
  ['C', 1, 'Get chores done right away.'],
  ['N', 1, 'Am easily disturbed.'],
  ['O', 1, 'Have excellent ideas.'],
  ['E', -1, 'Have little to say.'],
  ['A', 1, 'Have a soft heart.'],
  ['C', -1, 'Often forget to put things back in their proper place.'],
  ['N', 1, 'Get upset easily.'],
  ['O', -1, 'Do not have a good imagination.'],
  ['E', 1, 'Talk to a lot of different people at parties.'],
  ['A', -1, 'Am not really interested in others.'],
  ['C', 1, 'Like order.'],
  ['N', 1, 'Change my mood a lot.'],
  ['O', 1, 'Am quick to understand things.'],
  ['E', -1, "Don't like to draw attention to myself."],
  ['A', 1, 'Take time out for others.'],
  ['C', -1, 'Shirk my duties.'],
  ['N', 1, 'Have frequent mood swings.'],
  ['O', 1, 'Use difficult words.'],
  ['E', 1, "Don't mind being the center of attention."],
  ['A', 1, "Feel others' emotions."],
  ['C', 1, 'Follow a schedule.'],
  ['N', 1, 'Get irritated easily.'],
  ['O', 1, 'Spend time reflecting on things.'],
  ['E', -1, 'Am quiet around strangers.'],
  ['A', 1, 'Make people feel at ease.'],
  ['C', 1, 'Am exacting in my work.'],
  ['N', 1, 'Often feel blue.'],
  ['O', 1, 'Am full of ideas.']
];

const BIGFIVE_TRAITS = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Emotional sensitivity'
};

function scoreBigFive(answers) {
  const sum = { O: 0, C: 0, E: 0, A: 0, N: 0 };
  BIGFIVE_ITEMS.forEach(([trait, key], i) => {
    const a = answers[i];
    sum[trait] += key === 1 ? a : 6 - a;
  });
  const traits = ['O', 'C', 'E', 'A', 'N'].map((t) => {
    const pct = Math.round(((sum[t] - 10) / 40) * 100);
    const level = pct >= 65 ? 'High' : pct <= 35 ? 'Low' : 'Moderate';
    return { key: t, name: BIGFIVE_TRAITS[t], pct, level };
  });
  return { traits };
}

// ---------------- DISC-style work style (shared definition in public/shared/disc.js) ----------------

import { GROUPS as DISC_GROUPS, validDisc, scoreDisc } from '../public/shared/disc.js';

// ---------------- Catalog ----------------

export const TESTS = {
  bigfive: {
    id: 'bigfive',
    code: 'B5',
    name: 'Big Five personality',
    minutes: 10,
    format: 'likert',
    instruction: 'Describe yourself as you generally are now, not as you wish to be.',
    prompt: 'I…',
    scale: ['Very inaccurate', 'Moderately inaccurate', 'Neither', 'Moderately accurate', 'Very accurate'],
    questions: BIGFIVE_ITEMS.map(([, , text]) => ({ text })),
    score: scoreBigFive
  },
  disc: {
    id: 'disc',
    code: 'DI',
    name: 'Work style (DISC)',
    minutes: 8,
    format: 'forced',
    instruction: 'Go with your first instinct. Describe how you usually are at work or school.',
    prompt: 'In each group, pick the word MOST like you and the word LEAST like you.',
    scale: [],
    // Factors are never sent to the browser, only the words.
    questions: DISC_GROUPS.map((g) => ({ options: g.map(([text, gloss]) => ({ text, gloss })) })),
    validate: validDisc,
    score: scoreDisc
  },
  type16: {
    id: 'type16',
    code: '16',
    name: '16-type personality',
    minutes: 8,
    format: 'pair',
    instruction: 'There are no right or wrong answers. Answer as you usually are, not as you wish to be.',
    prompt: 'Which is more like you? I…',
    scale: ['Strongly left', 'Somewhat left', 'Neutral', 'Somewhat right', 'Strongly right'],
    questions: TYPE16_ITEMS.map((q) => ({ left: q.left, right: q.right })),
    score: scoreType16
  }
};

export const COMING_SOON = [
  { id: 'riasec', code: 'RI', name: 'Career interests (RIASEC)', minutes: 10 },
  { id: 'values', code: 'WV', name: 'Work values', minutes: 6 }
];

export function publicTest(t) {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    minutes: t.minutes,
    format: t.format,
    instruction: t.instruction,
    prompt: t.prompt,
    scale: t.scale,
    questions: t.questions
  };
}

export function validateAnswers(test, answers) {
  if (test.validate) return test.validate(answers);
  if (!Array.isArray(answers) || answers.length !== test.questions.length) return false;
  return answers.every((a) => Number.isInteger(a) && a >= 1 && a <= 5);
}
