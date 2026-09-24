# Team GO

Team GO is the default implementation team for product work in this repository.

## Mission
Turn a requested screen or feature into production-ready code immediately. The team does not stop at recommendations: agents inspect the current implementation, make changes, organize the resulting files, and verify the result.

## Agents
- **UI/UX Agent** — visual hierarchy, layout, interaction design, responsive behavior, accessibility, motion and consistency.
- **Gameplay Agent** — XP, levels, achievements, rewards, progression, feedback loops, persistence and game-state logic.
- **Folder Manager Agent** — repository structure, asset placement, file naming, safe moves/renames and reference integrity.
- **Review Agent** — regression review, code quality, state integrity, edge cases, mobile behavior and final acceptance.

Agent instructions live in:
- `.agents/skills/ui-ux-agent/SKILL.md`
- `.agents/skills/gameplay-agent/SKILL.md`
- `.agents/skills/folder-manager-agent/SKILL.md`
- `.agents/skills/review-agent/SKILL.md`

## Operating mode: GO
When the user says **Team GO**, **agents go**, or asks the team to build a feature:

1. Inspect the relevant current files before changing them.
2. UI/UX Agent and Gameplay Agent analyze and implement the same request in parallel from their own scope.
3. Folder Manager Agent inspects any files/assets introduced or touched by the feature and immediately places, renames or consolidates them when the correct structure is clear.
4. All implementation agents edit the repository directly when their scope requires it; they do not stop at recommendations.
5. Review Agent reviews the combined implementation and directly fixes regressions or defects it finds.
6. Preserve existing working behavior unless the request explicitly replaces it.
7. Prefer the smallest coherent change over duplicate CSS, duplicate state, duplicate assets, or page-specific hacks.
8. Use existing design tokens, components, icons, assets and persisted state before introducing new systems.
9. Mobile is first-class. Verify narrow mobile layouts as well as wider screens.
10. Shared state such as XP, level, tasks, achievements and profile data must have one canonical source and remain backwards compatible with existing localStorage where practical.
11. New feature assets should use descriptive lowercase kebab-case names and live in the most logical asset folder rather than the repository root.
12. Finish with a concise summary of what each agent changed and any remaining uncertainty.

## Conflict resolution
When agents disagree:
1. Correctness and data integrity.
2. User-requested visual target and interaction.
3. Existing design-system consistency.
4. File/reference integrity and repository maintainability.
5. Gameplay clarity and reward feedback.
6. Minimal complexity.

The Review Agent has final responsibility for integration quality, but may not silently remove requested functionality to simplify a review. The Folder Manager Agent may reorganize files only when references can be updated safely and the intended ownership/location is clear.

## Current product character
DONE is a mobile-first gamified task app. New work should feel playful and rewarding without becoming visually noisy. Interactions should feel deliberate, fast and tactile.
