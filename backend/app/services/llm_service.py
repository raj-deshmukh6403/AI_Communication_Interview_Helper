from groq import Groq
from ..config import settings
import json
from typing import List, Dict, Optional

class LLMService:
    """
    Service for interacting with Groq's LLM API (free tier).
    Uses Llama models for generating questions and analyzing responses.
    """
    
    def __init__(self):
        try:
          self.client = Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None
        except Exception as e:
            print(f"Error initializing Groq client: {e}")
            self.client = None
        # Use available model - if 70b is unavailable, use 8b-instant
        self.model = "llama-3.1-8b-instant"  # Free and available model
    
    async def generate_interview_questions(
        self, 
        job_description: str, 
        resume_text: Optional[str] = None, 
        position: str = None,
        num_questions: int = 15
    ) -> List[Dict[str, str]]:
        """
        Generate relevant interview questions based on job description and resume.
        
        Args:
            job_description: The job posting description
            resume_text: Optional resume text for personalization
            position: Job position/title
            num_questions: Number of questions to generate
        
        Returns:
            List of question dictionaries with question, type, and follow-up
        """
        
        resume_section = f"Candidate's Resume:\n{resume_text[:1500]}\n" if resume_text else ""

        # IMPROVED PROMPT for generate_interview_questions:
        prompt = f"""You are an expert HR interviewer conducting interviews for top tech companies.

Position: {position}
Company Context: {job_description[:500]}

{resume_section}

Generate exactly {num_questions} interview questions following these guidelines:

QUESTION DISTRIBUTION:
- 40% Behavioral (STAR method)
- 40% Technical/Role-specific  
- 20% Communication/Cultural fit

REQUIREMENTS:
- Questions must be specific to the role and job description
- Avoid generic questions like "tell me about yourself"
- Each question should assess a key competency
- Include realistic follow-ups an interviewer would ask

Return ONLY valid JSON array:
[
  {{
    "question": "specific, role-relevant question",
    "type": "behavioral|technical|communication",
    "follow_up": "natural follow-up question",
    "difficulty": "easy|medium|hard",
    "competency": "what this tests (e.g., problem-solving, leadership)"
  }}
]

JSON only, no markdown, no explanation."""

        
        if not self.client:
            # Fallback questions if no API key
            return self._get_default_questions(position)
        
        try:
            response = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Try to extract JSON from response
            # Sometimes the model includes markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            questions = json.loads(content)
            return questions
            
        except Exception as e:
            print(f"Error generating questions with LLM: {e}")
            return self._get_default_questions(position)
    
    async def generate_follow_up_question(
        self, 
        previous_question: str,
        user_answer: str,
        context: str = ""
    ) -> str:
        """
        Generate a dynamic follow-up question based on the user's answer.
        
        Args:
            previous_question: The question that was asked
            user_answer: The user's response
            context: Additional context (job description, etc.)
        
        Returns:
            Follow-up question string
        """
        
        prompt = f"""You are conducting an interview. Based on the candidate's answer, generate ONE relevant follow-up question that digs deeper.

Previous Question: {previous_question}

Candidate's Answer: {user_answer}

{f"Context: {context}" if context else ""}

Generate a single, specific follow-up question (maximum 30 words) that:
- Asks for more details or clarification
- Explores a specific point they mentioned
- Tests deeper understanding

Return ONLY the question text, nothing else."""
        
        if not self.client:
            return "Can you elaborate more on that specific point?"
        
        try:
            response = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.8,
                max_tokens=100
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"Error generating follow-up: {e}")
            return "Can you provide more specific examples?"
    
    async def evaluate_answer_quality(
        self,
        question: str,
        answer: str,
        expected_type: str = "behavioral"
    ) -> Dict[str, any]:
        """
        Evaluate the quality and relevance of an interview answer.
        
        Args:
            question: The interview question
            answer: The candidate's answer
            expected_type: Type of question (behavioral, technical, communication)
        
        Returns:
            Dictionary with scores and feedback
        """
        
        # Fix format string error in evaluate_answer_quality
        star_method_section = ""
        star_json_section = ""
        
        if expected_type == 'behavioral':
            star_method_section = """5. STAR METHOD (for behavioral):
   - Situation: Did they describe the context?
   - Task: Was their responsibility clear?
   - Action: Did they explain what THEY did?
   - Result: Was there a measurable outcome?"""
            star_json_section = '  "star_components": {"has_situation": true, "has_task": true, "has_action": true, "has_result": true},\n'
        
        prompt = f"""You are evaluating an interview response with 10+ years of HR experience. 

QUESTION TYPE: {expected_type}
QUESTION: {question}

CANDIDATE'S ANSWER: {answer}

EVALUATION CRITERIA:

1. RELEVANCE (0-100): Does it directly answer the question?
2. CLARITY (0-100): Is it well-structured and easy to understand?
3. COMPLETENESS (0-100): Does it provide sufficient detail and examples?
4. SPECIFICITY (0-100): Are there concrete examples vs vague statements?

{star_method_section}

Be constructive but honest. Grade like a tough but fair interviewer.

Return ONLY this JSON (no markdown):
{{
  "relevance_score": 75,
  "clarity_score": 75,
  "completeness_score": 75,
  "specificity_score": 75,
{star_json_section}  "overall_score": 75,
  "strengths": ["specific strength 1", "strength 2"],
  "improvements": ["specific improvement 1", "improvement 2"],
  "feedback": "2-3 sentences of constructive feedback"
}}"""
        
        if not self.client:
            return {
                "relevance_score": 75,
                "clarity_score": 75,
                "completeness_score": 75,
                "overall_score": 75,
                "feedback": "Your answer addresses the question adequately."
            }
        
        try:
            response = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.3,
                max_tokens=500
            )
            
            content = response.choices[0].message.content.strip()
            
            # Extract JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            return json.loads(content)
            
        except Exception as e:
            print(f"Error evaluating answer: {e}")
            return {
                "relevance_score": 70,
                "clarity_score": 70,
                "completeness_score": 70,
                "overall_score": 70,
                "feedback": "Unable to analyze answer automatically."
            }
    
    def _get_default_questions(self, position: str) -> List[Dict[str, str]]:
        """Fallback questions when LLM is unavailable."""
        return [
            {
                "question": "Tell me about yourself and your relevant experience.",
                "type": "behavioral",
                "follow_up": "What specific achievement are you most proud of?",
                "difficulty": "easy"
            },
            {
                "question": f"Why are you interested in this {position} position?",
                "type": "communication",
                "follow_up": "What about our company particularly attracts you?",
                "difficulty": "easy"
            },
            {
                "question": "Describe a challenging project you worked on. What was your role and how did you overcome obstacles?",
                "type": "behavioral",
                "follow_up": "What would you do differently if you could do it again?",
                "difficulty": "medium"
            },
            {
                "question": "What are your greatest strengths and how do they relate to this role?",
                "type": "communication",
                "follow_up": "Can you give me a specific example of using that strength?",
                "difficulty": "easy"
            },
            {
                "question": "Where do you see yourself in 5 years?",
                "type": "communication",
                "follow_up": "How does this position fit into that plan?",
                "difficulty": "medium"
            }
        ]