from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix='/classrooms', tags=['classrooms'])


@router.post('', response_model=schemas.ClassroomOut, status_code=status.HTTP_201_CREATED)
def create_classroom(data: schemas.ClassroomCreate, db: Session = Depends(get_db)):
    if db.get(models.Classroom, data.classid):
        raise HTTPException(status_code=409, detail='classid đã tồn tại')
    obj = models.Classroom(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get('', response_model=list[schemas.ClassroomOut])
def list_classrooms(db: Session = Depends(get_db)):
    return db.scalars(select(models.Classroom).order_by(models.Classroom.classid)).all()


@router.get('/{classid}', response_model=schemas.ClassroomOut)
def get_classroom(classid: str, db: Session = Depends(get_db)):
    obj = db.get(models.Classroom, classid)
    if not obj:
        raise HTTPException(status_code=404, detail='Không tìm thấy lớp')
    return obj


@router.put('/{classid}', response_model=schemas.ClassroomOut)
def update_classroom(classid: str, data: schemas.ClassroomUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Classroom, classid)
    if not obj:
        raise HTTPException(status_code=404, detail='Không tìm thấy lớp')
    obj.classname = data.classname
    db.commit()
    db.refresh(obj)
    return obj


@router.delete('/{classid}', status_code=status.HTTP_204_NO_CONTENT)
def delete_classroom(classid: str, db: Session = Depends(get_db)):
    obj = db.get(models.Classroom, classid)
    if not obj:
        raise HTTPException(status_code=404, detail='Không tìm thấy lớp')
    if obj.students:
        raise HTTPException(status_code=409, detail='Lớp còn sinh viên, không thể xóa')
    db.delete(obj)
    db.commit()