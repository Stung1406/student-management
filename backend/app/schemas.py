from pydantic import BaseModel, ConfigDict, Field
# ---------- Classroom ----------
class ClassroomCreate(BaseModel):
    classid: str = Field(min_length=1, max_length=20)
    classname: str = Field(min_length=1, max_length=100)
class ClassroomUpdate(BaseModel):
    classname: str = Field(min_length=1, max_length=100)
class ClassroomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    classid: str
    classname: str
# ---------- Student ----------
class StudentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    classid: str
    gpa: float = Field(ge=0, le=4) # thang 10 thì đổi le=10
class StudentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    classid: str | None = None
    gpa: float | None = Field(default=None, ge=0, le=4)
class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    classid: str
    gpa: float