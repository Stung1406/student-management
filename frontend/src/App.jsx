import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
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

        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h2 className="h5 fw-bold mb-0">
                {editingId !== null ? 'Cập nhật sinh viên' : 'Thêm sinh viên'}
              </h2>
              {editingId !== null && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetForm}>
                  Hủy chỉnh sửa
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3 align-items-end">
                <div className="col-12 col-md-5">
                  <label htmlFor="student-name" className="form-label">Họ và tên</label>
                  <input
                    id="student-name"
                    className="form-control"
                    type="text"
                    maxLength="100"
                    placeholder="Nhập họ tên"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label htmlFor="student-class" className="form-label">Lớp</label>
                  <select
                    id="student-class"
                    className="form-select"
                    value={form.classid}
                    onChange={(event) => setForm({ ...form, classid: event.target.value })}
                    required
                  >
                    <option value="">Chọn lớp</option>
                    {classes.map((classroom) => (
                      <option key={classroom.classid} value={classroom.classid}>
                        {classroom.classname} ({classroom.classid})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label htmlFor="student-gpa" className="form-label">GPA (0–4)</label>
                  <input
                    id="student-gpa"
                    className="form-control"
                    type="number"
                    min="0"
                    max="4"
                    step="0.01"
                    placeholder="Ví dụ: 3.50"
                    value={form.gpa}
                    onChange={(event) => setForm({ ...form, gpa: event.target.value })}
                    required
                  />
                </div>
                <div className="col-12">
                  <button className="btn btn-primary px-4" type="submit" disabled={submitting}>
                    {submitting ? 'Đang lưu...' : editingId !== null ? 'Lưu thay đổi' : 'Thêm sinh viên'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>

        <section className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 p-4">
              <div>
                <h2 className="h5 fw-bold mb-1">Sinh viên</h2>
                <p className="small text-secondary mb-0">
                  {students.length} sinh viên{filter ? ' trong lớp đã chọn' : ''}
                </p>
              </div>
              <div className="filter-control">
                <label htmlFor="class-filter" className="form-label small mb-1">Lọc theo lớp</label>
                <select
                  id="class-filter"
                  className="form-select form-select-sm"
                  value={filter}
                  onChange={(event) => {
                    setLoading(true)
                    setFilter(event.target.value)
                  }}
                >
                  <option value="">Tất cả lớp</option>
                  {classes.map((classroom) => (
                    <option key={classroom.classid} value={classroom.classid}>
                      {classroom.classname}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col" className="ps-4">Mã</th>
                    <th scope="col">Họ và tên</th>
                    <th scope="col">Lớp</th>
                    <th scope="col">GPA</th>
                    <th scope="col" className="text-end pe-4">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" className="text-center text-secondary py-5">Đang tải dữ liệu...</td></tr>
                  ) : students.length === 0 ? (
                    <tr><td colSpan="5" className="text-center text-secondary py-5">Chưa có sinh viên nào.</td></tr>
                  ) : students.map((student) => {
                    const classroom = classes.find((item) => item.classid === student.classid)
                    return (
                      <tr key={student.id}>
                        <td className="ps-4 text-secondary">#{student.id}</td>
                        <td className="fw-medium">{student.name}</td>
                        <td>{classroom?.classname ?? student.classid}</td>
                        <td><span className="badge text-bg-light">{Number(student.gpa).toFixed(2)}</span></td>
                        <td className="text-end pe-4">
                          <div className="d-inline-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleEdit(student)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(student)}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
