// Built-in multi-dimensional rubrics. A rubric metric has:
//   { name, mode: "rubric", levels: [worst..best], dimensions: [...] }
// Each dimension: { name, definition, lookFors, levels: { <levelName>: descriptor } }

export const COACHING_RUBRIC = {
  name: "Performance-Focused Coaching Rubric",
  mode: "rubric",
  framework: "Performance",
  jobFunction: "Data & analytics coaching",
  blurb: "Domain-specific rubric for data/analytics coaching conversations: powerful questioning, coachee-led problem solving, tool/domain integration, psychological safety, and action-orientation.",
  bestFor: "Technical coaching sessions with a domain context (e.g. analytics, Tableau)",
  levels: ["Needs Improvement", "Developing", "Advanced"],
  // Which speaker is treated as the coach for talk-time signals; the classifier
  // is told this and the UI can override it.
  coachRole: "first-speaker",
  dimensions: [
    {
      name: "Powerful Questioning",
      definition:
        "The ability to ask open-ended, thought-provoking questions that challenge assumptions and compel the coachee to analyze data deeply.",
      lookFors:
        "Questions beginning with What, How, or Why. Pauses that allow the coachee to process. Queries that push the coachee to connect data trends to tactical executions.",
      levels: {
        Advanced:
          "Consistently asks open-ended questions that require critical thinking. Prompts the coachee to diagnose issues and form hypotheses. Avoids embedding the answer within the question.",
        Developing:
          "Alternates between open-ended and leading questions. Sometimes suggests the answer while asking, limiting independent analysis.",
        "Needs Improvement":
          "Relies heavily on leading or binary questions ('Don't you think...?', 'Shouldn't we...?'). Questions function as directives requiring only agreement.",
      },
    },
    {
      name: "Coachee-Led Problem Solving",
      definition:
        "The degree to which the coachee owns the diagnosis of the problem and the formulation of both technical and strategic solutions.",
      lookFors:
        "The coachee explaining the 'why' behind data behaviors, outlining technical steps in Tableau, and proposing marketing adjustments. The coach acting as a sounding board.",
      quantitativeSignal: "coach_talk_time_pct",
      levels: {
        Advanced:
          "The coachee actively diagnoses the problem and designs the solution. The coach speaks less than 30% of the time.",
        Developing:
          "The coach identifies the core problem, but the coachee proposes the tactical steps. Effort is shared roughly equally.",
        "Needs Improvement":
          "The coach diagnoses, explains why, and dictates the exact solution. The coachee acts as an order-taker.",
      },
    },
    {
      name: "Contextual Tool & Domain Relevance",
      definition:
        "The seamless integration of specific digital marketing concepts (data segmentation, CPG metrics) and the technical environment (Tableau, data blending, calculated fields).",
      lookFors:
        "Terminology like conversions, psychographics, behavioral segmentation, calculated fields, data blending, cross-database joins, dimensions.",
      levels: {
        Advanced:
          "Coaching directly links high-level marketing concepts (intent-based targeting) to specific technical executions in Tableau (calculated dimensions from blended CRM and Shopify data).",
        Developing:
          "Mentions marketing strategy and the tool but keeps them separated; advice remains generic rather than intertwined.",
        "Needs Improvement":
          "Conversation stays surface-level; fails to leverage specific strategies or execution in Tableau.",
      },
    },
    {
      name: "Psychological Safety & Active Listening",
      definition:
        "Creating a supportive environment where the coachee feels safe discussing underperforming campaigns and admitting roadblocks without fear of penalization.",
      lookFors:
        "Affirmations of effort or formatting (e.g. 'clean dashboards'). Allowing the coachee to finish thoughts without interruption. Acknowledging their perspective before shifting focus.",
      quantitativeSignal: "interruption_count",
      levels: {
        Advanced:
          "Actively validates what is working before addressing gaps. Listens without interrupting, allowing the coachee to fully articulate their thinking.",
        Developing:
          "Acknowledges input but may cut thoughts short or move quickly past insights to stay on the coach's agenda.",
        "Needs Improvement":
          "Focuses entirely on failures without acknowledging valid work. Frequently interrupts or shuts down explanations mid-sentence.",
      },
    },
    {
      name: "Action-Orientation & Collaborative Accountability",
      definition:
        "Concluding with specific, measurable action items, ownership assignments, and a realistic timeline that respects the coachee's broader workflow.",
      lookFors:
        "Clear definitions of what will be built, when, and how success is measured, balanced against current capacity.",
      levels: {
        Advanced:
          "The coachee states their own next steps and a realistic deadline. The coach confirms alignment and verifies capacity and resources.",
        Developing:
          "Next steps and timeline are established but heavily prompted or assigned by the coach rather than volunteered.",
        "Needs Improvement":
          "Meeting ends without clear action items, or the coach imposes a rigid timeline and task list without verifying understanding, availability, or buy-in.",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Coaching-framework rubrics — converted from docs/frameworks/*.md.
// All five share the 4-level scale used in the framework docs.
// Extra fields (framework, jobFunction, blurb, bestFor) drive the UI picker;
// the classifier only reads name/levels/dimensions.
// ---------------------------------------------------------------------------

const FW_LEVELS = ["Developing", "Emerging", "Proficient", "Exemplary"];

export const GROW_RUBRIC = {
  name: "GROW Conversation Quality Rubric",
  mode: "rubric",
  framework: "GROW",
  jobFunction: "Management / people leadership",
  blurb: "Goal, Reality, Options, Will — the world's default coaching model (Whitmore). Judges whether the conversation sets a goal, examines reality, generates options, and lands a committed action.",
  bestFor: "Manager 1:1 performance and development conversations",
  levels: FW_LEVELS,
  coachRole: "first-speaker",
  dimensions: [
    {
      name: "Goal Clarity",
      definition: "Whether the coachee establishes a specific, measurable goal for the session, ideally linked to a longer-term performance or development goal they own.",
      lookFors: "Questions like 'What do you want to achieve from this conversation?', 'What does success look like?'. A stated session goal in the coachee's own words, with timing.",
      levels: {
        Developing: "No explicit goal; the conversation drifts.",
        Emerging: "A goal is named but vague or coach-imposed.",
        Proficient: "The coachee states a specific, measurable session goal.",
        Exemplary: "The session goal is linked to a longer-term performance/development goal owned by the coachee.",
      },
    },
    {
      name: "Reality Exploration",
      definition: "How objectively and thoroughly the current situation is explored before moving to solutions — facts, feelings, prior attempts, and obstacles.",
      lookFors: "'What is happening now?', 'What have you tried so far?', 'What obstacles are in your way?'. Coach withholding solutions while the situation is examined.",
      levels: {
        Developing: "The coach assumes or tells the coachee what the situation is.",
        Emerging: "Superficial questions; the coach jumps to solutions.",
        Proficient: "Open questions surface facts, feelings, and obstacles.",
        Exemplary: "The coachee reaches a self-generated insight about the real barrier.",
      },
    },
    {
      name: "Option Generation",
      definition: "The breadth of alternatives generated before any option is evaluated, and whether they come from the coachee rather than the coach.",
      lookFors: "'What could you do? What else?' asked repeatedly. Constraint-removal questions. Advice offered only by permission ('Would you like a suggestion?').",
      levels: {
        Developing: "The coach prescribes the answer.",
        Emerging: "One or two options, mostly from the coach.",
        Proficient: "The coachee generates three or more options before evaluating.",
        Exemplary: "The coachee expands beyond initial assumptions; any coach advice is offered only by permission.",
      },
    },
    {
      name: "Will / Commitment",
      definition: "Whether insight converts into a specific committed action with an owner, deadline, support, and follow-up.",
      lookFors: "'What will you do? By when?', a 1–10 commitment check, support identified, follow-up scheduled.",
      levels: {
        Developing: "No action agreed.",
        Emerging: "Vague intention ('I'll try to...').",
        Proficient: "Specific action, owner, and deadline agreed.",
        Exemplary: "Action plus commitment scaled at 8+/10, support identified, and a follow-up scheduled.",
      },
    },
    {
      name: "Talk Ratio & Questioning",
      definition: "Whether the coach unlocks answers through short, open questions and silence rather than dominating the conversation.",
      lookFors: "Coachee doing most of the talking; open questions (What/How); comfortable pauses; absence of leading or stacked questions.",
      quantitativeSignal: "coach_talk_time_pct",
      levels: {
        Developing: "The coach talks more than 60% of the time.",
        Emerging: "The coach talks about half the time, with frequent closed or leading questions.",
        Proficient: "The coachee talks around 70% of the time; questions are mostly open.",
        Exemplary: "The coachee talks 80%+; the coach uses short, powerful questions and comfortable silence.",
      },
    },
  ],
};

export const CLEAR_RUBRIC = {
  name: "CLEAR Session Rubric",
  mode: "rubric",
  framework: "CLEAR",
  jobFunction: "Executive & senior leadership coaching",
  blurb: "Contracting, Listening, Exploring, Action, Review (Hawkins). Transformational coaching that works with emotions, patterns, and underlying beliefs — not just action plans.",
  bestFor: "Executive coaching and high-stakes conversations where the presenting issue masks a deeper pattern",
  levels: FW_LEVELS,
  coachRole: "first-speaker",
  dimensions: [
    {
      name: "Contracting",
      definition: "Whether the conversation opens with an explicit agreement on scope, desired outcome, and how the coachee wants to be coached.",
      lookFors: "'What would make this hour valuable?', 'How do you want me to be with you?', scope in/out agreed, success criteria named, contract revisited if the real issue emerges.",
      levels: {
        Developing: "No contract; the coach assumes the agenda.",
        Emerging: "The topic is agreed, but no outcome or process contract.",
        Proficient: "Outcome, scope, and coaching style are agreed upfront.",
        Exemplary: "The contract is revisited mid-session when the real issue emerges.",
      },
    },
    {
      name: "Listening Depth",
      definition: "Generative listening that reflects emotion and energy — helping the coachee hear themselves — beyond accurate paraphrase of content.",
      lookFors: "Reflecting exact words, naming energy shifts ('your energy dropped when...'), allowing silence, listening for the person rather than the problem.",
      quantitativeSignal: "interruption_count",
      levels: {
        Developing: "The coach interrupts and problem-solves.",
        Emerging: "Accurate paraphrase of content only.",
        Proficient: "The coach reflects emotion and energy shifts, not just words.",
        Exemplary: "The coachee reports hearing themselves differently; the conversation reaches feelings and underlying assumptions.",
      },
    },
    {
      name: "Exploring",
      definition: "Whether the session surfaces the personal impact of the situation and the patterns and beliefs beneath it, then generates new possibility.",
      lookFors: "'What impact is this having on you?', 'Where has this shown up before?', 'What belief would you have to let go of?', possibility questions.",
      levels: {
        Developing: "Stays on surface facts.",
        Emerging: "Explores the situation but not its personal impact.",
        Proficient: "Impact and recurring patterns are surfaced.",
        Exemplary: "An underlying assumption is named and challenged; a new possibility is generated.",
      },
    },
    {
      name: "Action & Rehearsal",
      definition: "Whether the coachee chooses a route forward and, distinctively for CLEAR, rehearses it live in the session with feedback.",
      lookFors: "'What will you act on?', a concrete first step with timing, fast-forward rehearsal ('say it to me as if I were them'), contingency planning.",
      levels: {
        Developing: "No action.",
        Emerging: "An action is stated but untested.",
        Proficient: "A specific action with first step and timing.",
        Exemplary: "The action is rehearsed live with feedback, and resistance/contingency is discussed.",
      },
    },
    {
      name: "Review",
      definition: "Whether the session closes by reviewing both the committed actions and the coaching process itself.",
      lookFors: "'What are you taking away?', 'What worked about how we worked together?', accountability agreed, feedback on the coaching invited.",
      levels: {
        Developing: "The session just ends.",
        Emerging: "Actions are summarized.",
        Proficient: "Learning and actions are reviewed; the coachee self-assesses.",
        Exemplary: "The coachee gives feedback on the coaching itself and process adjustments are agreed.",
      },
    },
  ],
};

export const OSKAR_RUBRIC = {
  name: "OSKAR Coach Fidelity Rubric",
  mode: "rubric",
  framework: "OSKAR",
  jobFunction: "Team performance / solution-focused management",
  blurb: "Outcome, Scaling, Know-how, Affirm & Action, Review (McKergow & Jackson). Solution-focused: skips problem analysis and amplifies what's already working, anchored by the 0–10 scaling question.",
  bestFor: "Team cadences, retrospectives, and confidence dips where problem-analysis has hit diminishing returns",
  levels: FW_LEVELS,
  coachRole: "first-speaker",
  dimensions: [
    {
      name: "Outcome Focus",
      definition: "Whether attention is directed to the desired future state rather than the problem and its causes.",
      lookFors: "'What would you like to have happen?', the miracle question ('suppose the problem vanished overnight...'), concrete descriptions of the desired future.",
      levels: {
        Developing: "The conversation centers on the problem and its causes.",
        Emerging: "An outcome is named but discussion drifts back to problem-talk.",
        Proficient: "The future state is described concretely.",
        Exemplary: "The coachee describes observable 'day after the miracle' detail.",
      },
    },
    {
      name: "Scaling",
      definition: "Use of the 0–10 scale to locate today's position and mine the score for what is already working ('why so high', never 'why so low').",
      lookFors: "'On a scale of 0–10, where are you today?', 'What makes it a 4 and not a 0?', 'What would one point higher look like?', a 'good enough' level agreed.",
      levels: {
        Developing: "No scale is used.",
        Emerging: "The scale is asked but the score is left unexplored.",
        Proficient: "'What makes it an N, not zero?' is mined for working elements.",
        Exemplary: "The scale is reused for progress — a good-enough level is agreed and a +1 step defined.",
      },
    },
    {
      name: "Know-how & Resources",
      definition: "Surfacing the skills, past successes, and people that produced the current score — the raw material for progress.",
      lookFors: "'What's helped you get this far?', 'When has something like this gone well before?', 'Who has know-how you could borrow?'.",
      levels: {
        Developing: "The coach supplies the answers.",
        Emerging: "Generic strengths are mentioned.",
        Proficient: "Specific past successes and transferable skills are surfaced.",
        Exemplary: "Resources (people, platforms, prior wins) are mapped and explicitly reused in the action.",
      },
    },
    {
      name: "Affirmation",
      definition: "Evidence-based positive feedback that builds confidence alongside capability — not empty praise.",
      lookFors: "Affirmations tied to specific observed behavior ('what strikes me is how you kept the client engaged...'), visible shift in coachee energy, coachee self-affirming.",
      levels: {
        Developing: "No affirmation, or empty praise.",
        Emerging: "A generic compliment ('great job').",
        Proficient: "Affirmation tied to specific observed evidence.",
        Exemplary: "Affirmation visibly shifts the coachee's energy or confidence; the coachee self-affirms.",
      },
    },
    {
      name: "Small Actions & Review Loop",
      definition: "Whether the session ends with a small step scoped to move one point up the scale, and progress is reviewed next session ('what's better?').",
      lookFors: "'What small step will you take this week?', 'What will you do more of?', next session opening with 'what's better since we spoke?'.",
      levels: {
        Developing: "No action.",
        Emerging: "A large, vague action.",
        Proficient: "A small step scoped to move +1 on the scale.",
        Exemplary: "The step is committed and the next session opens with a 'what's better?' review.",
      },
    },
  ],
};

export const FUEL_RUBRIC = {
  name: "FUEL Conversation Rubric",
  mode: "rubric",
  framework: "FUEL",
  jobFunction: "Sales coaching & manager-initiated feedback",
  blurb: "Frame, Understand, Explore, Lay out a plan (Zenger & Stinnett). Built for conversations the manager initiates — call debriefs, deal reviews, performance feedback — forcing the framing and understanding steps managers skip.",
  bestFor: "Sales call/deal debriefs and any feedback conversation the manager must initiate",
  levels: FW_LEVELS,
  coachRole: "first-speaker",
  dimensions: [
    {
      name: "Framing",
      definition: "Whether the conversation opens with an agreed purpose, process, and outcome — the step that legitimizes a manager-initiated coaching moment.",
      lookFors: "Purpose stated and consent sought ('my goal is to help you think through next steps — does that work?'), a single topic in focus, coachee input on the agenda.",
      levels: {
        Developing: "Launches into feedback or advice with no setup.",
        Emerging: "The topic is stated, but no purpose or process is agreed.",
        Proficient: "Purpose, process, and outcome are agreed, with a single focus.",
        Exemplary: "The coachee co-owns the agenda; psychological safety is explicitly built.",
      },
    },
    {
      name: "Understanding",
      definition: "Whether the coachee's full view of the situation is surfaced before the manager offers their own read — the step managers most often fail.",
      lookFors: "'How do you see the situation?', 'What's working? What's getting in the way?', manager observations withheld until the coachee's view is complete, then offered by permission.",
      levels: {
        Developing: "The manager states their view first and only.",
        Emerging: "A token question, then the manager's assessment dominates.",
        Proficient: "The coachee's full view is surfaced before the manager shares observations.",
        Exemplary: "The coachee self-identifies the gap; the manager's observations are offered by permission and land as additive.",
      },
    },
    {
      name: "Exploring the Desired State",
      definition: "Whether success is vividly defined and multiple paths to it are weighed before one is chosen — by the coachee.",
      lookFors: "'What would you like to see happen instead?', 'What does great look like?', two or three alternative paths compared with trade-offs.",
      levels: {
        Developing: "The manager prescribes the fix.",
        Emerging: "One path considered — usually the manager's.",
        Proficient: "Success is vividly defined; two or three alternative paths are weighed.",
        Exemplary: "The coachee selects the path and articulates why it beats the alternatives.",
      },
    },
    {
      name: "Success Plan",
      definition: "Whether the chosen path converts into specific actions, dates, anticipated obstacles, support, and a booked follow-up.",
      lookFors: "'What exactly will you do, and by when?', first step this week, obstacles anticipated, support requested, follow-up scheduled.",
      levels: {
        Developing: "'Let's touch base sometime.'",
        Emerging: "An action is agreed with no date or measure.",
        Proficient: "Actions, dates, obstacles, and support are defined.",
        Exemplary: "The plan includes milestones, leading indicators, and a booked follow-up.",
      },
    },
    {
      name: "Talk Ratio & Advice Discipline",
      definition: "Whether the coachee does most of the talking and the manager's few contributions are high-leverage questions rather than unsolicited advice.",
      lookFors: "Coachee talk share; advice offered only by permission; short questions over monologues.",
      quantitativeSignal: "coach_talk_time_pct",
      levels: {
        Developing: "The manager talks 70%+ of the time.",
        Emerging: "The manager talks about half the time with frequent unsolicited advice.",
        Proficient: "The coachee talks 65%+; advice is by permission.",
        Exemplary: "The coachee talks 75%+; the manager's few contributions are high-leverage questions.",
      },
    },
  ],
};

export const COACTIVE_RUBRIC = {
  name: "Co-Active Session Rubric",
  mode: "rubric",
  framework: "Co-Active",
  jobFunction: "Executive presence, public speaking & career coaching",
  blurb: "Whole-person coaching (CTI). Coaches the person, not the problem — three-level listening, curiosity, dancing in the moment, and forwarding action while deepening learning.",
  bestFor: "Executive presence, public speaking, and career work where how the person shows up is the subject",
  levels: FW_LEVELS,
  coachRole: "first-speaker",
  dimensions: [
    {
      name: "Coaching the Person vs. the Problem",
      definition: "Whether the session addresses the whole person — values, patterns, identity — rather than only solving the topic they brought.",
      lookFors: "Values and identity connected to the topic; self-knowledge that transfers beyond the presenting issue; no default advice-giving.",
      levels: {
        Developing: "The session is pure problem-solving.",
        Emerging: "Mostly topic-focused; the person appears occasionally.",
        Proficient: "Values, patterns, and identity are connected to the topic.",
        Exemplary: "The coachee gains self-knowledge transferable far beyond the topic.",
      },
    },
    {
      name: "Listening Level",
      definition: "The coach's listening depth on Co-Active's three levels: I internal (self-referential), II focused (on the coachee), III global (energy, tone, the unsaid).",
      lookFors: "Reflections tracking words and emotions; naming shifts in the moment ('something changed when you said that'); absence of coach self-reference and advice.",
      quantitativeSignal: "interruption_count",
      levels: {
        Developing: "Level I dominant — the coach relates material to their own experience and gives advice.",
        Emerging: "Level II intermittent — focused listening with lapses into problem-solving or self-reference.",
        Proficient: "Level II sustained — consistent focused attention; reflections track words and emotions accurately.",
        Exemplary: "Level III — the coach works with energy, tone, pace, and the unsaid, naming shifts in the moment.",
      },
    },
    {
      name: "Curiosity & Questions",
      definition: "Short, powerful, open questions asked from genuine not-knowing rather than diagnosis, with room for silence.",
      lookFors: "Brief open questions; comfortable silence; no leading, stacked, or diagnostic questions.",
      levels: {
        Developing: "Leading or diagnostic questions.",
        Emerging: "Open but long or stacked questions.",
        Proficient: "Short, powerful, open questions.",
        Exemplary: "Questions evoke visible discovery; comfortable silence is used deliberately.",
      },
    },
    {
      name: "Dancing in the Moment",
      definition: "Whether the coach follows what emerges live — energy, emotion, resistance — over any pre-set agenda.",
      lookFors: "Responding to shifts in energy or emotion as they happen; redesigning the session around what emerges; holding the agenda lightly.",
      levels: {
        Developing: "The coach drives a fixed agenda.",
        Emerging: "The coach follows content shifts only.",
        Proficient: "The coach responds to energy and emotion shifts live.",
        Exemplary: "The coach redesigns the session in the moment around what emerges.",
      },
    },
    {
      name: "Forward & Deepen",
      definition: "Co-Active's dual output: every session produces both movement (actions, requests, challenges) and durable learning the coachee keeps.",
      lookFors: "Actions plus articulated learning; inquiries to live with between sessions; accountability designed by the coachee.",
      levels: {
        Developing: "Neither action nor learning.",
        Emerging: "Action without learning, or learning without action.",
        Proficient: "Both an action and articulated learning.",
        Exemplary: "An inquiry or challenge extends learning between sessions; accountability is designed by the coachee.",
      },
    },
  ],
};

export const RUBRICS = {
  grow: GROW_RUBRIC,
  clear: CLEAR_RUBRIC,
  oskar: OSKAR_RUBRIC,
  fuel: FUEL_RUBRIC,
  coactive: COACTIVE_RUBRIC,
  coaching: COACHING_RUBRIC,
};
