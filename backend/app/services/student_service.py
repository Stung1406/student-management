from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.errors import AppError, NotFoundError


def _check_class_exists(db: Session, classid: str) -> None:
    if not db.get(models.Classroom, classid):
        raise AppError('classid không tồn tại')


def get(db: Session, student_id: int) -> models.Student:
    obj = db.get(models.Student, student_id)
    if not obj:
        raise NotFoundError('Không tìm thấy sinh viên')
    return obj


def create(db: Session, data: schemas.StudentCreate) -> models.Student:
    _check_class_exists(db, data.classid)
    obj = models.Student(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_all(
    db: Session,
    classid: str | None,
    skip: int,
    limit: int,
) -> list[models.Student]:
    stmt = select(models.Student).order_by(models.Student.id)
    if classid:
        stmt = stmt.where(models.Student.classid == classid)
    return list(db.scalars(stmt.offset(skip).limit(limit)).all())


def update(
    db: Session,
    student_id: int,
    data: schemas.StudentUpdate,
) -> models.Student:
    obj = get(db, student_id)
    changes = data.model_dump(exclude_unset=True)
    if 'classid' in changes:
        _check_class_exists(db, changes['classid'])
    for field, value in changes.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, student_id: int) -> None:
    db.delete(get(db, student_id))
    db.commit()
