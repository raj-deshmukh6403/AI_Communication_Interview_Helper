"""
llm_service.py
==============
LLM service using Groq API (free tier, llama-3.1-8b-instant).

Key changes from original:
  - evaluate_answer_quality() now accepts pre_score from answer_scorer.py
    and injects it into the prompt to anchor the LLM score within ±15
  - decide_next_action() added — uses concrete rules to decide:
      next_question / follow_up / end_session
  - All existing methods kept with same signatures for compatibility
  - All fallbacks kept intact
"""

from groq import Groq
from ..config import settings
import json
from typing import List, Dict, Optional, Any

from .answer_scorer import build_scoring_context


class LLMService:
    """
    Service for interacting with Groq LLM API.
    Uses llama-3.1-8b-instant (free tier).
    """

    def __init__(self):
        try:
            self.client = Groq(api_key=settings.GROQ_API_KEY) \
                          if settings.GROQ_API_KEY else None
        except Exception as e:
            print(f"[LLMService] Groq init error: {e}")
            self.client = None

        self.model = "llama-3.1-8b-instant"

    # ─────────────────────────── Question generation ─────────────────────────

    async def generate_interview_questions(
        self,
        job_description: str,
        resume_text:     Optional[str] = None,
        position:        str = None,
        num_questions:   int = 5,
    ) -> List[Dict[str, str]]:
        """
        Generate interview questions from job description + resume.
        Unchanged from original except resume truncation increased to 2000 chars.
        """
        resume_section = (
            f"Candidate Resume (key highlights):\n{resume_text[:2000]}\n"
            if resume_text else ""
        )

        prompt = f"""You are an expert HR interviewer at a top-tier global tech company (e.g., Google, Amazon, Microsoft).

Your role is to conduct a highly professional, structured, and insightful HR interview.
   

Position: {position}
Job Description: {job_description[:600]}

{resume_section}

Generate exactly {num_questions} interview questions:



DISTRIBUTION:
- 40% Behavioral (STAR method expected)
- 30% Technical / Role-specific
- 30% Communication / Cultural fit

RULES:
- Questions must be specific to the role and job description
- If resume is provided, reference candidate's actual experience
- Avoid generic questions like "tell me about yourself"
- Each question tests a specific competency

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {{
    "question": "specific role-relevant question here",
    "type": "behavioral|technical|communication",
    "follow_up": "natural follow-up an interviewer would ask",
    "difficulty": "easy|medium|hard",
    "competency": "what this tests e.g. problem-solving, leadership"
  }}
]"""

        if not self.client:
            return self._get_default_questions(position)

        try:
            response = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.7,
                max_tokens=2000,
            )
            content = response.choices[0].message.content.strip()
            content = self._extract_json(content)
            return json.loads(content)

        except Exception as e:
            print(f"[LLMService] Question generation error: {e}")
            return self._get_default_questions(position)

    # ─────────────────────────── Answer evaluation ───────────────────────────

    async def evaluate_answer_quality(
        self,
        question:      str,
        answer:        str,
        expected_type: str = "behavioral",
        pre_score:     Optional[Dict[str, Any]] = None,   # ← NEW parameter
    ) -> Dict[str, Any]:
        """
        Evaluate answer quality.

        Now accepts pre_score from AnswerScorer.
        When pre_score is provided, the LLM prompt includes hard constraints
        so the final score cannot deviate more than ±15 from the objective
        pre-score — preventing random generous/strict scoring.

        Args:
            question      : the interview question asked
            answer        : user's answer transcript
            expected_type : behavioral / technical / communication
            pre_score     : dict from AnswerScorer.score_answer() — optional
                            but strongly recommended

        Returns:
            Dict with scores and feedback, compatible with InterviewResponse
        """
        # Build pre-score context string if available
        pre_score_context = ""
        if pre_score and pre_score.get("composite_pre_score", 0) > 0:
            pre_score_context = "\n\n" + build_scoring_context(pre_score)

        # STAR section only for behavioral questions
        star_section = ""
        star_json    = ""
        if expected_type == "behavioral":
            star_section = """
STAR METHOD CHECK:
- Situation : Did they describe the context clearly?
- Task       : Was their specific responsibility stated?
- Action     : Did they explain what THEY personally did?
- Result     : Was there a measurable or concrete outcome?"""
            star_json = (
                '  "star_components": {'
                '"has_situation": true, "has_task": true, '
                '"has_action": true, "has_result": true},\n'
            )

        prompt = f"""You are evaluating an interview response with 10+ years HR experience.

QUESTION TYPE : {expected_type}
QUESTION      : {question}

CANDIDATE ANSWER:
{answer}
{pre_score_context}

EVALUATION CRITERIA:
1. RELEVANCE (0-100)    : Does it directly answer the question?
2. CLARITY (0-100)      : Is it well-structured and easy to understand?
3. COMPLETENESS (0-100) : Sufficient detail and examples?
4. SPECIFICITY (0-100)  : Concrete examples vs vague statements?
{star_section}

Grade like a tough but fair interviewer. Be honest and constructive.

Return ONLY this JSON (no markdown):
{{
  "relevance_score": 75,
  "clarity_score": 75,
  "completeness_score": 75,
  "specificity_score": 75,
{star_json}  "overall_score": 75,
  "strengths": ["specific strength 1", "strength 2"],
  "improvements": ["specific improvement 1", "improvement 2"],
  "feedback": "2-3 sentences of constructive feedback",
  "needs_follow_up": false
}}"""

        if not self.client:
            return self._fallback_evaluation(pre_score)

        try:
            response = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.3,
                max_tokens=600,
            )
            content = response.choices[0].message.content.strip()
            content = self._extract_json(content)
            result  = json.loads(content)

            # Clamp overall_score to pre_score ±15 if pre_score was provided
            if pre_score and pre_score.get("composite_pre_score", 0) > 0:
                anchor     = pre_score["composite_pre_score"]
                low, high  = max(0, anchor - 15), min(100, anchor + 15)
                raw_score  = result.get("overall_score", anchor)
                result["overall_score"] = round(
                    max(low, min(high, raw_score)), 1)
                result["pre_score_anchor"] = anchor   # saved for transparency

            return result

        except Exception as e:
            print(f"[LLMService] Evaluation error: {e}")
            return self._fallback_evaluation(pre_score)

    # ─────────────────────────── Follow-up generation ────────────────────────

    async def generate_follow_up_question(
        self,
        previous_question: str,
        user_answer:       str,
        context:           str = "",
    ) -> str:
        """
        Generate one targeted follow-up question based on the answer.
        Unchanged from original.
        """
        prompt = f"""You are conducting an interview. Based on the candidate's answer,
generate ONE follow-up question that digs deeper.

Previous Question : {previous_question}
Candidate Answer  : {user_answer}
{f"Context: {context}" if context else ""}

The follow-up should:
- Ask for more specific details or a concrete example
- Explore a point they mentioned but didn't elaborate on
- Be under 30 words

Return ONLY the question text, nothing else."""

        if not self.client:
            return "Can you give me a specific example of that?"

        try:
            response = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.8,
                max_tokens=100,
            )
            return response.choices[0].message.content.strip()

        except Exception as e:
            print(f"[LLMService] Follow-up error: {e}")
            return "Can you provide a more specific example?"

    # ─────────────────────────── Decision logic ──────────────────────────────

    async def decide_next_action(
        self,
        evaluation:       Dict[str, Any],
        pre_score:        Dict[str, Any],
        question_number:  int,
        total_questions:  int,
        follow_ups_given: int = 0,
    ) -> Dict[str, Any]:
        """
        Decide what to do after receiving and scoring an answer.

        Uses CONCRETE RULES first (not just LLM guessing), then optionally
        confirms with LLM for borderline cases.

        Rules (in priority order):
          1. If question_number >= total_questions AND follow_ups_given >= 1
             → end_session
          2. If follow_ups_given >= 2 for this question
             → next_question  (don't keep hammering the same question)
          3. If composite_pre_score < 35 AND star_components < 2
             AND follow_ups_given == 0
             → follow_up  (answer was too weak/incomplete)
          4. If needs_follow_up == True from LLM AND follow_ups_given == 0
             → follow_up
          5. Otherwise
             → next_question

        Args:
            evaluation      : result from evaluate_answer_quality()
            pre_score       : result from AnswerScorer.score_answer()
            question_number : current question index (1-based)
            total_questions : total questions in session
            follow_ups_given: how many follow-ups already given for this Q

        Returns:
            Dict with keys:
              action       : "next_question" | "follow_up" | "end_session"
              reason       : human-readable reason (for debugging)
              confidence   : "rule_based" | "llm_assisted"
        """
        composite    = pre_score.get("composite_pre_score", 50)
        star_found   = len(pre_score.get("star_components_found", []))
        needs_followup_llm = evaluation.get("needs_follow_up", False)

        # Rule 1 — session end
        if question_number >= total_questions and follow_ups_given >= 1:
            return {
                "action":     "end_session",
                "reason":     "All questions answered",
                "confidence": "rule_based",
            }

        # Rule 2 — too many follow-ups on same question
        if follow_ups_given >= 2:
            return {
                "action":     "next_question",
                "reason":     "Max follow-ups reached for this question",
                "confidence": "rule_based",
            }

        # Rule 3 — answer objectively too weak (pre-score based)
        if composite < 35 and star_found < 2 and follow_ups_given == 0:
            return {
                "action":     "follow_up",
                "reason":     f"Pre-score {composite:.0f} too low, "
                              f"only {star_found}/4 STAR components found",
                "confidence": "rule_based",
            }

        # Rule 4 — LLM flagged follow-up AND we haven't given one yet
        if needs_followup_llm and follow_ups_given == 0:
            return {
                "action":     "follow_up",
                "reason":     "LLM flagged answer needs elaboration",
                "confidence": "llm_assisted",
            }

        # Rule 5 — default: move on
        return {
            "action":     "next_question",
            "reason":     f"Answer adequate (pre-score: {composite:.0f})",
            "confidence": "rule_based",
        }

    # ─────────────────────────── Private helpers ─────────────────────────────

    def _extract_json(self, content: str) -> str:
        """Strip markdown code fences if present."""
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return content.strip()

    def _fallback_evaluation(
        self, pre_score: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Fallback when LLM is unavailable. Uses pre_score if available."""
        base = pre_score.get("composite_pre_score", 70) if pre_score else 70
        return {
            "relevance_score":    base,
            "clarity_score":      base,
            "completeness_score": base,
            "specificity_score":  base,
            "overall_score":      base,
            "strengths":          ["Answer provided"],
            "improvements":       ["Could not auto-analyse — LLM unavailable"],
            "feedback":           "Automatic evaluation unavailable. "
                                  "Score estimated from objective metrics.",
            "needs_follow_up":    False,
            "pre_score_anchor":   base,
        }

    def _get_default_questions(self, position: str) -> List[Dict[str, str]]:
        """Fallback questions when LLM unavailable."""
        return [
            {
                "question":   "Tell me about a challenging project you worked on "
                              "and how you overcame the obstacles.",
                "type":       "behavioral",
                "follow_up":  "What would you do differently if you could do it again?",
                "difficulty": "medium",
                "competency": "problem-solving",
            },
            {
                "question":   f"Why are you interested in this {position} role?",
                "type":       "communication",
                "follow_up":  "What specifically about this role excites you?",
                "difficulty": "easy",
                "competency": "motivation",
            },
            {
                "question":   "Describe a time you had to work under pressure. "
                              "How did you manage it?",
                "type":       "behavioral",
                "follow_up":  "What coping strategies did you use?",
                "difficulty": "medium",
                "competency": "stress management",
            },
            {
                "question":   "Tell me about a time you led a team or initiative.",
                "type":       "behavioral",
                "follow_up":  "What was the most difficult part of leading that effort?",
                "difficulty": "medium",
                "competency": "leadership",
            },
            {
                "question":   "Where do you see yourself in 5 years?",
                "type":       "communication",
                "follow_up":  "How does this position fit into that plan?",
                "difficulty": "easy",
                "competency": "ambition",
            },
        ]