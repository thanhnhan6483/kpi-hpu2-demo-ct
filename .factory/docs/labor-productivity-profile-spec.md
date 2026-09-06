# I. Primer

## 1. TL;DR kiểu Feynman
- Trang "Năng suất lao động" có 2 tab. Tab **Tự đánh giá cá nhân** được biến thành luồng: **chọn người → xem danh sách 12 đợt đánh giá (tháng) → mở chi tiết 1 tháng**.
- Người bình thường chỉ thấy chính mình; **quản trị (u001) chọn được mọi người** (chỉ-xem).
- Chi tiết 1 tháng hiện **bảng chỉ tiêu** (như cũ) **+ danh sách các công việc** thực hiện trong tháng đó (cả từ đồng bộ phần mềm khác lẫn kế hoạch cá nhân), gom theo từng tiêu chí, có tag nguồn.
- Không đổi API, không đổi schema, không đổi tab "Đơn vị (quản lý)". Thay đổi gói gọn trong 1 file page.

## 2. Elaboration & Self-Explanation
Hiện tab cá nhân chỉ thấy **một tháng duy nhất** đang được chọn. Muốn xem lịch sử các tháng của một người thì không có chỗ nào. Yêu cầu mới đảo trục nhìn: **người → nhiều tháng → 1 tháng**. Vào chức năng là thấy "hồ sơ đánh giá" của một người dưới dạng danh sách các tháng (đợt đánh giá). Admin chuyển đổi giữa các người. Bấm vào một tháng xem được: các tiêu chí KPI đạt bao nhiêu điểm + danh sách công việc cụ thể đã làm tháng đó (từ đồng bộ dữ liệu hoặc kế hoạch cá nhân).

Điểm kỹ thuật chính: hiện `records` chỉ tải theo 1 tháng đang chọn. Để liệt kê 12 tháng, phải tải records **theo năm học** (API đã hỗ trợ, chỉ bỏ tham số `month`), rồi lọc theo từng tháng ở client bằng `recordFor(user, m)`.

## 3. Concrete Examples & Analogies
- Ví dụ cụ thể: u003 (Trần Thu Hà, Phòng Đào tạo) login → tab hồ sơ hiện **12 dòng tháng**; "9/2026" có record nháp với nút **Xem chi tiết / Tự đánh giá**; "10/2026" trống → "Chưa thêm" + nút **Thêm tháng**.
- Admin u001 login → chọn người bất kỳ → danh sách 12 tháng của người đó (không có nút ghi). Xem chi tiết 9/2026 của Hà → bảng tiêu chí (CV-01..06) + danh sách công việc đã tổng hợp (tag "Phần mềm Quản trị đại học").
- Analogy đời thường: như xem **bảng điểm theo từng kỳ** — chọn sinh viên (admin), thấy danh sách các kỳ, bấm vào 1 kỳ để xem điểm từng môn và danh sách bài tập đã nộp trong kỳ đó.

# II. Audit Summary (Tóm tắt kiểm tra)
- `src/app/kpi/labor-productivity/page.tsx` (~900 dòng): 2 tab; state `month` dùng chung.
- `load()` tải records theo `?academicYearId=...&month=...` → chỉ có records của tháng đang chọn.
- `recordOf(userId)` không lọc tháng (an toàn vì records đã bị lọc month ở tải); sau khi bỏ filter month phải thêm `&& r.month === month`.
- `computeUser(user)` gắn với `month`/`tasks` state → cần `computeUserFor(user, m)` và `tasksFor(user, m)`.
- Handler cá nhân đọc `month` từ state → phải tham số hóa theo (user, month).
- `DetailModal` chỉ render bảng tiêu chí + ghi chú, không có danh sách công việc.
- API `GET /api/labor-productivity` đã hỗ trợ `academicYearId` độc lập → không đổi API. Type `UnitWorkTask` đã có `resultSource`, `syncInfo`, `chiTieu`, `progress`, `status`, `dueDate`, `templateItemId`.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
Yêu cầu tính năng mới, không phải bug. Gap chính: page thiếu góc nhìn "hồ sơ 1 người × nhiều tháng" và thiếu hiển thị công việc trong chi tiết tháng.
- Counter-hypothesis 1: gọi API theo từng tháng (12 lần) → loại trừ, tải cả năm 1 lần là KISS.
- Counter-hypothesis 2: hiển thị `criterionRows` đã lưu → loại trừ, dùng tính toán live để đồng bộ với tab đơn vị.
- Counter-hypothesis 3: admin có nút ghi cho người khác → loại trừ (scope rộng, dễ sửa nhầm).
- Root cause: cần tái cấu trúc data-loading (records year-scoped + helper theo (user, month)) và mở rộng `DetailModal` nhận `tasks`.

# IV. Proposal (Đề xuất)
- Tab cá nhân đổi thành **"Hồ sơ đánh giá"**: admin chọn người (users active), người thường cố định chính mình; thẻ tóm tắt; bảng 12 tháng (Tháng | Trạng thái | Điểm cuối | Xếp loại | Công việc tháng | Thao tác); thao tác theo dòng: Xem chi tiết (luôn), Thêm tháng (tự xem + chưa có record + có KPI mẫu), Đồng bộ dữ liệu (tự xem + có KPI mẫu + không khóa), Tự đánh giá (tự xem + record draft).
- `DetailModal` (dùng chung 2 tab) thêm khối công việc: gom `tasks` theo `templateItemId` khớp từng tiêu chí + bucket "Chưa gán chỉ tiêu"; mỗi dòng: tên công việc, chỉ tiêu, kết quả, % hoàn thành, badge trạng thái, tag nguồn (`sync` → sourceName), hạn.
- Unit console không đổi hành vi; nút Chi tiết gọi `openDetailFor(u, month)` → cũng hiện công việc.

# V. Files Impacted (Tệp bị ảnh hưởng)
- **`src/app/kpi/labor-productivity/page.tsx`** — Sửa: file duy nhất. `load()` year-scoped; `recordOf` lọc tháng + thêm `recordFor`/`computeUserFor`/`tasksFor`/`unitNameOf`; 3 handler cá nhân tham số hóa; `DetailState` thêm `month`+`tasks`, thêm `openDetailFor`; tab hồ sơ (chọn người + 12 tháng); `DetailModal` thêm danh sách công việc.
- Không đổi: type, API, lib, dữ liệu runtime.

# VI. Execution Preview (Xem trước thực thi)
1. Sửa `load()` + helpers.
2. Tham số hóa 3 handler; nối lại SelfReviewModal.
3. `DetailState` + `openDetailFor`; sửa 2 call site.
4. `DetailModal` render công việc (dùng `effectiveProgress`).
5. Viết lại JSX tab hồ sơ.
6. Review tĩnh + `npx tsc --noEmit 2>&1 | Select-Object -First 10` + commit `--no-verify`.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Typecheck: `npx tsc --noEmit 2>&1 | Select-Object -First 10` — chỉ còn 2 lỗi pre-existing.
- Runtime (tester): u003 thấy 12 tháng của mình (9/2026 có record nháp); u001 chọn mọi người, không có nút ghi; Xem chi tiết thấy tiêu chí + công việc + tag nguồn; tab Đơn vị không đổi; Đồng bộ tháng trống cập nhật điểm/status đúng.

# VIII. Todo
1. `load()`: bỏ `month` khỏi URL records, deps `[yearId]`.
2. `recordOf` lọc `month`; thêm `recordFor`, `computeUserFor`, `tasksFor`, `unitNameOf`.
3. Tham số hóa `handleAddMonthFor`, `handleSyncFor`, `handleSelfSubmitFor`; nối lại `SelfReviewModal`.
4. `DetailState` thêm `month`, `tasks`; thêm `openDetailFor`; sửa 2 call site.
5. `DetailModal`: render công việc gom theo tiêu chí + bucket chưa gán + tag nguồn.
6. JSX tab hồ sơ: chọn người (admin) + tóm tắt + bảng 12 tháng + thao tác theo dòng.
7. Tự review tĩnh, tsc, commit.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Người thường vào → 12 tháng của chính mình; admin → chọn mọi người.
- Mỗi dòng tháng: trạng thái, điểm cuối, xếp loại, số công việc; tháng trống hiện "Chưa thêm".
- Xem chi tiết 1 tháng → đủ bảng chỉ tiêu + danh sách công việc (cả sync lẫn kế hoạch cá nhân), tag nguồn, % hoàn thành, trạng thái, hạn.
- Nút ghi chỉ xuất hiện khi xem chính mình và theo trạng thái tháng.
- Tab "Đơn vị (quản lý)" không đổi hành vi.
- Không có lỗi TS mới.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Thấp: chỉ 1 file page, không đổi API/schema/dữ liệu.
- Rủi ro logic: `recordOf` đổi sang lọc tháng — audit tĩnh các call site console trước commit.
- Rollback: `git revert` commit.

# XI. Out of Scope (Ngoài phạm vi)
- Không API mới, không đổi schema. Không đổi luồng Hội đồng/khóa.
- Không phân trang/tìm kiếm nâng cao người.
- Không cho admin thao tác ghi cho người khác.