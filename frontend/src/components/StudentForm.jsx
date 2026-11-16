export default function StudentForm({
  classes,
  form,
  editing,
  submitting,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 className="h5 fw-bold mb-0">
            {editing ? 'Cập nhật sinh viên' : 'Thêm sinh viên'}
          </h2>
          {editing && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>
              Hủy chỉnh sửa
            </button>
          )}
        </div>

        <form onSubmit={onSubmit}>
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
                onChange={(event) => onChange('name', event.target.value)}
                required
              />
            </div>
            <div className="col-12 col-md-4">
              <label htmlFor="student-class" className="form-label">Lớp</label>
              <select
                id="student-class"
                className="form-select"
                value={form.classid}
                onChange={(event) => onChange('classid', event.target.value)}
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
                onChange={(event) => onChange('gpa', event.target.value)}
                required
              />
            </div>
            <div className="col-12">
              <button className="btn btn-primary px-4" type="submit" disabled={submitting}>
                {submitting ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm sinh viên'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}
