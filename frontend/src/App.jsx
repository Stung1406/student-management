import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import StudentForm from './components/StudentForm'
import StudentTable from './components/StudentTable'
import './App.css'

const emptyForm = { name: '', classid: '', gpa: '' }

export default function App() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadStudents = useCallback(async () => {
    try {
      setStudents(await api.getStudents(filter))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    api.getClasses()
      .then(setClasses)
      .catch((requestError) => setError(requestError.message))
  }, [])

  useEffect(() => {
    let active = true
    api.getStudents(filter)
      .then((data) => {
        if (active) setStudents(data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [filter])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleFormChange = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      classid: form.classid,
      gpa: Number(form.gpa),
    }

    try {
      if (editingId !== null) {
        await api.updateStudent(editingId, payload)
      } else {
        await api.createStudent(payload)
      }
      resetForm()
      setLoading(true)
      await loadStudents()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (student) => {
    setEditingId(student.id)
    setForm({
      name: student.name,
      classid: student.classid,
      gpa: String(student.gpa),
    })
    setError('')
  }

  const handleDelete = async (student) => {
    if (!window.confirm(`Xóa sinh viên "${student.name}"?`)) return

    setError('')
    try {
      await api.deleteStudent(student.id)
      setLoading(true)
      await loadStudents()
      if (editingId === student.id) resetForm()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="app-shell">
      <nav className="navbar navbar-expand-lg navbar-dark app-navbar">
        <div className="container">
          <a className="navbar-brand fw-semibold" href="/">Student Manager</a>
          <span className="navbar-text text-white-50">Quản lý sinh viên</span>
        </div>
      </nav>

      <main className="container py-4 py-lg-5">
        <header className="page-heading mb-4">
          <p className="text-uppercase small fw-semibold text-primary mb-2">Bảng điều khiển</p>
          <h1 className="h2 fw-bold mb-2">Danh sách sinh viên</h1>
          <p className="text-secondary mb-0">Thêm, cập nhật và quản lý thông tin sinh viên.</p>
        </header>

        {error && (
          <div className="alert alert-danger alert-dismissible" role="alert">
            {error}
            <button
              type="button"
              className="btn-close"
              aria-label="Đóng thông báo"
              onClick={() => setError('')}
            />
          </div>
        )}

        <StudentForm
          classes={classes}
          form={form}
          editing={editingId !== null}
          submitting={submitting}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
        <StudentTable
          classes={classes}
          students={students}
          filter={filter}
          loading={loading}
          onFilterChange={(classid) => {
            setLoading(true)
            setFilter(classid)
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </main>
    </div>
  )
}
