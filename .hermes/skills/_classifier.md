# Classifier -- plik routingu POZA manifestem

#

# Manifest definiuje CO (id, capabilities, cost). Ten plik mówi KIEDY.

# Rozdzielenie odpowiedzialności: zmiana routingu NIE rusza manifestu.

#

# Pipe (Context Planner):

#

# Task

# ↓

# Intent Classifier (intent → required_capabilities)

# ↓

# Capability Resolver (required_capabilities → list of skills)

# ↓

# Skill Resolver (skills → load list with prefs)

# ↓

# Dependency Resolver (+transitive deps)

# ↓

# Budget Optimizer (drop lowest utility/cost ratio jeśli >cap)

# ↓

# Hermes

# ════════════════════ INTENT → CAPABILITIES ════════════════════

intents:

- intent: "rozwiąż bug w excelu (paste, copy, render, sticky cols)"
  required_capabilities: [excel-paste, excel-copy, debug-table]
  preferred_skills: [excel-debug]
  fallback_skills: [systematic-debugging]
  min_utility: 60

- intent: "root cause debugging regression"
  required_capabilities: [debug, root-cause]
  preferred_skills: [systematic-debugging]
  fallback_skills: [multi-agent-coordination]

- intent: "code review przed commitem"
  required_capabilities: [code-review, security-scan]
  preferred_skills: [requesting-code-review]
  invoke_only: true

- intent: "audyt bazy / cleanup repo / dead code"
  required_capabilities: [audit, cleanup]
  preferred_skills: [codebase-audit]
  invoke_only: true

- intent: "duży feature >3 plików (multi-agent)"
  required_capabilities: [planning, coding, reviewing]
  preferred_skills: [multi-agent-coordination, plan]
  fallback_skills: [sp-a-conventions]

- intent: "plan mode / walidacja istniejącego planu"
  required_capabilities: [planning, plan-compliance]
  preferred_skills: [plan, plan-guardian]
  condition: ".hermes/plan-*.md exists"

# intent "python (well_configurator_backend/)" — usunięty (backend skasowany)

- intent: "node.js debug (--inspect)"
  required_capabilities: [node-debugger]
  preferred_skills: [node-inspect-debugger]

- intent: "napisz testy (TDD)"
  required_capabilities: [tdd, testing]
  preferred_skills: [test-driven-development]

- intent: "throwaway experiment"
  required_capabilities: [prototype, experiment]
  preferred_skills: [spike]

- intent: "cleanup po zakończonej sesji"
  required_capabilities: [cleanup, refactor]
  preferred_skills: [simplify-code]

- intent: "modyfikuj architekturę SPA (router, iframe, header)"
  required_capabilities: [spa-architecture, spa-app-wrapper]
  preferred_skills: [sp-a-conventions]
  fallback_skills: [conventions-lite]

- intent: "AI/telemetry/ML/dashboard"
  required_capabilities: [ai-telemetry, ml-api]
  preferred_skills: [oferty-pv-ai-telemetry]

# ════════════════════ CAPABILITY → SKILL MAP ════════════════════

# Inverse index zbudowany z manifestu capabilities:

# excel-paste → [excel-debug]

# spa-architecture → [sp-a-conventions]

# debug → [systematic-debugging, excel-debug, python-debugpy, node-inspect-debugger]

# Ten plik jest generowany przez `npm run skills:capabilities --force`.

# ════════════════════ BUDGET POLICY ════════════════════

budget:
enabled: true
cap_total_tokens: 100000 # = manifest.policies.cap_total_cost_tokens
strategy: drop_lowest_utility_cost_ratio
prefer_invoke_only_for_heavy: true

# ════════════════════ TRIGGER → INTENT ════════════════════

triggers:
phrases: - "knowledge graph": "knowledge graph / graph query" - "graph query": "knowledge graph / graph query" - "audyt": "audyt bazy / cleanup repo / dead code" - "audit": "audyt bazy / cleanup repo / dead code" - "code review": "code review przed commitem" - "review przed commitem": "code review przed commitem" - "recenzja kodu": "code review przed commitem" - "debug excelu": "rozwiąż bug w excelu" - "paste nie działa": "rozwiąż bug w excelu" - "wklejanie": "rozwiąż bug w excelu" - "_excelHandlePaste": "rozwiąż bug w excelu" - "_excelRenderTable": "rozwiąż bug w excelu" - "regre": "root cause debugging regression" - "AI dashboard": "AI/telemetry/ML/dashboard" - "ml-api": "AI/telemetry/ML/dashboard" - "telemetr": "AI/telemetry/ML/dashboard"
default_intent: "general_help" # load only core
