export default function StudentTable({
  classes,
  students,
  filter,
  loading,
  onFilterChange,
  onEdit,
  onDelete,
}) {
  return (
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
              onChange={(event) => onFilterChange(event.target.value)}
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
                          onClick={() => onEdit(student)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onDelete(student)}
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
  )
}
