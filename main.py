from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Date, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, Session, relationship
from pydantic import BaseModel
from typing import List
from datetime import date
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5502"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "sqlite:///./session_setup.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
sessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class session_setup(Base):
    __tablename__ = "session_details"

    id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String, nullable=False)
    Date = Column(Date, default=date.today)
    teacher_name = Column(String, nullable=False)

    attendances = relationship("attendance", back_populates="session")


class student(Base):
    __tablename__ = "student_table"

    id = Column(Integer, primary_key=True, index=True)
    student_roll = Column(Integer, nullable=False)
    student_name = Column(String, nullable=False)

    attendances = relationship("attendance", back_populates="student")

class attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("session_details.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("student_table.id"), nullable=False)
    status = Column(String, default="absent")  # "present" | "absent" | "late"
    date = Column(Date, default=date.today)

    session = relationship("session_setup", back_populates="attendances")
    student = relationship("student", back_populates="attendances")


def get_db():
    db = sessionLocal()
    try:
        yield db
    finally:
        db.close()


class SessionCreate(BaseModel):
    class_name: str
    teacher_name: str


class StudentCreate(BaseModel):
    student_roll: int
    student_name: str


class AttendanceCreate(BaseModel):
    session_id: int
    student_id: int
    status: str  


class AttendanceOut(BaseModel):
    id: int
    session_id: int
    student_id: int
    status: str
    date: date

    class Config:
        from_attributes = True


Base.metadata.create_all(bind=engine)


@app.post("/session")
def create_session(session: SessionCreate, db: Session = Depends(get_db)):
    new_session = session_setup(class_name=session.class_name,
                                 teacher_name=session.teacher_name)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return {"message": "Session added✅", "session_id": new_session.id}


@app.post("/student")
def create_student(student_in: StudentCreate, db: Session = Depends(get_db)):
    new_student = student(student_roll=student_in.student_roll,
                           student_name=student_in.student_name)
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return {"message": "Student added✅", "student_id": new_student.id}


@app.get("/students")
def get_students(db: Session = Depends(get_db)):
    return db.query(student).all()


@app.post("/attendance")
def mark_attendance(record: AttendanceCreate, db: Session = Depends(get_db)):
    if record.status not in ("present", "absent", "late"):
        raise HTTPException(status_code=400, detail="status must be present, absent, or late")

    session_exists = db.query(session_setup).filter(session_setup.id == record.session_id).first()
    student_exists = db.query(student).filter(student.id == record.student_id).first()
    if not session_exists:
        raise HTTPException(status_code=404, detail="Session not found")
    if not student_exists:
        raise HTTPException(status_code=404, detail="Student not found")

   
    existing = db.query(attendance).filter(
        attendance.session_id == record.session_id,
        attendance.student_id == record.student_id
    ).first()

    if existing:
        existing.status = record.status #type:ignore
        db.commit()
        db.refresh(existing)
        return {"message": "Attendance updated✅", "id": existing.id}

    new_record = attendance(
        session_id=record.session_id,
        student_id=record.student_id,
        status=record.status
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return {"message": "Attendance marked✅", "id": new_record.id}

@app.get("/attendance/session/{session_id}", response_model=List[AttendanceOut])
def get_attendance_for_session(session_id: int, db: Session = Depends(get_db)):
    return db.query(attendance).filter(attendance.session_id == session_id).all()


@app.get("/attendance/history/{student_id}", response_model=List[AttendanceOut])
def get_student_history(student_id: int, db: Session = Depends(get_db)):
    """This is your 'student_history' — full attendance log for one student across all sessions."""
    records = db.query(attendance).filter(attendance.student_id == student_id).all()
    if not records:
        raise HTTPException(status_code=404, detail="No attendance history found for this student")
    return records