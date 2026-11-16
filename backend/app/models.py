from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Classroom(Base):
    __tablename__ = 'classroom'
    classid: Mapped[str] = mapped_column(String(20), primary_key=True)
    classname: Mapped[str] = mapped_column(String(100), nullable=False)
    students: Mapped[list['Student']] = relationship(back_populates='classroom')

class Student(Base):
    __tablename__ = 'student'
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(100))
    classid: Mapped[str] = mapped_column(ForeignKey('classroom.classid'),nullable=False)
    gpa: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    classroom: Mapped['Classroom'] = relationship(back_populates='students')