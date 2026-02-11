from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column,Integer,String,ForeignKey,JSON

Base=declarative_base()

class Experiment(Base):

    __tablename__="EXPERIMENTS"

    experiment_id=Column(Integer,primary_key=True,index=True)
    title=Column(String)
    objective=Column(String)
    current_step=Column(Integer,default=1)

class Steps(Base):

    __tablename__="STEPS"

    step_number =Column(Integer,primary_key=True,index=True)
    experiment_id=Column(Integer,ForeignKey("EXPERIMENTS.experiment_id"),primary_key=True)
    instruction=Column(String)
    expected_outcome=Column(String)
    equipment_used=Column(JSON)

class Precaution(Base):

    __tablename__="PRECAUTIONS"

    experiment_id=Column(Integer,ForeignKey("EXPERIMENTS.experiment_id"),primary_key=True)
    precaution=Column(JSON)

 
