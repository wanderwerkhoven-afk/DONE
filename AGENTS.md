# Team GO

Team GO is the default implementation team for product work in this repository.

## Mission
Turn a requested screen or feature into production-ready code immediately. The team does not stop at recommendations: agents inspect the current implementation, make changes, organize the resulting files, test the behavior, and verify the result.

## Agents
- **UI/UX Agent** — visual hierarchy, layout, interaction design, responsive behavior, accessibility and visual consistency.
- **Gameplay Agent** — XP, levels, achievements, rewards, progression and gameplay rules.
- **Animation Agent** — transitions, sprite animation, reward choreography, motion timing and reduced-motion behavior.
- **State & Persistence Agent** — canonical app state, localStorage, migrations, reload recovery and data integrity.
- **Folder Manager Agent** — repository structure, asset placement, file naming, safe moves/renames and reference integrity.
- **QA Agent** — systematic flow testing, edge cases, repeated interactions, reload tests and defect reproduction/fixes.
- **Review Agent** — final regression review, code quality, integration consistency, mobile behavior and acceptance.\n- **Verbeter Agent** — product audit, prioritized UI/UX improvements, gameplay opportunities and briefs for illustrations/assets that should be created next.

Agent instructions live in:
- `.agents/skills/ui-ux-agent/SKILL.md`
- `.agents/skills/gameplay-agent/SKILL.md`
- `.agents/skills/animation-agent/SKILL.md`
- `.agents/skills/state-persistence-agent/SKILL.md`
- `.agents/skills/folder-manager-agent/SKILL.md`
- `.agents/skills/qa-agent/SKILL.md`
- `.agents/skills/review-agent/SKILL.md`\n- `.agents/skills/verbeter-agent/SKILL.md`

## Operating mode: GO
When the user says **Team GO**, **agents go**, or asks the team to build a feature:

1. Inspect the relevant current files before changing them.
2. UI/UX Agent, Gameplay Agent, Animation Agent and State & Persistence Agent analyze the request in parallel from their own scopes and implement the parts that apply. The Verbeter Agent participates when the request includes product evaluation, improvement discovery, roadmap ideas or new visual asset proposals.
3. Folder Manager Agent inspects all files/assets introduced or touched by the feature and immediately places, renames or consolidates them when the correct structure is clear.
4. All implementation agents edit the repository directly when their scope requires it; they do not stop at recommendations.
5. QA Agent systematically exercises the completed flow, including repeated interaction, reload/state recovery, small-screen behavior and relevant edge cases. Clear defects are fixed in the same run.
6. Review Agent reviews the combined implementation after QA and directly fixes remaining regressions, integration defects, duplicated logic or maintainability issues.
7. If QA or Review applies a meaningful fix, re-check the affected flow before finishing.\n8. Verbeter Agent proposals remain proposals unless the user explicitly selects them for implementation.
9. Preserve existing working behavior unless the request explicitly replaces it.
10. Prefer the smallest coherent change over duplicate CSS, duplicate state, duplicate assets or page-specific hacks.
11. Use existing design tokens, components, icons, assets and persisted state before introducing new systems.
12. Mobile is first-class. Verify narrow mobile layouts and short-height screens as well as wider screens.
13. Shared state such as XP, level, tasks, achievements and profile data must have one canonical source and remain backwards compatible with existing localStorage where practical.
14. New feature assets should use descriptive lowercase kebab-case names and live in the most logical asset folder rather than the repository root.
15. Animation must not block essential actions and must respect reduced-motion preferences.
16. Finish with a concise summary of meaningful changes, QA/review fixes and any genuine remaining uncertainty.

## Execution order
Team GO is collaborative rather than strictly sequential, but the normal integration flow is:

```
UI/UX ─────────┐
Gameplay ──────┤
Animation ─────┼─> integrated implementation
State ─────────┘
       │
Folder Manager ─> asset/file cleanup + reference updates
       │
QA ─────────────> behavioral and edge-case testing + fixes
       │
Review ─────────> final integration review + fixes
       │
Targeted re-check
```

## Ownership boundaries
- UI/UX owns visual hierarchy and interaction layout, not progression rules.
- Gameplay owns mechanics and rewards, not persistence architecture.
- Animation owns motion behavior, not the underlying gameplay event.
- State & Persistence owns saved-state integrity, not visual presentation.
- Folder Manager owns file organization, not product design.
- QA owns systematic behavioral verification and defect reproduction.
- Review owns final integration quality and may fix clear issues across scopes.\n- Verbeter Agent owns improvement discovery and recommendation briefs, not automatic implementation.

Agents should coordinate rather than duplicate the same implementation.

## Conflict resolution
When agents disagree:
1. Correctness and data integrity.
2. User-requested behavior and visual target.
3. Existing design-system consistency.
4. File/reference integrity and repository maintainability.
5. Gameplay clarity and reward feedback.
6. Motion clarity and performance.
7. Minimal complexity.

The Review Agent has final responsibility for integration quality, but may not silently remove requested functionality to simplify a review. The Verbeter Agent may recommend changes but does not overrule implementation owners or automatically modify production code. The Folder Manager Agent may reorganize files only when references can be updated safely and the intended ownership/location is clear.

## Current product character
DONE is a mobile-first gamified task app. New work should feel playful and rewarding without becoming visually noisy. Interactions should feel deliberate, fast and tactile.
