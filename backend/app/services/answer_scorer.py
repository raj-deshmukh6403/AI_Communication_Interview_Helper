"""
answer_scorer.py — Objective pre-scoring engine
================================================
Calculates measurable metrics from the answer transcript BEFORE
sending to the LLM. This anchors the LLM score so it cannot
randomly give 90 to a bad answer or 40 to a good one.

How it works:
  1. Calculate 6 objective metrics (0-100 each)
  2. Combine into a composite_pre_score (weighted average)
  3. Pass composite_pre_score to LLM prompt with instruction:
     "Your score must be within ±15 of this pre-score: {composite_pre_score}"

Metrics calculated:
  - word_count_score     : answer length (too short = penalty)
  - filler_word_score    : fewer fillers = higher score
  - star_keyword_score   : STAR structure detection
  - specificity_score    : numbers, dates, names present = concrete answer
  - relevance_score      : keyword overlap between question and answer
  - sentence_clarity_score: avg sentence length (too long = rambling)

Used by:
  - llm_service.py       : receives pre_score to anchor LLM evaluation
  - websocket.py         : calls this before LLM evaluation
  - models/session.py    : PreScore saved per InterviewResponse
"""

import re
from typing import Dict, Any, List


# ─────────────────────────── STAR keywords ───────────────────────────────────
# Grouped by STAR component — detecting these shows structured thinking

STAR_KEYWORDS = {
    "situation": [
        "situation", "context", "background", "at the time", "when i was",
        "i was working", "we were", "the project", "the team", "the company",
        "in my previous", "at my last", "during my", "while i was",
    ],
    "task": [
        "task", "responsibility", "my role", "i was responsible", "i needed to",
        "i had to", "my goal", "the objective", "i was asked", "i was assigned",
        "challenge", "problem to solve", "requirement",
    ],
    "action": [
        "i did", "i decided", "i took", "i implemented", "i developed",
        "i created", "i led", "i managed", "i worked with", "i collaborated",
        "i reached out", "i built", "i designed", "i analysed", "i analyzed",
        "my approach", "i first", "i then", "i started", "i resolved",
        "i communicated", "i presented", "i proposed", "specifically i",
    ],
    "result": [
        "result", "outcome", "impact", "achieved", "increased", "decreased",
        "reduced", "improved", "saved", "delivered", "completed", "successfully",
        "as a result", "which led to", "this resulted in", "we saw",
        "the team", "the project", "percent", "%", "by the end",
        "feedback was", "it was successful",
    ],
}

# ─────────────────────────── Specificity patterns ────────────────────────────
# Numbers, percentages, dates, proper nouns — signal concrete answers

SPECIFICITY_PATTERNS = [
    r"\b\d+\s*%",                      # percentages: 30%, 50 %
    r"\b\d{4}\b",                      # years: 2022, 2023
    r"\b\d+\s*(weeks?|months?|days?|hours?|years?)\b",  # time spans
    r"\b\d+\s*(users?|customers?|clients?|people|members?|engineers?)\b",
    r"\b\d+\s*(million|thousand|hundred|k)\b",
    r"\$\s*\d+",                        # dollar amounts
    r"\b[A-Z][a-z]+\s[A-Z][a-z]+\b",  # proper nouns (two capitalised words)
    r"\b(january|february|march|april|may|june|july|august|september"
    r"|october|november|december)\b",
    r"\bq[1-4]\b",                      # Q1, Q2 etc.
    r"\bv?\d+\.\d+\b",                 # version numbers: 2.0, v3.1
]


class AnswerScorer:
    """
    Calculates objective pre-scores for interview answers.
    All scores are 0-100.
    """

    # Ideal answer length range (words)
    MIN_WORDS_GOOD   = 80    # below this starts penalising
    MIN_WORDS_OK     = 40    # below this heavy penalty
    MAX_WORDS_GOOD   = 300   # above this starts penalising (rambling)
    MAX_WORDS_LIMIT  = 450   # above this heavy penalty

    # Ideal sentence length (words per sentence)
    IDEAL_SENT_MIN   = 10
    IDEAL_SENT_MAX   = 25

    def score_answer(
        self,
        question:   str,
        answer:     str,
        filler_count: int = 0,
        word_count:   int = 0,
    ) -> Dict[str, Any]:
        """
        Calculate all pre-scores for one answer.

        Args:
            question    : the interview question that was asked
            answer      : the transcript of the user's answer
            filler_count: total filler words (from AudioAnalyzer)
            word_count  : total words (from AudioAnalyzer, 0 = recount from text)

        Returns:
            Dict matching PreScore model in models/session.py:
              word_count_score, filler_word_score, star_keyword_score,
              specificity_score, relevance_score, sentence_clarity_score,
              composite_pre_score
            Plus extra detail fields for feedback_generator:
              star_components_found, specificity_matches,
              question_keywords_matched, word_count_used
        """
        if not answer or not answer.strip():
            return self._empty_score()

        answer_clean = answer.strip()
        answer_lower = answer_clean.lower()

        # Use word count from AudioAnalyzer if provided, else count from text
        if word_count == 0:
            word_count = len(re.findall(r"\b\w+\b", answer_lower))

        # ── 1. Word count score ───────────────────────────────────────────────
        wc_score = self._score_word_count(word_count)

        # ── 2. Filler word score ──────────────────────────────────────────────
        filler_score = self._score_filler_words(filler_count, word_count)

        # ── 3. STAR keyword score ─────────────────────────────────────────────
        star_score, star_components = self._score_star_keywords(answer_lower)

        # ── 4. Specificity score ──────────────────────────────────────────────
        specificity_score, specificity_matches = self._score_specificity(answer_clean)

        # ── 5. Relevance score ────────────────────────────────────────────────
        relevance_score, keywords_matched = self._score_relevance(
            question.lower(), answer_lower)

        # ── 6. Sentence clarity score ─────────────────────────────────────────
        clarity_score = self._score_sentence_clarity(answer_clean)

        # ── Composite (weighted) ──────────────────────────────────────────────
        # Weights reflect what matters most in a behavioral interview
        composite = (
            wc_score          * 0.15 +   # length matters but not most
            filler_score      * 0.15 +   # fluency
            star_score        * 0.25 +   # structure — most important
            specificity_score * 0.20 +   # concrete examples
            relevance_score   * 0.20 +   # answered the question
            clarity_score     * 0.05     # sentence clarity
        )

        return {
            # Fields matching PreScore model
            "word_count_score":       round(wc_score, 1),
            "filler_word_score":      round(filler_score, 1),
            "star_keyword_score":     round(star_score, 1),
            "specificity_score":      round(specificity_score, 1),
            "relevance_score":        round(relevance_score, 1),
            "sentence_clarity_score": round(clarity_score, 1),
            "composite_pre_score":    round(composite, 1),

            # Extra detail for LLM prompt and feedback_generator
            "word_count_used":           word_count,
            "star_components_found":     star_components,    # e.g. ["situation","action","result"]
            "specificity_matches":       specificity_matches, # count of concrete details
            "question_keywords_matched": keywords_matched,    # count of question words in answer
        }

    # ─────────────────────────── Scoring functions ───────────────────────────

    def _score_word_count(self, wc: int) -> float:
        """
        Score answer length.
        80-300 words = ideal (100)
        40-79  words = ok   (60-99)
        <40    words = poor (0-59)   — too short, likely incomplete
        >300   words = ok   (70-99)  — slight rambling penalty
        >450   words = poor (40-69)  — excessive rambling
        """
        if self.MIN_WORDS_GOOD <= wc <= self.MAX_WORDS_GOOD:
            return 100.0
        elif self.MIN_WORDS_OK <= wc < self.MIN_WORDS_GOOD:
            # Linear scale 60-99 from 40 to 80 words
            return 60.0 + (wc - self.MIN_WORDS_OK) / \
                   (self.MIN_WORDS_GOOD - self.MIN_WORDS_OK) * 39.0
        elif wc < self.MIN_WORDS_OK:
            # Very short — 0 to 59
            return max(0.0, (wc / self.MIN_WORDS_OK) * 59.0)
        elif self.MAX_WORDS_GOOD < wc <= self.MAX_WORDS_LIMIT:
            # Slight rambling penalty: 70-99
            return 70.0 + (self.MAX_WORDS_LIMIT - wc) / \
                   (self.MAX_WORDS_LIMIT - self.MAX_WORDS_GOOD) * 29.0
        else:
            # Excessive — heavy penalty
            return max(40.0, 70.0 - (wc - self.MAX_WORDS_LIMIT) * 0.1)

    def _score_filler_words(self, filler_count: int, word_count: int) -> float:
        """
        Score based on filler word rate (fillers per 100 words).
        0   fillers per 100 = 100
        1-2 per 100        = 85-99
        3-5 per 100        = 60-84
        5+  per 100        = 0-59
        """
        if word_count == 0:
            return 100.0
        rate = (filler_count / word_count) * 100
        if rate == 0:
            return 100.0
        elif rate <= 2:
            return 85.0 + (2 - rate) / 2 * 14.0
        elif rate <= 5:
            return 60.0 + (5 - rate) / 3 * 24.0
        else:
            return max(0.0, 60.0 - (rate - 5) * 5)

    def _score_star_keywords(self, answer_lower: str):
        """
        Detect which STAR components are present.
        4 components = 100, 3 = 75, 2 = 50, 1 = 25, 0 = 0
        Returns (score, list_of_found_components)
        """
        found = []
        for component, keywords in STAR_KEYWORDS.items():
            if any(kw in answer_lower for kw in keywords):
                found.append(component)

        score = (len(found) / 4) * 100
        return round(score, 1), found

    def _score_specificity(self, answer: str):
        """
        Count concrete details (numbers, dates, names, metrics).
        0 matches = 0, 1 = 40, 2 = 65, 3 = 80, 4+ = 100
        Returns (score, match_count)
        """
        answer_lower = answer.lower()
        match_count  = 0
        for pattern in SPECIFICITY_PATTERNS:
            matches = re.findall(pattern, answer_lower, re.IGNORECASE)
            match_count += len(matches)

        if match_count == 0:   return 0.0,  0
        elif match_count == 1: return 40.0, match_count
        elif match_count == 2: return 65.0, match_count
        elif match_count == 3: return 80.0, match_count
        else:                  return 100.0, match_count

    def _score_relevance(self, question_lower: str, answer_lower: str):
        """
        Keyword overlap between question and answer.
        Strips stopwords, checks how many question keywords appear in answer.
        Returns (score, matched_keyword_count)
        """
        stopwords = {
            "a","an","the","and","or","but","in","on","at","to","for",
            "of","with","by","from","is","was","are","were","be","been",
            "have","has","had","do","does","did","will","would","could",
            "should","may","might","can","your","you","me","my","we",
            "our","us","i","it","its","this","that","these","those",
            "what","how","why","when","where","who","which","tell","describe",
            "give","example","time","situation","please",
        }

        q_words = set(re.findall(r"\b\w+\b", question_lower)) - stopwords
        a_words = set(re.findall(r"\b\w+\b", answer_lower))

        if not q_words:
            return 50.0, 0   # can't score relevance without question keywords

        matched = q_words & a_words
        ratio   = len(matched) / len(q_words)

        # Scale: 0% overlap = 0, 30% = 50, 60%+ = 100
        if ratio >= 0.6:
            score = 100.0
        elif ratio >= 0.3:
            score = 50.0 + (ratio - 0.3) / 0.3 * 50.0
        else:
            score = ratio / 0.3 * 50.0

        return round(score, 1), len(matched)

    def _score_sentence_clarity(self, answer: str) -> float:
        """
        Average sentence length score.
        10-25 words/sentence = ideal (100)
        Too short (<10) or too long (>25) = penalty
        """
        sentences = re.split(r"[.!?]+", answer)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 0]

        if not sentences:
            return 50.0

        lengths = [len(re.findall(r"\b\w+\b", s)) for s in sentences]
        avg_len = sum(lengths) / len(lengths)

        if self.IDEAL_SENT_MIN <= avg_len <= self.IDEAL_SENT_MAX:
            return 100.0
        elif avg_len < self.IDEAL_SENT_MIN:
            return max(40.0, (avg_len / self.IDEAL_SENT_MIN) * 100)
        else:
            penalty = (avg_len - self.IDEAL_SENT_MAX) * 2
            return max(40.0, 100.0 - penalty)

    def _empty_score(self) -> Dict[str, Any]:
        return {
            "word_count_score":          0.0,
            "filler_word_score":         0.0,
            "star_keyword_score":        0.0,
            "specificity_score":         0.0,
            "relevance_score":           0.0,
            "sentence_clarity_score":    0.0,
            "composite_pre_score":       0.0,
            "word_count_used":           0,
            "star_components_found":     [],
            "specificity_matches":       0,
            "question_keywords_matched": 0,
        }


# ─────────────────────────── LLM prompt helper ───────────────────────────────

def build_scoring_context(pre_score: Dict[str, Any]) -> str:
    """
    Build the pre-score context string to inject into the LLM prompt.
    This is what anchors the LLM so it can't randomly be too generous/strict.

    Usage in llm_service.py:
        context = build_scoring_context(pre_score)
        prompt = f"...evaluate this answer...\\n\\n{context}"
    """
    star_found  = pre_score.get("star_components_found", [])
    star_missing = [c for c in ["situation","task","action","result"]
                    if c not in star_found]

    lines = [
        "=== OBJECTIVE PRE-ASSESSMENT (calculated before your evaluation) ===",
        f"Composite pre-score     : {pre_score['composite_pre_score']}/100",
        f"  Answer length         : {pre_score['word_count_used']} words "
        f"(score: {pre_score['word_count_score']}/100)",
        f"  Filler word score     : {pre_score['filler_word_score']}/100",
        f"  STAR structure score  : {pre_score['star_keyword_score']}/100",
        f"    Components found    : {', '.join(star_found) if star_found else 'none'}",
        f"    Components missing  : {', '.join(star_missing) if star_missing else 'none'}",
        f"  Specificity score     : {pre_score['specificity_score']}/100 "
        f"({pre_score['specificity_matches']} concrete details found)",
        f"  Question relevance    : {pre_score['relevance_score']}/100 "
        f"({pre_score['question_keywords_matched']} question keywords matched)",
        f"  Sentence clarity      : {pre_score['sentence_clarity_score']}/100",
        "",
        f"INSTRUCTION: Your final score MUST be within ±15 of the composite "
        f"pre-score ({pre_score['composite_pre_score']}). "
        f"Valid range: "
        f"{max(0, pre_score['composite_pre_score'] - 15):.0f} – "
        f"{min(100, pre_score['composite_pre_score'] + 15):.0f}.",
        "You may adjust within this range based on content quality, depth, "
        "and communication effectiveness.",
        "=================================================================",
    ]
    return "\n".join(lines)
# ```

# ---

# ## How it fits into the flow
# ```
# User submits answer
#         ↓
# AudioAnalyzer.get_answer_snapshot()
#   → gives us: transcript, word_count, filler_count
#         ↓
# AnswerScorer.score_answer(question, transcript, filler_count, word_count)
#   → gives us: composite_pre_score + all 6 sub-scores
#         ↓
# build_scoring_context(pre_score)
#   → gives us: context string to inject into LLM prompt
#         ↓
# LLMService.evaluate_answer(question, answer, context)
#   → LLM score is now anchored: cannot deviate more than ±15
#         ↓
# Save PreScore + llm_score to InterviewResponse in MongoDB
# ```

# ---

# ## Example output

# For a good answer that uses STAR with specific numbers:
# ```
# composite_pre_score: 81.0
#   word_count_score:       95.0   (answer was 180 words)
#   filler_word_score:      92.0   (2 fillers in 180 words)
#   star_keyword_score:     100.0  (all 4 components found)
#   specificity_score:      80.0   (3 concrete details)
#   relevance_score:        85.0   (8/10 question keywords matched)
#   sentence_clarity_score: 90.0