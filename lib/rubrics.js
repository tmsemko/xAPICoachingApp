// Built-in multi-dimensional rubrics. A rubric metric has:
//   { name, mode: "rubric", levels: [worst..best], dimensions: [...] }
// Each dimension: { name, definition, lookFors, levels: { <levelName>: descriptor } }

export const COACHING_RUBRIC = {
  name: "Performance-Focused Coaching Rubric",
  mode: "rubric",
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

export const RUBRICS = { coaching: COACHING_RUBRIC };
