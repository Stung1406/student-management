from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import Base, engine, get_db
from app.errors import AppError
from app.routers import classrooms, students


app = FastAPI(title='Student Management API')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.exception_handler(AppError)
def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={'detail': exc.message},
    )


app.include_router(classrooms.router)
app.include_router(students.router)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/health/db')
def health_db(db: Session = Depends(get_db)):
    db.execute(text('SELECT 1'))
    return {'db': 'connected'}