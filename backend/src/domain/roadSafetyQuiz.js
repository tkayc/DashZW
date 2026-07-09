/**
 * Road safety quiz for newly approved drivers.
 * Pass mark: 80% (8 of 10).
 */
export const QUIZ_VERSION = 'v1';
export const QUIZ_PASS_SCORE = 80;

export const ROAD_SAFETY_QUIZ = [
  {
    id: 'q1',
    question: 'What is the safest following distance in city traffic?',
    options: [
      'Half a car length',
      'At least a 2–3 second gap behind the vehicle ahead',
      'As close as possible to save time',
      'No gap needed if you are delivering',
    ],
    correctIndex: 1,
  },
  {
    id: 'q2',
    question: 'When should you use your phone while driving or riding?',
    options: [
      'Anytime if it is hands-free and urgent',
      'Only when stopped in a safe place',
      'While waiting at a red light',
      'Whenever a customer messages',
    ],
    correctIndex: 1,
  },
  {
    id: 'q3',
    question: 'A pedestrian is already crossing at a zebra crossing. You should:',
    options: [
      'Hoot and continue if you are late',
      'Speed up to pass before they finish',
      'Stop and give them the right of way',
      'Drive around them carefully',
    ],
    correctIndex: 2,
  },
  {
    id: 'q4',
    question: 'In wet or rainy conditions you should:',
    options: [
      'Drive at the same speed as usual',
      'Reduce speed and increase following distance',
      'Use hazard lights and drive in the middle of the road',
      'Ignore road markings because they are slippery',
    ],
    correctIndex: 1,
  },
  {
    id: 'q5',
    question: 'Before starting a delivery shift you must check:',
    options: [
      'Only your phone battery',
      'Brakes, lights, tyres/tyre pressure, and that your load is secure',
      'Only the delivery bag',
      'Nothing — the app will warn you',
    ],
    correctIndex: 1,
  },
  {
    id: 'q6',
    question: 'At a stop street with no traffic lights you must:',
    options: [
      'Slow down and roll through if the road looks clear',
      'Come to a complete stop, then proceed when safe',
      'Hoot once and continue',
      'Only stop if another vehicle is coming',
    ],
    correctIndex: 1,
  },
  {
    id: 'q7',
    question: 'If you feel tired during a shift, the safest action is to:',
    options: [
      'Drink energy drinks and continue',
      'Pull over in a safe place and rest before continuing',
      'Drive faster to finish sooner',
      'Open the windows and keep going',
    ],
    correctIndex: 1,
  },
  {
    id: 'q8',
    question: 'When carrying a delivery package on a motorbike or in a car you should:',
    options: [
      'Hold it with one hand while steering',
      'Secure it so it cannot fall or block your view/controls',
      'Place it on the passenger seat unsecured',
      'Balance it on the fuel tank',
    ],
    correctIndex: 1,
  },
  {
    id: 'q9',
    question: 'What should you do if another road user becomes aggressive?',
    options: [
      'Argue back to defend yourself',
      'Stay calm, avoid eye contact, and create space safely',
      'Brake suddenly in front of them',
      'Follow them to confront them later',
    ],
    correctIndex: 1,
  },
  {
    id: 'q10',
    question: 'Alcohol or drugs before or during a delivery shift are:',
    options: [
      'Allowed in small amounts if you feel fine',
      'Strictly not allowed — never drive or ride under the influence',
      'OK if the delivery is short',
      'Only banned for van drivers',
    ],
    correctIndex: 1,
  },
];
