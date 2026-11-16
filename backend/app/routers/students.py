from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app import schemas
from app.database import get_db
from app.services import student_service as service

router = APIRouter(prefix='/students', tags=['students'])

@router.post('', response_model=schemas.StudentOut,
status_code=status.HTTP_201_CREATED)
def create_student(data: schemas.StudentCreate, db: Session =
Depends(get_db)):
    return service.create(db, data)

@router.get('', response_model=list[schemas.StudentOut])
def list_students(
    classid: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.list_all(db, classid, skip, limit)

@router.get('/{student_id}', response_model=schemas.StudentOut)
def get_student(student_id: int, db: Session = Depends(get_db)):
    return service.get(db, student_id)

@router.patch('/{student_id}', response_model=schemas.StudentOut)
def update_student(student_id: int, data: schemas.StudentUpdate, db: Session
= Depends(get_db)):
    return service.update(db, student_id, data)
@router.delete('/{student_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    service.delete(db, student_id)
