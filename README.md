# BioMind: A Multi-Agent Framework for Evidence-Traceable Drug Repurposing Hypothesis Generation

**A Hackathon Prototype — Technical Report**

---

<p align="center">
  <img src="assets/v2_awv-a44c972a3823a57d (online-video-cutter.com).gif" width="700"/>
</p>

## Abstract

Drug repurposing is bottlenecked by evidence fragmentation, not by a shortage of biological insight. Disease-pathway literature, drug-target databases, and post-market safety records live in separate systems, and no single researcher cross-references all three before forming a hypothesis. **BioMind** solves this with a six-agent pipeline that automates evidence triage: it extracts disease-relevant pathways from literature via RAG-grounded retrieval, maps them to approved drugs via molecular targets, screens candidates against known safety data (FAERS + live ClinicalTrials.gov), applies a peer-review layer, and produces a ranked, citation-linked hypothesis report — end to end, in minutes, with every claim traceable to its source.

BioMind''s scope is deliberate and stated up front: it generates ranked, evidence-backed hypotheses for a human researcher to validate. It does not run wet-lab or in-silico validation, and it does not assign candidates a probability of clinical success. That distinction is the system''s core design principle, not a limitation to apologize for: every score BioMind produces is a transparent, inspectable rule, and every claim resolves to a specific paper or database record.

---

## 1. Problem Statement

### 1.1 The literature triage bottleneck

<p align="center">
  <img src="assets/Gemini_Generated_Image_d9zepkd9zepkd9ze.png" width="90%" />
</p>

Investigating whether an existing drug might treat a given disease requires four disconnected steps, performed manually, every time:

1. **Pathway discovery** — search the literature for pathways and proteins implicated in the disease.
2. **Target mapping** — cross-reference those proteins against drug-target databases (ChEMBL, DrugBank) for approved compounds that act on them.
3. **Safety screening** — check post-market safety data (FDA FAERS + ClinicalTrials.gov) for contraindications or trial-termination signals on each candidate.
4. **Synthesis** — combine all of the above into a ranked, defensible hypothesis.

Each step is well-served individually by existing tools. None of them chains into the next. BioMind closes that gap.

<p align="center">
  <img src="assets/Gemini_Generated_Image_ojp7dwojp7dwojp7.png" width="90%" />
</p>

### 1.2 Scope, stated precisely

BioMind reduces literature triage time. It does not discover new biology, does not validate a hypothesis, and does not replace a pharmacologist''s judgment. Its confidence output is a transparent, rule-based evidence score (0-100 integer) mapped to a confidence tier (High / Moderate / Low), not a validated predictive score — and it is built that way on purpose.

---

## 2. Related Work

Computational drug repurposing splits into three established families: network/graph-based methods that mine drug-disease-target graphs for indirect connections, machine-learning methods that predict association scores from learned embeddings, and literature-mining methods that extract entity relationships from biomedical text. BioMind sits in the third family and extends it: most literature-mining tools stop at entity/relation extraction and leave synthesis to the user. BioMind adds live safety screening (ClinicalTrials.gov trial-termination signals), a peer-review cross-check layer, and a human-readable, source-traceable reasoning chain as first-class pipeline outputs.

---

## 3. Solution: System Architecture

BioMind runs **six agents**, each with one narrow, auditable responsibility.

```
  Disease Name
       |
       v
  +---------+   pathways/proteins    +---------+    candidate drugs     +---------+
  |  LEXIS  | ---------------------->|  HELIX  | ---------------------->| SHIELD  |
  | (Lit.   |   + citations (RAG)    | (Target |   + mechanism          | (Safety |
  | Scout)  |                        |  Match) |   ChEMBL / CT.gov      | Screen) |
  +---------+                        +---------+                        +---------+
                                                                               |
                                                           flagged/cleared candidates + CT.gov signals
                                                                               v
                                                                         +---------+
                                                                         | ORACLE  |
                                                                         |(Scoring)|
                                                                         +---------+
                                                                               |
                                                              ranked candidates (score 0-100)
                                                                       +-------+-------+
                                                                       v               v
                                                                 +----------+   +--------------+
                                                                 |  SYNAPSE |   | PEER_REVIEW  |
                                                                 |(Synthesis|   |(Cross-check) |
                                                                 +----------+   +--------------+
                                                                       |               |
                                                                       +------+--------+
                                                                              v
                                                              Ranked, cited, plain-English
                                                                   hypothesis report
                                                              + per-agent peer review ratings
```

| Agent | Responsibility | Input | Output |
|---|---|---|---|
| **LEXIS** | Extracts disease-relevant pathways/proteins from RAG-retrieved literature | Disease name, FAISS vectorstore or live PubMed | Pathway/protein list with constrained citations |
| **HELIX** | Maps proteins to approved drugs via ChEMBL; falls back to live ClinicalTrials.gov discovery for uncurated diseases | Protein list | Drug candidates with protein target and NCT provenance |
| **SHIELD** | Screens candidates against FAERS + live ClinicalTrials.gov trial-termination signals | Drug candidates | Candidates with `black_box_warning`, `failed_trial`, and `clinical_trials` safety fields |
| **ORACLE** | Computes a transparent integer evidence score (0-100) per candidate; applies penalty for trial-termination signals | Annotated candidates | Ranked candidates with score |
| **PEER_REVIEW** | Each downstream agent (HELIX, SHIELD, ORACLE, SYNAPSE) rates the LEXIS output 1-10 and provides structured feedback | LEXIS output | Per-agent ratings + feedback JSON |
| **SYNAPSE** | Assembles the final human-readable, source-linked report; graceful LLM-failure fallback to dynamic template | All of the above | Final hypothesis report |

---

## 4. Methodology: Algorithms

### 4.1 Algorithm 1 — LEXIS: Pathway/Protein Extraction

<p align="center">
  <img src="assets/Gemini_Generated_Image_r8y9lpr8y9lpr8y9.png" width="90%" />
</p>

LEXIS performs constrained extraction, not open generation. It retrieves context through a **RAG layer** (FAISS vectorstore per curated disease, or live PubMed fallback for uncurated diseases) and is prohibited from asserting any pathway or protein not directly supported by retrieved text. JSON repair (`json_repair`) guards against malformed LLM output, and a curated disease-specific default table ensures the pipeline never crashes even when the LLM returns unparseable text.

```
Algorithm 1: LEXIS_EXTRACT
Input:  disease D
Output: pathway list P = {pathways, proteins, reasoning}

1:  context <- RAG_RETRIEVE(D)            // FAISS vectorstore or PubMed fallback
2:  prompt  <- BUILD_CONSTRAINED_PROMPT(D, context)
3:  raw     <- LLM_CALL(prompt)           // structured JSON only
4:  raw     <- EXTRACT_JSON_OBJECT(raw)   // strip any chain-of-thought prose
5:  repaired <- JSON_REPAIR(raw)
6:  result  <- JSON_PARSE(repaired)
7:  if result is valid and contains {pathways, proteins}:
8:      return {lexis: result}
9:  // Fallback: disease-specific curated defaults (ALS, COVID-19, Parkinsons, Alzheimers ...)
10: return {lexis: DISEASE_DEFAULTS[D] or MINIMAL_DEFAULT}
```

The curated default table (step 10) ensures the pipeline produces real, biology-grounded output for well-studied diseases even when the LLM call fails or returns garbage — useful in demo or rate-limited environments.

### 4.2 Algorithm 2 — HELIX: Target-to-Drug Matching

HELIX''s primary matching step is a deterministic ChEMBL cache lookup with **multi-strategy fuzzy protein matching** (exact, substring, synonym/interactor, word-level). When no ChEMBL cache entry exists for a disease (anything outside the ~46 curated entries), HELIX automatically queries the **live ClinicalTrials.gov v2 API** to discover drugs currently being investigated for that exact condition — so the pipeline returns real candidates for *any* disease, not just pre-curated ones.

```
Algorithm 2: HELIX_MATCH
Input:  protein list [p_1, ..., p_k], disease D
Output: candidate list C = [(drug, protein, source, nct_ids?, phase?)]

1:  mappings <- CHEMBL_CACHE_LOOKUP(D)
2:  C <- [m for m in mappings if FUZZY_PROTEIN_MATCH(m.protein, [p_1,..,p_k])]
3:  if C = empty:
4:      C <- ALL_CHEMBL_MAPPINGS(D)          // protein-match fallback
5:  if C = empty:                            // no curated ChEMBL data at all
6:      C <- CLINICALTRIALS_DISCOVER(D, [p_1,..,p_k])
7:      source <- "clinicaltrials_live"
8:  return C
```

Fuzzy matching (step 2) supports five strategies in priority order: exact case-insensitive, cache-protein-as-substring, LLM-protein-as-substring, SYNONYMS table (e.g. `ace2` -> `sars-cov-2 receptor`), and word-level overlap for names >= 4 characters.

### 4.3 Algorithm 3 — SHIELD: Safety Screening

SHIELD combines two independent safety signals for every candidate: the curated FAERS cache *and* a **live ClinicalTrials.gov lookup** — so trial-termination evidence surfaces even for drugs that have no FAERS entry.

```
Algorithm 3: SHIELD_SCREEN
Input:  candidate list C, FAERS cache S, ClinicalTrials.gov API
Output: annotated candidate list C' with safety fields

1:  for each candidate c in C:
2:      faers_record <- FAERS_LOOKUP(S, c.drug)        // black_box_warning, failed_trial
3:      trials       <- CLINICALTRIALS_GET(c.drug, disease)
4:      ct_signal    <- SUMMARIZE_SAFETY_SIGNAL(trials) // concerning_trial_count + NCT IDs
5:      c.safety <- {**faers_record, "clinical_trials": ct_signal}
6:  return C'
```

`SUMMARIZE_SAFETY_SIGNAL` counts trials with status in {TERMINATED, WITHDRAWN, SUSPENDED} and returns the specific NCT IDs and `why_stopped` text, keeping the signal inspectable.

### 4.4 Algorithm 4 — ORACLE: Evidence Scoring

ORACLE computes an **integer score (0-100)** using three transparent deductions from a base of 80. Every point removed has a named reason, and the full breakdown is visible to the user.

```
Score(c):
  base = 80
  if c.safety.failed_trial:                    base -= 30
  if c.safety.black_box_warning:               base -= 20
  if ct_signal.concerning_trial_count > 0:     base -= 15
  score = clamp(base, 0, 100)
```

**Tier mapping (frontend display):**

```
Algorithm 4: ORACLE_SCORE_AND_TIER
1:  for each candidate c in C':
2:      c.score <- clamp(80 - penalties(c), 0, 100)
3:  return SORT_DESCENDING(C', key=c.score)

Frontend tier:
  score/100 >= 0.7  ->  "High Confidence"      (green)
  score/100 >= 0.4  ->  "Moderate Confidence"  (amber)
  else              ->  "Low Confidence"        (indigo)
```

### 4.5 Algorithm 5 — PEER_REVIEW: Cross-Agent Quality Check

PEER_REVIEW is a new agent added in the fixed final build. It runs after ORACLE and before SYNAPSE finishes. Each of the four downstream agents (HELIX, SHIELD, ORACLE, SYNAPSE) rates the LEXIS output on a 1-10 scale and returns structured JSON feedback.

```
Algorithm 5: PEER_REVIEW
Input:  LEXIS output
Output: peer_reviews = [{agent, rating, feedback}, ...]

1:  for each agent in [helix, shield, oracle, synapse]:
2:      prompt <- BUILD_REVIEW_PROMPT(agent, lexis_output)
3:      raw    <- LLM_CALL(prompt)
4:      review <- JSON_PARSE(JSON_REPAIR(raw))
5:      peer_reviews <- peer_reviews + {review}
6:  return {peer_reviews}
```

A score >= 9 signals that the LEXIS analysis is sufficiently complete and scientifically supported. Scores below 9 surface specific missing information or corrections for the researcher.

### 4.6 Algorithm 6 — SYNAPSE: Reasoning Chain Assembly

SYNAPSE assembles the final report via LLM call over the ORACLE-ranked candidate list. A dynamic template-based fallback ensures the pipeline always returns a structured report even when the LLM call fails.

```
Algorithm 6: SYNAPSE_ASSEMBLE
Input:  ranked candidate list (oracle output), disease D
Output: final report R

1:  try:
2:      R <- LLM_CALL(SYNAPSE_PROMPT + str(oracle_ranked))
3:  except LLMError:
4:      for each candidate c in oracle_ranked:
5:          R += TEMPLATE(drug=c.drug, protein=c.protein, score=c.score, disease=D)
6:  return {report: R}
```

---

## 5. Implementation

| Component | Choice | Rationale |
|---|---|---|
| LLM | OpenRouter API (configurable model, default `meta-llama/llama-3.3-70b-instruct`) | Flexible; swappable via `OPENROUTER_MODEL` env var without code changes |
| Embeddings | `BAAI/bge-small-en-v1.5` (HuggingFace, lazy-loaded) | Lightweight; avoids startup crash on Render; FAISS vectorstore per curated disease |
| Orchestration | LangGraph (linear DAG with PEER_REVIEW branch) | Simple, debuggable; ORACLE fans out to both SYNAPSE and PEER_REVIEW |
| Drug-target data | ChEMBL cache (JSON per disease) + live ClinicalTrials.gov v2 API | Cache for speed; live API for uncurated diseases |
| Safety data | FAERS cache (JSON) + live ClinicalTrials.gov v2 API | Both signals per candidate; CT.gov covers drugs with no FAERS entry |
| Preprint literature | bioRxiv/medRxiv API (live, cache-backed, 90-day window) | Supplements PubMed for cutting-edge biology |
| Backend | FastAPI + SQLAlchemy (SQLite) | Lightweight; multiple API endpoints for analysis and data inspection |
| Frontend | React 19 + Vite + D3 (evidence graph) + Lucide icons | Polished UI; evidence graph, result cards, literature feed, agent status |
| Deployment | Netlify (frontend) + Render (backend, `Procfile`/`render.yaml`) | CORS configured for both origins |

### 5.1 Project Structure

```
BioMind-fixed-final--main/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── lexis.py          # Pathway/protein extraction (RAG + LLM + fallback)
│   │   │   ├── helix.py          # Drug-target matching (ChEMBL + CT.gov live discovery)
│   │   │   ├── shield.py         # Safety screening (FAERS + CT.gov live trials)
│   │   │   ├── oracle.py         # Evidence scoring (0-100 integer, deduction model)
│   │   │   ├── peer_review.py    # NEW: cross-agent LEXIS quality check
│   │   │   ├── reviewer.py       # Single biomedical peer reviewer (structured JSON)
│   │   │   ├── synapse.py        # Report assembly (LLM + template fallback)
│   │   │   └── evidence.py       # Evidence aggregator (PubMed, ChEMBL, DrugBank, FAERS)
│   │   ├── api/
│   │   │   ├── routes.py         # /analyze, /trials, /discover, /cache, /history
│   │   │   └── schemas.py
│   │   ├── graph/
│   │   │   ├── workflow.py       # LangGraph DAG
│   │   │   └── state.py          # BioMindState TypedDict
│   │   ├── llm/
│   │   │   └── granite.py        # ChatOpenAI via OpenRouter (env-configurable)
│   │   ├── rag/
│   │   │   ├── retriever.py      # FAISS vectorstore + PubMed live fallback
│   │   │   └── build_index.py
│   │   ├── services/
│   │   │   ├── chembl.py
│   │   │   ├── clinicaltrials.py # NEW: full live CT.gov v2 API connector
│   │   │   ├── drugbank.py
│   │   │   ├── faers.py
│   │   │   ├── preprint.py       # NEW: bioRxiv/medRxiv live paper retrieval
│   │   │   ├── pubmed.py
│   │   │   └── cache.py
│   │   └── utils/
│   ├── requirements.txt
│   ├── .env.example
│   ├── Procfile
│   └── render.yaml
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── AgentCard.jsx
    │   │   ├── AnalysisSummary.jsx
    │   │   ├── EvidenceGraph.jsx  # D3-based disease->pathway->target->drug graph
    │   │   ├── LiteratureFeed.jsx
    │   │   └── ResultCard.jsx    # Shows score, tier, safety flags, NCT IDs, source
    │   └── data/
    ├── package.json              # React 19, Vite, D3, Lucide, canvas-confetti
    └── vercel.json
```

### 5.2 Configuration

Copy `.env.example` to `.env` in the `backend/` directory and fill in your OpenRouter credentials:

```env
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

The LLM model is fully swappable via `OPENROUTER_MODEL` — any model served by OpenRouter works without code changes.

### 5.3 Running Locally

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 5.4 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/analyze` | Run the full six-agent pipeline for a disease |
| `GET` | `/trials/{drug}?disease=X` | Live ClinicalTrials.gov lookup for a drug |
| `GET` | `/discover/{disease}` | Live CT.gov candidate discovery for uncurated diseases |
| `GET` | `/cache/{disease}` | Inspect curated cache (PubMed, ChEMBL, DrugBank, FAERS) |
| `GET` | `/history` | Retrieve past analysis reports (SQLite) |

### 5.5 Caching Strategy

All literature and drug-target data is cached to disk (JSON) on first retrieval. The ClinicalTrials.gov connector writes back each successful live response to `app/cache/clinicaltrials/`, so a repeat query or demo run does not need the network. Algorithms are agnostic to the data source — swapping cache for live API requires no algorithmic change, only a data-source switch.

---

## 6. Case Study: ALS / Metformin

One complete pipeline run using real pipeline output.

**Input:** disease = "Amyotrophic Lateral Sclerosis (ALS)"

**LEXIS** identifies TDP-43 proteinopathy as the primary pathway and AMPK/autophagy dysregulation as a secondary pathway via RAG-retrieved context from the ALS vectorstore. Fallback defaults for ALS (SOD1, TDP-43, FUS, UBQLN2) activate if the LLM response is malformed.

**HELIX** matches the AMPK pathway''s protein (PRKAA1) to Metformin via a deterministic ChEMBL cache lookup. The fuzzy matching layer also catches synonyms and word-level partial matches, reducing missed mappings.

**SHIELD** runs two independent safety checks: the FAERS cache (contraindicated in severe renal impairment) and a live ClinicalTrials.gov query for Metformin + ALS. Any terminated/withdrawn/suspended trials are surfaced with their NCT IDs and `why_stopped` text.

**ORACLE** computes a score from base 80, applying deductions for any safety signals found. With no black-box warning and no failed trial, the deduction comes only from any concerning CT.gov signals.

**PEER_REVIEW** queries HELIX, SHIELD, ORACLE, and SYNAPSE perspectives on the LEXIS output, returning structured 1-10 ratings and feedback for the researcher.

**SYNAPSE** produces a plain-English hypothesis report citing the protein target, mechanism, and evidence score.

---

## 7. Design Boundaries

BioMind is built around a small number of firm boundaries:

1. **No clinical or experimental validation is claimed.** The evidence score is a transparent, rule-based deduction from a base of 80, not a predictor of repurposing success.
2. **The demo covers curated diseases plus live fallback.** The ~46 curated diseases use pre-fetched, verified caches. Any other disease triggers live PubMed + ClinicalTrials.gov discovery automatically.
3. **The LLM is OpenRouter-routed**, not IBM WatsonX/Granite. The `OPENROUTER_MODEL` env var makes this fully swappable without code changes.
4. **The pipeline is a linear DAG with a peer-review branch.** ORACLE fans out to both SYNAPSE and PEER_REVIEW in parallel before SYNAPSE finishes. Debate-based adversarial cross-checking is partially realized in PEER_REVIEW.
5. **Scoring weights are hand-set for interpretability**, not fit to a labeled dataset — because no such dataset exists yet, and a hand-set, disclosed formula is more honest than a fit one presented without the data to justify it.

---

## 8. Future Work

- **LEXIS citation verification:** swap RAG-inferred references for live, verified PubMed identifiers using the PubMed E-utilities API.
- **Adversarial critic agent:** a dedicated agent that argues against each candidate before ORACLE scores it, surfacing counter-evidence alongside supporting evidence (PEER_REVIEW is the first step toward this).
- **Pathway-level target matching:** multi-protein pathway scoring beyond the current single-protein match.
- **Expert review loop:** pharmacologist/researcher review of a candidate set as a first step toward validating whether the evidence score correlates with expert-assessed plausibility.
- **Expanded ChEMBL cache:** grow the curated disease set beyond ~46 entries to reduce reliance on the live ClinicalTrials.gov discovery fallback for common diseases.

---

## 9. Ethical Considerations

BioMind is a research-triage tool. It is not, and does not present itself as, a clinical decision-support system, and no output should inform a treatment decision without expert review. The entire architecture is built around making that review possible: every claim resolves to a ChEMBL record, a FAERS entry, a ClinicalTrials.gov NCT record, or a PubMed abstract — never to an opaque model score.
