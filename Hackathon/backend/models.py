from pydantic import BaseModel
from typing import Optional, List


# ─────────────────────────────
# REQUEST MODELS (frontend → backend)
# ─────────────────────────────

class ActionRequest(BaseModel):
    experiment_id: int
    action: str


# ─────────────────────────────
# RESPONSE MODELS (backend → frontend)
# ─────────────────────────────

class ActionResponse(BaseModel):#from comapring_llm.py to frontend
    is_correct: bool
    is_dangerous: bool
    observation: Optional[str] = None
    message: Optional[str] = None


class StepSchema(BaseModel):
    step_number: int
    instruction: str
    expected_outcome: str
    equipment_used: List[str]


class ExperimentMetadata(BaseModel):
    experiment_id: int
    title: str
    objective: str


class MaterialsRequired(BaseModel):
    apparatus: List[str]
    chemicals: List[str]


class ExperimentResponse(BaseModel):#from modifer_llm.py to frontend
    experiment_metadata: ExperimentMetadata
    materials_required: MaterialsRequired
    procedure: List[StepSchema]
    precautions: List[str]

class ChatbotRequest(BaseModel):
    experiment_id: int
    audio: str  # base64 string
    
class ChatbotResponse(BaseModel):
    response: str