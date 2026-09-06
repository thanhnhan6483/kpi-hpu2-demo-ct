# I. Primer

## 1. TL;DR kiểu Feynman

- Mỗi năm học, admin gán cho từng người một **Bộ KPI mẫu cá nhân** (Giảng viên → `tpl002`, Chuyên viên/phòng ban → `tpl007`). Dữ liệu nằm ở `individual-template-assignments.json`.
- Ở trang "Kế hoạch cá nhân", người dùng thấy **Bộ KPI mẫu của tôi** (danh sách tiêu chí kèm trọng số/chỉ tiêu) và có nút **Thêm công việc** — công việc mới được gắn tiêu chí + tháng thực hiện.
- Cuối tháng, ở trang "Năng suất lao động hàng tháng", chọn năm học/tháng/đơn vị → bấm **Tổng hợp**: hệ thống gom công việc theo tiêu chí, tính điểm (trọng số × % thực hiện × hệ số minh chứng) và tự xếp loại **A ≥ 90, B ≥ 70, C < 70**.
- Người dùng **Gửi** bản tự đánh giá lên trưởng đơn vị; trưởng đơn vị/admin kiểm tra, có thể ghi nhận xét + đổi xếp loại rồi **Chốt**; bản chốt hiển thị trạng thái "Khóa".
- Thang A/B/C là module riêng, **không đụng** thang 5 mức đang dùng cho đánh giá năm (Xuất sắc/Tốt/Đạt/Cần cải thiện/Không đạt).

## 2. Elaboration & Self-Explanation

Trước đây hệ thống đã có: vị trí việc làm gắn Bộ KPI mẫu (`job-positions`), Bộ KPI mẫu cá nhân (`kpi-templates` có `targetLevel: individual`), và bảng công việc cá nhân `unit-work-plans` nhưng không biết công việc thuộc **tiêu chí nào** và **tháng nào**. Vì vậy không thể tự động tính "năng suất tháng".

Feature này nối 3 thứ lại với nhau:

1. **Gán bộ mẫu** (tầng cấu hình): admin gán một `kpiTemplateId` cho từng user theo năm học. Quy tắc đề xuất tự động: đơn vị có `type === "faculty"` → `tpl002`, còn lại → `tpl007`.
2. **Công việc gắn ngữ cảnh** (tầng dữ liệu): mỗi công việc trong `unit-work-plans` thêm các field `templateId`, `templateItemId`, `criterionCode`, `month` để "công việc này thuộc tiêu chí GV-01, tháng 9/2026".
3. **Tổng hợp & xếp loại** (tầng tính toán): `labor-productivity.json` lưu bản ghi hàng tháng của từng người gồm danh sách dòng tiêu chí (`criterionRows`), `totalScore`, `grade` và vòng đời trạng thái `draft → self_reviewed → manager_reviewed → locked`.

Công thức: mỗi tiêu chí có công việc trong tháng thì
`score(c) = min(% thực hiện trung bình, 100) × hệ số minh chứng` (có minh chứng = có kết quả/báo cáo → 1.0; thiếu → 0.5).
`totalScore = Σ(score(c) × weight(c)) / Σ weight(c)` (chỉ tính tiêu chí có công việc). Xếp loại: A ≥ 90, B ≥ 70, C < 70.

## 3. Concrete Examples & Analogies

Ví dụ bám repo: Phòng Hành chính (`u104`) nhân sự `u009` được gán `tpl007` (Bộ KPI Chuyên viên, gồm CV-01…CV-06, trọng số 25/20/15/15/15/10). Tháng đó `u009` chỉ có công việc gắn CV-01 và CV-02:
- CV-01: 4 việc, tiến độ 100/100/100/80 → trung bình 95%, có minh chứng → score 95 × 1.0 = 95.
- CV-02: 2 việc, tiến độ 80/60 → trung bình 70%, thiếu minh chứng → score 70 × 0.5 = 35.
- TotalScore = (95×25 + 35×20) / (25+20) = (2375+700)/45 = 68.3 → xếp loại C.

Analogies đời thường: giống chấm điểm tiết học — mỗi em có phiếu mục tiêu (bộ mẫu); cuối tháng giáo viên chỉ chấm những mục các em thật sự được giao việc; có bài nộp (minh chứng) mới được điểm đủ, không nộp thì mất nửa điểm mục đó.

# II. Audit Summary (Tóm tắt kiểm tra)

- Khảo sát kỹ code trước khi xây:
  - `src/app/kpi/my-work-plan/page.tsx` chỉ đọc `/api/unit-work-plans` (mọi user), không có form thêm việc, không có khái niệm tháng/tiêu chí.
  - Không tồn tại bất kỳ thuật ngữ năng suất/A/B/C/tháng nào trong hệ đánh giá hiện hữu (đánh giá năm dùng `getGrade` 5 mức theo finalScore 0–120 trong `src/lib/kpi.ts`).
  - Bảng dữ liệu sẵn dùng được: `kpi-template-items.json` (trọng số), `individual-kpis.json` (tên chỉ tiêu + target), `units.json` (`type`, `managerId`), `academic-years.json` (`ay_hpu2_2026_2027` active).
- Pattern dữ liệu bám theo `src/lib/db.ts` (`readDb`/`writeDb`/`generateId`) và route chuẩn `GET/POST/PUT/DELETE` của `job-positions` / `unit-work-plans`.
- Kiểm tra static: `npx tsc --noEmit` trước mỗi mốc — luôn chỉ còn đúng 2 lỗi **có sẵn** (`individual-plans/route.ts(28,5)` TS2353, `my-kpi/page.tsx(85,32)` TS2339), không thêm lỗi mới.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)

- Root Cause (vì sao chưa có sẵn tính năng): thiếu mảnh ghép dữ liệu — công việc không mang thông tin tiêu chí/tháng, và chưa có bảng "gán bộ mẫu theo năm học" cũng như bảng "bản ghi tháng".
- Counter-Hypothesis đã loại trừ:
  - Có thể tái dùng luôn bảng `individual-plans` (kế hoạch cá nhân theo chu kỳ)? → Không: bảng đó theo `cycleId`, không theo tháng, `items` chứa target 0 và không liên kết công việc thực tế. Giữ nguyên, không đụng.
  - Có thể dùng `LucialWorkReport` có sẵn để tính năng suất? → Không: báo cáo kết quả nhiệm vụ là tổng hợp cấp đơn vị, không phân bổ theo tiêu chí cá nhân/tháng.

# IV. Proposal (Đề xuất)

1) **Schema/dữ liệu**
- `src/types/index.ts`: mở rộng `UnitWorkTask` thêm 4 field optional; thêm `IndividualTemplateAssignment`, `LaborProductivity`, `ProductivityCriterionRow`.
- `src/data/individual-template-assignments.json`: seed 8 bản ghi cho `ay_hpu2_2026_2027` (phòng ban/trung tâm → tpl007, `u010` khối giảng dạy → tpl002).
- `src/data/labor-productivity.json`: seed `[]`.

2) **API**
- Mới: `src/app/api/individual-template-assignments/route.ts` + `[id]/route.ts` (GET filter userId/academicYearId, POST check trùng 409, PUT whitelist `kpiTemplateId`/`status`, DELETE).
- Mới: `src/app/api/labor-productivity/route.ts` + `[id]/route.ts` (GET filter, POST upsert theo `userId+month+academicYearId`, PUT whitelist, DELETE).
- Mở rộng: `unit-work-plans` POST nhận `templateId/templateItemId/criterionCode/month`; `[id]` PUT thêm 4 field vào whitelist.

3) **Tính toán** — `src/lib/laborProductivity.ts`: `aggregateByCriterion` (gom việc theo tiêu chí trong tháng), `computeMonthlyTotal` (bình quân trọng số), `gradeForScore` (A/B/C), `effectiveProgress`, `hasEvidence`, `GRADE_META`, `PRODUCTIVITY_STATUS_META`, `indicatorMeta`/`targetTextOf` (map tên/trọng số từ `individual-kpis.json`), `currentMonthKey`/`yearMonths`.

4) **UI**
- M1: `src/app/admin/individual-template-assignments/page.tsx` — lọc năm học/đơn vị, nút "Đề xuất gán theo quy tắc", modal gán/đổi/ngưng; menu Quản trị → Danh mục.
- M2: `src/app/kpi/my-work-plan/page.tsx` — card "Bộ KPI mẫu của tôi", modal "Thêm công việc" (chọn tiêu chí, tháng, chỉ tiêu, hạn), filter "Của tôi / Tất cả".
- M3: `src/app/kpi/labor-productivity/page.tsx` — chọn năm hoc/tháng/đơn vị, nút Tổng hợp → Gửi → Kiểm tra/Chốt (trưởng đơn vị `managerId` hoặc admin u001), modal chi tiết + nhận xét, xuất CSV; menu Đánh giá chất lượng.

# V. Files Impacted (Tệp bị ảnh hưởng)

**Sửa:**
- `src/types/index.ts` — interface chung; thêm field + 3 interface mới.
- `src/app/api/unit-work-plans/route.ts` — POST nhận field tiêu chí/tháng.
- `src/app/api/unit-work-plans/[id]/route.ts` — mở rộng whitelist PUT.
- `src/app/kpi/my-work-plan/page.tsx` — card bộ mẫu + thêm việc + filter phạm vi.
- `src/components/layout/Sidebar.tsx` — 2 menu: Quản trị→Danh mục, Đánh giá chất lượng.

**Thêm:**
- `src/data/individual-template-assignments.json` — seed gán bộ mẫu theo năm học.
- `src/data/labor-productivity.json` — bản ghi năng suất hàng tháng (khởi tạo rỗng).
- `src/app/api/individual-template-assignments/route.ts`, `[id]/route.ts` — CRUD gán bộ mẫu.
- `src/app/api/labor-productivity/route.ts`, `[id]/route.ts` — CRUD bản ghi tháng.
- `src/lib/laborProductivity.ts` — công thức tính điểm/xếp loại.
- `src/app/admin/individual-template-assignments/page.tsx` — trang quản trị gán bộ mẫu.
- `src/app/kpi/labor-productivity/page.tsx` — trang năng suất tháng.

# VI. Execution Preview (Xem trước thực thi)

1. Types + 2 file data + 2 bộ API mới + mở rộng `unit-work-plans` → commit M1 (`e268eff`) kèm trang admin + menu + seed.
2. M2: `my-work-plan` thêm card bộ mẫu/form thêm việc/filter → commit (`eee30a8`).
3. M3: viết `laborProductivity.ts`, trang năng suất, rút gọn helper dùng chung, thêm menu → commit (`1b2ce29`).
4. Mỗi mốc chạy `npx tsc --noEmit` — chỉ còn 2 lỗi có sẵn.

# VII. Verification Plan (Kế hoạch kiểm chứng)

- **Static (bắt buộc):** `npx tsc --noEmit` → chỉ còn 2 lỗi có sẵn đã nêu.
- **Runtime (do tester kiểm chứng, agent không tự chạy):**
  - M1: vào `/admin/individual-template-assignments`, chọn năm 2026-2027 + Phòng Hành chính → `u009` hiện "Đã gán / Bộ KPI mẫu Chuyên viên"; bấm "Đề xuất gán theo quy tắc" không tạo bản ghi trùng.
  - M2: vào `/kpi/my-work-plan` → card "Bộ KPI mẫu của tôi" hiện 6 tiêu chí CV-01…CV-06; "Thêm công việc" tạo việc gắn tiêu chí + tháng; filter "Của tôi" đúng nhân sự đăng nhập.
  - M3: vào `/kpi/labor-productivity`, chọn tháng + Phòng Hành chính → "Tổng hợp" đủ dòng tiêu chí, điểm/xếp loại đúng công thức; "Gửi" → trạng thái "Đã tự đánh giá"; tài khoản admin u001 thấy nút "Kiểm tra", "Chốt kết quả" → trạng thái "Đã chốt"; xuất CSV mở được bằng Excel, tiếng Việt không lỗi font.
- **Tiêu chí pass:** luồng full (thêm việc 1 tiêu chí tháng → tổng hợp → gửi → chốt) chạy mượt; điểm trùng công thức trong spec; không phá 2 báo cáo/report hiện hữu.

# VIII. Todo

- [x] Types + 2 file data + API (M1 phần core)
- [x] Trang admin gán bộ mẫu + seed + menu (M1)
- [x] my-work-plan: card bộ mẫu + thêm việc + filter (M2)
- [x] lib laborProductivity + trang năng suất + menu (M3)
- [x] tsc 3 mốc, 3 commit (`e268eff`, `eee30a8`, `1b2ce29`), spec

# IX. Acceptance Criteria (Tiêu chí chấp nhận)

- Admin gán/đổi/ngưng Bộ KPI mẫu theo năm học; nút đề xuất không ghi đè bản đã gán.
- Công việc mới từ my-work-plan phải lưu được `templateItemId`/`criterionCode`/`month`.
- Tổng hợp tháng ra đúng: `score(c) = min(pct,100) × (1|0.5)`, totalScore theo trọng số, grade theo ngưỡng A≥90/B≥70/C<70.
- Vòng đời: `draft → self_reviewed → manager_reviewed → locked`; bản `locked` không cho "Tổng hợp" nữa.
- Trưởng đơn vị (theo `managerId`) hoặc admin u001 mới thấy nút Kiểm tra/Chốt.
- tsc sau cùng chỉ còn 2 lỗi có sẵn; không commit 5 file data runtime đang modified.

# X. Risk / Rollback (Rủi ro / Hoàn tác)

- Rủi ro: chưa có đăng nhập thật (demo vẫn dùng fallback user u009/u001) nên phân biệt "của tôi"/"trưởng đơn vị" chỉ là heuristic. Fix/rollback: đổi hằng số fallback; không ảnh hưởng luồng tính toán.
- Rollback: 3 commit tách mốc, `git revert` từng cái an toàn; data mới nằm file riêng, không đè bảng cũ; nếu muốn xoá sạch thì bỏ 2 file data + 6 file UI/API + lib + field mới trong types/unit-work-plans.

# XI. Out of Scope (Ngoài phạm vi)

- Không đổi thang 5 mức đánh giá năm; không sửa `cycles.json`/`individual-plans`.
- Không thêm cơ chế đồng bộ phần mềm riêng cho năng suất (tái dùng `resultSource`/`syncInfo` sẵn có).
- Không nhập khẩu real data production; chỉ hoạt động trên file JSON demo.
- Không làm permission thật (auth không secret) — chừng mực heuristic.
- Không có ghi chú phê duyệt cấp trên 2 tầng (chỉ trưởng đơn vị + admin).