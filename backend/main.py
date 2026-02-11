from fastapi import FastAPI,Depends,UploadFile, File,HTTPException
from models import ActionRequest,ActionResponse,ExperimentResponse,ChatbotRequest,ChatbotResponse
from database import session,engine
import database_models
from sqlalchemy.orm import Session
import os
import tempfile
import shutil
from pdf_parser import parse_pdf
from modify_instruct import modify_instructions
from comparing_llm import compare_action
from llm import llm_response
from stt import audio_to_text
from prompts import CHATBOT_PROMPT

app=FastAPI()

database_models.Base.metadata.create_all(bind=engine)



def get_db():
    db=session()
    try:
        yield db
    finally:
        db.close()


@app.post("/",response_model=ExperimentResponse)#homepage
def upload_lab_manual(file: UploadFile = File(...),db:Session=Depends(get_db)):
    # 1. Create a secure temporary file
    # delete=False ensures the file stays on disk after the 'with' block 
    # closes, so your parser can actually find the path.
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        # 2. Copy the bits from the upload to the temp file
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name  # This is the unique path string (e.g., /tmp/tmp_abc123.pdf)

    try:
        parsed_json=parse_pdf(tmp_path)
        modified_json=modify_instructions(parsed_json=parsed_json)

        metadata=modified_json["experiment_metadata"]
    
        db.add(database_models.Experiment(**metadata))
        db.commit()

        exp_id=metadata["experiment_id"]
        for step_data in modified_json["procedure"]:
            step_record=database_models.Steps(
            experiment_id=exp_id, # Links to Table 1
            step_number=step_data["step_number"],
            instruction=step_data["instruction"],
            expected_outcome=step_data["expected_outcome"],
            # SQLAlchemy handles the Python list -> JSON string conversion for you
            equipment_used=step_data["equipment_used"]

            )
            db.add(step_record)     
        db.commit()

        db.add(database_models.Precaution(
        experiment_id=exp_id,
        precautions=modified_json["precautions"]
        ))
        db.commit()

        return modified_json

    

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


    finally:
        # 4. NOW we delete it. 
        # Since we set delete=False above, we are responsible for this.
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    
    

@app.post("/action",response_model=ActionResponse)#user inputs/signlas
def feedback(user_input: ActionRequest,db:Session=Depends(get_db)):
    exp_id=user_input.experiment_id
    experiment_record = db.get(database_models.Experiment,exp_id )

    curr_step=experiment_record.current_step

    step = db.query(database_models.Steps).filter(
    database_models.Steps.experiment_id == exp_id,
    database_models.Steps.step_number == curr_step
    ).first()

    precaution_row = db.query(database_models.Precaution).filter(
    database_models.Precaution.experiment_id == exp_id
    ).first()
    precautions = precaution_row.precautions

    result = compare_action(
        instruction=step.instruction,
        user_action=user_input.action,
        expected_outcome=step.expected_outcome,
        equipment_used=step.equipment_used,
        precautions=precautions)
    
    if result["is_correct"] :
        experiment_record.current_step+=1
        db.commit()

    return result

@app.post("/chatbot", response_model=ChatbotResponse)
def chatbot(user_input: ChatbotRequest, db: Session = Depends(get_db)):
    
    # 1. Convert audio to text
    user_question = audio_to_text(user_input.audio)
    
    # 2. Get experiment context from DB
    experiment = db.get(database_models.Experiment, user_input.experiment_id)
    
    # 3. Get current step
    step = db.query(database_models.Steps).filter(
        database_models.Steps.experiment_id == user_input.experiment_id,
        database_models.Steps.step_number == experiment.current_step
    ).first()
    
    # 4. Get ALL steps for full context
    all_steps = db.query(database_models.Steps).filter(
        database_models.Steps.experiment_id == user_input.experiment_id
    ).all()
    all_steps_text = [
        f"Step {s.step_number}: {s.instruction}" 
        for s in all_steps
    ]
    
    # 5. Get precautions
    precaution_row = db.query(database_models.Precaution).filter(
        database_models.Precaution.experiment_id == user_input.experiment_id
    ).first()
    
    # 6. Build prompt with context
    prompt = CHATBOT_PROMPT.format(
        title=experiment.title,
        objective=experiment.objective,
        current_step=experiment.current_step,
        instruction=step.instruction,
        all_steps=all_steps_text,
        precautions=precaution_row.precaution,
        user_question=user_question
    )
    
    # 7. Get LLM response
    response = llm_response(prompt)
    
    return {"response": response}

