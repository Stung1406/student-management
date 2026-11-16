# Kế hoạch học FastAPI: Quản lý sinh viên (CRUD)

Stack: React + FastAPI + PostgreSQL + Docker, làm trong VS Code trên WSL. Mỗi bước đều chạy và kiểm tra được trước khi sang bước sau.

## 0. Tổng quan

| Bước | Nội dung | Kiểm tra bằng |
| --- | --- | --- |
| 1 | Docker Compose + Postgres + FastAPI | `/health/db` trả `connected` |
| 2 | Kết nối DB + models SQLAlchemy | 2 bảng xuất hiện trong Postgres |
| 3 | Schemas Pydantic + CRUD `classroom` | Swagger `/docs` |
| 4 | CRUD `student` + validate GPA + lọc theo lớp | Swagger `/docs` + curl |
| 5 | CORS + giao diện React | Bảng sinh viên hiện trên web |
| 6 | Tách tầng service, xử lý lỗi, Alembic | Migration chạy được |

**Thiết kế dữ liệu (đã chốt)**

- `classroom`: `classid` (PK, chuỗi, ví dụ `CNTT01`), `classname`
- `student`: `id` (PK, tự tăng), `name`, `classid` (FK → `classroom.classid`), `gpa` (thang 4)

**Cấu trúc thư mục cuối cùng**

```
student-management/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── errors.py              (bước 6)
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── classrooms.py
│       │   └── students.py
│       └── services/              (bước 6)
│           ├── __init__.py
│           └── student_service.py
└── frontend/                      (bước 5, tạo bằng Vite)
```

**Quy ước:** gõ lệnh trong terminal WSL, project đặt ở `~/` (không để ở `/mnt/c`), test API bằng Swagger tại http://localhost:8000/docs.

---

## Bước 1: Dựng môi trường

Mục tiêu: 2 container (Postgres và FastAPI) chạy và nói chuyện được với nhau.

### 1.1 Tạo khung thư mục

```bash
mkdir -p ~/student-management/backend/app && cd ~/student-management
touch backend/app/__init__.py
code .
```

### 1.2 `backend/requirements.txt`

```
fastapi
uvicorn[standard]
sqlalchemy
psycopg2-binary
```

### 1.3 `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
```

- `COPY requirements.txt .` rồi `pip install` đặt trước `COPY . .` để Docker cache lớp cài thư viện. Sửa code không phải cài lại.

### 1.4 `docker-compose.yml` (thư mục gốc)

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin123
      POSTGRES_DB: student_db
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U admin -d student_db']
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - '8000:8000'
    environment:
      DATABASE_URL: postgresql+psycopg2://admin:admin123@db:5432/student_db
    volumes:
      - ./backend:/app
    depends_on:
      db:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  pgdata:
```

- Backend gọi Postgres bằng hostname `db` (tên service), không phải `localhost`.
- `POSTGRES_*`: Postgres đọc 3 biến này để tạo user, mật khẩu, database ở lần khởi động đầu.
- `volume pgdata`: dữ liệu còn nguyên khi tắt container.
- `healthcheck` + `depends_on`: backend chỉ chạy khi Postgres sẵn sàng.
- `./backend:/app` + `--reload`: sửa code là server tự restart.

### 1.5 `backend/app/main.py` (bản đầu, bước 2 sẽ thay)

```python
import os
from fastapi import FastAPI
from sqlalchemy import create_engine, text

engine = create_engine(os.getenv('DATABASE_URL'))
app = FastAPI(title='Student Management API')


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/health/db')
def health_db():
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    return {'db': 'connected'}
```

### 1.6 Chạy và kiểm tra

```bash
docker compose up --build
```

Mở terminal WSL khác:

```bash
curl localhost:8000/health      # {"status":"ok"}
curl localhost:8000/health/db   # {"db":"connected"}
```

**Đạt khi:** cả 2 lệnh trả đúng kết quả và http://localhost:8000/docs mở được.

**Lỗi thường gặp**

- `could not translate host name "db"`: `DATABASE_URL` phải dùng `db`, không dùng `localhost`.
- Port 5432 bị chiếm (máy đã có Postgres): đổi thành `'5433:5432'` trong compose.

---

## Bước 2: Kết nối DB và tạo 2 bảng

Mục tiêu: định nghĩa `classroom`, `student` bằng SQLAlchemy và thấy bảng trong Postgres.

### 2.1 `backend/app/database.py`

```python
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv('DATABASE_URL')

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- `SessionLocal`: nhà máy tạo session, mỗi request dùng 1 session riêng.
- `Base`: lớp cha của mọi model, SQLAlchemy dựa vào đây để biết có những bảng nào.
- `get_db`: dependency của FastAPI. `yield` đưa session cho endpoint, `finally` luôn đóng session dù có lỗi.

### 2.2 `backend/app/models.py`

```python
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
    classid: Mapped[str] = mapped_column(ForeignKey('classroom.classid'), nullable=False)
    gpa: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    classroom: Mapped['Classroom'] = relationship(back_populates='students')
```

- `Mapped[str]` + `mapped_column(...)`: khai báo kiểu Python và cấu hình cột SQL.
- `ForeignKey('classroom.classid')`: ràng buộc sinh viên chỉ thuộc lớp đã tồn tại.
- `relationship`: cho phép gõ `student.classroom` và `classroom.students` mà không cần viết JOIN.

### 2.3 Thay `backend/app/main.py`

```python
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (import để Base biết 2 bảng)
from app.database import Base, engine, get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title='Student Management API', lifespan=lifespan)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/health/db')
def health_db(db: Session = Depends(get_db)):
    db.execute(text('SELECT 1'))
    return {'db': 'connected'}
```

- `lifespan`: code chạy 1 lần khi server khởi động. `create_all` tạo bảng nếu chưa có (bước 6 sẽ thay bằng Alembic).

### 2.4 Kiểm tra

```bash
docker compose exec db psql -U admin -d student_db -c '\dt'
docker compose exec db psql -U admin -d student_db -c '\d student'
```

**Đạt khi:** thấy bảng `classroom`, `student` và `student` có khóa ngoại tới `classroom`.

---

## Bước 3: Schemas Pydantic + CRUD `classroom`

Mục tiêu: 5 endpoint cho lớp học, test hết trên Swagger.

### 3.1 `backend/app/schemas.py`

Schema là "hình dạng dữ liệu vào/ra" của API. Tách khỏi model DB để kiểm soát những gì client gửi và nhận.

```python
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
    gpa: float = Field(ge=0, le=4)  # thang 10 thì đổi le=10


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
```

- `Field(ge=0, le=4)`: FastAPI tự trả lỗi 422 nếu GPA ngoài khoảng 0 đến 4.
- `from_attributes=True`: cho phép trả thẳng object SQLAlchemy, Pydantic tự đọc thuộc tính.
- `StudentUpdate` cho mọi trường là `None` mặc định để cập nhật từng phần (PATCH).

### 3.2 `backend/app/routers/classrooms.py`

```bash
mkdir backend/app/routers && touch backend/app/routers/__init__.py
```

```python
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
```

- `db.get(Model, pk)`: lấy 1 dòng theo khóa chính, trả `None` nếu không có.
- `data.model_dump()`: đổi schema thành dict để tạo model.
- `db.add` → `db.commit` → `db.refresh`: thêm, lưu xuống DB, nạp lại dữ liệu mới nhất.
- Mã trạng thái: 201 tạo mới, 204 xóa xong (không có body), 404 không thấy, 409 xung đột dữ liệu.

### 3.3 Đăng ký router trong `main.py`

Thêm import và dòng `include_router` ngay sau khi tạo `app`:

```python
from app.routers import classrooms

app = FastAPI(title='Student Management API', lifespan=lifespan)
app.include_router(classrooms.router)
```

### 3.4 Kiểm tra trên http://localhost:8000/docs

1. `POST /classrooms` với `{"classid": "CNTT01", "classname": "Công nghệ thông tin 01"}` → 201.
2. Gửi lại y hệt → 409.
3. `GET /classrooms` → thấy lớp vừa tạo.
4. `PUT /classrooms/CNTT01` đổi tên → 200.
5. `GET /classrooms/XXX` → 404.
6. Tạo thêm lớp `CNTT02` rồi `DELETE /classrooms/CNTT02` → 204.

---

## Bước 4: CRUD `student`

Mục tiêu: CRUD sinh viên, validate GPA, kiểm tra lớp tồn tại, lọc theo lớp, phân trang.

### 4.1 `backend/app/routers/students.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix='/students', tags=['students'])


def _check_class_exists(db: Session, classid: str):
    if not db.get(models.Classroom, classid):
        raise HTTPException(status_code=400, detail='classid không tồn tại')


def _get_or_404(db: Session, student_id: int) -> models.Student:
    obj = db.get(models.Student, student_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Không tìm thấy sinh viên')
    return obj


@router.post('', response_model=schemas.StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(data: schemas.StudentCreate, db: Session = Depends(get_db)):
    _check_class_exists(db, data.classid)
    obj = models.Student(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get('', response_model=list[schemas.StudentOut])
def list_students(
    classid: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(models.Student).order_by(models.Student.id)
    if classid:
        stmt = stmt.where(models.Student.classid == classid)
    return db.scalars(stmt.offset(skip).limit(limit)).all()


@router.get('/{student_id}', response_model=schemas.StudentOut)
def get_student(student_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, student_id)


@router.patch('/{student_id}', response_model=schemas.StudentOut)
def update_student(student_id: int, data: schemas.StudentUpdate, db: Session = Depends(get_db)):
    obj = _get_or_404(db, student_id)
    changes = data.model_dump(exclude_unset=True)
    if 'classid' in changes:
        _check_class_exists(db, changes['classid'])
    for field, value in changes.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete('/{student_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    obj = _get_or_404(db, student_id)
    db.delete(obj)
    db.commit()
```

- `classid: str | None = None` trong hàm: FastAPI hiểu là query param tùy chọn (`?classid=CNTT01`).
- `Query(0, ge=0)`: ràng buộc `skip >= 0`; `limit` từ 1 đến 100.
- `exclude_unset=True`: chỉ lấy những trường client thật sự gửi, nên PATCH không ghi đè trường khác bằng `None`.

Đăng ký trong `main.py`:

```python
from app.routers import classrooms, students

app.include_router(classrooms.router)
app.include_router(students.router)
```

### 4.2 Kiểm tra

Trên `/docs`, hoặc bằng curl:

```bash
curl -X POST localhost:8000/students -H 'Content-Type: application/json' -d '{"name":"Nguyễn Văn A","classid":"CNTT01","gpa":3.2}'
```

| Thao tác | Kết quả đúng |
| --- | --- |
| Tạo sinh viên hợp lệ | 201 + có `id` |
| `gpa` = 5 | 422 |
| `classid` = `ZZZ` (không có) | 400 |
| `GET /students?classid=CNTT01` | chỉ sinh viên lớp đó |
| `GET /students?skip=0&limit=1` | đúng 1 dòng |
| `PATCH /students/1` body `{"gpa": 3.9}` | chỉ `gpa` đổi |
| `DELETE /classrooms/CNTT01` khi lớp còn sinh viên | 409 |
| `DELETE /students/1` | 204 |

---

## Bước 5: CORS + giao diện React

Mục tiêu: trang React hiển thị, thêm, sửa, xóa, lọc sinh viên qua API.

### 5.1 Bật CORS trong `main.py`

Trình duyệt chặn web ở cổng 5173 gọi API ở cổng 8000 nếu server không cho phép. Thêm sau dòng tạo `app`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_methods=['*'],
    allow_headers=['*'],
)
```

### 5.2 Tạo project React (Vite)

Cần Node 20 trở lên. Nếu chưa có, cài bằng nvm trong WSL:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc && nvm install --lts
```

```bash
cd ~/student-management
npm create vite@latest frontend -- --template react
cd frontend && npm install && npm run dev
```

Nếu Vite hỏi thêm tùy chọn, chọn mặc định. Mở http://localhost:5173.

### 5.3 `frontend/src/api.js`

```js
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Dữ liệu không hợp lệ');
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getClasses: () => request('/classrooms'),
  getStudents: (classid) => request(`/students${classid ? `?classid=${classid}` : ''}`),
  createStudent: (data) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
};
```

- Gom mọi lệnh gọi API vào 1 file, component không phải biết URL hay cách xử lý lỗi.
- FastAPI trả lỗi 422 dưới dạng mảng nên chỉ hiện thông báo chung; lỗi 400/404/409 có `detail` là chuỗi nên hiện nguyên văn.

### 5.4 `frontend/src/App.jsx`

```jsx
import { useEffect, useState } from 'react';
import { api } from './api';

const emptyForm = { name: '', classid: '', gpa: '' };

export default function App() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const loadStudents = async () => {
    try {
      setStudents(await api.getStudents(filter));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    api.getClasses().then(setClasses).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadStudents();
  }, [filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, classid: form.classid, gpa: Number(form.gpa) };
    try {
      if (editingId) await api.updateStudent(editingId, payload);
      else await api.createStudent(payload);
      setForm(emptyForm);
      setEditingId(null);
      setError('');
      await loadStudents();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({ name: s.name, classid: s.classid, gpa: String(s.gpa) });
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa sinh viên này?')) return;
    try {
      await api.deleteStudent(id);
      await loadStudents();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Quản lý sinh viên</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder='Họ tên' value={form.name} required
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select value={form.classid} required
          onChange={(e) => setForm({ ...form, classid: e.target.value })}>
          <option value=''>-- Chọn lớp --</option>
          {classes.map((c) => (
            <option key={c.classid} value={c.classid}>{c.classname}</option>
          ))}
        </select>
        <input type='number' step='0.01' min='0' max='4' placeholder='GPA'
          value={form.gpa} required
          onChange={(e) => setForm({ ...form, gpa: e.target.value })} />
        <button type='submit'>{editingId ? 'Lưu' : 'Thêm'}</button>
        {editingId && (
          <button type='button' onClick={() => { setEditingId(null); setForm(emptyForm); }}>
            Hủy
          </button>
        )}
      </form>

      <label>Lọc theo lớp: </label>
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value=''>Tất cả</option>
        {classes.map((c) => (
          <option key={c.classid} value={c.classid}>{c.classname}</option>
        ))}
      </select>

      <table border='1' cellPadding='6' style={{ width: '100%', marginTop: 12 }}>
        <thead>
          <tr><th>ID</th><th>Họ tên</th><th>Lớp</th><th>GPA</th><th></th></tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td><td>{s.name}</td><td>{s.classid}</td><td>{s.gpa}</td>
              <td>
                <button onClick={() => handleEdit(s)}>Sửa</button>{' '}
                <button onClick={() => handleDelete(s.id)}>Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- `useEffect(..., [])`: chạy 1 lần khi trang mở, nạp danh sách lớp.
- `useEffect(..., [filter])`: nạp lại sinh viên mỗi khi đổi bộ lọc.
- `editingId` quyết định nút submit là Thêm (POST) hay Lưu (PATCH).
- Lớp chưa có thì tạo trước bằng Swagger (`POST /classrooms`). Làm trang quản lý lớp là bài tập mở rộng.

### 5.5 Kiểm tra

Thêm, sửa, xóa sinh viên trên web, đổi bộ lọc lớp, nhập GPA 5 để thấy thông báo lỗi. Mở tab Network của trình duyệt để xem request/response thật.

---

## Bước 6: Tách tầng, xử lý lỗi, Alembic

Mục tiêu: router chỉ nhận request và trả response; logic nằm ở service; schema DB được quản lý bằng migration.

### 6.1 `backend/app/errors.py`

```python
class AppError(Exception):
    status_code = 400

    def __init__(self, message: str):
        self.message = message


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409
```

### 6.2 `backend/app/services/student_service.py`

```bash
mkdir backend/app/services && touch backend/app/services/__init__.py
```

```python
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


def list_all(db: Session, classid: str | None, skip: int, limit: int):
    stmt = select(models.Student).order_by(models.Student.id)
    if classid:
        stmt = stmt.where(models.Student.classid == classid)
    return db.scalars(stmt.offset(skip).limit(limit)).all()


def update(db: Session, student_id: int, data: schemas.StudentUpdate) -> models.Student:
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
```

### 6.3 Router sinh viên gọn lại

```python
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services import student_service as service

router = APIRouter(prefix='/students', tags=['students'])


@router.post('', response_model=schemas.StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(data: schemas.StudentCreate, db: Session = Depends(get_db)):
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
def update_student(student_id: int, data: schemas.StudentUpdate, db: Session = Depends(get_db)):
    return service.update(db, student_id, data)


@router.delete('/{student_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    service.delete(db, student_id)
```

**Bài tập:** làm tương tự `classroom_service.py` (gợi ý: lớp còn sinh viên thì ném `ConflictError`), rồi rút gọn `routers/classrooms.py`.

### 6.4 `main.py` hoàn chỉnh (đã bỏ `create_all`)

```python
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError
from app.routers import classrooms, students

app = FastAPI(title='Student Management API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(classrooms.router)
app.include_router(students.router)


@app.exception_handler(AppError)
def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={'detail': exc.message})


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/health/db')
def health_db(db: Session = Depends(get_db)):
    db.execute(text('SELECT 1'))
    return {'db': 'connected'}
```

- `exception_handler(AppError)`: service ném lỗi nghiệp vụ, FastAPI tự đổi thành JSON với đúng mã trạng thái.

### 6.5 Alembic (migration)

Thêm `alembic` vào `requirements.txt`, rồi build lại:

```bash
docker compose up --build -d
docker compose exec backend alembic init alembic
sudo chown -R $USER:$USER backend
```

Sửa `backend/alembic/env.py`: thêm import và dòng `set_main_option` ngay sau `config = context.config`, đổi `target_metadata`:

```python
import os

from app import models  # noqa: F401
from app.database import Base

config = context.config
config.set_main_option('sqlalchemy.url', os.environ['DATABASE_URL'])

# ... giữ nguyên phần còn lại, chỉ đổi dòng này:
target_metadata = Base.metadata
```

Reset DB (xóa hết dữ liệu cũ vì bảng cũ tạo bằng `create_all`) rồi tạo migration đầu tiên:

```bash
docker compose down -v
docker compose up -d
docker compose exec backend alembic revision --autogenerate -m 'init'
docker compose exec backend alembic upgrade head
docker compose exec db psql -U admin -d student_db -c '\dt'
```

**Đạt khi:** thấy 3 bảng `alembic_version`, `classroom`, `student`.

**Thử quy trình đổi schema:** thêm cột `email: Mapped[str | None] = mapped_column(String(100))` vào `Student`, chạy `alembic revision --autogenerate -m 'add email'` rồi `alembic upgrade head`. Mở file trong `alembic/versions/` để đọc migration sinh ra.

---

## Phụ lục: Lệnh Docker hay dùng

| Lệnh | Tác dụng |
| --- | --- |
| `docker compose up -d` | Chạy nền |
| `docker compose logs -f backend` | Xem log backend |
| `docker compose ps` | Xem trạng thái container |
| `docker compose exec backend bash` | Vào shell container backend |
| `docker compose down` | Tắt, giữ dữ liệu |
| `docker compose down -v` | Tắt và xóa dữ liệu DB |

## Sau khi xong 6 bước

1. Chuyển mật khẩu DB sang file `.env` và thêm `.gitignore`.
2. Viết test bằng `pytest` + `TestClient` với DB test riêng.
3. Thêm trang quản lý lớp trên React.
4. Trả về tổng số bản ghi để làm phân trang trên giao diện.
5. Đưa `frontend` vào `docker-compose.yml`.
6. Thêm đăng nhập JWT.
